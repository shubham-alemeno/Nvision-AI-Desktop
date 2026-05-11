import axios from 'axios';
import * as Sentry from '@sentry/react';
import { STAGING_URL, PRODUCTION_URL } from '../../constants';

// Enhanced error types for better categorization
export interface ApiError {
  type: 'validation' | 'authentication' | 'network' | 'server' | 'unknown';
  message: string;
  retryable: boolean;
  status?: number;
  originalError?: any;
  details?: any; // Optional details property for field errors
}

// Enhanced error classification for consistent error handling
export const classifyError = (error: any): ApiError => {
  // Network errors
  if (!navigator.onLine) {
    return {
      type: 'network',
      message:
        'No internet connection. Please check your network and try again.',
      retryable: true,
    };
  }

  if (error.code === 'NETWORK_ERROR' || error.name === 'NetworkError') {
    return {
      type: 'network',
      message: 'Network error. Please check your connection and try again.',
      retryable: true,
    };
  }

  // API response errors
  if (error.response) {
    const status = error.response.status;
    const detail = error.response.data?.detail;

    switch (status) {
      case 400: {
        if (detail?.includes('credentials')) {
          return {
            type: 'authentication',
            message:
              'Invalid credentials. Please check your input and try again.',
            retryable: false,
            status,
            originalError: error, // keep original
          };
        }

        return {
          type: 'validation',
          message: 'Please check your input and try again.',
          retryable: false,
          status,
          details: error.response.data, // 🔥 Preserve the actual field errors
          originalError: error,
        };
      }

      case 401:
        return {
          type: 'authentication',
          message: 'Authentication failed. Please verify your credentials.',
          retryable: false,
          status,
        };

      case 403:
        return {
          type: 'authentication',
          message: 'Access denied. Please contact support if this persists.',
          retryable: false,
          status,
        };

      case 404:
        return {
          type: 'server',
          message:
            'Resource not found. Please check the request and try again.',
          retryable: false,
          status,
        };

      case 423:
        return {
          type: 'authentication',
          message:
            'Account is temporarily locked. Please try again later or contact support.',
          retryable: true,
          status,
        };

      case 429:
        return {
          type: 'server',
          message:
            'Too many requests. Please wait a few minutes before trying again.',
          retryable: true,
          status,
        };

      case 500:
      case 502:
      case 503:
      case 504:
        return {
          type: 'server',
          message:
            'Server is temporarily unavailable. Please try again in a few moments.',
          retryable: true,
          status,
        };

      default:
        return {
          type: 'unknown',
          message: `An error occurred (${status}). Please try again or contact support.`,
          retryable: true,
          status,
        };
    }
  }

  // Timeout errors
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return {
      type: 'network',
      message: 'Request timed out. Please check your connection and try again.',
      retryable: true,
    };
  }

  // Default fallback
  return {
    type: 'unknown',
    message: error.message || 'An unexpected error occurred. Please try again.',
    retryable: true,
    originalError: error,
  };
};

// Enhanced Sentry logging with error classification
export const logErrorToSentry = (
  error: any,
  classifiedError: ApiError,
  context: {
    location: string;
    operation: string;
    extra?: Record<string, any>;
  }
) => {
  Sentry.captureException(error, {
    tags: {
      location: context.location,
      operation: context.operation,
      error_type: classifiedError.type,
      retryable: classifiedError.retryable,
      status: classifiedError.status?.toString(),
    },
    extra: {
      ...context.extra,
      errorStatus: error.response?.status,
      userAgent: navigator.userAgent,
      online: navigator.onLine,
      classifiedMessage: classifiedError.message,
    },
    level: classifiedError.type === 'server' ? 'warning' : 'error',
  });
};

// Utility function to handle API calls with consistent error handling
export const apiCallWithErrorHandling = async <T>(
  apiCall: () => Promise<T>,
  context: {
    location: string;
    operation: string;
    extra?: Record<string, any>;
  }
): Promise<T> => {
  try {
    return await apiCall();
  } catch (error) {
    const classifiedError = classifyError(error);
    console.error(`Error in ${context.location}:`, error);
    logErrorToSentry(error, classifiedError, context);
    throw classifiedError;
  }
};

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

// Logout callback function that will be set from App.tsx
let logoutCallback: (() => void) | null = null;

let currentEnvironment = {
  isProduction: true,
  baseUrl: PRODUCTION_URL,
  environment: 'Production',
};

const getAuthToken = () => localStorage.getItem('sentinel_dash_token');
const getRefreshToken = () => localStorage.getItem('sentinel_dash_refresh');

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (newToken: string) => {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
};

// Function to set logout callback from App.tsx
export const setLogoutCallback = (callback: () => void) => {
  logoutCallback = callback;
};

// Internal logout function
const performLogout = () => {
  localStorage.removeItem('sentinel_dash_token');
  localStorage.removeItem('sentinel_dash_username');
  localStorage.removeItem('sentinel_dash_refresh');
  if (logoutCallback) {
    logoutCallback();
  }
};

export const api = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor that always uses current environment
api.interceptors.request.use(
  (config) => {
    config.baseURL = currentEnvironment.baseUrl;

    // Allow unauthenticated request for login or refresh
    if (
      config.url?.includes('/login/') &&
      !config.url?.includes('/login/refresh/')
    ) {
      return config;
    }

    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      // If no token and route is not login, logout
      performLogout();
      return Promise.reject(new Error('No authentication token found'));
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check for expired access token - handle multiple error formats
    const isTokenExpired =
      error.response?.data?.code === 'token_not_valid' ||
      error.response?.data?.error === 'Token error: Token is expired' ||
      error.response?.status === 401;

    if (isTokenExpired && !originalRequest._retry) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshToken = getRefreshToken();

          if (!refreshToken) {
            console.log('No refresh token found, logging out user');
            isRefreshing = false;
            performLogout();
            return Promise.reject(error);
          }

          const response = await axios.post(
            `${currentEnvironment.baseUrl}/login/refresh/`,
            {
              refresh: refreshToken,
            }
          );

          const { access, refresh } = response.data;

          // Save new tokens
          localStorage.setItem('sentinel_dash_token', access);
          localStorage.setItem('sentinel_dash_refresh', refresh);

          // Update the original request with new token
          originalRequest.headers.Authorization = `Bearer ${access}`;

          onRefreshed(access);
          isRefreshing = false;

          return api(originalRequest); // Retry original request
        } catch (refreshError) {
          console.error('Refresh token failed:', refreshError);
          isRefreshing = false;

          // Check if refresh also failed with token_not_valid or expired
          const isRefreshTokenExpired =
            refreshError.response?.data?.code === 'token_not_valid' ||
            refreshError.response?.data?.error ===
              'Token error: Token is expired' ||
            refreshError.response?.status === 401;

          if (isRefreshTokenExpired) {
            console.log(
              'Refresh token is also invalid/expired, logging out user'
            );
          } else {
            console.log(
              'Refresh token request failed for other reason, logging out user'
            );
          }

          performLogout();
          return Promise.reject(refreshError);
        }
      }

      // If already refreshing, wait for the refresh to complete
      return new Promise((resolve) => {
        subscribeTokenRefresh((newToken) => {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          resolve(api(originalRequest));
        });
      });
    }

    return Promise.reject(error);
  }
);

