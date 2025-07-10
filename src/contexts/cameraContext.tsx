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
      return [RESOLUTION_PRESETS[0]];
    }
  };

  // Setup camera stream
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

          // Update selectedResolution to match what the camera is actually providing
          const matchingPreset = RESOLUTION_PRESETS.find(
            (preset) =>
              preset.width === actualResolution.width &&
              preset.height === actualResolution.height
          );

          if (matchingPreset) {
            // Check if we need to update the selected resolution
            if (
              !selectedResolution ||
              selectedResolution.width !== actualResolution.width ||
              selectedResolution.height !== actualResolution.height
            ) {
              console.log(
                `Updating selectedResolution to match actual camera resolution: ${matchingPreset.label} (${actualResolution.width}x${actualResolution.height})`
              );
              setSelectedResolution(matchingPreset);
            }
          } else {
            // If actual resolution doesn't match any preset, create a custom one
            const customResolution: CameraResolution = {
              width: actualResolution.width,
              height: actualResolution.height,
              label: `Custom (${actualResolution.width}x${actualResolution.height})`,
            };

            console.log(
              `Camera is using non-standard resolution: ${customResolution.label}`
            );
            setSelectedResolution(customResolution);
          }
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
    }
  };

  // Set resolution and restart camera
  const setResolution = async (resolution: CameraResolution) => {
    try {
      setSelectedResolution(resolution);
      await setupCamera(resolution);
    } catch (error) {
      console.error('Error setting resolution:', error);
      setIsLoading(false);
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

  // Stop camera stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    videoTrackRef.current = null;
    setIsCameraReady(false);
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
