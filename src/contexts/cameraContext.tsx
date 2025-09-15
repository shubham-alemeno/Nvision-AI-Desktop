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

// Common resolution presets (ordered by preference)
const RESOLUTION_PRESETS: CameraResolution[] = [
  // 4K resolutions first (highest priority for professional cameras)
  { width: 4096, height: 2160, label: "DCI 4K (4096x2160)" },
  { width: 3840, height: 2160, label: "4K UHD (3840x2160)" },
  // { width: 4096, height: 3072, label: 'HXGA (4096x3072)' },

  // 2K and high-end resolutions
  // { width: 3200, height: 2400, label: 'QUXGA (3200x2400)' },
  // { width: 2560, height: 2048, label: 'QSXGA (2560x2048)' },
  { width: 2560, height: 1440, label: "QHD (2560x1440)" },
  // { width: 2048, height: 1536, label: 'QXGA (2048x1536)' },

  // Standard HD resolutions
  { width: 1920, height: 1080, label: "Full HD (1920x1080)" },
  // { width: 1600, height: 1200, label: 'UXGA (1600x1200)' },
  // { width: 1280, height: 1024, label: 'SXGA (1280x1024)' },
  { width: 1280, height: 720, label: "HD (1280x720)" },
  // { width: 1024, height: 768, label: 'XGA (1024x768)' },
  // { width: 800, height: 600, label: 'SVGA (800x600)' },
  // { width: 640, height: 480, label: 'VGA (640x480)' },
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
    useState<CameraResolution>(RESOLUTION_PRESETS[0]); // Start with Full HD as default
  console.log(RESOLUTION_PRESETS[3]);
  const [availableDevices, setAvailableDevices] = useState<CameraDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<CameraDevice | null>(
    null
  );

  // Get available camera devices
  const getAvailableDevices = async (): Promise<CameraDevice[]> => {
    try {
      // Request permissions first to get proper device labels
      await navigator.mediaDevices.getUserMedia({ video: true });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      const physicalCameras = videoDevices.filter(
        (device) =>
          !device.label.includes("OBS") &&
          !device.label.includes("Virtual") &&
          !device.label.includes("Screen")
      );

      return physicalCameras.map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
        groupId: device.groupId || "",
      }));
    } catch (error) {
      console.error("Error getting available devices:", error);
      setCameraError(
        error instanceof Error
          ? error.message
          : "Failed to get available devices"
      );
      return [];
    }
  };

  // Test a single resolution with improved logic
  const testResolution = async (
    deviceId: string,
    preset: CameraResolution,
    timeoutMs: number = 8000
  ): Promise<{
    supported: boolean;
    actualResolution?: { width: number; height: number };
  }> => {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log(
          `Resolution ${preset.label} test timed out for device ${deviceId}`
        );
        resolve({ supported: false });
      }, timeoutMs);

      // Test with exact constraints first
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
            `Testing ${preset.label}: got ${settings.width}x${settings.height}`
          );

          // Check if we got exactly what we asked for or very close
          const widthMatch = settings.width === preset.width;
          const heightMatch = settings.height === preset.height;

          // If exact match failed, check for close matches (within 5% tolerance)
          const widthTolerance = preset.width * 0.05;
          const heightTolerance = preset.height * 0.05;
          const widthClose =
            Math.abs((settings.width || 0) - preset.width) <= widthTolerance;
          const heightClose =
            Math.abs((settings.height || 0) - preset.height) <= heightTolerance;

          const isSupported =
            (widthMatch && heightMatch) || (widthClose && heightClose);

          // Clean up test stream
          testStream.getTracks().forEach((track) => track.stop());

          console.log(
            `Resolution ${preset.label} ${
              isSupported ? "SUPPORTED" : "NOT SUPPORTED"
            } for device ${deviceId}`
          );

          resolve({
            supported: isSupported,
            actualResolution: {
              width: settings.width || preset.width,
              height: settings.height || preset.height,
            },
          });
        })
        .catch((error) => {
          clearTimeout(timeout);
          console.log(
            `Resolution ${preset.label} failed for device ${deviceId}:`,
            error.message
          );

          // Try with ideal constraints as fallback
          const fallbackConstraints = {
            video: {
              deviceId: { exact: deviceId },
              width: { ideal: preset.width },
              height: { ideal: preset.height },
            },
          };

          navigator.mediaDevices
            .getUserMedia(fallbackConstraints)
            .then((fallbackStream) => {
              const track = fallbackStream.getVideoTracks()[0];
              const settings = track.getSettings();

              // Clean up fallback stream
              fallbackStream.getTracks().forEach((track) => track.stop());

              // Check if the fallback gave us a reasonable resolution
              const aspectRatio = preset.width / preset.height;
              const actualAspectRatio =
                (settings.width || 1) / (settings.height || 1);
              const aspectRatioMatch =
                Math.abs(aspectRatio - actualAspectRatio) < 0.1;

              // If aspect ratio matches and resolution is in reasonable range, consider it supported
              const sizeRatio =
                ((settings.width || 0) * (settings.height || 0)) /
                (preset.width * preset.height);
              const sizeReasonable = sizeRatio >= 0.5 && sizeRatio <= 2.0; // Within 50%-200% of target

              const fallbackSupported = aspectRatioMatch && sizeReasonable;

              console.log(
                `Fallback test for ${preset.label}: ${
                  fallbackSupported ? "SUPPORTED" : "NOT SUPPORTED"
                } (${settings.width}x${settings.height})`
              );

              resolve({
                supported: fallbackSupported,
                actualResolution: {
                  width: settings.width || preset.width,
                  height: settings.height || preset.height,
                },
              });
            })
            .catch(() => {
              resolve({ supported: false });
            });
        });
    });
  };

  // Get available camera resolutions with improved detection
  const getAvailableResolutions = async (
    deviceId?: string
  ): Promise<CameraResolution[]> => {
    try {
      const targetDeviceId = deviceId || selectedDevice?.deviceId;
      if (!targetDeviceId) {
        const devices = await getAvailableDevices();
        if (devices.length === 0) return [RESOLUTION_PRESETS[3]]; // Return Full HD as fallback
        return getAvailableResolutions(devices[0].deviceId);
      }

      console.log(`Testing resolutions for device ${targetDeviceId}...`);

      // Test all resolutions in smaller batches to avoid overwhelming the system
      // Get camera capabilities to optimize testing order
      let maxWidth = 4096;
      let maxHeight = 3072;

      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: targetDeviceId } },
        });
        const track = tempStream.getVideoTracks()[0];
        const capabilities = track.getCapabilities();
        maxWidth = capabilities.width?.max || 4096;
        maxHeight = capabilities.height?.max || 3072;
        tempStream.getTracks().forEach((t) => t.stop());

        console.log(`Camera max resolution: ${maxWidth}x${maxHeight}`);
      } catch (error) {
        console.log("Could not get capabilities, using defaults");
      }

      // Filter presets to only test resolutions within camera capabilities
      const filteredPresets = RESOLUTION_PRESETS.filter(
        (preset) => preset.width <= maxWidth && preset.height <= maxHeight
      );

      console.log(
        `Testing ${filteredPresets.length} resolutions (filtered from ${RESOLUTION_PRESETS.length})`
      );

      const batchSize = 2; // Smaller batches for more reliable testing
      const supportedResolutions: CameraResolution[] = [];

      for (let i = 0; i < filteredPresets.length; i += batchSize) {
        const batch = filteredPresets.slice(i, i + batchSize);
        // ... rest of the loop

        const batchTests = batch.map((preset) => {
          const is4K = preset.width >= 3840 || preset.height >= 2160;
          const timeout = is4K ? 10000 : 8000; // Longer timeout for 4K

          return testResolution(targetDeviceId, preset, timeout);
        });

        const batchResults = await Promise.allSettled(batchTests);

        batchResults.forEach((result, batchIndex) => {
          if (result.status === "fulfilled" && result.value.supported) {
            supportedResolutions.push(batch[batchIndex]);
          }
        });

        // Add a small delay between batches to prevent overwhelming the camera
        if (i + batchSize < RESOLUTION_PRESETS.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Ensure we always have at least one resolution available
      if (supportedResolutions.length === 0) {
        console.warn("No resolutions detected, adding fallback resolutions");
        // Add common fallback resolutions
        supportedResolutions.push(
          RESOLUTION_PRESETS[3], // Full HD
          RESOLUTION_PRESETS[4] // HD
          // RESOLUTION_PRESETS[12] // VGA
        );
      }

      // Sort by resolution (highest first)
      supportedResolutions.sort(
        (a, b) => b.width * b.height - a.width * a.height
      );
      console.log(supportedResolutions);
      console.log(
        `Found ${supportedResolutions.length} supported resolutions:`,
        supportedResolutions.map((r) => r.label)
      );

      return supportedResolutions;
    } catch (error) {
      console.error("Error getting available resolutions:", error);
      setCameraError(
        error instanceof Error
          ? error.message
          : "Failed to get available resolutions"
      );
      // Return fallback resolutions
      return [
        RESOLUTION_PRESETS[3], // Full HD
        RESOLUTION_PRESETS[4], // HD
        // RESOLUTION_PRESETS[12] // VGA
      ];
    }
  };

  // Setup camera stream with exact resolution constraints
  const setupCameraWithExactResolution = async (
    resolution: CameraResolution
  ) => {
    setIsLoading(true);
    setIsCameraReady(false);
    setCameraError(null);

    const targetDeviceId = selectedDevice?.deviceId;

    try {
      // if (!targetDeviceId) {
      //   throw new Error('No camera device selected');
      // }

      console.log(
        `Setting up camera with resolution: ${resolution.width}x${resolution.height}`
      );

      // Try exact first, fall back to ideal if exact fails
      let constraints: MediaStreamConstraints = {
        video: {
          deviceId: targetDeviceId ? { exact: targetDeviceId } : undefined,
          width: { exact: resolution.width },
          height: { exact: resolution.height },
        },
      };

      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (exactError) {
        console.log(
          `Exact constraints failed for ${resolution.label}, trying ideal:`,
          exactError.message
        );

        // Fallback to ideal constraints
        constraints = {
          video: {
            deviceId: targetDeviceId ? { exact: targetDeviceId } : undefined,
            width: { ideal: resolution.width, max: resolution.width },
            height: { ideal: resolution.height, max: resolution.height },
          },
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
      }

      // const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.onloadedmetadata = null;
        videoRef.current.onplaying = null;
        videoRef.current.onerror = null;

        videoRef.current.srcObject = stream;
        const videoTrack = stream.getVideoTracks()[0];
        videoTrackRef.current = videoTrack;

        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
        };

        videoRef.current.onplaying = () => {
          const actualSettings = videoTrack.getSettings();
          console.log(
            `Camera started with resolution: ${actualSettings.width}x${actualSettings.height}`
          );

          setCameraResolution({
            width: actualSettings.width || resolution.width,
            height: actualSettings.height || resolution.height,
          });

          setIsLoading(false);
          setIsCameraReady(true);
        };

        videoRef.current.onerror = (e) => {
          setIsLoading(false);
          setIsCameraReady(false);
          console.error("Video element error:", e);
          setCameraError("Video playback error");
        };
      }
    } catch (error) {
      console.error("Error setting up camera:", error);
      setIsLoading(false);
      setIsCameraReady(false);

      let errorMessage = "Failed to set up camera";
      if (error instanceof DOMException) {
        // if (error.name === 'OverconstrainedError') {
        //   errorMessage = 'The selected resolution is not supported by this camera';
        // } else
        if (error.name === "NotAllowedError") {
          errorMessage = "Camera access denied";
        } else if (error.name === "NotFoundError") {
          errorMessage = "Camera not found";
        } else {
          errorMessage = `Camera error: ${
            error?.message || "Camera error. Please refresh."
          }`;
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      setCameraError(errorMessage);
      throw error;
    }
  };

  // Setup camera stream (initial setup)
  const setupCamera = async (
    resolution?: CameraResolution,
    deviceId?: string
  ) => {
    stopCamera();
    setIsLoading(true);
    setIsCameraReady(false);
    setCameraError(null);

    const targetResolution = resolution || selectedResolution;
    const targetDeviceId = deviceId || selectedDevice?.deviceId;

    try {
      if (!targetDeviceId) {
        const devices = await getAvailableDevices();
        if (devices.length > 0) {
          setSelectedDevice(devices[0]);
          setAvailableDevices(devices);
          return setupCamera(targetResolution, devices[0].deviceId);
        } else {
          throw new Error("No camera devices found");
        }
      }

      if (
        !targetResolution ||
        targetResolution.width <= 0 ||
        targetResolution.height <= 0
      ) {
        console.log("Invalid resolution, using fallback");
        await setupCameraWithExactResolution(RESOLUTION_PRESETS[3]); // Full HD fallback
      } else {
        await setupCameraWithExactResolution(targetResolution);
      }

      // await setupCameraWithExactResolution(targetResolution);
    } catch (error) {
      console.error("Error in setupCamera:", error);

      // Don't show OverconstrainedError during resolution testing
      if (
        error.name !== "OverconstrainedError" ||
        availableResolutions.length > 0
      ) {
        setIsLoading(false);
        setIsCameraReady(false);
      }
    }
  };

  // Set resolution and restart camera
  const setResolution = async (resolution: CameraResolution) => {
    try {
      console.log(`Switching to resolution: ${resolution.label}`);

      stopCamera();

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      await new Promise((resolve) => setTimeout(resolve, 200));

      setSelectedResolution(resolution);
      await setupCameraWithExactResolution(resolution);
    } catch (error) {
      console.error("Error setting resolution:", error);
      setIsLoading(false);
      setIsCameraReady(false);

      const errorMessage =
        error instanceof Error ? error.message : "Failed to set resolution";
      setCameraError(errorMessage);
    }
  };

  // Set device and restart camera
  const setDevice = async (device: CameraDevice) => {
    try {
      setIsLoading(true);
      setCameraError(null);

      console.log(`Switching to device: ${device.label}`);

      // Stop current camera first
      stopCamera();

      setSelectedDevice(device);

      // Get fresh resolutions for the new device with retry logic
      let resolutions: CameraResolution[] = [];
      let retryCount = 0;
      const maxRetries = 2;

      while (resolutions.length === 0 && retryCount < maxRetries) {
        if (retryCount > 0) {
          console.log(
            `Retrying resolution detection (attempt ${retryCount + 1})`
          );
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        resolutions = await getAvailableResolutions(device.deviceId);
        retryCount++;
      }

      setAvailableResolutions(resolutions);

      // Check if current resolution is supported by new device
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

      // Start camera with target resolution
      await setupCamera(targetResolution, device.deviceId);
    } catch (error) {
      console.error("Error setting device:", error);
      setIsLoading(false);

      const errorMessage =
        error instanceof Error ? error.message : "Failed to set device";
      setCameraError(errorMessage);
    }
  };

  // Initialize devices and resolutions on mount
  useEffect(() => {
    const initCamera = async () => {
      console.log("Initializing camera system...");
      setIsLoading(true);

      try {
        const devices = await getAvailableDevices();
        setAvailableDevices(devices);

        if (devices.length > 0) {
          const deviceToUse = devices[0];
          setSelectedDevice(deviceToUse);

          // Get resolutions with retry logic
          // Get camera capabilities first to determine max resolution
          const tempStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceToUse.deviceId } },
          });
          const track = tempStream.getVideoTracks()[0];
          const capabilities = track.getCapabilities();
          tempStream.getTracks().forEach((t) => t.stop());

          console.log("Camera capabilities:", capabilities);

          // Find the best starting resolution based on capabilities
          const maxWidth = capabilities.width?.max || 1920;
          const maxHeight = capabilities.height?.max || 1080;

          // Find the best preset that fits within camera capabilities
          const suitablePreset = RESOLUTION_PRESETS.find(
            (preset) => preset.width <= maxWidth && preset.height <= maxHeight
          ) || {
            width: Math.min(1920, maxWidth),
            height: Math.min(1080, maxHeight),
            label: "Auto",
          };

          setSelectedResolution(suitablePreset);
          console.log(
            `Starting with resolution: ${suitablePreset.label} (${suitablePreset.width}x${suitablePreset.height})`
          );

          // Test resolutions in background after initial setup
          getAvailableResolutions(deviceToUse.deviceId).then((resolutions) => {
            setAvailableResolutions(resolutions);
            console.log("Background resolution testing complete");
          });
        }
      } catch (error) {
        console.error("Error during camera initialization:", error);
        setCameraError(
          error instanceof Error ? error.message : "Failed to initialize camera"
        );
      } finally {
        setIsLoading(false);
      }
    };

    initCamera();
  }, []);

  // Stop camera stream
  const stopCamera = () => {
    console.log("Stopping camera stream...");

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: MediaStreamTrack) => {
        track.stop();
      });
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

  // Adjust camera settings
  const adjustCameraSettings = async (settings: CameraSettings) => {
    const track = videoTrackRef.current;
    if (!track) return;

    try {
      const capabilities = track.getCapabilities();
      console.log("Camera capabilities:", capabilities);

      const applicableSettings: any = {};

      if ("exposureMode" in capabilities && settings.exposureMode) {
        applicableSettings.exposureMode = settings.exposureMode;
      }

      if ("exposureTime" in capabilities && settings.exposureTime) {
        applicableSettings.exposureTime = settings.exposureTime;
      }

      if (
        "exposureCompensation" in capabilities &&
        settings.exposureCompensation !== undefined
      ) {
        applicableSettings.exposureCompensation = settings.exposureCompensation;
      }

      if ("focusMode" in capabilities && settings.focusMode) {
        applicableSettings.focusMode = settings.focusMode;
      }

      if ("brightness" in capabilities && settings.brightness !== undefined) {
        applicableSettings.brightness = settings.brightness;
      }

      if ("contrast" in capabilities && settings.contrast !== undefined) {
        applicableSettings.contrast = settings.contrast;
      }

      if (
        "focusDistance" in capabilities &&
        settings.focusDistance !== undefined
      ) {
        applicableSettings.focusDistance = settings.focusDistance;
      }

      await track.applyConstraints(applicableSettings);
      console.log("Applied camera settings:", applicableSettings);

      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log("Settings applied, current settings:", track.getSettings());
    } catch (error) {
      console.error("Error applying camera constraints:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to apply camera settings";
      setCameraError(errorMessage);
    }
  };

  // Capture image from video stream
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current || !isCameraReady) {
      return null;
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    const videoWidth = videoRef.current.videoWidth;
    const videoHeight = videoRef.current.videoHeight;

    canvas.width = videoWidth;
    canvas.height = videoHeight;

    if (context) {
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png", 1.0);
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
      <div style={{ display: "none" }}>
        <canvas ref={canvasRef} />
      </div>
    </CameraContext.Provider>
  );
};