// Function to update environment state

export const updateEnvironment = (newEnvironment) => {
  currentEnvironment = { ...newEnvironment };
};

// Function to toggle environment (for web use)
export const toggleEnvironment = () => {
  currentEnvironment.isProduction = !currentEnvironment.isProduction;
  currentEnvironment.baseUrl = currentEnvironment.isProduction
    ? PRODUCTION_URL
    : STAGING_URL;
  currentEnvironment.environment = currentEnvironment.isProduction
    ? 'Production'
    : 'Staging';

  console.log('Environment toggled:', currentEnvironment);
  return { ...currentEnvironment };
};

// Function to get current environment state
export const getCurrentEnvironment = () => ({ ...currentEnvironment });

// Initialize API
export const initializeAPI = async () => {
  if (window.electronAPI) {
    try {
      const electronEnv = await window.electronAPI.getCurrentEnvironment();
      updateEnvironment(electronEnv);
      console.log('API initialized from Electron:', currentEnvironment);
    } catch (error) {
      console.error('Failed to get environment from Electron:', error);
    }
  } else {
    // Web fallback
    const envUrl = import.meta.env.VITE_BASE_URL;
    if (envUrl && envUrl.includes('staging')) {
      updateEnvironment({
        isProduction: false,
        baseUrl: STAGING_URL,
        environment: 'Staging',
      });
    }
  }
};
// Authentication
export const login = async (username: string, password: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .post('/login/', {
          username,
          password,
        })
        .then((response) => response.data),
    {
      location: 'login',
      operation: 'authentication',
      extra: { username },
    }
  );
};

// get user data from token
export const getUserFromToken = async (accessToken: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .post('/data/users/get_user_from_token/', {
          access_token: accessToken,
        })
        .then((response) => response.data),
    {
      location: 'getUserFromToken',
      operation: 'authentication',
      extra: { accessToken: accessToken ? 'present' : 'missing' },
    }
  );
};

// Display Panel
export const checkDisplayPanel = async (ppid: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .post('/data/display-panel/check_display_panel/', { ppid })
        .then((response) => response.data),
    {
      location: 'checkDisplayPanel',
      operation: 'display_panel_check',
      extra: { ppid },
    }
  );
};

export const createDisplayPanel = async (data: {
  ppid: string;
  defects?: number[];
  panel_images: Array<{
    panel: string;
    image_url: string;
    base_pattern: number;
  }>;
  test_type: 'test' | 'production';
  inference?: boolean;
  qa?: boolean;
}) => {
  return apiCallWithErrorHandling(
    () =>
      api.post('/data/display-panel/', data).then((response) => response.data),
    {
      location: 'createDisplayPanel',
      operation: 'display_panel_creation',
      extra: {
        ppid: data.ppid,
        test_type: data.test_type,
        defects_count: data.defects?.length || 0,
        images_count: data.panel_images?.length || 0,
      },
    }
  );
};

export const getTaskStatus = async (taskUuid: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .get(`/data/task/${taskUuid}/status/`)
        .then((response) => response.data),
    {
      location: 'getTaskStatus',
      operation: 'task_status_check',
      extra: { taskUuid },
    }
  );
};

// Defect mapping
const DEFECT_MAP: { [key: string]: number } = {
  def_abnormal_display: 1,
  def_horizontal_line: 2,
  def_horizontal_band: 3,
  def_vertical_line: 4,
  def_vertical_band: 5,
  def_particles: 6,
  def_white_patches: 7,
  def_polariser_scratches: 8,
  def_light_leakage: 9,
  def_mura: 10,
  def_incoming_border_patch: 11,
  def_pixel_bright_dot: 12,
  def_incoming_galaxy: 13,
  def_led_off: 14,
  def_bleeding: 15,
  def_other_defects: 17,
};

const DEFECT_ID_TO_NAME: { [key: number]: string } = {
  1: 'Abnormal Display',
  2: 'Horizontal Line',
  3: 'Horizontal Band',
  4: 'Vertical Line',
  5: 'Vertical Band',
  6: 'Particles',
  7: 'White Patches',
  8: 'Polariser Scratches',
  9: 'Light Leakage',
  10: 'Mura',
  11: 'Incoming Border Patch',
  12: 'Pixel Bright Dot',
  13: 'Incoming Galaxy',
  14: 'LED Off',
  15: 'Bleeding',
  17: 'Other Defects',
};

// Helper function to get defect ID from defect type key
const getDefectIdFromType = (defectType: string): number => {
  return DEFECT_MAP[defectType] || 1; // Default to 1 if not found
};

// Bulk create annotations
// export const bulkCreateAnnotations = async (
//   annotations: Array<{
//     panel_image: number;
//     defect: number;
//     base_pattern: number;
//     status: string;
//     x: number;
//     y: number;
//     width: number;
//     height: number;
//     notes: string;
//   }>
// ) => {
//   return apiCallWithErrorHandling(
//     () =>
//       api
//         .post('api/self-learning/annotations/bulk_create/', { annotations })
//         .then((response) => response.data),
//     {
//       location: 'bulkCreateAnnotations',
//       operation: 'bulk_annotations_create',
//       extra: {
//         annotations_count: annotations.length,
//       },
//     }
//   );
// };

