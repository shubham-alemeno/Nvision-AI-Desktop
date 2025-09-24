import { useState, useEffect } from 'react';
import * as Sentry from '@sentry/react';
import white_AAA from '../assets/white_AAA.bmp';
import black_BBB from '../assets/black_BBB.bmp';
import cyan_CCC from '../assets/cyan_CCC.bmp';
import gray50_DDD from '../assets/gray50_DDD.bmp';
import red_EEE from '../assets/red_EEE.bmp';
import green_FFF from '../assets/green_FFF.bmp';
import blue_GGG from '../assets/blue_GGG.bmp';
import gray75_HHH from '../assets/gray75_HHH.bmp';
import grayVertical_III from '../assets/grayVertical_III.bmp';
import colorBars_JJJ from '../assets/colorBars_JJJ.bmp';
import focus_KKK from '../assets/focus_KKK.bmp';
import blackWithWhiteBorder_LLL from '../assets/blackWithWhiteBorder_LLL.jpg';
import crossHatch_MMM from '../assets/crossHatch_MMM.bmp';
import barGray_NNN from '../assets/16BarGray_NNN.bmp';
import blackWhite_OOO from '../assets/black&White_OOO.bmp';
import { useCamera } from '../contexts/cameraContext';

interface ImageCaptureProcessProps {
  onComplete: (images: string[], totalToUpload: number) => void;
  onUploadProgress: (imageUrl: string | null, index: number) => void;
  ppid: string;
  isTestMode?: boolean;
  cluster1?: number;
  cluster2?: number;
  cluster3?: number;
  cluster4?: number;
  focusDistance: number;
  patternEBC: {
    [pattern: string]: {
      exposure: number;
      brightness: number;
      contrast: number;
    };
  };
}

