import React from 'react';
import { useCamera, CameraResolution } from '../contexts/cameraContext';

interface CameraResolutionSelectorProps {
  className?: string;
}

const CameraResolutionSelector: React.FC<CameraResolutionSelectorProps> = ({
  className = '',
}) => {
  const {
    availableResolutions,
    selectedResolution,
    setResolution,
    cameraResolution,
    isLoading,
    cameraError,
  } = useCamera();

  const handleResolutionChange = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const selectedIndex = parseInt(event.target.value);
    const resolution = availableResolutions[selectedIndex];
    if (resolution) {
      try {
        await setResolution(resolution);
      } catch (error) {
        console.error('Failed to change resolution:', error);
      }
    }
  };

  const getCurrentResolutionIndex = () => {
    const index = availableResolutions.findIndex(
      (res) =>
        res.width === selectedResolution.width &&
        res.height === selectedResolution.height
    );
    return index >= 0 ? index : 0; // Fallback to first option if not found
  };

  // Show loading state during initialization
  if (isLoading && availableResolutions.length === 0) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="font-medium">Resolution:</span>
        <span className="text-sm text-gray-500">Detecting available resolutions...</span>
      </div>
    );
  }

  // Show error state if there's an error and no resolutions
  if (cameraError && availableResolutions.length === 0) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="font-medium">Resolution:</span>
        <span className="text-sm text-red-500">Error detecting resolutions</span>
      </div>
    );
  }

  // Show single resolution if only one is available
  if (availableResolutions.length <= 1) {
    const displayResolution = availableResolutions[0] || selectedResolution;
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="font-medium">Resolution:</span>
        <span className="text-sm text-gray-600">
          {displayResolution.label}
          {cameraResolution && (
            <span className="ml-2 text-xs text-gray-500">
              (Active: {cameraResolution.width}x{cameraResolution.height})
            </span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label htmlFor="resolution-select" className="font-medium">
        Resolution:
      </label>
      <select
        id="resolution-select"
        value={getCurrentResolutionIndex()}
        onChange={handleResolutionChange}
        disabled={isLoading}
        className={`border border-gray-300 rounded px-2 py-1 text-sm min-w-[200px] ${
          isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        {availableResolutions.map((resolution, index) => (
          <option
            key={`${resolution.width}x${resolution.height}`}
            value={index}
          >
            {resolution.label}
          </option>
        ))}
      </select>
      {cameraResolution && (
        <span className="text-xs text-gray-500">
          (Active: {cameraResolution.width}x{cameraResolution.height})
        </span>
      )}
      {isLoading && (
        <span className="text-xs text-blue-500">Switching...</span>
      )}
    </div>
  );
};

export default CameraResolutionSelector;