export const submitSelfLearning = async (data: {
  ppid: string;
  test_type: 'test' | 'production';
  panel_images: Array<{
    id: number;
    panel: string;
    base_pattern: number;
    image_url: string;
  }>;
  bounding_boxes: {
    [key: number]: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      defect_type: string;
      drawn_on_pattern: number;
    }>;
  };
  imageWidth?: number;
  imageHeight?: number;
}) => {
  return apiCallWithErrorHandling(
    async () => {
      // Use provided dimensions or default to common resolution
      const imageWidth = data.imageWidth || 1920;
      const imageHeight = data.imageHeight || 1080;

      console.log(
        `Normalizing coordinates with image dimensions: ${imageWidth}x${imageHeight}`
      );

      // Collect unique defects used in annotations
      const uniqueDefects = new Set<number>();

      // Build panel_images array with nested annotations
      const panelImagesWithAnnotations = data.panel_images.map(
        (panelImage, index) => {
          const boxes = data.bounding_boxes[index] || [];

          console.log(`Processing pattern ${index + 1}: ${boxes.length} boxes`);

          // Create annotations array for this specific panel
          const annotations = boxes.map((box) => {
            // Normalize coordinates to 0-1 range
            const normalizedX = box.x / imageWidth;
            const normalizedY = box.y / imageHeight;
            const normalizedWidth = box.width / imageWidth;
            const normalizedHeight = box.height / imageHeight;

            const defectId = getDefectIdFromType(box.defect_type);
            uniqueDefects.add(defectId);

            // Check if this annotation is visible on current pattern
            // visible_on is true if drawn on this pattern, false if replicated
            const visibleOn = box.drawn_on_pattern === index;

            return {
              defect: defectId,
              x: normalizedX,
              y: normalizedY,
              width: normalizedWidth,
              height: normalizedHeight,
              visible_on: visibleOn,
              status: 'pending',
              notes: '',
            };
          });

          return {
            id: panelImage.id,
            base_pattern: panelImage.base_pattern,
            image_url: panelImage.image_url,
            annotations: annotations,
          };
        }
      );

      console.log('Panel images with annotations:', panelImagesWithAnnotations);

      const defects = Array.from(uniqueDefects).map((defectId) => ({
        id: defectId,
        name: DEFECT_ID_TO_NAME[defectId] || `Defect ${defectId}`,
      }));

      // Complete payload structure with annotations grouped by panel_images
      const payload = {
        ppid: data.ppid,
        test_type: data.test_type,
        defects: defects,
        panel_images: panelImagesWithAnnotations,
      };

      console.log('Payload to submit:', payload);

      const annotationsResponse = await api
        .post('api/self-learning/annotations/bulk_create/', payload)
        .then((response) => response.data);

      console.log('Annotations created:', annotationsResponse);

      // Handle partial success or errors
      if (annotationsResponse.status === 'partial_success') {
        console.warn(
          `Partial success: ${annotationsResponse.created_count} created, ${annotationsResponse.error_count} failed`,
          annotationsResponse.errors
        );

        return {
          success: true,
          message: `Partial success: ${annotationsResponse.created_count} annotations created, ${annotationsResponse.error_count} failed`,
          annotations: annotationsResponse,
          hasErrors: true,
        };
      }

      if (annotationsResponse.status === 'error') {
        throw new Error(
          `Failed to create annotations: ${annotationsResponse.error_count} errors`
        );
      }

      return {
        success: true,
        message: `Successfully created ${annotationsResponse.created_count} annotations`,
        annotations: annotationsResponse,
      };
    },
    {
      location: 'submitSelfLearning',
      operation: 'self_learning_submission',
      extra: {
        ppid: data.ppid,
        boxes_count: Object.values(data.bounding_boxes).reduce(
          (sum, boxes) => sum + boxes.length,
          0
        ),
      },
    }
  );
};

export const retryDisplayPanel = async (displayUuid: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .post(`/data/display-panel/retry/${displayUuid}/`)
        .then((response) => response.data),
    {
      location: 'retryDisplayPanel',
      operation: 'display_panel_retry',
      extra: { displayUuid },
    }
  );
};

// Helper function to get the latest task from retry response
export const getLatestTask = (retryResponse: any) => {
  if (!retryResponse.tasks || retryResponse.tasks.length === 0) {
    return null;
  }

  // Sort tasks by created_at in descending order to get the latest
  const sortedTasks = retryResponse.tasks.sort(
    (a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return sortedTasks[0];
};

//Feedback
export const submitFeedback = async (
  taskUuid: string,
  feedback: Record<string, { feedback: boolean }>,
  qa: boolean = false
) => {
  return apiCallWithErrorHandling(
    () => {
      const queryParams = new URLSearchParams();
      if (qa) queryParams.append('qa', 'true');

      const url = `/data/task/${taskUuid}/feedback/${
        queryParams.toString() ? `?${queryParams.toString()}` : ''
      }`;

      return api.post(url, { feedback }).then((response) => response.data);
    },
    {
      location: 'submitFeedback',
      operation: 'feedback_submission',
      extra: {
        taskUuid,
        feedbackCount: Object.keys(feedback).length,
        qa: qa.toString(),
      },
    }
  );
};

// Defect Management
export const getDefects = async () => {
  return apiCallWithErrorHandling(
    () => api.get('/data/defect/').then((response) => response.data),
    {
      location: 'getDefects',
      operation: 'defects_fetch',
    }
  );
};

//Past Data

export const getPastTasks = async (params: {
  page?: number;
  from_date?: string;
  to_date?: string;
  ppid?: string;
  group?: boolean;
  test_type?: string;
  qa?: boolean;
}) => {
  return apiCallWithErrorHandling(
    () => {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.from_date) queryParams.append('from_date', params.from_date);
      if (params.to_date) queryParams.append('to_date', params.to_date);
      if (params.ppid) queryParams.append('ppid', params.ppid);
      if (params.test_type) queryParams.append('test_type', params.test_type);

      queryParams.append('group', (params.group || false).toString());
      queryParams.append('qa', (params.qa || false).toString());

      return api
        .get(`/data/task/past_tasks/?${queryParams.toString()}`)
        .then((response) => response.data);
    },
    {
      location: 'getPastTasks',
      operation: 'past_tasks_fetch',
    }
  );
};

// Alternative approach: Create a separate function specifically for export
export const getPastTasksForExport = async (params: {
  from_date?: string;
  to_date?: string;
  ppid?: string;
  group?: boolean;
  test_type?: string;
  qa?: boolean;
}) => {
  return apiCallWithErrorHandling(
    () => {
      const queryParams = new URLSearchParams();
      // Intentionally exclude page parameter for unpaginated results
      if (params.from_date) queryParams.append('from_date', params.from_date);
      if (params.to_date) queryParams.append('to_date', params.to_date);
      if (params.ppid) queryParams.append('ppid', params.ppid);
      if (params.test_type) queryParams.append('test_type', params.test_type);
      queryParams.append('group', (params.group || false).toString());
      queryParams.append('qa', (params.qa || false).toString());

      return api
        .get(`/data/task/past_tasks/?${queryParams.toString()}`)
        .then((response) => response.data);
    },
    {
      location: 'getPastTasksForExport',
      operation: 'past_tasks_export_fetch',
    }
  );
};

// Live Accuracy
export const getLiveAccuracy = async (params?: {
  from_date?: string;
  to_date?: string;
  start_date?: string;
  end_date?: string;
  ppid_filter?: string;
  ppid?: string[];
  group?: boolean;
  test_type?: string;
  status?: string;
  qa?: boolean;
}) => {
  return apiCallWithErrorHandling(
    () => {
      const queryParams = new URLSearchParams();
      if (params?.from_date) queryParams.append('from_date', params.from_date);
      if (params?.to_date) queryParams.append('to_date', params.to_date);
      if (params?.start_date)
        queryParams.append('start_date', params.start_date);
      if (params?.end_date) queryParams.append('end_date', params.end_date);
      if (params?.ppid_filter)
        queryParams.append('ppid_filter', params.ppid_filter);
      if (params?.ppid) {
        params.ppid.forEach((p) => queryParams.append('ppid', p));
      }
      if (params?.group !== undefined)
        queryParams.append('group', params.group.toString());
      if (params?.test_type) queryParams.append('test_type', params.test_type);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.qa !== undefined)
        queryParams.append('qa', params.qa.toString());

      return api
        .get(`/data/task/live-accuracy/?${queryParams.toString()}`)
        .then((response) => response.data);
    },
    {
      location: 'getLiveAccuracy',
      operation: 'live_accuracy_fetch',
      extra: { qa: params?.qa?.toString() },
    }
  );
};

