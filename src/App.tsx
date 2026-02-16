import React, { useState, useEffect, useRef } from 'react';
import * as Sentry from '@sentry/react';
import HomePage from './components/HomePage';
import ReviewImagesPage from './components/ReviewImagesPage';
import DefectAnalysisPage from './components/DefectAnalysisPage';
import ImageCaptureProcess from './components/ImageCaptureProcess';
import CustomTitlebar from './components/customTitlebar';
import { CameraProvider } from './contexts/cameraContext';
import { LoginPage } from './components/LoginPage';
import SignUpPage from './components/SignUpPage';
import white_AAA from './assets/white_AAA.bmp';
import black_BBB from './assets/black_BBB.bmp';
import cyan_CCC from './assets/cyan_CCC.bmp';
import gray50_DDD from './assets/gray50_DDD.bmp';
import red_EEE from './assets/red_EEE.bmp';
import green_FFF from './assets/green_FFF.bmp';
import blue_GGG from './assets/blue_GGG.bmp';
import gray75_HHH from './assets/gray75_HHH.bmp';
import grayVertical_III from './assets/grayVertical_III.bmp';
import colorBars_JJJ from './assets/colorBars_JJJ.bmp';
import focus_KKK from './assets/focus_KKK.bmp';
import blackWithWhiteBorder_LLL from './assets/blackWithWhiteBorder_LLL.jpg';
import crossHatch_MMM from './assets/crossHatch_MMM.bmp';
import barGray_NNN from './assets/16BarGray_NNN.bmp';
import blackWhite_OOO from './assets/black&White_OOO.bmp';
import SummaryPage from './components/SummaryPage';
import PatternEBCPage from './components/PatternEBCPage';
import DataCollectionPage from './components/DataCollectionPage';
import DefectCheckerPage from './components/DefectCheckerPage';
import { AppModeProvider } from './contexts/appModeContext';
import PastDataPage from './components/PastDataPage';
import PredictedDefectsPage from './components/PredictedDefectsPage';
import UsageDataPage from './components/UsageDataPage';
import {
  createDisplayPanel,
  getLatestTask,
  getTaskStatus,
  getUserFromToken,
  initializeAPI,
  retryDisplayPanel,
  setLogoutCallback,
} from './services/api';
import { EnvironmentIndicator } from './hooks/useEnvironment';
import DefectConfiguration from './components/DefectConfiguration';
import AdminUserManagement from './components/AdminSettingsPage';
import packageInfo from '../package.json';
import NTFCheckerPage from './components/NTFChecker';
import NftDefectsPage from './components/NtfDefectsPage';
import Dashboard from './components/Dashboard';
import SelfLearningPage from './components/SelfLearning';
import BoundingBoxPage from './components/BoundingBoxPage';
import SelfLearningDataPage from './components/SelfLearningDataPage';
import SelfLearningSummaryPage from './components/SelfLearningSummaryPage';
import SelfLearningAnnotationPage from './components/SelfLearningAnnotationPage';
import NewModelTrainingPage from './components/NewModelTrainingPage';
import BatchTrainingSummaryPage from './components/BatchTrainingSummaryPage';

declare global {
  interface Window {
    electronAPI?: {
      saveTestImages: (images: string[]) => void;
      onTestImagesSaved: (callback: () => void) => void;

      getAssetPath: (assetName: string) => string;
      loadImageAsDataURL: (imageName: string) => string;
      uploadImage: (data: {
        imageData: string;
        ppid: string;
        patternName: string;
        isTestMode: boolean;
      }) => Promise<string>;

      enableFullScreen: () => void;
      disableFullScreen: () => void;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;

      // Environment switching
      toggleEnvironment: () => void;
      getCurrentEnvironment: () => Promise<{
        isProduction: boolean;
        baseUrl: string;
        environment: string;
      }>;
      onEnvironmentChanged: (
        callback: (
          event: any,
          environment: {
            isProduction: boolean;
            baseUrl: string;
            environment: string;
          }
        ) => void
      ) => void;

      // Utilities
      removeAllListeners: (channel: string) => void;
    };
  }
}

const testPatterns = [
  { name: 'white_AAA', src: white_AAA },
  { name: 'black_BBB', src: black_BBB },
  { name: 'cyan_CCC', src: cyan_CCC },
  { name: 'gray50_DDD', src: gray50_DDD },
  { name: 'red_EEE', src: red_EEE },
  { name: 'green_FFF', src: green_FFF },
  { name: 'blue_GGG', src: blue_GGG },
  { name: 'gray75_HHH', src: gray75_HHH },
  { name: 'grayVertical_III', src: grayVertical_III },
  { name: 'colorBars_JJJ', src: colorBars_JJJ },
  { name: 'focus_KKK', src: focus_KKK },
  { name: 'blackWithWhiteBorder_LLL', src: blackWithWhiteBorder_LLL },
  { name: 'crossHatch_MMM', src: crossHatch_MMM },
  { name: '16BarGray_NNN', src: barGray_NNN },
  { name: 'black&White_OOO', src: blackWhite_OOO },
];

