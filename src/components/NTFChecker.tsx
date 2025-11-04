import React, { useState, useEffect } from 'react';
import { useCamera } from '../contexts/cameraContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { useAppMode } from '../contexts/appModeContext';
import { checkDisplayPanel } from '@/services/api';
import CameraControls from './CameraControls';

interface NTFCheckerPageProps {
  onStartDefectChecker: (
    ppid: string,
    isTestMode: boolean,
    focusDistance: number
  ) => void;
  cameraRefreshTrigger?: number;
}

const defaultLiveSettings = {
  exposure: 125,
  brightness: 125,
  contrast: 125,
  focusDistance: 40,
};

const NTFCheckerPage: React.FC<NTFCheckerPageProps> = ({
  onStartDefectChecker,
}) => {
  const { isTestMode } = useAppMode();
  const [ppid, setPpid] = useState('');
  const [exposure, setExposure] = useState(() => {
    const saved = localStorage.getItem('exposure');
    return saved ? Number(saved) : 140;
  });
  const [focusDistance, setFocusDistance] = useState(() => {
    const savedDistance = localStorage.getItem('focusDistance');
    return savedDistance ? Number(savedDistance) : 125;
  });
  const [brightness, setBrightness] = useState(() => {
    const savedBrightness = localStorage.getItem('brightness');
    return savedBrightness ? Number(savedBrightness) : 125;
  });
  const [contrast, setContrast] = useState(() => {
    const savedContrast = localStorage.getItem('contrast');
    return savedContrast ? Number(savedContrast) : 125;
  });
  const [showHiddenState, setShowHiddenState] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isManual, setIsManual] = useState(false);
  const [cameraRefreshTrigger, setCameraRefreshTrigger] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const {
    setupCamera,
    stopCamera,
    isCameraReady,
    adjustCameraSettings,
    videoRef,
    cameraError: contextCameraError,
    clearCameraError,
    getCameraSettings,
  } = useCamera();

  useEffect(() => {
    const initCamera = async () => {
      await setupCamera();
    };
    initCamera();
    return () => {
      stopCamera();
    };
  }, [cameraRefreshTrigger]);

  useEffect(() => {
    setupCamera();
  }, []);

  useEffect(() => {
    if (contextCameraError) {
      setCameraError(contextCameraError);
    } else {
      setCameraError(null);
    }
  }, [contextCameraError]);

  // Initialize with actual camera defaults when camera is ready
  useEffect(() => {
    if (isCameraReady) {
      const settings = getCameraSettings();
      if (settings) {
        console.log('Camera default settings:', settings);
        // Only set defaults if not already saved in localStorage
        if (!localStorage.getItem('exposure') && settings.exposureCompensation !== undefined) {
          setExposure(settings.exposureCompensation);
        }
        if (!localStorage.getItem('brightness') && settings.brightness !== undefined) {
          setBrightness(settings.brightness);
        }
        if (!localStorage.getItem('contrast') && settings.contrast !== undefined) {
          setContrast(settings.contrast);
        }
        if (!localStorage.getItem('focusDistance') && settings.focusDistance !== undefined) {
          setFocusDistance(settings.focusDistance);
        }
      }
    }
  }, [isCameraReady]);

  useEffect(() => {
    if (isCameraReady) {
      adjustCameraSettings({
        exposureMode: isManual ? 'manual' : 'continuous',
        focusMode: isManual ? 'manual' : 'continuous',
        focusDistance: focusDistance,
        brightness: isManual ? brightness : 125, // Set to optimal in auto
        contrast: isManual ? contrast : 125, // Set to optimal in auto
        exposureCompensation: exposure,
        exposureTime: 50,
      });
    }
  }, [isCameraReady, focusDistance, brightness, contrast, exposure, isManual]);

  const handleRefresh = () => {
    setCameraRefreshTrigger((prev) => prev + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ppid.trim()) {
      setSubmitLoading(true);
      setSubmitError(null);
      try {
        const checkData = await checkDisplayPanel(ppid);
        const finalPpid = checkData.exists ? checkData.recommended_ppid : ppid;
        onStartDefectChecker(
          finalPpid,
          isTestMode,
          focusDistance,
          'ntf-checker'
        );
      } catch (error) {
        if (error.type === 'network') {
          setSubmitError('Network error: Please check your internet connection and try again.');
        } else if (error.type === 'authentication') {
          setSubmitError('Authentication error: Please log in again.');
        } else if (error.type === 'server') {
          setSubmitError('Server error: Please try again later.');
        } else if (error.type === 'validation') {
          setSubmitError(`Validation error: ${error.message}`);
        } else {
          setSubmitError(error.message || 'An unknown error occurred');
        }
      } finally {
        setSubmitLoading(false);
      }
    }
  };

  const handleResetLiveSettings = () => {
    setExposure(defaultLiveSettings.exposure);
    setBrightness(defaultLiveSettings.brightness);
    setContrast(defaultLiveSettings.contrast);
    setFocusDistance(defaultLiveSettings.focusDistance);
  };

  useEffect(() => {
    localStorage.setItem('exposure', exposure.toString());
  }, [exposure]);

  useEffect(() => {
    localStorage.setItem('focusDistance', focusDistance.toString());
  }, [focusDistance]);
  useEffect(() => {
    localStorage.setItem('brightness', brightness.toString());
  }, [brightness]);
  useEffect(() => {
    localStorage.setItem('contrast', contrast.toString());
  }, [contrast]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>NTF Checker Routine</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              title="Refresh Camera"
            >
              <RotateCcw className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex gap-4 mb-4">
            <input
              type="text"
              value={ppid}
              onChange={(e) => setPpid(e.target.value)}
              className="flex-grow border border-gray-300 px-3 py-2 rounded"
              placeholder="Enter PPID"
            />
            <Button type="submit" disabled={!ppid || submitLoading}>
              {submitLoading ? 'Processing...' : 'Start Defect Cheker Routine'}
            </Button>
          </form>
          {submitError && (
            <div className="mb-4 p-4 bg-red-100 border border-red-300 rounded-lg text-red-800">
              <div className="flex items-center justify-between">
                <div>
                  <strong>Submission Error:</strong> {submitError}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSubmitError(null)}
                  className="text-red-800 hover:text-red-900 hover:bg-red-200"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
          {cameraError && (
            <div className="mb-4 p-4 bg-red-100 border border-red-300 rounded-lg text-red-800">
              <div className="flex items-center justify-between">
                <div>
                  <strong>Camera Error:</strong> {cameraError}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCameraError(null);
                    clearCameraError();
                    handleRefresh();
                  }}
                  className="text-red-800 hover:text-red-900 hover:bg-red-200"
                >
                  Retry
                </Button>
              </div>
            </div>
          )}
          <div className="aspect-video w-full h-full bg-gray-200 relative mb-4 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          </div>

          {/* Camera Controls */}
          <div className="mb-4">
            <CameraControls />
          </div>

          <Button
            variant="link"
            className="p-0 h-auto text-primary"
            onClick={() => setShowHiddenState((prev) => !prev)}
          >
            {showHiddenState ? 'Hide camera settings' : 'Show camera settings'}
          </Button>
          {showHiddenState && (
            <div className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Live Camera Feed Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="flex items-center gap-4">
                      <span className="font-medium">Mode:</span>
                      <div className="relative">
                        <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
                          <button
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                              isManual
                                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                            onClick={() => setIsManual(true)}
                          >
                            Manual
                          </button>
                          <button
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                              !isManual
                                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                            }`}
                            onClick={() => setIsManual(false)}
                          >
                            Automatic
                          </button>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="ml-auto"
                      onClick={handleResetLiveSettings}
                    >
                      Reset Live Settings
                    </Button>
                  </div>
                  <div className="flex gap-4 flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                      <label className="block font-medium">Focus</label>
                      <input
                        type="range"
                        min="0"
                        max="250"
                        step="5"
                        value={focusDistance}
                        onChange={(e) =>
                          setFocusDistance(Number(e.target.value))
                        }
                        className="range-slider-green"
                      />
                      <span className="text-xs">{focusDistance}</span>
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <label className="block font-medium">Exposure</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={exposure}
                        onChange={(e) => setExposure(Number(e.target.value))}
                        className="range-slider-green"
                      />
                      <span className="text-xs">{exposure}</span>
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <label className="block font-medium">Brightness</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={brightness}
                        onChange={(e) => setBrightness(Number(e.target.value))}
                        disabled={!isManual}
                        className="range-slider-green"
                      />
                      <span className="text-xs">{brightness}</span>
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <label className="block font-medium">Contrast</label>
                      <input
                        type="range"
                        min="0"
                        max="255"
                        value={contrast}
                        onChange={(e) => setContrast(Number(e.target.value))}
                        disabled={!isManual}
                        className="range-slider-green"
                      />
                      <span className="text-xs">{contrast}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NTFCheckerPage;