// Statistics
export const getPanelStats = async () => {
  return apiCallWithErrorHandling(
    () =>
      api
        .get('/data/panel-image-search/stats/')
        .then((response) => response.data),
    {
      location: 'getPanelStats',
      operation: 'panel_stats_fetch',
    }
  );
};

// Inference Usage
export const getInferenceUsage = async (qa: boolean = false) => {
  return apiCallWithErrorHandling(
    () => {
      const queryParams = new URLSearchParams();
      queryParams.append('qa', qa.toString());

      return api
        .get(`/data/inference-usage/my-usage/?${queryParams.toString()}`)
        .then((response) => response.data);
    },
    {
      location: 'getInferenceUsage',
      operation: 'inference_usage_fetch',
      extra: { qa: qa.toString() },
    }
  );
};

export const getGroupInferenceUsage = async (qa: boolean = false) => {
  return apiCallWithErrorHandling(
    () => {
      const queryParams = new URLSearchParams();
      queryParams.append('qa', qa.toString());

      return api
        .get(`/data/inference-usage/group-usage/?${queryParams.toString()}`)
        .then((response) => response.data);
    },
    {
      location: 'getGroupInferenceUsage',
      operation: 'group_inference_usage_fetch',
      extra: { qa: qa.toString() },
    }
  );
};

//admin account creation

// Get all users with optional filtering
export const getUsers = async (params?: {
  search?: string;
  is_active?: boolean;
  is_staff?: boolean;
  page?: number;
  page_size?: number;
}) => {
  return apiCallWithErrorHandling(
    () => {
      const queryParams = new URLSearchParams();
      if (params?.search) queryParams.append('search', params.search);
      if (params?.is_active !== undefined)
        queryParams.append('is_active', params.is_active.toString());
      if (params?.is_staff !== undefined)
        queryParams.append('is_staff', params.is_staff.toString());
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.page_size)
        queryParams.append('page_size', params.page_size.toString());

      return api
        .get(`/data/users/?${queryParams.toString()}`)
        .then((response) => response.data);
    },
    {
      location: 'getUsers',
      operation: 'users_fetch',
    }
  );
};

// Get user details by ID
export const getUserById = async (id: number) => {
  return apiCallWithErrorHandling(
    () => api.get(`/data/users/${id}/`).then((response) => response.data),
    {
      location: 'getUserById',
      operation: 'user_details_fetch',
      extra: { user_id: id.toString() },
    }
  );
};

// Create new user
export const createUser = async (userData) => {
  return apiCallWithErrorHandling(
    () => api.post('/data/users/', userData).then((response) => response.data),
    {
      location: 'createUser',
      operation: 'user_create',
    }
  );
};

// Create new supervisor
export const createSupervisor = async (userData) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .post('/data/users/create_supervisor/', userData)
        .then((response) => response.data),
    {
      location: 'createSupervisor',
      operation: 'supervisor_create',
    }
  );
};

// Update user
export const updateUser = async (id: number, userData) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .patch(`/data/users/${id}/`, userData)
        .then((response) => response.data),
    {
      location: 'updateUser',
      operation: 'user_update',
      extra: { user_id: id.toString() },
    }
  );
};

// Delete user
export const deleteUser = async (id: number) => {
  return apiCallWithErrorHandling(
    () => api.delete(`/data/users/${id}/`).then((response) => response.data),
    {
      location: 'deleteUser',
      operation: 'user_delete',
      extra: { user_id: id.toString() },
    }
  );
};

// Set user password
export const setUserPassword = async (id: number, passwordData) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .post(`/data/users/${id}/set_password/`, passwordData)
        .then((response) => response.data),
    {
      location: 'setUserPassword',
      operation: 'user_password_set',
      extra: { user_id: id.toString() },
    }
  );
};

// Toggle user active status
export const toggleUserActive = async (id: number) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .post(`/data/users/${id}/toggle_active/`)
        .then((response) => response.data),
    {
      location: 'toggleUserActive',
      operation: 'user_active_toggle',
      extra: { user_id: id.toString() },
    }
  );
};

// Toggle user staff status
export const toggleUserStaff = async (id: number) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .post(`/data/users/${id}/toggle_staff/`)
        .then((response) => response.data),
    {
      location: 'toggleUserStaff',
      operation: 'user_staff_toggle',
      extra: { user_id: id.toString() },
    }
  );
};