function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const [isCapturing, setIsCapturing] = useState(false);
  const [ppid, setPpid] = useState('');
  const [userData, setUserData] = useState('');
  const [focusDistance, setFocusDistance] = useState();
  const [isTestMode, setIsTestMode] = useState(false);
  const [capturedImages, setCapturedImages] = useState([]);
  const [uploadedImageUrls, setUploadedImageUrls] = useState([]);
  const [totalUploads, setTotalUploads] = useState(0);
  const [completedUploads, setCompletedUploads] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedBatchSlug, setSelectedBatchSlug] = useState<
    string | undefined
  >(undefined);
  const [selectedBatchName, setSelectedBatchName] = useState<string>('');
  const [failedUploadIndices, setFailedUploadIndices] = useState([]);
  const [authToken, setAuthToken] = useState(() =>
    localStorage.getItem('sentinel_dash_token')
  );
  // const [showSignup, setShowSignup] = useState(false);
  const [patternEBC, setPatternEBC] = useState(() => {
    const saved = localStorage.getItem('patternEBC');
    if (saved) return JSON.parse(saved);
    const testPatternsDefault = [
      {
        name: 'white_AAA',
        settings: { exposure: 0, brightness: 145, contrast: 145 },
      },
      {
        name: 'black_BBB',
        settings: { exposure: 100, brightness: 120, contrast: 145 },
      },
      {
        name: 'cyan_CCC',
        settings: { exposure: 0, brightness: 145, contrast: 145 },
      },
      {
        name: 'gray50_DDD',
        settings: { exposure: 20, brightness: 125, contrast: 125 },
      },
      {
        name: 'red_EEE',
        settings: { exposure: 45, brightness: 85, contrast: 125 },
      },
      {
        name: 'green_FFF',
        settings: { exposure: 45, brightness: 85, contrast: 145 },
      },
      {
        name: 'blue_GGG',
        settings: { exposure: 100, brightness: 125, contrast: 145 },
      },
      {
        name: 'gray75_HHH',
        settings: { exposure: 45, brightness: 85, contrast: 145 },
      },
      {
        name: 'grayVertical_III',
        settings: { exposure: 20, brightness: 125, contrast: 145 },
      },
      {
        name: 'colorBars_JJJ',
        settings: { exposure: 45, brightness: 85, contrast: 125 },
      },
      {
        name: 'focus_KKK',
        settings: { exposure: 10, brightness: 80, contrast: 125 },
      },
      {
        name: 'blackWithWhiteBorder_LLL',
        settings: { exposure: 10, brightness: 100, contrast: 80 },
      },
      {
        name: 'crossHatch_MMM',
        settings: { exposure: 45, brightness: 145, contrast: 145 },
      },
      {
        name: '16BarGray_NNN',
        settings: { exposure: 20, brightness: 125, contrast: 125 },
      },
      {
        name: 'black&White_OOO',
        settings: { exposure: 0, brightness: 145, contrast: 145 },
      },
    ];
    const obj = {};
    testPatternsDefault.forEach(({ name, settings }) => {
      obj[name] = { ...settings };
    });
    return obj;
  });
  const [username, setUsername] = useState(
    () => localStorage.getItem('sentinel_dash_username') || ''
  );
  const [routineType, setRoutineType] = useState<
    'data-collection' | 'defect-checker' | 'ntf-checker' | 'self-learning'
  >('defect-checker');
  const [predictedDefects, setPredictedDefects] = useState(null); // for real API result
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionError, setPredictionError] = useState(null);
  const [taskid, setTaskid] = useState();
  const [selectedDefects, setSelectedDefects] = useState([]);
  const [defectDisplayMap, setDefectDisplayMap] = useState([]);
  const pollingRef = useRef(null);
  const pollCountRef = useRef(0);

  useEffect(() => {
    const VERSION_KEY = 'app_version';
    const CURRENT_VERSION = packageInfo.version; // "4.7.0"
    const storedVersion = localStorage.getItem(VERSION_KEY);

    if (storedVersion !== CURRENT_VERSION) {
      console.log(
        `Version update: ${
          storedVersion || 'first install'
        } → ${CURRENT_VERSION}`
      );
      localStorage.clear();
      localStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    }
  }, []);

  useEffect(() => {
    initializeAPI();

    // Load defectDisplayMap from localStorage on app startup
    const loadDefectDisplayMap = () => {
      try {
        const savedDefects = localStorage.getItem('selectedDefects');

        // // Default defects that should be selected if no saved configuration exists
        // const defaultDefects = [
        //   'def_horizontal_band',
        //   'def_white_patches',
        //   'def_polariser_scratches',
        // ];

        // Complete defect list matching DefectConfiguration.tsx
        const defectsList = [
          { name: 'Abnormal Display', key: 'def_abnormal_display' },
          { name: 'Horizontal Line', key: 'def_horizontal_line' },
          { name: 'Horizontal Band', key: 'def_horizontal_band' },
          { name: 'Vertical Line', key: 'def_vertical_line' },
          { name: 'Vertical Band', key: 'def_vertical_band' },
          { name: 'Particles', key: 'def_particles' },
          { name: 'White Patch', key: 'def_white_patches' },
          {
            name: 'Polariser Scratches / Dent',
            key: 'def_polariser_scratches',
          },
          { name: 'Light Leakage', key: 'def_light_leakage' },
          { name: 'Mura', key: 'def_mura' },
          { name: 'Incoming Border Patch', key: 'def_incoming_border_patch' },
          { name: 'Pixel Bright Dot', key: 'def_pixel_bright_dot' },
          { name: 'Incoming Galaxy', key: 'def_incoming_galaxy' },
          { name: 'Led Off', key: 'def_led_off' },
          { name: 'Bleeding', key: 'def_bleeding' },
          // { name: 'No Trouble Found', key: 'def_no_trouble_found' },
        ];

        let defectsToUse: string[] = defectsList.map((d) => d.key);

        if (savedDefects) {
          const parsedDefects = JSON.parse(savedDefects);
          // Only use saved defects if they exist and are not empty
          if (parsedDefects.length > 0) {
            // If the saved defects are objects, convert to keys
            if (
              typeof parsedDefects[0] === 'object' &&
              parsedDefects[0] !== null &&
              'key' in parsedDefects[0]
            ) {
              defectsToUse = parsedDefects.map((d: any) => d.key);
            } else {
              defectsToUse = parsedDefects;
            }
          } else {
            // If saved defects exist but are empty, save the defaults
            localStorage.setItem(
              'selectedDefects',
              JSON.stringify(defectsList.map((d) => d.key))
            );
          }
        } else {
          // No saved defects, save the defaults
          localStorage.setItem(
            'selectedDefects',
            JSON.stringify(defectsList.map((d) => d.key))
          );
        }

        const selectedDefectsList = defectsList.filter((defect) =>
          defectsToUse.includes(defect.key)
        );

        const displayMap = selectedDefectsList.map((defect) => ({
          key: defect.key,
          label: defect.name,
        }));

        setSelectedDefects(defectsToUse);
        setDefectDisplayMap(displayMap);
        console.log('Loaded defectDisplayMap from localStorage:', displayMap);
      } catch (error) {
        console.error(
          'Error loading defectDisplayMap from localStorage:',
          error
        );
        // Fallback to defaults on error
        // const defaultDefects = [
        //   'def_horizontal_band',
        //   'def_white_patches',
        //   'def_polariser_scratches',
        // ];
        // setSelectedDefects(defaultDefects);
        // localStorage.setItem('selectedDefects', JSON.stringify(defaultDefects));
      }
    };

    const initializeUser = async () => {
      const storedUserData = localStorage.getItem('sentinel_dash_user');
      if (storedUserData) {
        try {
          const parsedUserData = JSON.parse(storedUserData);
          setUserData(parsedUserData);
        } catch (error) {
          console.error('Error parsing stored user data:', error);
          localStorage.removeItem('sentinel_dash_user');
        }
      }

      const token = localStorage.getItem('sentinel_dash_token');
      if (token) {
        try {
          console.log('called');
          const userData = await getUserFromToken(token);
          setUserData(userData.user);
          localStorage.setItem(
            'sentinel_dash_user',
            JSON.stringify(userData.user)
          );
        } catch (error) {
          console.error('Error refreshing user data:', error);
          localStorage.removeItem('sentinel_dash_user');
          localStorage.removeItem('sentinel_dash_token');
        }
      }
    };

    initializeUser();
    loadDefectDisplayMap();
  }, []);

  useEffect(() => {
    localStorage.setItem('patternEBC', JSON.stringify(patternEBC));
  }, [patternEBC]);

  useEffect(() => {
    const token = localStorage.getItem('sentinel_dash_token');
    setAuthToken(token);
  }, []);

  const handleDefectsSelected = (defects, displayMap) => {
    setSelectedDefects(defects);
    setDefectDisplayMap(displayMap);
    console.log('Defects configured:', defects);
  };

  console.log(defectDisplayMap);

  const handleLogin = async (token) => {
    try {
      localStorage.setItem('sentinel_dash_token', token);
      setAuthToken(token);
      console.log('called1');

      // Fetch user data from token
      const userData = await getUserFromToken(token);

      // Store user data in state and localStorage
      setUserData(userData.user);
      localStorage.setItem('sentinel_dash_user', JSON.stringify(userData.user));

      setActivePage('dashboard');
      const savedUsername =
        localStorage.getItem('sentinel_dash_username') ||
        userData.user.username ||
        '';
      setUsername(savedUsername);
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      // Handle error - maybe clear token and show error
      localStorage.removeItem('sentinel_dash_token');
      setAuthToken(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sentinel_dash_token');
    localStorage.removeItem('sentinel_dash_username');
    localStorage.removeItem('sentinel_dash_refresh');
    setAuthToken(null);
    setActivePage('login');
  };

  useEffect(() => {
    setLogoutCallback(() => {
      setAuthToken(null);
      setActivePage('login');
    });
  }, []);

  const handleEnvironmentSwitch = () => {
    handleLogout();
  };

  // const navigateToSignup = () => setShowSignup(true);
  // const navigateToLogin = () => setShowSignup(false);

  const handleMinimize = () => {
    window.electronAPI?.minimizeWindow();
  };

  const handleMaximize = () => {
    window.electronAPI?.maximizeWindow();
  };

  const handleClose = () => {
    window.electronAPI?.closeWindow();
  };

  // Start the defect checker or data collection routine
  const startDefectChecker = (ppid, isTestMode, focusDistance, routine) => {
    setPpid(ppid);
    setIsTestMode(isTestMode);
    setFocusDistance(focusDistance);

    // Set routine type based on the routine parameter
    if (routine === 'data-collection') {
      setRoutineType('data-collection');
    } else if (routine === 'ntf-checker') {
      setRoutineType('ntf-checker');
    } else if (routine === 'self-learning') {
      setRoutineType('self-learning');
    } else {
      setRoutineType('defect-checker');
    }

    setIsCapturing(true);
  };

  // Handle when image capture is complete and uploads have started
  const handleCaptureComplete = (images, totalToUpload) => {
    window.electronAPI.disableFullScreen();
    setCapturedImages(images);
    setTotalUploads(totalToUpload);
    setIsUploading(true);
    setIsCapturing(false);
    setActivePage('review');
  };

  // Update upload progress
  const handleUploadProgress = (imageUrl, index) => {
    setUploadedImageUrls((prev) => {
      const newUrls = [...prev];
      newUrls[index] = imageUrl;
      return newUrls;
    });

    // Track failed uploads
    if (imageUrl === null) {
      setFailedUploadIndices((prev) => [...prev, index]);
    }
    setCompletedUploads((prev) => prev + 1);
  };

  // Function to retry failed uploads
  const retryFailedUploads = async () => {
    if (failedUploadIndices.length === 0) return;

    // Reset uploading state
    setIsUploading(true);

    // Process each failed upload
    for (const index of failedUploadIndices) {
      if (index < capturedImages.length) {
        try {
          const imageData = capturedImages[index];
          const patternName = testPatterns[index].name;
          const imageUrl = await window.electronAPI.uploadImage({
            imageData,
            ppid,
            patternName,
            isTestMode,
          });

          // Update success
          setUploadedImageUrls((prev) => {
            const newUrls = [...prev];
            newUrls[index] = imageUrl;
            return newUrls;
          });

          console.log(`Successfully re-uploaded ${patternName}`);
        } catch (error) {
          console.error(`Failed to re-upload image at index ${index}:`, error);
          Sentry.captureException(error, {
            tags: {
              location: 'retryFailedUploads',
              operation: 'image_reupload',
            },
            extra: {
              imageIndex: index,
              patternName: testPatterns[index]?.name || 'unknown',
            },
          });
          // Leave as null in the array
        }
      }
    }

    // Clear failed indices as we've attempted them all
    setFailedUploadIndices([]);
    setIsUploading(false);
  };

  const approveImages = () => setActivePage('defect-analysis');
  const retakeImages = () => {
    setUploadedImageUrls([]);
    setCompletedUploads(0);
    setTotalUploads(0);
    setIsUploading(false);
    setFailedUploadIndices([]);
    setIsCapturing(true);
  };

  // Submit defect analysis and go back to home page
  const submitDefectAnalysis = () => {
    setPpid('');
    setCapturedImages([]);
    setUploadedImageUrls([]);
    setCompletedUploads(0);
    setTotalUploads(0);
    setIsUploading(false);
    setFailedUploadIndices([]);
    setActivePage(routineType);
  };

  // Discard session
  const discardSession = () => {
    setPpid('');
    setCapturedImages([]);
    setUploadedImageUrls([]);
    setCompletedUploads(0);
    setTotalUploads(0);
    setIsUploading(false);
    setFailedUploadIndices([]);
    setActivePage(routineType);
  };

  // Check if all uploads are complete
  useEffect(() => {
    if (isUploading && completedUploads === totalUploads && totalUploads > 0) {
      setIsUploading(false);
    }
  }, [completedUploads, totalUploads, isUploading]);

  useEffect(() => {
    if (isCapturing) {
      window.electronAPI.enableFullScreen();
    }
  }, [isCapturing]);

  // Navigation handler for sidebar
  const handleNavigate = (page) => {
    setActivePage(page);
  };

  // Map activePage to page title
  const pageTitles = {
    dashboard: 'Dashboard',
    'defect-checker': 'Defect Checker',
    'ntf-checker': 'NTF Checker',
    'data-collection': 'Data Collection',
    'self-learning': 'Self Learning',
    'self-learning-annotation': 'Past Unannotated Panels',
    'self-learning-data': 'Self Learning Data',
    'new-model-training': 'New Model Training',
    summary: 'Data Collection Summary',
    'pattern-ebc': 'Pattern EBC Settings',
    review: 'Review Images',
    'defect-analysis': 'Defect Analysis',
    'bounding-box-drawing': 'Annotate Defects',
    'past-data': 'Past Data',
    'predicted-defects': 'Predicted Defects',
    'ntf-defects': 'NTF Defects',
    'usage-data': 'Defect Checker Usage',
    'select-defects': 'Select Defects',
    'admin-settings': 'Admin Settings',
    // Add more as needed
  };

  // const startPrediction = async () => {
  //   setIsPredicting(true);
  //   setPredictedDefects(null);
  //   setPredictionError(null);
  //   pollCountRef.current = 0;

  //   try {
  //     const token = localStorage.getItem('sentinel_dash_token');
  //     if (!token) {
  //       setIsPredicting(false);
  //       setPredictedDefects({
  //         error: 'No authentication token found. Please log in again.',
  //       });
  //       return;
  //     }

  //     // Prepare panel_images array as in defectchecker
  //     const panel_images = uploadedImageUrls.map((url, idx) => ({
  //       panel: ppid,
  //       image_url: url,
  //       base_pattern: idx + 1,
  //     }));

  //     const payload = {
  //       ppid,
  //       panel_images,
  //       test_type: isTestMode
  //         ? ('test' as 'test')
  //         : ('production' as 'production'),
  //       inference: true,
  //     };

  //     const data = await createDisplayPanel(payload);
  //     const task_uuid = data.tasks?.[0]?.task_uuid;
  //     if (!task_uuid) throw new Error('No task_uuid returned');

  //     // Poll for status
  //     setTaskid(task_uuid);
  //     pollPredictionStatus(task_uuid);
  //   } catch (err) {
  //     setIsPredicting(false);
  //     const errorDetail = err.response?.data?.detail || err.message || 'Prediction failed';
  //     setPredictedDefects({ error: errorDetail });
  //     setPredictionError(errorDetail);
  //     Sentry.captureException(err, {
  //       tags: {
  //         location: 'startPrediction',
  //         operation: 'prediction_start',
  //       },
  //       extra: {
  //         ppid: ppid,
  //         isTestMode: isTestMode,
  //         imagesCount: uploadedImageUrls.filter((url) => url !== null).length,
  //       },
  //     });
  //   }
  // };

  //   const startPrediction = async () => {
  //   setIsPredicting(true);
  //   setPredictedDefects(null);
  //   setPredictionError(null);
  //   pollCountRef.current = 0;
  //   try {
  //     const token = localStorage.getItem('sentinel_dash_token');
  //     if (!token) {
  //       setIsPredicting(false);
  //       setPredictedDefects({
  //         error: 'No authentication token found. Please log in again.',
  //       });
  //       return;
  //     }
  //     // Prepare panel_images array as in defectchecker
  //     const panel_images = uploadedImageUrls.map((url, idx) => ({
  //       panel: ppid,
  //       image_url: url,
  //       base_pattern: idx + 1,
  //     }));
  //     const payload = {
  //       ppid,
  //       panel_images,
  //       test_type: isTestMode
  //         ? ('test' as 'test')
  //         : ('production' as 'production'),
  //       inference: true,
  //     };
  //     const data = await createDisplayPanel(payload);
  //     const task_uuid = data.tasks?.[0]?.task_uuid;
  //     if (!task_uuid) throw new Error('No task_uuid returned');
  //     // Poll for status
  //     setTaskid(task_uuid);
  //     pollPredictionStatus(task_uuid);
  //   } catch (err) {
  //     setIsPredicting(false);
  //     const errorDetail = err.response?.data?.detail || err.message || 'Prediction failed';
  //     setPredictedDefects({ error: errorDetail });
  //     setPredictionError(errorDetail);
  //     Sentry.captureException(err, {
  //       tags: {
  //         location: 'startPrediction',
  //         operation: 'prediction_start',
  //       },
  //       extra: {
  //         ppid: ppid,
  //         isTestMode: isTestMode,
  //         imagesCount: uploadedImageUrls.filter((url) => url !== null).length,
  //       },
  //     });
  //   }
  // };

  // const retryPrediction = async () => {
  //   setIsPredicting(true);
  //   setPredictedDefects(null);
  //   setPredictionError(null);
  //   pollCountRef.current = 0;
  //   try {
  //     if (!ppid) {
  //       setIsPredicting(false);
  //       setPredictionError(
  //         'No Panel ID available for retry. Please start prediction again.'
  //       );
  //       return;
  //     }

  //     // First, try to retry the existing display panel
  //     try {
  //       const retryResponse = await retryDisplayPanel(ppid);
  //       const latestTask = getLatestTask(retryResponse);
  //       if (!latestTask || !latestTask.task_uuid) {
  //         setIsPredicting(false);
  //         setPredictionError(
  //           'No valid task returned from retry. Please try again.'
  //         );
  //         return;
  //       }
  //       // Update task ID and start polling with the latest task UUID
  //       setTaskid(latestTask.task_uuid);
  //       pollPredictionStatus(latestTask.task_uuid);
  //     } catch (retryError) {
  //       // Check if the error is due to DisplayPanel not found
  //       const errorMessage = retryError.response?.data?.error ||
  //                           retryError.response?.data?.detail ||
  //                           retryError.message || '';

  //       const isDisplayPanelNotFound =
  //         errorMessage.includes('DisplayPanel') &&
  //         errorMessage.includes('not found');

  //       if (isDisplayPanelNotFound) {
  //         console.log('DisplayPanel not found, creating new panel...');

  //         // Fallback: Create a new display panel (same as startPrediction)
  //         const token = localStorage.getItem('sentinel_dash_token');
  //         if (!token) {
  //           setIsPredicting(false);
  //           setPredictionError('No authentication token found. Please log in again.');
  //           return;
  //         }

  //         // Prepare panel_images array
  //         const panel_images = uploadedImageUrls.map((url, idx) => ({
  //           panel: ppid,
  //           image_url: url,
  //           base_pattern: idx + 1,
  //         }));

  //         const payload = {
  //           ppid,
  //           panel_images,
  //           test_type: isTestMode
  //             ? ('test' as 'test')
  //             : ('production' as 'production'),
  //           inference: true,
  //         };

  //         const data = await createDisplayPanel(payload);
  //         const task_uuid = data.tasks?.[0]?.task_uuid;
  //         if (!task_uuid) throw new Error('No task_uuid returned from new panel creation');

  //         // Poll for status with new task
  //         setTaskid(task_uuid);
  //         pollPredictionStatus(task_uuid);
  //       } else {
  //         // For other errors, rethrow
  //         throw retryError;
  //       }
  //     }
  //   } catch (error) {
  //     setIsPredicting(false);
  //     const errorDetail = error.response?.data?.detail ||
  //                        error.response?.data?.error ||
  //                        error.message ||
  //                        'Retry failed';
  //     setPredictedDefects({ error: errorDetail });
  //     setPredictionError(errorDetail);
  //     Sentry.captureException(error, {
  //       tags: {
  //         location: 'retryPrediction',
  //         operation: 'prediction_retry',
  //       },
  //       extra: {
  //         ppid: ppid,
  //         errorStatus: error.response?.status,
  //         errorType: error.response?.data?.error ? 'display_panel_not_found' : 'other_error',
  //       },
  //     });
  //   }
  // };

  // You might also want to create a helper function to reduce code duplication

  const startNftChecker = async () => {
    setIsPredicting(true);
    setPredictionError(null);
    setPredictedDefects(null);
    try {
      const response = await createDisplayPanelWithImagesForNft(
        ppid,
        uploadedImageUrls,
        isTestMode
      );

      console.log('NTF Response:', response);

      // Fix: Get task_uuid from the nested tasks array
      const taskUuid = response?.tasks?.[0]?.task_uuid;

      if (taskUuid) {
        console.log('Task UUID received:', taskUuid);
        setTaskid(taskUuid);
        pollCountRef.current = 0;
        pollForNftResults(taskUuid);
      } else {
        console.log('No task_uuid in response');
        setIsPredicting(false); // Important!
        setPredictionError('failed');
        setPredictedDefects({
          error: 'Failed to start NTF checking',
          message: 'No task ID received from server',
        });
      }
    } catch (error: any) {
      console.error('Error in startNftChecker:', error);
      setIsPredicting(false);
      setPredictionError('failed');
      setPredictedDefects({
        error: error.message || 'Failed to start NTF checking',
        message:
          error.message || 'An error occurred while starting NTF checking',
      });
    }
  };

  const pollForNftResults = async (task_uuid: string) => {
    try {
      const token = localStorage.getItem('sentinel_dash_token');
      if (!token) {
        setIsPredicting(false);
        setPredictedDefects({
          error: 'No authentication token found. Please log in again.',
        });
        setPredictionError(
          'No authentication token found. Please log in again.'
        );
        return;
      }

      const poll = async () => {
        try {
          if (pollCountRef.current >= 10) {
            setIsPredicting(false);
            setPredictedDefects({
              error: 'timeout',
              message:
                'Prediction is taking longer than expected. This might be due to high server load.',
            });
            setPredictionError('timeout');
            if (pollingRef.current) clearTimeout(pollingRef.current);
            return;
          }

          const data = await getTaskStatus(task_uuid);
          const status = data.task?.status;

          if (status === 'completed') {
            setIsPredicting(false);

            // Check for errors in defect_details
            const defectDetails = data.task.results?.defect_details || {};
            console.log(defectDetails);
            const hasErrors = Object.values(defectDetails).some(
              (detail: any) => detail.processing_status === 'error'
            );

            if (hasErrors) {
              // Find the first error for display
              const errorDetail = Object.values(defectDetails).find(
                (detail: any) => detail.processing_status === 'error'
              ) as any;

              setPredictedDefects({
                error: 'processing_failed',
                message: `Defect analysis failed`,
              });
              setPredictionError('processing_failed');
            } else {
              setPredictedDefects(data.task.results?.defects || {});
              setPredictionError(null);
            }

            if (pollingRef.current) clearTimeout(pollingRef.current);
          } else if (status === 'failed') {
            setIsPredicting(false);
            setPredictedDefects({
              error: 'failed',
              message: 'Task processing failed. Please try again.',
            });
            setPredictionError('failed');
            if (pollingRef.current) clearTimeout(pollingRef.current);
          } else {
            pollCountRef.current += 1;
            pollingRef.current = setTimeout(() => poll(), 5000);
          }
        } catch (error) {
          let errMsg = 'Failed to poll status';
          if (
            error.response?.status === 401 ||
            error.response?.status === 403
          ) {
            errMsg = 'Unauthorized. Please log in again.';
          } else {
            // Use the error detail if available, otherwise fallback to message or default
            errMsg = error.response?.data?.detail || error.message || errMsg;
          }
          setIsPredicting(false);
          setPredictedDefects({ error: errMsg });
          setPredictionError(errMsg);
          Sentry.captureException(error, {
            tags: {
              location: 'pollPredictionStatus',
              operation: 'status_polling',
            },
            extra: {
              taskUuid: task_uuid,
              pollCount: pollCountRef.current,
              errorStatus: error.response?.status,
            },
          });
        }
      };

      poll();
    } catch (err) {
      setIsPredicting(false);
      setPredictedDefects({
        error: err.message || 'Prediction polling failed',
      });
      setPredictionError(err.message || 'Prediction polling failed');
      Sentry.captureException(err, {
        tags: {
          location: 'pollPredictionStatus',
          operation: 'polling_initialization',
        },
        extra: {
          taskUuid: task_uuid,
        },
      });
    }
  };

  const createDisplayPanelWithImagesForNft = async (
    ppid: string,
    uploadedImageUrls: (string | null)[],
    isTestMode: boolean
  ) => {
    const token = localStorage.getItem('sentinel_dash_token');
    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }

    const panel_images = uploadedImageUrls.map((url, idx) => ({
      panel: ppid,
      image_url: url,
      base_pattern: idx + 1,
    }));

    const payload = {
      ppid,
      panel_images,
      test_type: isTestMode
        ? ('test' as 'test')
        : ('production' as 'production'),
      inference: true,
      qa: true,
    };

    return await createDisplayPanel(payload);
  };

  const createDisplayPanelWithImages = async (
    ppid: string,
    uploadedImageUrls: (string | null)[],
    isTestMode: boolean
  ) => {
    const token = localStorage.getItem('sentinel_dash_token');
    if (!token) {
      throw new Error('No authentication token found. Please log in again.');
    }

    const panel_images = uploadedImageUrls.map((url, idx) => ({
      panel: ppid,
      image_url: url,
      base_pattern: idx + 1,
    }));

    const payload = {
      ppid,
      panel_images,
      test_type: isTestMode
        ? ('test' as 'test')
        : ('production' as 'production'),
      inference: true,
    };

    return await createDisplayPanel(payload);
  };

  // Refactored version using the helper function:
  const startPredictionRefactored = async () => {
    setIsPredicting(true);
    setPredictedDefects(null);
    setPredictionError(null);
    pollCountRef.current = 0;
    try {
      const data = await createDisplayPanelWithImages(
        ppid,
        uploadedImageUrls,
        isTestMode
      );
      const task_uuid = data.tasks?.[0]?.task_uuid;
      if (!task_uuid) throw new Error('No task_uuid returned');

      setTaskid(task_uuid);
      pollPredictionStatus(task_uuid);
    } catch (err) {
      setIsPredicting(false);
      const errorDetail =
        err.response?.data?.detail || err.message || 'Prediction failed';
      setPredictedDefects({ error: errorDetail });
      setPredictionError(errorDetail);
      Sentry.captureException(err, {
        tags: {
          location: 'startPrediction',
          operation: 'prediction_start',
        },
        extra: {
          ppid: ppid,
          isTestMode: isTestMode,
          imagesCount: uploadedImageUrls.filter((url) => url !== null).length,
        },
      });
    }
  };

  const pollPredictionStatus = async (task_uuid) => {
    try {
      const token = localStorage.getItem('sentinel_dash_token');
      if (!token) {
        setIsPredicting(false);
        setPredictedDefects({
          error: 'No authentication token found. Please log in again.',
        });
        setPredictionError(
          'No authentication token found. Please log in again.'
        );
        return;
      }

      const poll = async () => {
        try {
          if (pollCountRef.current >= 10) {
            setIsPredicting(false);
            setPredictedDefects({
              error: 'timeout',
              message:
                'Prediction is taking longer than expected. This might be due to high server load.',
            });
            setPredictionError('timeout');
            if (pollingRef.current) clearTimeout(pollingRef.current);
            return;
          }

          const data = await getTaskStatus(task_uuid);
          const status = data.task?.status;

          if (status === 'completed') {
            setIsPredicting(false);

            // Check for errors in defect_details
            const defectDetails = data.task.results?.defect_details || {};
            const hasErrors = Object.values(defectDetails).some(
              (detail: any) => detail.processing_status === 'error'
            );

            if (hasErrors) {
              // Find the first error for display
              const errorDetail = Object.values(defectDetails).find(
                (detail: any) => detail.processing_status === 'error'
              ) as any;

              setPredictedDefects({
                error: 'processing_failed',
                message: `Defect analysis failed`,
              });
              setPredictionError('processing_failed');
            } else {
              setPredictedDefects(data.task.results?.defects || {});
              setPredictionError(null);
            }

            if (pollingRef.current) clearTimeout(pollingRef.current);
          } else if (status === 'failed') {
            setIsPredicting(false);
            setPredictedDefects({
              error: 'failed',
              message: 'Task processing failed. Please try again.',
            });
            setPredictionError('failed');
            if (pollingRef.current) clearTimeout(pollingRef.current);
          } else {
            pollCountRef.current += 1;
            pollingRef.current = setTimeout(() => poll(), 5000);
          }
        } catch (error) {
          let errMsg = 'Failed to poll status';
          if (
            error.response?.status === 401 ||
            error.response?.status === 403
          ) {
            errMsg = 'Unauthorized. Please log in again.';
          } else {
            // Use the error detail if available, otherwise fallback to message or default
            errMsg = error.response?.data?.detail || error.message || errMsg;
          }
          setIsPredicting(false);
          setPredictedDefects({ error: errMsg });
          setPredictionError(errMsg);
          Sentry.captureException(error, {
            tags: {
              location: 'pollPredictionStatus',
              operation: 'status_polling',
            },
            extra: {
              taskUuid: task_uuid,
              pollCount: pollCountRef.current,
              errorStatus: error.response?.status,
            },
          });
        }
      };

      poll();
    } catch (err) {
      setIsPredicting(false);
      setPredictedDefects({
        error: err.message || 'Prediction polling failed',
      });
      setPredictionError(err.message || 'Prediction polling failed');
      Sentry.captureException(err, {
        tags: {
          location: 'pollPredictionStatus',
          operation: 'polling_initialization',
        },
        extra: {
          taskUuid: task_uuid,
        },
      });
    }
  };

  const ErrorDisplay = ({
    title = 'Error',
    message,
    onRetry,
    onGoHome,
    retryButtonText = 'Retry',
    homeButtonText = 'Go to Defect Checker Home',
  }) => (
    <div className="text-center p-6 max-w-3xl mx-auto mt-10">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-red-600 mb-2">{title}</h3>
        <p className="text-gray-600 mb-4">{message}</p>
      </div>

      <div className="flex gap-3 justify-center">
        <button
          className="px-6 py-3 bg-primary text-white rounded hover:bg-primary/90 text-md font-semibold"
          onClick={onRetry}
        >
          {retryButtonText}
        </button>

        <button
          className="px-6 py-3 bg-primary text-white rounded hover:bg-primary/90 text-md font-semibold"
          onClick={onGoHome}
        >
          {homeButtonText}
        </button>
      </div>
    </div>
  );

  const resetAndGoBack = () => {
    setPpid('');
    setCapturedImages([]);
    setUploadedImageUrls([]);
    setCompletedUploads(0);
    setTotalUploads(0);
    setIsUploading(false);
    setFailedUploadIndices([]);

    // Also reset prediction states
    setIsPredicting(false);
    setPredictedDefects(null);
    setPredictionError(null);
    // setPollCount(0);
    pollCountRef.current = 0;
    setTaskid(null); // Clear the task ID

    setActivePage('defect-checker');
  };

  const resetNftAndGoBack = () => {
    setPpid('');
    setCapturedImages([]);
    setUploadedImageUrls([]);
    setCompletedUploads(0);
    setTotalUploads(0);
    setIsUploading(false);
    setFailedUploadIndices([]);

    // Reset prediction states
    setIsPredicting(false);
    setPredictedDefects(null);
    setPredictionError(null);
    pollCountRef.current = 0;
    setTaskid(null);

    setActivePage('ntf-checker');
  };

  const resetSelfLearningAndGoBack = () => {
    setPpid('');
    setCapturedImages([]);
    setUploadedImageUrls([]);
    setCompletedUploads(0);
    setTotalUploads(0);
    setIsUploading(false);
    setFailedUploadIndices([]);

    setActivePage('self-learning');
  };

  const handleBoundingBoxSubmit = async (
    boundingBoxes: any,
    imageDimensions?: { width: number; height: number }
  ) => {
    const { submitSelfLearning } = await import('./services/api');

    // Step 1: Create the display panel first to get panel_image IDs
    const panel_images = uploadedImageUrls
      .filter((url) => url !== null)
      .map((url, index) => ({
        panel: ppid,
        image_url: url,
        base_pattern: index + 1,
      }));

    const panelPayload = {
      ppid,
      panel_images,
      test_type: isTestMode
        ? ('test' as 'test')
        : ('production' as 'production'),
      inference: false, // No inference for self-learning
      qa: false,
    };

    // Step 2: Submit annotations directly with bounding boxes
    // panel_image and base_pattern are just 1, 2, 3, 4, 5... for each pattern
    const panel_images_with_ids = uploadedImageUrls
      .filter((url) => url !== null)
      .map((url, index) => ({
        id: index + 1,
        panel: ppid,
        base_pattern: index + 1,
        image_url: url,
      }));

    const result = await submitSelfLearning({
      ppid,
      test_type: isTestMode ? 'test' : 'production',
      panel_images: panel_images_with_ids,
      bounding_boxes: boundingBoxes,
      imageWidth: imageDimensions?.width,
      imageHeight: imageDimensions?.height,
    });
    return result; // Return the result to BoundingBoxPage
  };

  // const retryPrediction = async () => {
  //   setIsPredicting(true);
  //   setPredictedDefects(null);
  //   setPredictionError(null);
  //   pollCountRef.current = 0;

  //   try {
  //     if (!ppid) {
  //       setIsPredicting(false);
  //       setPredictionError(
  //         'No Panel ID available for retry. Please start prediction again.'
  //       );
  //       return;
  //     }

  //     const retryResponse = await retryDisplayPanel(ppid);
  //     const latestTask = getLatestTask(retryResponse);

  //     if (!latestTask || !latestTask.task_uuid) {
  //       setIsPredicting(false);
  //       setPredictionError(
  //         'No valid task returned from retry. Please try again.'
  //       );
  //       return;
  //     }

  //     // Update task ID and start polling with the latest  
  //     setTaskid(latestTask.task_uuid);
  //     pollPredictionStatus(latestTask.task_uuid);
  //   } catch (error) {
  //     setIsPredicting(false);
  //     const errorDetail = error.response?.data?.detail || error.message || 'Retry failed';
  //     setPredictedDefects({ error: errorDetail });
  //     setPredictionError(errorDetail);
  //     Sentry.captureException(error, {
  //       tags: {
  //         location: 'retryPrediction',
  //         operation: 'prediction_retry',
  //       },
  //       extra: {
  //         ppid: ppid,
  //         errorStatus: error.response?.status,
  //       },
  //     });
  //   }
  // };

  // Render the correct subpage/component

  const retryNftChecker = async () => {
    setIsPredicting(true);
    setPredictedDefects(null);
    setPredictionError(null);
    pollCountRef.current = 0;

    try {
      if (!ppid) {
        setIsPredicting(false);
        setPredictionError(
          'No Panel ID available for retry. Please start NTF check again.'
        );
        return;
      }

      try {
        // First attempt: retry existing panel
        const retryResponse = await retryDisplayPanel(ppid);
        const latestTask = getLatestTask(retryResponse);

        if (!latestTask || !latestTask.task_uuid) {
          setIsPredicting(false);
          setPredictionError(
            'No valid task returned from retry. Please try again.'
          );
          return;
        }

        setTaskid(latestTask.task_uuid);
        pollForNftResults(latestTask.task_uuid);
      } catch (retryError) {
        console.log('Retry error:', retryError);

        // Check if it's a 404 error (DisplayPanel not found)
        const is404Error =
          retryError.status === 404 ||
          retryError.response?.status === 404 ||
          (retryError.message &&
            retryError.message.includes('Resource not found'));

        // Additional check for the specific DisplayPanel not found case
        const errorMessage =
          retryError.response?.data?.error ||
          retryError.response?.data?.detail ||
          retryError.message ||
          '';

        const isDisplayPanelNotFound =
          is404Error ||
          (errorMessage.includes('DisplayPanel') &&
            errorMessage.includes('not found'));

        if (isDisplayPanelNotFound) {
          console.log('DisplayPanel not found (404), creating new panel...');

          try {
            // Fallback: create new panel with qa: true
            const data = await createDisplayPanelWithImagesForNft(
              ppid,
              uploadedImageUrls,
              isTestMode
            );

            const task_uuid = data.tasks?.[0]?.task_uuid;

            if (!task_uuid) {
              throw new Error('No task_uuid returned from new panel creation');
            }

            setTaskid(task_uuid);
            pollForNftResults(task_uuid);
          } catch (createError) {
            console.error('Failed to create new panel after 404:', createError);
            throw createError;
          }
        } else {
          // For other errors, rethrow
          throw retryError;
        }
      }
    } catch (error) {
      console.error('Final retry error:', error);
      setIsPredicting(false);

      const errorDetail =
        error.response?.data?.detail ||
        error.response?.data?.error ||
        error.message ||
        'Retry failed';

      setPredictedDefects({ error: errorDetail });
      setPredictionError(errorDetail);

      Sentry.captureException(error, {
        tags: {
          location: 'retryNftChecker',
          operation: 'nft_check_retry',
        },
        extra: {
          ppid: ppid,
          errorStatus: error.response?.status || error.status,
          errorType:
            error.status === 404 || error.response?.status === 404
              ? 'display_panel_not_found'
              : 'other_error',
          originalError: error.message,
        },
      });
    }
  };

  const retryPredictionRefactored = async () => {
    setIsPredicting(true);
    setPredictedDefects(null);
    setPredictionError(null);
    pollCountRef.current = 0;

    try {
      if (!ppid) {
        setIsPredicting(false);
        setPredictionError(
          'No Panel ID available for retry. Please start prediction again.'
        );
        return;
      }

      try {
        // First attempt: retry existing panel
        const retryResponse = await retryDisplayPanel(ppid);
        const latestTask = getLatestTask(retryResponse);
        if (!latestTask || !latestTask.task_uuid) {
          setIsPredicting(false);
          setPredictionError(
            'No valid task returned from retry. Please try again.'
          );
          return;
        }

        setTaskid(latestTask.task_uuid);
        pollPredictionStatus(latestTask.task_uuid);
      } catch (retryError) {
        console.log('Retry error:', retryError);

        // Check if it's a 404 error (DisplayPanel not found)
        // Your apiCallWithErrorHandling is wrapping the original error
        const is404Error =
          retryError.status === 404 ||
          retryError.response?.status === 404 ||
          (retryError.message &&
            retryError.message.includes('Resource not found'));

        // Additional check for the specific DisplayPanel not found case
        const errorMessage =
          retryError.response?.data?.error ||
          retryError.response?.data?.detail ||
          retryError.message ||
          '';

        const isDisplayPanelNotFound =
          is404Error ||
          (errorMessage.includes('DisplayPanel') &&
            errorMessage.includes('not found'));

        if (isDisplayPanelNotFound) {
          console.log('DisplayPanel not found (404), creating new panel...');

          try {
            // Fallback: create new panel
            const data = await createDisplayPanelWithImages(
              ppid,
              uploadedImageUrls,
              isTestMode
            );
            const task_uuid = data.tasks?.[0]?.task_uuid;
            if (!task_uuid)
              throw new Error('No task_uuid returned from new panel creation');

            setTaskid(task_uuid);
            pollPredictionStatus(task_uuid);
          } catch (createError) {
            console.error('Failed to create new panel after 404:', createError);
            throw createError;
          }
        } else {
          // For other errors, rethrow
          throw retryError;
        }
      }
    } catch (error) {
      console.error('Final retry error:', error);
      setIsPredicting(false);
      const errorDetail =
        error.response?.data?.detail ||
        error.response?.data?.error ||
        error.message ||
        'Retry failed';
      setPredictedDefects({ error: errorDetail });
      setPredictionError(errorDetail);
      Sentry.captureException(error, {
        tags: {
          location: 'retryPrediction',
          operation: 'prediction_retry',
        },
        extra: {
          ppid: ppid,
          errorStatus: error.response?.status || error.status,
          errorType:
            error.status === 404 || error.response?.status === 404
              ? 'display_panel_not_found'
              : 'other_error',
          originalError: error.message,
        },
      });
    }
  };

  const renderActivePage = () => {
    switch (activePage) {
      case 'data-collection':
        return <DataCollectionPage onStartDefectChecker={startDefectChecker} />;
      case 'defect-checker':
        return <DefectCheckerPage onStartDefectChecker={startDefectChecker} />;
      case 'ntf-checker':
        return <NTFCheckerPage onStartDefectChecker={startDefectChecker} />;
      case 'self-learning':
        return <SelfLearningPage onStartDefectChecker={startDefectChecker} />;
      case 'self-learning-annotation':
        return <SelfLearningAnnotationPage />;
      case 'self-learning-data':
        return (
          <SelfLearningDataPage
            onNavigateToTraining={(batchSlug?: string) => {
              setSelectedBatchSlug(batchSlug);
              setActivePage('new-model-training');
            }}
            userData={userData}
          />
        );
      case 'self-learning-summary':
        return (
          <SelfLearningSummaryPage
            onNavigateToTraining={() => {
              setActivePage('new-model-training');
            }}
          />
        );
      case 'new-model-training':
        return (
          <NewModelTrainingPage
            selectedBatchSlug={selectedBatchSlug}
            onBackToSelfLearning={() => {
              setSelectedBatchSlug(undefined);
              setActivePage('self-learning-data');
            }}
          />
        );
      // case 'batch-training-summary':
      //   return selectedBatchSlug ? (
      //     <BatchTrainingSummaryPage
      //       batchSlug={selectedBatchSlug}
      //       batchName={selectedBatchName}
      //       onBack={() => {
      //         setActivePage('new-model-training');
      //       }}
      //       onTrainingTriggered={() => {
      //         setActivePage('new-model-training');
      //       }}
      //     />
      //   ) : null;
      case 'summary':
        return <SummaryPage />;
      case 'pattern-ebc':
        return (
          <PatternEBCPage
            patternEBC={patternEBC}
            setPatternEBC={setPatternEBC}
            testPatterns={testPatterns}
            handleResetPatternEBC={() => {
              const testPatternsDefault = [
                {
                  name: 'white_AAA',
                  settings: { exposure: 0, brightness: 145, contrast: 145 },
                },
                {
                  name: 'black_BBB',
                  settings: { exposure: 100, brightness: 120, contrast: 145 },
                },
                {
                  name: 'cyan_CCC',
                  settings: { exposure: 0, brightness: 145, contrast: 145 },
                },
                {
                  name: 'gray50_DDD',
                  settings: { exposure: 20, brightness: 125, contrast: 125 },
                },
                {
                  name: 'red_EEE',
                  settings: { exposure: 45, brightness: 85, contrast: 125 },
                },
                {
                  name: 'green_FFF',
                  settings: { exposure: 45, brightness: 85, contrast: 145 },
                },
                {
                  name: 'blue_GGG',
                  settings: { exposure: 100, brightness: 125, contrast: 145 },
                },
                {
                  name: 'gray75_HHH',
                  settings: { exposure: 45, brightness: 85, contrast: 145 },
                },
                {
                  name: 'grayVertical_III',
                  settings: { exposure: 20, brightness: 125, contrast: 145 },
                },
                {
                  name: 'colorBars_JJJ',
                  settings: { exposure: 45, brightness: 85, contrast: 125 },
                },
                {
                  name: 'focus_KKK',
                  settings: { exposure: 10, brightness: 80, contrast: 125 },
                },
                {
                  name: 'blackWithWhiteBorder_LLL',
                  settings: { exposure: 10, brightness: 100, contrast: 80 },
                },
                {
                  name: 'crossHatch_MMM',
                  settings: { exposure: 45, brightness: 145, contrast: 145 },
                },
                {
                  name: '16BarGray_NNN',
                  settings: { exposure: 20, brightness: 125, contrast: 125 },
                },
                {
                  name: 'black&White_OOO',
                  settings: { exposure: 0, brightness: 145, contrast: 145 },
                },
              ];
              const obj = {};
              testPatternsDefault.forEach(({ name, settings }) => {
                obj[name] = { ...settings };
              });
              setPatternEBC(obj);
            }}
          />
        );
      case 'past-data':
        return <PastDataPage />;
      case 'dashboard':
        return <Dashboard />;
      case 'usage-data':
        return <UsageDataPage />;
      case 'admin-settings':
        return <AdminUserManagement />;
      case 'defect-configuration':
        return (
          <DefectConfiguration
            onDefectsSelected={handleDefectsSelected}
            selectedDefects={selectedDefects}
          />
        );
      default:
        return <div></div>;
    }
  };

  return (
    <AppModeProvider>
      <CameraProvider>
        <EnvironmentIndicator onEnvironmentSwitch={handleEnvironmentSwitch} />
        <div className="app-container">
          {!isCapturing && (
            <div className="fixed top-0 left-0 w-full z-50">
              <CustomTitlebar
                onMinimize={handleMinimize}
                onMaximize={handleMaximize}
                onClose={handleClose}
              />
            </div>
          )}
          <div className={`content-area ${authToken ? 'pt-8' : ''}`}>
            {!authToken ? (
              // showSignup ? (
              //   <SignUpPage
              //     onSignup={handleLogin}
              //     navigateToLogin={navigateToLogin}
              //   />
              // ) : (
              <LoginPage
                onLogin={handleLogin}
                // navigateToSignup={navigateToSignup}
              />
            ) : // )
            isCapturing ? (
              <ImageCaptureProcess
                onComplete={handleCaptureComplete}
                onUploadProgress={handleUploadProgress}
                ppid={ppid}
                isTestMode={isTestMode}
                focusDistance={focusDistance}
                patternEBC={patternEBC}
              />
            ) : // subpages without sidebar/header
            activePage === 'review' ? (
              <>
                <header className="sticky w-screen top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
                  <div className="text-xl font-semibold">
                    {routineType === 'data-collection'
                      ? 'Data Collection Review Page'
                      : routineType === 'defect-checker'
                      ? 'Defect Checker Review Page'
                      : routineType === 'ntf-checker'
                      ? 'NTF Checker Review Page'
                      : 'Self Learning Review Page'}
                  </div>
                </header>
                <div className="flex justify-center items-center min-h-screen bg-gray-100">
                  <div className="w-full max-w-3xl p-4">
                    <ReviewImagesPage
                      ppid={ppid}
                      capturedImages={capturedImages}
                      onApprove={async () => {
                        if (routineType === 'defect-checker') {
                          setActivePage('predicted-defects');
                          await startPredictionRefactored();
                        } else if (routineType === 'ntf-checker') {
                          setActivePage('ntf-defects');
                          await startNftChecker();
                        } else if (routineType === 'self-learning') {
                          setActivePage('bounding-box-drawing');
                        } else {
                          approveImages();
                        }
                      }}
                      onRetake={retakeImages}
                      onDiscard={discardSession}
                    />
                  </div>
                </div>
              </>
            ) : activePage === 'predicted-defects' ? (
              isPredicting ? (
                <div className="flex flex-col items-center justify-center min-h-[300px]">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
                  <div className="text-lg font-semibold">
                    Processing images, please wait...
                  </div>
                </div>
              ) : predictionError &&
                predictionError !==
                  'No authentication token found. Please log in again.' ? (
                <ErrorDisplay
                  title={
                    predictionError === 'timeout'
                      ? 'Prediction Timeout'
                      : predictionError === 'failed'
                      ? 'Task Failed'
                      : predictionError === 'processing_failed'
                      ? 'Processing Failed'
                      : 'Error'
                  }
                  message={predictedDefects.message || predictedDefects.error}
                  onRetry={retryPredictionRefactored}
                  onGoHome={resetAndGoBack}
                />
              ) : predictedDefects && !predictedDefects.error ? (
                <>
                  <header className="sticky w-screen top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
                    <div className="text-xl font-semibold">
                      {routineType === 'data-collection'
                        ? 'Data Collection Predicted Defects'
                        : 'Defect Checker Predicted Defects'}
                    </div>
                  </header>
                  <div className="flex justify-center items-center min-h-screen bg-gray-100">
                    <div className="w-full max-w-2xl p-4">
                      <PredictedDefectsPage
                        defects={predictedDefects}
                        onGoHome={resetAndGoBack}
                        taskUuid={taskid}
                        defectDisplayMap={defectDisplayMap}
                      />
                    </div>
                  </div>
                </>
              ) : predictedDefects &&
                predictedDefects.error ===
                  'No authentication token found. Please log in again.' ? (
                <div className="flex flex-col items-center justify-center min-h-[300px]">
                  <div className="text-red-600 text-center p-8">
                    {predictedDefects.message || predictedDefects.error}
                  </div>
                  <button
                    className="px-6 py-3 bg-primary text-white rounded hover:bg-primary/90 text-md font-semibold"
                    onClick={handleLogout}
                  >
                    Go to Login page
                  </button>
                </div>
              ) : null
            ) : activePage === 'defect-analysis' ? (
              <>
                <header className="sticky w-screen top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
                  <div className="text-xl font-semibold">
                    {routineType === 'data-collection'
                      ? 'Data Collection Defect Analysis'
                      : 'Defect Checker Defect Analysis'}
                  </div>
                </header>
                <div className="flex justify-center items-center min-h-screen bg-gray-100">
                  <div className="w-full max-w-3xl p-4">
                    <DefectAnalysisPage
                      ppid={ppid}
                      isTestMode={isTestMode}
                      uploadedImageUrls={uploadedImageUrls}
                      onSubmit={submitDefectAnalysis}
                      onDiscard={discardSession}
                      uploadProgress={completedUploads}
                      totalUploads={totalUploads}
                      isUploading={isUploading}
                      failedUploadCount={failedUploadIndices.length}
                      onRetryUploads={retryFailedUploads}
                    />
                  </div>
                </div>
              </>
            ) : activePage === 'ntf-defects' ? (
              isPredicting ? (
                <div className="flex flex-col items-center justify-center min-h-[300px]">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
                  <div className="text-lg font-semibold">
                    Processing NTF check, please wait...
                  </div>
                </div>
              ) : predictionError &&
                predictionError !==
                  'No authentication token found. Please log in again.' ? (
                <ErrorDisplay
                  title={
                    predictionError === 'timeout'
                      ? 'NTF Check Timeout'
                      : predictionError === 'failed'
                      ? 'Task Failed'
                      : predictionError === 'processing_failed'
                      ? 'Processing Failed'
                      : 'Error'
                  }
                  message={predictedDefects.message || predictedDefects.error}
                  onRetry={retryNftChecker} // Changed from startNftChecker to retryNftChecker
                  onGoHome={resetNftAndGoBack}
                  homeButtonText="Go to NTF Checker Home"
                />
              ) : predictedDefects && !predictedDefects.error ? (
                <>
                  <header className="sticky w-screen top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
                    <div className="text-xl font-semibold">
                      NTF Checker Results
                    </div>
                  </header>
                  <div className="flex justify-center items-center min-h-screen bg-gray-100">
                    <div className="w-full max-w-2xl p-4">
                      <NftDefectsPage
                        defects={predictedDefects}
                        taskUuid={taskid}
                        onGoHome={resetNftAndGoBack}
                      />
                    </div>
                  </div>
                </>
              ) : predictedDefects &&
                predictedDefects.error ===
                  'No authentication token found. Please log in again.' ? (
                <div className="flex flex-col items-center justify-center min-h-[300px]">
                  <div className="text-red-600 text-center p-8">
                    {predictedDefects.message || predictedDefects.error}
                  </div>
                  <button
                    className="px-6 py-3 bg-primary text-white rounded hover:bg-primary/90 text-md font-semibold"
                    onClick={handleLogout}
                  >
                    Go to Login page
                  </button>
                </div>
              ) : null
            ) : activePage === 'bounding-box-drawing' ? (
              <BoundingBoxPage
                images={capturedImages}
                ppid={ppid}
                uploadedImageUrls={uploadedImageUrls}
                isTestMode={isTestMode}
                onSubmit={handleBoundingBoxSubmit}
                onDiscard={resetSelfLearningAndGoBack}
              />
            ) : (
              // All other pages remain inside HomePage (with sidebar/header)
              <HomePage
                handleLogout={handleLogout}
                onNavigate={handleNavigate}
                activePage={activePage}
                pageTitle={pageTitles[activePage] || ''}
                username={username}
                userData={userData}
              >
                {renderActivePage() || <></>}
              </HomePage>
            )}
          </div>
        </div>
      </CameraProvider>
    </AppModeProvider>
  );
}

export default App;
