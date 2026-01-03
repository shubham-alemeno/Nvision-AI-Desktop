import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

interface Annotation {
  id: number;
  defect: string;
  defect_fault_code: string;
  status: string;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  created_at: string;
  created_by: string;
  notes: string | null;
}

interface PanelImage {
  id: number;
  base_pattern: string;
  image_url: string;
  cropped_url: string | null;
  annotation_count: number;
  annotations: Annotation[];
}

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  ppid: string;
  panelImages: PanelImage[];
}

const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  isOpen,
  onClose,
  ppid,
  panelImages,
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [imageDimensions, setImageDimensions] = useState({ width: 1920, height: 1080 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = React.useRef<HTMLImageElement>(null);

  if (!isOpen) return null;

  const currentImage = panelImages[currentImageIndex];

  const handlePrevious = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : panelImages.length - 1));
  };

  const handleNext = () => {
    setCurrentImageIndex((prev) => (prev < panelImages.length - 1 ? prev + 1 : 0));
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    // Use natural dimensions for the viewBox
    const natWidth = img.naturalWidth;
    const natHeight = img.naturalHeight;

    setImageDimensions({
      width: natWidth,
      height: natHeight,
    });
    setImageLoaded(true);
    console.log('Image natural dimensions:', natWidth, 'x', natHeight);
    console.log('Image displayed dimensions:', img.width, 'x', img.height);
  };

  // Reset image loaded state when changing images
  React.useEffect(() => {
    setImageLoaded(false);
  }, [currentImageIndex]);

  // Get color for annotation based on defect type
  const getAnnotationColor = (defect: string): string => {
    const colors: { [key: string]: string } = {
      'Abnormal Display': '#ef4444',
      'Horizontal Line': '#f97316',
      'Horizontal Band': '#f59e0b',
      'Vertical Line': '#eab308',
      'Vertical Band': '#84cc16',
      'Particles': '#22c55e',
      'White Patch': '#10b981',
      'Polariser Scratches / Dent': '#14b8a6',
      'Light Leakage': '#06b6d4',
      'Mura': '#0ea5e9',
      'Incoming Border Patch': '#3b82f6',
      'Pixel Bright Dot': '#6366f1',
      'Incoming Galaxy': '#8b5cf6',
      'Led Off': '#a855f7',
      'Bleeding': '#d946ef',
      'Other Defects': '#ec4899',
    };
    return colors[defect] || '#3b82f6';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-[95vw] h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div>
            <h2 className="text-xl font-semibold">View Images - {ppid}</h2>
            <p className="text-sm text-gray-600">
              Pattern {currentImageIndex + 1} of {panelImages.length} • {currentImage.annotation_count} annotations
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Sidebar - Thumbnails */}
          <div className="w-48 bg-gray-50 border-r overflow-y-auto flex-shrink-0">
            <div className="p-2 space-y-1">
              {panelImages.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`w-full p-2 rounded-lg border-2 transition-all ${
                    currentImageIndex === idx
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="relative bg-white rounded" style={{ height: '60px' }}>
                    <img
                      src={img.image_url}
                      alt={`Pattern ${idx + 1}`}
                      className="w-full h-full object-contain rounded"
                    />
                    {img.annotation_count > 0 && (
                      <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded">
                        {img.annotation_count}
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-medium text-center mt-1">
                    Pattern {idx + 1}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Center - Image Viewer with Annotations */}
          <div className="flex-1 bg-gray-900 relative flex items-center justify-center">
            <TransformWrapper
              initialScale={0.8}
              minScale={0.2}
              maxScale={5}
              doubleClick={{ disabled: false, mode: 'zoomIn' }}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  {/* Zoom Controls */}
                  <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => zoomIn()}
                      className="shadow-lg"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => zoomOut()}
                      className="shadow-lg"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => resetTransform()}
                      className="shadow-lg"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Navigation Arrows */}
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={handlePrevious}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 shadow-lg"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={handleNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 shadow-lg"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </Button>

                  <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                    <div className="relative inline-block" style={{ lineHeight: 0 }}>
                      <img
                        ref={imageRef}
                        src={currentImage.image_url}
                        alt={`Pattern ${currentImageIndex + 1}`}
                        onLoad={handleImageLoad}
                        style={{
                          display: 'block',
                          maxWidth: '100%',
                          maxHeight: 'calc(95vh - 200px)',
                          width: 'auto',
                          height: 'auto',
                          objectFit: 'contain'
                        }}
                      />
                      {/* SVG Overlay for Annotations */}
                      {imageLoaded && imageRef.current && (
                        <svg
                          className="absolute top-0 left-0 pointer-events-none"
                          style={{
                            width: `${imageRef.current.width}px`,
                            height: `${imageRef.current.height}px`,
                          }}
                          viewBox={`0 0 ${imageDimensions.width} ${imageDimensions.height}`}
                          preserveAspectRatio="none"
                        >
                        {currentImage.annotations.map((annotation) => {
                          // Handle both bbox format and flat format
                          const x = annotation.bbox?.x ?? annotation.x ?? 0;
                          const y = annotation.bbox?.y ?? annotation.y ?? 0;
                          const width = annotation.bbox?.width ?? annotation.width ?? 0;
                          const height = annotation.bbox?.height ?? annotation.height ?? 0;

                          // Coordinates are ALWAYS normalized (0-1) in the API response
                          // Convert to pixel coordinates using actual image dimensions
                          const pixelX = x * imageDimensions.width;
                          const pixelY = y * imageDimensions.height;
                          const pixelWidth = width * imageDimensions.width;
                          const pixelHeight = height * imageDimensions.height;

                          const color = getAnnotationColor(annotation.defect);

                          return (
                            <g key={annotation.id}>
                              <rect
                                x={pixelX}
                                y={pixelY}
                                width={pixelWidth}
                                height={pixelHeight}
                                fill="none"
                                stroke={color}
                                strokeWidth="3"
                              />
                              <rect
                                x={pixelX}
                                y={pixelY - 24}
                                width={annotation.defect.length * 8 + 10}
                                height="24"
                                fill={color}
                              />
                              <text
                                x={pixelX + 5}
                                y={pixelY - 6}
                                fill="white"
                                fontSize="14"
                                fontFamily="sans-serif"
                              >
                                {annotation.defect}
                              </text>
                            </g>
                          );
                        })}
                        </svg>
                      )}
                    </div>
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </div>

          {/* Right Sidebar - Annotation List */}
          <div className="w-80 bg-white border-l overflow-y-auto flex-shrink-0">
            <div className="p-4">
              <h3 className="text-sm font-semibold mb-3">
                Annotations ({currentImage.annotations.length})
              </h3>
              {currentImage.annotations.length === 0 ? (
                <div className="text-center text-gray-400 py-6 text-sm border rounded-lg">
                  No annotations
                </div>
              ) : (
                <div className="space-y-2">
                  {currentImage.annotations.map((annotation) => (
                    <div
                      key={annotation.id}
                      className="p-3 bg-gray-50 rounded-lg border text-xs"
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <div
                          className="w-3 h-3 rounded mt-0.5 flex-shrink-0"
                          style={{ backgroundColor: getAnnotationColor(annotation.defect) }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{annotation.defect}</div>
                          <div className="text-gray-500 text-xs">
                            {annotation.defect_fault_code}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1 text-xs text-gray-600">
                        <div>
                          <span className="font-medium">Status:</span>{' '}
                          <span
                            className={`px-1.5 py-0.5 rounded ${
                              annotation.status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : annotation.status === 'rejected'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {annotation.status}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">By:</span> {annotation.created_by}
                        </div>
                        <div>
                          <span className="font-medium">Date:</span>{' '}
                          {new Date(annotation.created_at).toLocaleDateString()}
                        </div>
                        {annotation.notes && (
                          <div>
                            <span className="font-medium">Notes:</span> {annotation.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            Use mouse wheel or buttons to zoom • Drag to pan • Arrow keys or buttons to navigate
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImageViewerModal;