// Get user statistics
export const getUserStats = async () => {
  return apiCallWithErrorHandling(
    () => api.get('/data/users/stats/').then((response) => response.data),
    {
      location: 'getUserStats',
      operation: 'user_stats_fetch',
    }
  );
};

// Health Check
export const getHealthCheck = async () => {
  return apiCallWithErrorHandling(
    () => api.get('/data/health/').then((response) => response.data),
    {
      location: 'getHealthCheck',
      operation: 'health_check',
    }
  );
};

// Self Learning / Annotation Statistics API
export const getAnnotationStatsOverview = async (params?: {
  from_date?: string;
  to_date?: string;
  annotator?: number;
  defect?: number;
  pattern?: number;
  status?: 'pending' | 'approved' | 'rejected';
}) => {
  return apiCallWithErrorHandling(
    () => {
      const queryParams = new URLSearchParams();
      if (params?.from_date) queryParams.append('from_date', params.from_date);
      if (params?.to_date) queryParams.append('to_date', params.to_date);
      if (params?.annotator)
        queryParams.append('annotator', params.annotator.toString());
      if (params?.defect)
        queryParams.append('defect', params.defect.toString());
      if (params?.pattern)
        queryParams.append('pattern', params.pattern.toString());
      if (params?.status) queryParams.append('status', params.status);

      return api
        .get(
          `api/self-learning/annotations/statistics/?${queryParams.toString()}`
        )
        .then((response) => response.data);
    },
    {
      location: 'getAnnotationStatsOverview',
      operation: 'annotation_stats_overview_fetch',
    }
  );
};

export const getAnnotationStatsPanels = async (params?: {
  from_date?: string;
  to_date?: string;
  defect?: number;
  pattern?: number;
  test_type?: 'production' | 'test';
  annotator?: number;
}) => {
  return apiCallWithErrorHandling(
    () => {
      const queryParams = new URLSearchParams();
      if (params?.from_date) queryParams.append('from_date', params.from_date);
      if (params?.to_date) queryParams.append('to_date', params.to_date);
      if (params?.defect)
        queryParams.append('defect', params.defect.toString());
      if (params?.pattern)
        queryParams.append('pattern', params.pattern.toString());
      if (params?.test_type) queryParams.append('test_type', params.test_type);
      if (params?.annotator)
        queryParams.append('annotator', params.annotator.toString());

      return api
        .get(
          `/api/self-learning/annotation-stats/panels/?${queryParams.toString()}`
        )
        .then((response) => response.data);
    },
    {
      location: 'getAnnotationStatsPanels',
      operation: 'annotation_stats_panels_fetch',
    }
  );
};

export const getAnnotationStatsBreakdown = async (params: {
  category: 'defect' | 'pattern' | 'annotator' | 'status' | 'date';
  from_date?: string;
  to_date?: string;
  defect?: number;
  pattern?: number;
  annotator?: number;
}) => {
  return apiCallWithErrorHandling(
    () => {
      const queryParams = new URLSearchParams();
      queryParams.append('category', params.category);
      if (params?.from_date) queryParams.append('from_date', params.from_date);
      if (params?.to_date) queryParams.append('to_date', params.to_date);
      if (params?.defect)
        queryParams.append('defect', params.defect.toString());
      if (params?.pattern)
        queryParams.append('pattern', params.pattern.toString());
      if (params?.annotator)
        queryParams.append('annotator', params.annotator.toString());

      return api
        .get(
          `/api/self-learning/annotation-stats/breakdown/?${queryParams.toString()}`
        )
        .then((response) => response.data);
    },
    {
      location: 'getAnnotationStatsBreakdown',
      operation: 'annotation_stats_breakdown_fetch',
    }
  );
};

export const getAnnotationStatsTrainingUsage = async (params?: {
  defect_id?: number;
  pattern_id?: number;
  test_type?: 'production' | 'test';
  page?: number;
  page_size?: number;
}) => {
  return apiCallWithErrorHandling(
    () => {
      const queryParams = new URLSearchParams();
      if (params?.defect_id)
        queryParams.append('defect_id', params.defect_id.toString());
      if (params?.pattern_id)
        queryParams.append('pattern_id', params.pattern_id.toString());
      if (params?.test_type) queryParams.append('test_type', params.test_type);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.page_size)
        queryParams.append('page_size', params.page_size.toString());

      return api
        .get(
          `/api/self-learning/annotation-stats/training-usage/?${queryParams.toString()}`
        )
        .then((response) => response.data);
    },
    {
      location: 'getAnnotationStatsTrainingUsage',
      operation: 'annotation_stats_training_usage_fetch',
    }
  );
};

// PPID Annotation API
export const getAnnotationPPIDList = async (params?: {
  ppid?: string;
  test_type?: 'production' | 'test';
  status?: 'pending' | 'approved' | 'rejected';
  defect?: number;
  pattern?: number;
  created_by?: number;
  from_date?: string;
  to_date?: string;
  page?: number;
  page_size?: number;
}) => {
  return apiCallWithErrorHandling(
    () => {
      const queryParams = new URLSearchParams();
      if (params?.ppid) queryParams.append('ppid', params.ppid);
      if (params?.test_type) queryParams.append('test_type', params.test_type);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.defect)
        queryParams.append('defect', params.defect.toString());
      if (params?.pattern)
        queryParams.append('pattern', params.pattern.toString());
      if (params?.created_by)
        queryParams.append('created_by', params.created_by.toString());
      if (params?.from_date) queryParams.append('from_date', params.from_date);
      if (params?.to_date) queryParams.append('to_date', params.to_date);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.page_size)
        queryParams.append('page_size', params.page_size.toString());

      return api
        .get(
          `/api/self-learning/annotation-ppid/list/?${queryParams.toString()}`
        )
        .then((response) => response.data);
    },
    {
      location: 'getAnnotationPPIDList',
      operation: 'annotation_ppid_list_fetch',
    }
  );
};

export const getAnnotationPPIDDetails = async (ppid: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .get(`/api/self-learning/annotation-ppid/${ppid}/`)
        .then((response) => response.data),
    {
      location: 'getAnnotationPPIDDetails',
      operation: 'annotation_ppid_details_fetch',
      extra: { ppid },
    }
  );
};

export const validateAnnotationPPIDs = async (ppids: string[]) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .post('/api/self-learning/annotation-ppid/validate/', { ppids })
        .then((response) => response.data),
    {
      location: 'validateAnnotationPPIDs',
      operation: 'annotation_ppid_validate',
      extra: { ppids_count: ppids.length },
    }
  );
};

