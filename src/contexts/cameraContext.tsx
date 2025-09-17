import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";

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
    throw new Error("useCamera must be used within a CameraProvider");
  }
  return context;
};

// Comprehensive resolution presets - ordered by common usage
const RESOLUTION_PRESETS: CameraResolution[] = [
  { width: 3840, height: 2160, label: "4K UHD (3840×2160)" },
  { width: 2560, height: 1440, label: "QHD (2560×1440)" },
  { width: 1920, height: 1080, label: "Full HD (1920×1080)" },
  { width: 1280, height: 720, label: "HD (1280×720)" },
  // { width: 854, height: 480, label: "FWVGA (854×480)" },
  // { width: 640, height: 480, label: "VGA (640×480)" },
  // { width: 320, height: 240, label: "QVGA (320×240)" },
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
    useState<CameraResolution>(RESOLUTION_PRESETS[2]); // Start with Full HD
  const [availableDevices, setAvailableDevices] = useState<CameraDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<CameraDevice | null>(
    null
  );

  // Get available camera devices
  const getAvailableDevices = async (): Promise<CameraDevice[]> => {
    try {
      // Request permissions first to get proper device labels
      const permissionStream = await navigator.mediaDevices.getUserMedia({ 
        video: true 
      });
      permissionStream.getTracks().forEach(track => track.stop());

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      
      // Filter out virtual cameras and screen capture devices
      const physicalCameras = videoDevices.filter(
        (device) =>
          !device.label.toLowerCase().includes("obs") &&
          !device.label.toLowerCase().includes("virtual") &&
          !device.label.toLowerCase().includes("screen") &&
          !device.label.toLowerCase().includes("capture")
      );

      return physicalCameras.map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
        groupId: device.groupId || "",
      }));
    } catch (error) {
      console.error("Error getting available devices:", error);
      setCameraError("Failed to access camera devices. Please check permissions.");
      return [];
    }
  };

  // Simplified resolution testing - one at a time with proper cleanup
  const testSingleResolution = async (
    deviceId: string,
    preset: CameraResolution
  ): Promise<boolean> => {
    let testStream: MediaStream | null = null;
    
    try {
      console.log(`Testing ${preset.label} for device ${deviceId}`);
      
      const constraints = {
        video: {
          deviceId: { exact: deviceId },
          width: { exact: preset.width },
          height: { exact: preset.height },
        },
      };

      // Set a reasonable timeout
      const streamPromise = navigator.mediaDevices.getUserMedia(constraints);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      );

      testStream = await Promise.race([streamPromise, timeoutPromise]) as MediaStream;
      
      if (testStream) {
        const track = testStream.getVideoTracks()[0];
        const settings = track.getSettings();
        
        // Check if we got exactly what we asked for
        const gotExact = settings.width === preset.width && 
                        settings.height === preset.height;
        
        console.log(`${preset.label}: ${gotExact ? 'SUPPORTED' : 'NOT EXACT'} (got ${settings.width}×${settings.height})`);
        
        // Clean up immediately
        testStream.getTracks().forEach(track => track.stop());
        
        return gotExact;
      }
      
      return false;
    } catch (error) {
      console.log(`${preset.label}: FAILED (${error.message})`);
      
      // Clean up on error
      if (testStream) {
        testStream.getTracks().forEach(track => track.stop());
      }
      
      return false;
    }
  };

  // Get available resolutions for a specific device - simplified and robust
  const getAvailableResolutions = async (
    deviceId?: string
  ): Promise<CameraResolution[]> => {
    const targetDeviceId = deviceId || selectedDevice?.deviceId;
    
    if (!targetDeviceId) {
      console.log("No device selected, returning default resolutions");
      return [RESOLUTION_PRESETS[2], RESOLUTION_PRESETS[3]]; // Full HD and HD
    }

    console.log(`Getting available resolutions for device: ${targetDeviceId}`);
    
    try {
      // First, get camera capabilities to understand limits
      let maxWidth = 4096;
      let maxHeight = 2160;
      
      try {
        const capabilityStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: targetDeviceId } }
        });
        const track = capabilityStream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        console.log('capabilities', capabilities)
        if (capabilities.width?.max) maxWidth = capabilities.width.max;
        if (capabilities.height?.max) maxHeight = capabilities.height.max;
        
        capabilityStream.getTracks().forEach(track => track.stop());
        
        console.log(`Camera max capabilities: ${maxWidth}×${maxHeight}`);
      } catch (capError) {
        console.log("Could not get capabilities, using defaults");
      }

      // Filter presets to only test reasonable resolutions
      const candidateResolutions = RESOLUTION_PRESETS.filter(
        preset => preset.width <= maxWidth && preset.height <= maxHeight
      );

      const supportedResolutions: CameraResolution[] = [];
      
      // Test resolutions one by one with delays to avoid overwhelming the camera
      for (const preset of candidateResolutions) {
        const isSupported = await testSingleResolution(targetDeviceId, preset);
        
        if (isSupported) {
          supportedResolutions.push(preset);
        }
        
        // Small delay between tests to prevent camera conflicts
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Ensure we always have at least one resolution
      if (supportedResolutions.length === 0) {
        console.warn("No exact resolutions found, adding fallbacks");
        supportedResolutions.push(
          RESOLUTION_PRESETS[2], // Full HD
          RESOLUTION_PRESETS[3]  // HD
        );
      }

      // Sort by resolution (highest first)
      supportedResolutions.sort((a, b) => (b.width * b.height) - (a.width * a.height));
      
      console.log(`Found ${supportedResolutions.length} supported resolutions:`, 
        supportedResolutions.map(r => r.label));
      
      return supportedResolutions;
    } catch (error) {
      console.error("Error testing resolutions:", error);
      // Return safe fallback resolutions
      return [
        RESOLUTION_PRESETS[2], // Full HD
        RESOLUTION_PRESETS[3], // HD
        RESOLUTION_PRESETS[5]  // VGA
      ];
    }
  };

  // Setup camera with specific resolution
  const setupCameraStream = async (resolution: CameraResolution) => {
    setIsLoading(true);
    setIsCameraReady(false);
    setCameraError(null);

    const targetDeviceId = selectedDevice?.deviceId;

    try {
      console.log(`Setting up camera: ${resolution.label} on device ${targetDeviceId}`);

      const constraints: MediaStreamConstraints = {
        video: {
          deviceId: targetDeviceId ? { exact: targetDeviceId } : undefined,
          width: { exact: resolution.width },
          height: { exact: resolution.height },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        // Clear any existing event handlers
        videoRef.current.onloadedmetadata = null;
        videoRef.current.onplaying = null;
        videoRef.current.onerror = null;

        videoRef.current.srcObject = stream;
        const videoTrack = stream.getVideoTracks()[0];
        videoTrackRef.current = videoTrack;

        // Set up event handlers
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(console.error);
        };

        videoRef.current.onplaying = () => {
          const settings = videoTrack.getSettings();
          console.log(`Camera active: ${settings.width}×${settings.height}`);

          setCameraResolution({
            width: settings.width || resolution.width,
            height: settings.height || resolution.height,
          });

          setIsLoading(false);
          setIsCameraReady(true);
        };

        videoRef.current.onerror = (error) => {
          console.error("Video element error:", error);
          setIsLoading(false);
          setIsCameraReady(false);
          setCameraError("Video playback failed");
        };
      }
    } catch (error) {
      console.error("Error setting up camera stream:", error);
      setIsLoading(false);
      setIsCameraReady(false);

      let errorMessage = "Failed to setup camera";
      if (error instanceof DOMException) {
        switch (error.name) {
          case "NotAllowedError":
            errorMessage = "Camera access denied. Please allow camera permissions.";
            break;
          case "NotFoundError":
            errorMessage = "Camera not found. Please check camera connection.";
            break;
          case "OverconstrainedError":
            errorMessage = "Selected resolution not supported by this camera.";
            break;
          default:
            errorMessage = `Camera error: ${error.message}`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setCameraError(errorMessage);
      throw error;
    }
  };

  // Main setup camera function
  const setupCamera = async (
    resolution?: CameraResolution,
    deviceId?: string
  ) => {
    try {
      // Stop any existing stream first
      stopCamera();
      
      const targetResolution = resolution || selectedResolution;
      const targetDeviceId = deviceId || selectedDevice?.deviceId;

      // If no device is selected, get available devices first
      if (!targetDeviceId) {
        const devices = await getAvailableDevices();
        if (devices.length > 0) {
          setSelectedDevice(devices[0]);
          setAvailableDevices(devices);
          return setupCamera(targetResolution, devices[0].deviceId);
        } else {
          throw new Error("No camera devices available");
        }
      }

      await setupCameraStream(targetResolution);
    } catch (error) {
      console.error("Setup camera failed:", error);
      // Error handling is done in setupCameraStream
    }
  };

  // Set resolution and restart camera
  const setResolution = async (resolution: CameraResolution) => {
    try {
      console.log(`Switching to resolution: ${resolution.label}`);
      setSelectedResolution(resolution);
      
      // Small delay to ensure clean transition
      await new Promise(resolve => setTimeout(resolve, 100));
      await setupCameraStream(resolution);
    } catch (error) {
      console.error("Error changing resolution:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to change resolution";
      setCameraError(errorMessage);
    }
  };

  // Set device and get its available resolutions
  const setDevice = async (device: CameraDevice) => {
    try {
      setIsLoading(true);
      setCameraError(null);
      console.log(`Switching to device: ${device.label}`);

      // Stop current camera
      stopCamera();
      setSelectedDevice(device);

      // Get available resolutions for this device
      const resolutions = await getAvailableResolutions(device.deviceId);
      setAvailableResolutions(resolutions);

      // Check if current resolution is supported by new device
      const isCurrentSupported = resolutions.some(
        res => res.width === selectedResolution.width && res.height === selectedResolution.height
      );

      // Use current resolution if supported, otherwise use the first available
      const targetResolution = isCurrentSupported ? selectedResolution : resolutions[0];
      
      if (!isCurrentSupported) {
        setSelectedResolution(targetResolution);
      }

      // Setup camera with target resolution
      await setupCamera(targetResolution, device.deviceId);
    } catch (error) {
      console.error("Error switching device:", error);
      setIsLoading(false);
      setCameraError(error instanceof Error ? error.message : "Failed to switch camera device");
    }
  };

  // Initialize on mount
  useEffect(() => {
    const initializeCamera = async () => {
      console.log("Initializing camera system...");
      setIsLoading(true);

      try {
        // Get available devices
        const devices = await getAvailableDevices();
        setAvailableDevices(devices);

        if (devices.length > 0) {
          const primaryDevice = devices[0];
          setSelectedDevice(primaryDevice);

          // Get available resolutions for the primary device
          const resolutions = await getAvailableResolutions(primaryDevice.deviceId);
          setAvailableResolutions(resolutions);

          // Select best starting resolution (prefer Full HD if available, otherwise highest)
          const preferredResolution = resolutions.find(r => r.width === 1920 && r.height === 1080) || resolutions[0];
          setSelectedResolution(preferredResolution);

          console.log(`Initialized with device: ${primaryDevice.label}, resolution: ${preferredResolution.label}`);
        } else {
          setCameraError("No camera devices found");
        }
      } catch (error) {
        console.error("Camera initialization failed:", error);
        setCameraError(error instanceof Error ? error.message : "Failed to initialize camera");
      } finally {
        setIsLoading(false);
      }
    };

    initializeCamera();
  }, []);

  // Stop camera stream
  const stopCamera = () => {
    console.log("Stopping camera...");

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    videoTrackRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraReady(false);
    setCameraResolution(null);
  };

  // Clear camera error
  const clearCameraError = () => {
    setCameraError(null);
  };

  // Adjust camera settings (simplified)
  const adjustCameraSettings = async (settings: CameraSettings) => {
    const track = videoTrackRef.current;
    if (!track) {
      console.warn("No active video track for settings adjustment");
      return;
    }

    try {
      const capabilities = track.getCapabilities();
      const applicableSettings: any = {};

      // Only apply settings that are supported
      Object.entries(settings).forEach(([key, value]) => {
        if (key in capabilities && value !== undefined) {
          applicableSettings[key] = value;
        }
      });

      if (Object.keys(applicableSettings).length > 0) {
        await track.applyConstraints(applicableSettings);
        console.log("Applied camera settings:", applicableSettings);
      }
    } catch (error) {
      console.error("Error applying camera settings:", error);
      setCameraError(error instanceof Error ? error.message : "Failed to apply camera settings");
    }
  };

  // Capture image from video stream
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current || !isCameraReady) {
      console.warn("Cannot capture image: camera not ready");
      return null;
    }

    try {
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      const video = videoRef.current;

      if (!context) {
        console.error("Cannot get canvas context");
        return null;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png", 1.0);
    } catch (error) {
      console.error("Error capturing image:", error);
      return null;
    }
  };

  // Cleanup on unmount
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
      <div style={{ display: "none" }}>
        <canvas ref={canvasRef} />
      </div>
    </CameraContext.Provider>
  );
};