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
  feedback: Record<string, { feedback: boolean }>
) => {
  return apiCallWithErrorHandling(
    () =>
      api
        .post(`/data/task/${taskUuid}/feedback/`, { feedback })
        .then((response) => response.data),
    {
      location: 'submitFeedback',
      operation: 'feedback_submission',
      extra: {
        taskUuid,
        feedbackCount: Object.keys(feedback).length,
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
export const getInferenceUsage = async () => {
  return apiCallWithErrorHandling(
    () =>
      api
        .get('/data/inference-usage/my-usage/')
        .then((response) => response.data),
    {
      location: 'getInferenceUsage',
      operation: 'inference_usage_fetch',
    }
  );
};

export const getGroupInferenceUsage = async () => {
  return apiCallWithErrorHandling(
    () =>
      api
        .get('/data/inference-usage/group-usage/')
        .then((response) => response.data),
    {
      location: 'getGroupInferenceUsage',
      operation: 'group_inference_usage_fetch',
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
    () => api.post('/users/create_supervisor/', userData).then((response) => response.data),
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