// Bulk update annotation status - flexible API
export const bulkUpdateAnnotationStatus = async (data: {
  display_panels: Array<{
    ppid: string;
    action?: 'approve' | 'reject';
    notes?: string;
    panel_images?: Array<{
      panel_image_id: number;
      action: 'approve' | 'reject';
      notes?: string;
    }>;
    annotations?: Array<{
      annotation_id: number;
      action: 'approve' | 'reject';
      notes?: string;
    }>;
  }>;
}) => {
  console.log(
    'API call - bulkUpdateAnnotationStatus payload:',
    JSON.stringify(data, null, 2)
  );
  return apiCallWithErrorHandling(
    () =>
      api
        .post(
          '/api/self-learning/annotations/bulk_update_annotation_status/',
          data
        )
        .then((response) => response.data),
    {
      location: 'bulkUpdateAnnotationStatus',
      operation: 'bulk_annotation_status_update',
      extra: { panels_count: data.display_panels.length },
    }
  );
};

// Simple bulk update by annotation IDs
export const bulkUpdateStatus = async (data: {
  annotation_ids: number[];
  status: 'approved' | 'rejected' | 'pending';
}) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .post('/api/self-learning/annotations/bulk_update_status/', data)
        .then((response) => response.data),
    {
      location: 'bulkUpdateStatus',
      operation: 'bulk_status_update',
      extra: { annotations_count: data.annotation_ids.length },
    }
  );
};

// Delete single annotation by ID
export const deleteAnnotation = async (annotationId: number) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .delete(`/api/self-learning/annotations/${annotationId}/`)
        .then((response) => response.data),
    {
      location: 'deleteAnnotation',
      operation: 'annotation_delete',
      extra: { annotation_id: annotationId },
    }
  );
};

// Delete multiple annotations (calls DELETE for each)
export const deleteAnnotations = async (annotationIds: number[]) => {
  const results = await Promise.allSettled(
    annotationIds.map((id) => deleteAnnotation(id))
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.error('Some deletions failed:', failed);
    throw new Error(`Failed to delete ${failed.length} annotation(s)`);
  }

  return { deleted: annotationIds.length };
};

// Add new annotation
export const addAnnotation = async (data: {
  panel_image: number;
  defect: number;
  x: number;
  y: number;
  width: number;
  height: number;
  status?: 'pending' | 'approved' | 'rejected';
  visible_on?: boolean;
  notes?: string;
}) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .post('/api/self-learning/annotations/', {
          ...data,
          status: data.status || 'pending',
          visible_on: data.visible_on !== undefined ? data.visible_on : true,
        })
        .then((response) => response.data),
    {
      location: 'addAnnotation',
      operation: 'annotation_create',
      extra: { panel_image: data.panel_image, defect: data.defect },
    }
  );
};

// Add multiple annotations (calls POST for each)
export const addAnnotations = async (
  annotations: Array<{
    panel_image: number;
    defect: number;
    x: number;
    y: number;
    width: number;
    height: number;
    status?: 'pending' | 'approved' | 'rejected';
    visible_on?: boolean;
    notes?: string;
  }>
) => {
  const results = await Promise.allSettled(
    annotations.map((ann) => addAnnotation(ann))
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    console.error('Some additions failed:', failed);
    throw new Error(`Failed to add ${failed.length} annotation(s)`);
  }

  const created = results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
    .map((r) => r.value);

  return { created, count: created.length };
};

// Bulk create PPID annotation - creates same annotation across all 15 patterns
export const bulkCreatePPIDAnnotation = async (data: {
  ppid: string;
  defect: number;
  x: number;
  y: number;
  width: number;
  height: number;
  visible_on?: boolean;
  status?: 'pending' | 'approved' | 'rejected';
  notes?: string;
}) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .post('/api/self-learning/annotations/bulk_create_ppid_annotation/', {
          ...data,
          status: data.status || 'pending',
          visible_on: data.visible_on !== undefined ? data.visible_on : true,
        })
        .then((response) => response.data),
    {
      location: 'bulkCreatePPIDAnnotation',
      operation: 'bulk_create_ppid_annotation',
      extra: { ppid: data.ppid, defect: data.defect },
    }
  );
};

// Bulk update PPID annotation bbox - updates all instances of a defect type across all 15 patterns
export const bulkUpdatePPIDAnnotation = async (data: {
  ppid: string;
  defect: number;
  x: number;
  y: number;
  width: number;
  height: number;
  panel_image_ids?: number[];
  visible_on?: boolean;
  status?: 'pending' | 'approved' | 'rejected';
  notes?: string;
}) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .patch('/api/self-learning/annotations/bulk_update_ppid_annotation/', data)
        .then((response) => response.data),
    {
      location: 'bulkUpdatePPIDAnnotation',
      operation: 'bulk_update_ppid_annotation',
      extra: { ppid: data.ppid, defect: data.defect },
    }
  );
};

// Bulk delete PPID annotation - deletes all annotations of a defect type across all 15 patterns
export const bulkDeletePPIDAnnotation = async (data: {
  ppid: string;
  defect: number;
}) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .post(
          '/api/self-learning/annotations/bulk_delete_ppid_annotation/',
          data
        )
        .then((response) => response.data),
    {
      location: 'bulkDeletePPIDAnnotation',
      operation: 'bulk_delete_ppid_annotation',
      extra: { ppid: data.ppid, defect: data.defect },
    }
  );
};

// Annotate existing panel from past data
export const annotateExistingPanel = async (data: {
  ppid: string;
  annotations: Array<{
    panel_image_id: number;
    defect: number;
    x: number;
    y: number;
    width: number;
    height: number;
    visible_on?: boolean;
    status?: string;
    notes?: string;
  }>;
}) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .post(
          '/api/self-learning/annotations/annotate_existing_panel/',
          data
        )
        .then((response) => response.data),
    {
      location: 'annotateExistingPanel',
      operation: 'annotate_existing_panel',
      extra: { ppid: data.ppid, annotations_count: data.annotations.length },
    }
  );
};

