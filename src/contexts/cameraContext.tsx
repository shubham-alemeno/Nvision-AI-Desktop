import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';

export interface CameraResolution {
  width: number;
  height: number;
  label: string;
}

export interface CameraDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

interface CameraContextType {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  videoTrackRef: React.RefObject<MediaStreamTrack>;
  isCameraReady: boolean;
  isLoading: boolean;
  cameraError: string | null;
  cameraResolution: { width: number; height: number } | null;
  availableResolutions: CameraResolution[];
  selectedResolution: CameraResolution;
  availableDevices: CameraDevice[];
  selectedDevice: CameraDevice | null;
  setupCamera: (
    resolution?: CameraResolution,
    deviceId?: string
  ) => Promise<void>;
  stopCamera: () => void;
  adjustCameraSettings: (settings: CameraSettings) => void;
  captureImage: () => string | null;
  setResolution: (resolution: CameraResolution) => Promise<void>;
  setDevice: (device: CameraDevice) => Promise<void>;
  getAvailableResolutions: (deviceId?: string) => Promise<CameraResolution[]>;
  getAvailableDevices: () => Promise<CameraDevice[]>;
  clearCameraError: () => void;
}

interface CameraSettings {
  exposureMode?: string;
  exposureTime?: number;
  exposureCompensation?: number;
  focusMode?: string;
  brightness?: string;
  contrast?: string;
  focusDistance?: number;
}

const CameraContext = createContext<CameraContextType | null>(null);

export const useCamera = () => {
  const context = useContext(CameraContext);
  if (!context) {
    throw new Error('useCamera must be used within a CameraProvider');
  }
  return context;
};

// Common resolution presets (ordered by preference)
const RESOLUTION_PRESETS: CameraResolution[] = [
  // 4K resolutions first (highest priority for professional cameras)
  { width: 4096, height: 2160, label: 'DCI 4K (4096x2160)' },
  { width: 3840, height: 2160, label: '4K UHD (3840x2160)' },
  { width: 4096, height: 3072, label: 'HXGA (4096x3072)' },

  // 2K and high-end resolutions
  { width: 3200, height: 2400, label: 'QUXGA (3200x2400)' },
  { width: 2560, height: 2048, label: 'QSXGA (2560x2048)' },
  { width: 2560, height: 1440, label: 'QHD (2560x1440)' },
  { width: 2048, height: 1536, label: 'QXGA (2048x1536)' },

  // Standard HD resolutions
  { width: 1920, height: 1080, label: 'Full HD (1920x1080)' },
  { width: 1600, height: 1200, label: 'UXGA (1600x1200)' },
  { width: 1280, height: 1024, label: 'SXGA (1280x1024)' },
  { width: 1280, height: 720, label: 'HD (1280x720)' },
  { width: 1024, height: 768, label: 'XGA (1024x768)' },
  { width: 800, height: 600, label: 'SVGA (800x600)' },
  { width: 640, height: 480, label: 'VGA (640x480)' },
];