function ImageCaptureProcess({
  onComplete,
  onUploadProgress,
  ppid,
  isTestMode,
  // cluster1 = 20,
  // cluster2 = 60,
  // cluster3 = 100,
  // cluster4 = 140,
  focusDistance,
  patternEBC,
}: ImageCaptureProcessProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);

  const {
    setupCamera,
    isCameraReady,
    adjustCameraSettings,
    captureImage,
    videoRef,
    canvasRef,
  } = useCamera();

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

  const testImagesCount = testPatterns.length;

  // Exposure values for each cluster
  // const exposureClusters: { [key: string]: number } = {
  //   cluster1,
  //   cluster2,
  //   cluster3,
  //   cluster4,
  // };

  // const clusterMapping: {
  //   [key: string]: 'cluster1' | 'cluster2' | 'cluster3' | 'cluster4';
  // } = {
  //   // Cluster 1
  //   white_AAA: 'cluster1',
  //   'black&White_OOO': 'cluster1',
  //   colorBars_JJJ: 'cluster1',
  //   // Cluster 2
  //   focus_KKK: 'cluster2',
  //   gray75_HHH: 'cluster2',
  //   green_FFF: 'cluster2',
  //   cyan_CCC: 'cluster2',
  //   gray50_DDD: 'cluster2',
  //   // Cluster 3
  //   red_EEE: 'cluster3',
  //   grayVertical_III: 'cluster3',
  //   '16BarGray_NNN': 'cluster3',
  //   // Cluster 4
  //   blue_GGG: 'cluster4',
  //   crossHatch_MMM: 'cluster4',
  //   blackWithWhiteBorder_LLL: 'cluster4',
  //   black_BBB: 'cluster4',
  // };

  useEffect(() => {
    setupCamera();
  }, []);

  useEffect(() => {
    if (isCameraReady && currentImageIndex < testImagesCount && !isCompleted) {
      // Log when pattern becomes visible
      const patternName = testPatterns[currentImageIndex].name;
      console.log(`[${new Date().toISOString()}] Pattern "${patternName}" displayed at index ${currentImageIndex}`);
      
      // adjustPatternCameraSettings(testPatterns[currentImageIndex].name);
      adjustPatternCameraSettings(currentImageIndex);
      // Give time to display the test pattern, then capture the webcam image
      const captureTimer = setTimeout(() => {
        console.log(`[${new Date().toISOString()}] Starting image capture for pattern "${patternName}" after 2.5s delay`);
        processCurrentImage();
      }, 2500);

      return () => {
        clearTimeout(captureTimer);
      };
    }
  }, [currentImageIndex, testImagesCount, isCameraReady, isCompleted]);

  // Effect to check if we've completed capturing all images
  useEffect(() => {
    // Check if we've reached the end of the process and haven't called onComplete yet
    if (currentImageIndex >= testImagesCount && !isCompleted) {
      // Ensure we have the correct number of images
      if (capturedImages.length === testImagesCount) {
        setIsCompleted(true);
        onComplete(capturedImages.slice(0, testImagesCount), testImagesCount);
      } else {
        console.error(
          `Image capture process completed but has incorrect number of images: 
          ${capturedImages.length} captured vs ${testImagesCount} expected`
        );
      }
    }
  }, [
    currentImageIndex,
    capturedImages,
    testImagesCount,
    isCompleted,
    onComplete,
  ]);

  const adjustPatternCameraSettings = async (index: number) => {
    if (!isCameraReady) return;
    const pattern = testPatterns[index];
    const settings = patternEBC[pattern.name];
    await adjustCameraSettings({
      exposureMode: 'manual',
      exposureTime: 50,
      exposureCompensation: settings.exposure,
      focusMode: 'manual',
      focusDistance: focusDistance,
      brightness: settings.brightness,
      contrast: settings.contrast,
    });
  };

  const processCurrentImage = () => {
    if (!isCameraReady) return;

    const patternName = testPatterns[currentImageIndex].name;
    console.log(`[${new Date().toISOString()}] Capturing image for pattern "${patternName}"`);

    // Capture image using the context's method
    const imageData = captureImage();

    if (imageData) {
      console.log(`[${new Date().toISOString()}] Image captured successfully for pattern "${patternName}"`);
      
      // Store the current index to use in the background upload
      const imageIndex = currentImageIndex;

      setCapturedImages((prev) => {
        if (prev.length < testImagesCount) {
          return [...prev, imageData];
        }
        return prev;
      });

      // Increment the image index
      setCurrentImageIndex((prev) => prev + 1);

      // Start the upload in the background
      setTimeout(() => {
        uploadToDigitalOcean(imageData, imageIndex).catch((error) =>
          console.error('Error during upload:', error)
        );
      }, 0);
    } else {
      console.error(`[${new Date().toISOString()}] Failed to capture image for pattern "${patternName}"`);
    }
  };

  const uploadToDigitalOcean = async (imageData: string, index: number) => {
    if (index >= testImagesCount) {
      console.error('Attempted to upload image beyond test count');
      return null;
    }

    try {
      // throw new Error('Uplaod fialed');
      const patternName = testPatterns[index].name;

      const imageUrl = await window.electronAPI.uploadImage({
        imageData,
        ppid,
        patternName,
        isTestMode,
      });

      console.log(`Successfully uploaded ${patternName}`);

      // Notify parent component about the completed upload
      onUploadProgress(imageUrl, index);

      return imageUrl;
    } catch (error) {
      console.error('Error uploading to DigitalOcean:', error);

      Sentry.captureException(error, {
        tags: {
          location: 'uploadToDigitalOcean',
          patternIndex: index.toString(),
        },
        extra: {
          imageDataSnippet: imageData.slice(0, 30), //preview image
        },
      });

      onUploadProgress(null, index);

      return null;
    }
  };

  // Get current test pattern filename
  const currentPattern = testPatterns[currentImageIndex];

  return (
    <div className="fixed cursor-none inset-0 bg-black flex flex-col items-center justify-center">
      {currentImageIndex < testImagesCount ? (
        <div className="w-full h-full cursor-none">
          {/* Full screen test pattern image */}
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            {currentPattern && (
              <div className="relative w-full h-full">
                <img
                  src={currentPattern.src}
                  alt={`Test pattern ${currentImageIndex + 1}`}
                  className="absolute inset-0 w-full h-full"
                  style={{
                    objectFit: 'fill',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-white text-2xl">Processing images...</div>
      )}

      {/* Hidden video element for camera capture */}
      <div className="aspect-video max-w-md hidden cursor-none">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{
            border: isCameraReady ? '2px solid green' : '2px solid yellow',
          }}
          className="object-cover"
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}

export default ImageCaptureProcess;