// Unannotated Panels API
export const getUnannotatedPanels = async (params?: {
  page?: number;
  page_size?: number;
  include_images?: boolean;
  include_group_members?: boolean;
  ppid?: string;
  test_type?: string;
  from_date?: string;
  to_date?: string;
  ordering?: string;
}) => {
  return apiCallWithErrorHandling(
    () => {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
      if (params?.include_images !== undefined) queryParams.append('include_images', params.include_images.toString());
      if (params?.include_group_members !== undefined) queryParams.append('include_group_members', params.include_group_members.toString());
      if (params?.ppid) queryParams.append('ppid', params.ppid);
      if (params?.test_type) queryParams.append('test_type', params.test_type);
      if (params?.from_date) queryParams.append('from_date', params.from_date);
      if (params?.to_date) queryParams.append('to_date', params.to_date);
      if (params?.ordering) queryParams.append('ordering', params.ordering);
      return api
        .get(`/api/self-learning/unannotated-panels/?${queryParams.toString()}`)
        .then((response) => response.data);
    },
    {
      location: 'getUnannotatedPanels',
      operation: 'unannotated_panels_fetch',
    }
  );
};

export const getUnannotatedPanelDetail = async (ppid: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .get(`/api/self-learning/unannotated-panels/${ppid}/`)
        .then((response) => response.data),
    {
      location: 'getUnannotatedPanelDetail',
      operation: 'unannotated_panel_detail_fetch',
      extra: { ppid },
    }
  );
};

// Batch Training System API
export const createBatch = async (data: {
  name: string;
  description?: string;
  defect_ids: number[];
  min_approved_annotations_threshold?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .post('/api/self-learning/batches/', data)
        .then((response) => response.data),
    {
      location: 'createBatch',
      operation: 'batch_create',
      extra: { defects_count: data.defect_ids.length },
    }
  );
};

export const getBatches = async (params?: {
  status?:
    | 'draft'
    | 'in_review'
    | 'ready_for_training'
    | 'training'
    | 'completed';
  defect_id?: number;
  is_locked?: boolean;
  page?: number;
  page_size?: number;
}) => {
  return apiCallWithErrorHandling(
    () => {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append('status', params.status);
      if (params?.defect_id)
        queryParams.append('defect_id', params.defect_id.toString());
      if (params?.is_locked !== undefined)
        queryParams.append('is_locked', params.is_locked.toString());
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.page_size)
        queryParams.append('page_size', params.page_size.toString());

      return api
        .get(`/api/self-learning/batches/?${queryParams.toString()}`)
        .then((response) => response.data);
    },
    {
      location: 'getBatches',
      operation: 'batches_fetch',
    }
  );
};

export const getBatchDetails = async (slug: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .get(`/api/self-learning/batches/${slug}/`)
        .then((response) => response.data),
    {
      location: 'getBatchDetails',
      operation: 'batch_details_fetch',
      extra: { slug },
    }
  );
};

export const updateBatch = async (
  slug: string,
  data: {
    name?: string;
    description?: string;
    status?: string;
    min_approved_annotations_threshold?: number;
    tags?: string[];
  }
) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .patch(`/api/self-learning/batches/${slug}/`, data)
        .then((response) => response.data),
    {
      location: 'updateBatch',
      operation: 'batch_update',
      extra: { slug },
    }
  );
};

export const deleteBatch = async (slug: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .delete(`/api/self-learning/batches/${slug}/`)
        .then((response) => response.data),
    {
      location: 'deleteBatch',
      operation: 'batch_delete',
      extra: { slug },
    }
  );
};

export const addDefectsToBatch = async (slug: string, defect_ids: number[]) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .post(`/api/self-learning/batches/${slug}/add_defects/`, { defect_ids })
        .then((response) => response.data),
    {
      location: 'addDefectsToBatch',
      operation: 'batch_add_defects',
      extra: { slug, defects_count: defect_ids.length },
    }
  );
};

export const removeDefectsFromBatch = async (
  slug: string,
  defect_ids: number[]
) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .post(`/api/self-learning/batches/${slug}/remove_defects/`, {
          defect_ids,
        })
        .then((response) => response.data),
    {
      location: 'removeDefectsFromBatch',
      operation: 'batch_remove_defects',
      extra: { slug, defects_count: defect_ids.length },
    }
  );
};

export const getBatchStatistics = async (slug: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .get(`/api/self-learning/batches/${slug}/statistics/`)
        .then((response) => response.data),
    {
      location: 'getBatchStatistics',
      operation: 'batch_statistics_fetch',
      extra: { slug },
    }
  );
};

export const validateTrainingReadiness = async (slug: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .get(`/api/self-learning/batches/${slug}/validate_training_readiness/`)
        .then((response) => response.data),
    {
      location: 'validateTrainingReadiness',
      operation: 'batch_validate_training',
      extra: { slug },
    }
  );
};

export const triggerTraining = async (
  slug: string,
  params: {
    dataset_task_id: string;
    model_display_name?: string;
    description?: string;
    model_type?: string;
    edge_model_type?: string;
    training_budget_hours?: number;
    vertex_dataset_id: string;
    training_parameters?: {
      epochs?: number;
      batch_size?: number;
      learning_rate?: number;
      optimizer?: string;
    };
  }
) => {
  const payload = {
    dataset_task_id: params.dataset_task_id,
    vertex_dataset_id: params.vertex_dataset_id,
    model_display_name:
      params.model_display_name ||
      `Model Training ${new Date().toLocaleDateString()}`,
    description: params.description || `Training model for defect detection`,
    model_type: params.model_type || 'object_detection',
    edge_model_type: params.edge_model_type || 'MOBILE_TF_VERSATILE_1',
    training_budget_hours: params.training_budget_hours || 8,
    training_parameters: params.training_parameters || {},
  };

  return apiCallWithErrorHandling(
    () =>
      api
        .post(`/api/self-learning/batches/${slug}/trigger_training/`, payload)
        .then((response) => response.data),
    {
      location: 'triggerTraining',
      operation: 'batch_trigger_training',
      extra: { slug },
    }
  );
};

export const getBatchTrainingProgress = async (slug: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .get(`/api/self-learning/batches/${slug}/training-progress/`)
        .then((response) => response.data),
    {
      location: 'getBatchTrainingProgress',
      operation: 'batch_training_progress_fetch',
      extra: { slug },
    }
  );
};

/**
 * Get model training status using the lightweight status endpoint
 * This is the recommended approach for polling training progress
 */
export const getModelTrainingStatus = async (taskUuid: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .get(`/api/self-learning/model-training/${taskUuid}/status/`)
        .then((response) => response.data),
    {
      location: 'getModelTrainingStatus',
      operation: 'model_training_status_fetch',
      extra: { taskUuid },
    }
  );
};