export const CameraProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraResolution, setCameraResolution] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [availableResolutions, setAvailableResolutions] = useState<
    CameraResolution[]
  >([]);
  const [selectedResolution, setSelectedResolution] =
    useState<CameraResolution>(RESOLUTION_PRESETS[0]); // Always start with Full HD default

  const [availableDevices, setAvailableDevices] = useState<CameraDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<CameraDevice | null>(
    null
  ); // Will be set when devices are loaded

  // Get available camera devices
  const getAvailableDevices = async (): Promise<CameraDevice[]> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      const physicalCameras = videoDevices.filter(
        (device) =>
          !device.label.includes('OBS') && !device.label.includes('Virtual')
      );

      return physicalCameras.map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
        groupId: device.groupId || '',
      }));
    } catch (error) {
      console.error('Error getting available devices:', error);
      setCameraError(error instanceof Error ? error.message : 'Failed to get available devices');
      return [];
    }
  };

  // Test a single resolution with timeout (improved)
  const testResolution = async (
    deviceId: string,
    preset: CameraResolution,
    timeoutMs: number = 3000
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log(
          `Resolution ${preset.label} test timed out for device ${deviceId}`
        );
        resolve(false);
      }, timeoutMs);

      const testConstraints = {
        video: {
          deviceId: { exact: deviceId },
          width: { exact: preset.width },
          height: { exact: preset.height },
        },
      };

      navigator.mediaDevices
        .getUserMedia(testConstraints)
        .then((testStream) => {
          clearTimeout(timeout);
          const track = testStream.getVideoTracks()[0];
          const settings = track.getSettings();

          console.log(
            `Testing ${preset.label} for device ${deviceId}: got ${settings.width}x${settings.height} (expected ${preset.width}x${preset.height})`
          );

          // More flexible resolution matching - allow for small variations
          // Use larger tolerance for 4K resolutions as they may have more variation
          const is4K = preset.width >= 3840 || preset.height >= 2160;
          const tolerance = is4K ? 50 : 10; // Allow 50px variation for 4K, 10px for others

          const widthMatch =
            Math.abs((settings.width || 0) - preset.width) <= tolerance;
          const heightMatch =
            Math.abs((settings.height || 0) - preset.height) <= tolerance;
          const isSupported = widthMatch && heightMatch;

          // Clean up test stream immediately
          testStream.getTracks().forEach((track) => track.stop());

          console.log(
            `Resolution ${preset.label} ${
              isSupported ? 'SUPPORTED' : 'NOT SUPPORTED'
            } for device ${deviceId}`
          );
          resolve(isSupported);
        })
        .catch((error) => {
          clearTimeout(timeout);
          console.log(
            `Resolution ${preset.label} failed for device ${deviceId}:`,
            error.message
          );
          if (error instanceof DOMException) {
            console.error('DOMException in testResolution:', error.name, error.message);
          }
          resolve(false);
        });
    });
  };

  // Get available camera resolutions for a specific device (always fresh detection)
  const getAvailableResolutions = async (
    deviceId?: string
  ): Promise<CameraResolution[]> => {
    try {
      const targetDeviceId = deviceId || selectedDevice?.deviceId;
      if (!targetDeviceId) {
        // If no device specified, get devices first
        const devices = await getAvailableDevices();
        if (devices.length === 0) return [RESOLUTION_PRESETS[0]];
        return getAvailableResolutions(devices[0].deviceId);
      }

      console.log(`Testing resolutions for device ${targetDeviceId}...`);

      // Test resolutions in parallel with adequate timeout for reliable detection
      // Use longer timeout for 4K resolutions as they take more time to initialize
      const resolutionTests = RESOLUTION_PRESETS.map((preset) => {
        const is4K = preset.width >= 3840 || preset.height >= 2160;
        const timeout = is4K ? 5000 : 3000; // 5 seconds for 4K, 3 seconds for others

        console.log(
          `Starting test for ${preset.label} with ${timeout}ms timeout${
            is4K ? ' (4K resolution)' : ''
          }...`
        );

        return testResolution(targetDeviceId, preset, timeout).then(
          (isSupported) => ({
            preset,
            isSupported,
          })
        );
      });

      const results = await Promise.all(resolutionTests);
      const supportedResolutions = results
        .filter((result) => result.isSupported)
        .map((result) => result.preset);

      const finalResolutions =
        supportedResolutions.length > 0
          ? supportedResolutions
          : [RESOLUTION_PRESETS[0]];

      console.log(
        `Found ${finalResolutions.length} supported resolutions for device ${targetDeviceId}:`,
        finalResolutions.map((r) => r.label)
      );

      return finalResolutions;
    } catch (error) {
      console.error('Error getting available resolutions:', error);
      setCameraError(error instanceof Error ? error.message : 'Failed to get available resolutions');
      return [RESOLUTION_PRESETS[0]];
    }
  };

  // Setup camera stream with exact resolution constraints (for resolution switching)
  const setupCameraWithExactResolution = async (
    resolution: CameraResolution
  ) => {
    setIsLoading(true);
    setIsCameraReady(false);

    const targetDeviceId = selectedDevice?.deviceId;

    try {
      if (!targetDeviceId) {
        throw new Error('No camera device selected');
      }

      console.log(
        `Setting up camera with EXACT resolution: ${resolution.width}x${resolution.height}`
      );

      // Use EXACT constraints to force the specific resolution
      const constraints = {
        video: {
          deviceId: { exact: targetDeviceId },
          width: { exact: resolution.width },
          height: { exact: resolution.height },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        // Clear any existing event handlers first
        videoRef.current.onloadedmetadata = null;
        videoRef.current.onplaying = null;
        videoRef.current.onerror = null;

        videoRef.current.srcObject = stream;
        const videoTrack = stream.getVideoTracks()[0];
        videoTrackRef.current = videoTrack;

        // Set up event handlers for video element
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
        };

        videoRef.current.onplaying = () => {
          const actualSettings = videoTrack.getSettings();
          console.log(
            `Camera started with EXACT resolution: ${actualSettings.width}x${actualSettings.height} (requested: ${resolution.width}x${resolution.height})`
          );

          setCameraResolution({
            width: actualSettings.width || resolution.width,
            height: actualSettings.height || resolution.height,
          });

          setIsLoading(false);
          setIsCameraReady(true);
        };

        videoRef.current.onerror = () => {
          setIsLoading(false);
          console.error('Video element error during resolution switch');
        };
      }
    } catch (error) {
      console.error('Error setting up camera with exact resolution:', error);
      setIsLoading(false);
      const errorMessage = error instanceof Error ? error.message : 'Failed to set up camera with exact resolution';
      setCameraError(errorMessage);
      
      if (error instanceof DOMException) {
        console.error('DOMException in setupCameraWithExactResolution:', error.name, error.message);
      }
      throw error;
    }
  };

  // Setup camera stream (for initial setup with flexible constraints)
  const setupCamera = async (
    resolution?: CameraResolution,
    deviceId?: string
  ) => {
    // Stop any existing stream first
    stopCamera();
    setIsLoading(true);
    setIsCameraReady(false);

    const targetResolution = resolution || selectedResolution;
    const targetDeviceId = deviceId || selectedDevice?.deviceId;

    try {
      // If no device is selected, get available devices and select the first one
      if (!targetDeviceId) {
        const devices = await getAvailableDevices();
        if (devices.length > 0) {
          setSelectedDevice(devices[0]);
          setAvailableDevices(devices);
          return setupCamera(targetResolution, devices[0].deviceId);
        } else {
          throw new Error('No camera devices found');
        }
      }

      const constraints = {
        video: {
          deviceId: { exact: targetDeviceId },
          width: { ideal: targetResolution.width },
          height: { ideal: targetResolution.height },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        const videoTrack = stream.getVideoTracks()[0];
        videoTrackRef.current = videoTrack;

        // const capabilities = videoTrack.getCapabilities();
        // const advancedConstraints: any = {};

        // if ('exposureMode' in capabilities) {
        //   advancedConstraints.exposureMode = 'manual';
        // }

        // if (Object.keys(advancedConstraints).length > 0) {
        //   try {
        //     await videoTrack.applyConstraints({
        //       advanced: [advancedConstraints],
        //     });
        //     console.log(
        //       'Applied initial camera settings:',
        //       advancedConstraints
        //     );
        //   } catch (error) {
        //     console.error('Error applying initial camera settings:', error);
        //   }
        // }

        // Set up event handlers for video element
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
        };

        videoRef.current.onplaying = () => {
          setIsCameraReady(true);
          setIsLoading(false);
          const settings = videoTrack.getSettings();
          const actualResolution = {
            width: settings.width || 0,
            height: settings.height || 0,
          };

          setCameraResolution(actualResolution);

          console.log(
            `Camera initialized with resolution: ${actualResolution.width}x${actualResolution.height} (selected: ${selectedResolution.label})`
          );

          // Don't auto-update selectedResolution - let user's manual selection stay
          // Only update if this is initial setup and no resolution was explicitly selected
        };

        videoRef.current.onerror = () => {
          setIsLoading(false);
          setIsCameraReady(false);
          console.error('Video element error');
        };
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setIsLoading(false);
      setIsCameraReady(false);
      console.log('called')
      
      let errorMessage = 'Failed to access camera';
      
      if (error instanceof DOMException) {
        // Provide user-friendly messages for specific DOMException types
        if (error.name === 'OverconstrainedError') {
          errorMessage = 'Camera disconnected or not available. Please check if the camera is connected properly and try again.';
        } else if (error.name === 'NotAllowedError') {
          errorMessage = 'Camera access denied. Please allow camera permissions in your browser settings.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No camera devices found. Please connect a camera and try again.';
        } else {
          errorMessage = `Camera error: ${error.message}`;
        }
        console.error('DOMException details:', error.name, error.message);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setCameraError(errorMessage);
    }
  };

  // Set resolution and restart camera (force complete restart)
  const setResolution = async (resolution: CameraResolution) => {
    try {
      console.log(
        `Switching to resolution: ${resolution.label} (${resolution.width}x${resolution.height})`
      );

      // Force stop current camera completely
      stopCamera();

      // Clear video element source to prevent caching
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      // Wait a bit to ensure complete cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Update selected resolution
      setSelectedResolution(resolution);

      // Force complete camera restart with exact constraints
      await setupCameraWithExactResolution(resolution);
    } catch (error) {
      console.error('Error setting resolution:', error);
      setIsLoading(false);
      if (error instanceof DOMException) {
        console.error('DOMException in setResolution:', error.name, error.message);
        setCameraError(`Resolution error: ${error.message}`);
      }
    }
  };

  // Set device and restart camera
  const setDevice = async (device: CameraDevice) => {
    try {
      setIsLoading(true);
      setSelectedDevice(device);

      // Get resolutions for the new device (always fresh detection)
      const resolutions = await getAvailableResolutions(device.deviceId);
      setAvailableResolutions(resolutions);

      // If current resolution is not supported by new device, switch to first available
      const isCurrentResolutionSupported = resolutions.some(
        (res) =>
          res.width === selectedResolution.width &&
          res.height === selectedResolution.height
      );

      const targetResolution = isCurrentResolutionSupported
        ? selectedResolution
        : resolutions[0];

      if (!isCurrentResolutionSupported && resolutions.length > 0) {
        setSelectedResolution(targetResolution);
      }

      // Start camera setup immediately with target resolution
      await setupCamera(targetResolution, device.deviceId);
    } catch (error) {
      console.error('Error setting device:', error);
      setIsLoading(false);
      const errorMessage = error instanceof Error ? error.message : 'Failed to set device';
      setCameraError(errorMessage);
      
      if (error instanceof DOMException) {
        console.error('DOMException in setDevice:', error.name, error.message);
      }
    }
  };

  // Initialize devices and resolutions on mount
  useEffect(() => {
    const initCamera = async () => {
      console.log('Initializing camera - fresh detection');

      const devices = await getAvailableDevices();
      setAvailableDevices(devices);

      if (devices.length > 0) {
        // Always use the first device as default
        const deviceToUse = devices[0];
        setSelectedDevice(deviceToUse);

        // Get resolutions for the selected device (always fresh detection)
        const resolutions = await getAvailableResolutions(deviceToUse.deviceId);
        setAvailableResolutions(resolutions);

        // Set the first resolution as default
        if (resolutions.length > 0) {
          setSelectedResolution(resolutions[0]);
        }
      }
    };
    initCamera();
  }, []);

  // Stop camera stream (thorough cleanup)
  const stopCamera = () => {
    console.log('Stopping camera stream...');

    // Stop all tracks in the current stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: MediaStreamTrack) => {
        track.stop();
        console.log(`Stopped ${track.kind} track`);
      });
      streamRef.current = null;
    }

    // Clear video track reference
    videoTrackRef.current = null;

    // Clear video element source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Reset camera state
    setIsCameraReady(false);
    setCameraResolution(null);
  };

  // Clear camera error
  const clearCameraError = () => {
    setCameraError(null);
  };

  // Adjust camera settings
  const adjustCameraSettings = async (settings: CameraSettings) => {
    const track = videoTrackRef.current;
    if (!track) return;

    try {
      const capabilities = track.getCapabilities();
      console.log('Camera capabilities:', capabilities);

      // Filter settings based on capabilities
      const applicableSettings: any = {};

      if ('exposureMode' in capabilities && settings.exposureMode) {
        applicableSettings.exposureMode = settings.exposureMode;
      }

      if ('exposureTime' in capabilities && settings.exposureTime) {
        applicableSettings.exposureTime = settings.exposureTime;
      }

      if (
        'exposureCompensation' in capabilities &&
        settings.exposureCompensation !== undefined
      ) {
        applicableSettings.exposureCompensation = settings.exposureCompensation;
      }

      if ('focusMode' in capabilities && settings.focusMode) {
        applicableSettings.focusMode = settings.focusMode;
      }
      if ('brightness' in capabilities && settings.brightness !== undefined) {
        applicableSettings.brightness = settings.brightness;
      }
      if ('contrast' in capabilities && settings.contrast !== undefined) {
        applicableSettings.contrast = settings.contrast;
      }

      if (
        'focusDistance' in capabilities &&
        settings.focusDistance !== undefined
      ) {
        applicableSettings.focusDistance = settings.focusDistance;
      }

      // Apply only the supported settings
      track.applyConstraints(applicableSettings);
      console.log('Applied camera settings:', applicableSettings);
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log('After settings:', track.getSettings());
    } catch (error) {
      console.error('Error applying camera constraints:', error);
      if (error instanceof DOMException) {
        console.error('DOMException in adjustCameraSettings:', error.name, error.message);
        setCameraError(`Camera settings error: ${error.message}`);
      }
    }
  };

  // Capture image from video stream
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current || !isCameraReady) {
      return null;
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    const videoWidth = videoRef.current.videoWidth;
    const videoHeight = videoRef.current.videoHeight;

    canvas.width = videoWidth;
    canvas.height = videoHeight;

    if (context) {
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png', 1.0);
    }

    return null;
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const value = {
    videoRef,
    canvasRef,
    videoTrackRef,
    isCameraReady,
    isLoading,
    cameraError,
    cameraResolution,
    availableResolutions,
    selectedResolution,
    availableDevices,
    selectedDevice,
    setupCamera,
    stopCamera,
    adjustCameraSettings,
    captureImage,
    setResolution,
    setDevice,
    getAvailableResolutions,
    getAvailableDevices,
    clearCameraError,
  };

  return (
    <CameraContext.Provider value={value}>
      {children}
      <div style={{ display: 'none' }}>
        {/* <video ref={videoRef} autoPlay playsInline /> */}
        <canvas ref={canvasRef} />
      </div>
    </CameraContext.Provider>
  );
};