export const getBatchStatus = async (slug: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .get(`/api/self-learning/batches/${slug}/status/`)
        .then((response) => response.data),
    {
      location: 'getBatchStatus',
      operation: 'batch_status_fetch',
      extra: { slug },
    }
  );
};

export const getBatchTrainingLogs = async (slug: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .get(`/api/self-learning/batches/${slug}/training_logs/`)
        .then((response) => response.data),
    {
      location: 'getBatchTrainingLogs',
      operation: 'batch_training_logs_fetch',
      extra: { slug },
    }
  );
};

export const lockBatch = async (slug: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .post(`/api/self-learning/batches/${slug}/lock/`)
        .then((response) => response.data),
    {
      location: 'lockBatch',
      operation: 'batch_lock',
      extra: { slug },
    }
  );
};

export const createDataset = async (data: {
  batch_slug: string;
  description?: string;
  test_type?: 'production' | 'test';
  ppids?: string[];
  defect_names?: string[];
  start_date?: string;
  end_date?: string;
}) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .post('/api/self-learning/dataset-creation/', data)
        .then((response) => response.data),
    {
      location: 'createDataset',
      operation: 'dataset_creation',
      extra: { batch_slug: data.batch_slug },
    }
  );
};

export const getBatchPPIDs = async (slug: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .get(`/api/self-learning/batches/${slug}/get_batch_ppids/`)
        .then((response) => response.data),
    {
      location: 'getBatchPPIDs',
      operation: 'batch_ppids_fetch',
      extra: { slug },
    }
  );
};

export const getAllBatchStatistics = async () => {
  return apiCallWithErrorHandling(
    () =>
      api
        .get('/api/self-learning/batches/all_statistics/')
        .then((response) => response.data),
    {
      location: 'getAllBatchStatistics',
      operation: 'all_batch_statistics_fetch',
    }
  );
};

export const getDatasetCreationTaskStatus = async (taskUuid: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .get(`/api/self-learning/dataset-creation/tasks/${taskUuid}/`)
        .then((response) => response.data),
    {
      location: 'getDatasetCreationTaskStatus',
      operation: 'dataset_task_status_fetch',
      extra: { taskUuid },
    }
  );
};

export const getDefectOverview = async () => {
  return apiCallWithErrorHandling(
    () =>
      api
        .get('/api/self-learning/defect-overview/')
        .then((response) => response.data),
    {
      location: 'getDefectOverview',
      operation: 'defect_overview_fetch',
    }
  );
};

/**
 * Get pipeline status for a batch - single endpoint for training, deployment, and benchmark status
 * This is the preferred API for polling pipeline progress
 */
export const getBatchPipelineStatus = async (slug: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .get(`/api/self-learning/batches/${slug}/pipeline-status/`)
        .then((response) => response.data),
    {
      location: 'getBatchPipelineStatus',
      operation: 'batch_pipeline_status_fetch',
      extra: { slug },
    }
  );
};

export const getBatchAnnotations = async (
  slug: string,
  params?: {
    status?: 'pending' | 'approved' | 'rejected';
    defect_id?: number;
    pattern_id?: number;
    page?: number;
    page_size?: number;
  }
) => {
  return apiCallWithErrorHandling(
    () => {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append('status', params.status);
      if (params?.defect_id)
        queryParams.append('defect_id', params.defect_id.toString());
      if (params?.pattern_id)
        queryParams.append('pattern_id', params.pattern_id.toString());
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.page_size)
        queryParams.append('page_size', params.page_size.toString());

      return api
        .get(
          `/api/self-learning/batches/${slug}/annotations/?${queryParams.toString()}`
        )
        .then((response) => response.data);
    },
    {
      location: 'getBatchAnnotations',
      operation: 'batch_annotations_fetch',
      extra: { slug },
    }
  );
};

// ==================== DEPLOYMENT APIs ====================

/**
 * Get list of model deployments with optional filters
 */
export const getModelDeploymentList = async (params?: {
  batch_uuid?: string;
  status?: string;
  training_task_uuid?: string;
  page?: number;
  page_size?: number;
}) => {
  return apiCallWithErrorHandling(
    () => {
      const queryParams = new URLSearchParams();
      if (params?.batch_uuid)
        queryParams.append('batch_uuid', params.batch_uuid);
      if (params?.status) queryParams.append('status', params.status);
      if (params?.training_task_uuid)
        queryParams.append('training_task_uuid', params.training_task_uuid);
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.page_size)
        queryParams.append('page_size', params.page_size.toString());

      return api
        .get(
          `/api/self-learning/model-deployment/list/?${queryParams.toString()}`
        )
        .then((response) => response.data);
    },
    {
      location: 'getModelDeploymentList',
      operation: 'deployment_list_fetch',
      extra: params,
    }
  );
};

/**
 * Get deployment status for a specific task
 */
export const getModelDeploymentStatus = async (taskUuid: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .get(`/api/self-learning/model-deployment/${taskUuid}/status/`)
        .then((response) => response.data),
    {
      location: 'getModelDeploymentStatus',
      operation: 'deployment_status_fetch',
      extra: { taskUuid },
    }
  );
};

// ==================== BENCHMARKING APIs ====================

/**
 * Trigger model benchmarking after deployment
 */
export const triggerModelBenchmark = async (
  deploymentTaskUuid: string,
  maxImagesPerClass?: number
) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .post('/api/self-learning/model-benchmark/create/', {
          deployment_task_uuid: deploymentTaskUuid,
          max_images_per_class: maxImagesPerClass || 50,
        })
        .then((response) => response.data),
    {
      location: 'triggerModelBenchmark',
      operation: 'benchmark_trigger',
      extra: { deploymentTaskUuid, maxImagesPerClass },
    }
  );
};

/**
 * Get benchmark status for a specific task
 */
export const getModelBenchmarkStatus = async (taskUuid: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .get(`/api/self-learning/model-benchmark/${taskUuid}/status/`)
        .then((response) => response.data),
    {
      location: 'getModelBenchmarkStatus',
      operation: 'benchmark_status_fetch',
      extra: { taskUuid },
    }
  );
};

/**
 * Get full benchmark results after completion
 */
export const getModelBenchmarkResults = async (taskUuid: string) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .get(`/api/self-learning/model-benchmark/${taskUuid}/results/`)
        .then((response) => response.data),
    {
      location: 'getModelBenchmarkResults',
      operation: 'benchmark_results_fetch',
      extra: { taskUuid },
    }
  );
};
