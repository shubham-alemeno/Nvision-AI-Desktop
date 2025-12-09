import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, ZoomIn, ZoomOut, RotateCcw, Copy } from 'lucide-react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

interface BoundingBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  defect_type: string;
  defect_label: string;
}

interface BoundingBoxPageProps {
  images: string[];
  ppid: string;
  uploadedImageUrls: (string | null)[];
  isTestMode: boolean;
  onSubmit: (boundingBoxes: { [key: number]: BoundingBox[] }) => void;
  onDiscard: () => void;
}

// Defect types matching the app's defect configuration
// IDs match the backend API defect IDs
const DEFECT_TYPES = [
  {
    key: 'def_abnormal_display',
    label: 'Abnormal Display',
    color: '#ef4444',
    id: 1,
  },
  {
    key: 'def_horizontal_line',
    label: 'Horizontal Line',
    color: '#f97316',
    id: 2,
  },
  {
    key: 'def_horizontal_band',
    label: 'Horizontal Band',
    color: '#f59e0b',
    id: 3,
  },
  { key: 'def_vertical_line', label: 'Vertical Line', color: '#eab308', id: 4 },
  { key: 'def_vertical_band', label: 'Vertical Band', color: '#84cc16', id: 5 },
  { key: 'def_particles', label: 'Particles', color: '#22c55e', id: 6 },
  { key: 'def_white_patches', label: 'White Patch', color: '#10b981', id: 7 },
  {
    key: 'def_polariser_scratches',
    label: 'Polariser Scratches / Dent',
    color: '#14b8a6',
    id: 8,
  },
  { key: 'def_light_leakage', label: 'Light Leakage', color: '#06b6d4', id: 9 },
  { key: 'def_mura', label: 'Mura', color: '#0ea5e9', id: 10 },
  {
    key: 'def_incoming_border_patch',
    label: 'Incoming Border Patch',
    color: '#3b82f6',
    id: 11,
  },
  {
    key: 'def_pixel_bright_dot',
    label: 'Pixel Bright Dot',
    color: '#6366f1',
    id: 12,
  },
  {
    key: 'def_incoming_galaxy',
    label: 'Incoming Galaxy',
    color: '#8b5cf6',
    id: 13,
  },
  { key: 'def_led_off', label: 'Led Off', color: '#a855f7', id: 14 },
  { key: 'def_bleeding', label: 'Bleeding', color: '#d946ef', id: 15 },
  {
    key: 'def_other_defects',
    label: 'Other Defects',
    color: '#ec4899',
    id: 17,
  },
];

// Helper function to get defect ID from defect type key
const getDefectIdFromType = (defectType: string): number => {
  const defect = DEFECT_TYPES.find((d) => d.key === defectType);
  return defect?.id || 1; // Default to 1 if not found
};

const BoundingBoxPage: React.FC<BoundingBoxPageProps> = ({
  images,
  ppid,
  uploadedImageUrls,
  isTestMode,
  onSubmit,
  onDiscard,
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [boundingBoxes, setBoundingBoxes] = useState<{
    [key: number]: BoundingBox[];
  }>({});
  const [selectedDefectType, setSelectedDefectType] = useState<string>(
    DEFECT_TYPES[0].key
  );
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [currentBox, setCurrentBox] = useState<BoundingBox | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [replicateToAll, setReplicateToAll] = useState(true); // Default to true for replication
  const [submissionResult, setSubmissionResult] = useState<any>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const transformRef = useRef<any>(null);

  // Redraw canvas whenever boxes or zoom changes
  useEffect(() => {
    redrawCanvas();
  }, [boundingBoxes, currentBox, currentImageIndex]);

  // Setup canvas on image load
  useEffect(() => {
    const img = imageRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const handleImageLoad = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      redrawCanvas();
    };

    img.addEventListener('load', handleImageLoad);
    if (img.complete) {
      handleImageLoad();
    }

    return () => {
      img.removeEventListener('load', handleImageLoad);
    };
  }, [currentImageIndex]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw existing boxes
    const boxes = boundingBoxes[currentImageIndex] || [];
    boxes.forEach((box) => {
      ctx.strokeStyle = box.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(box.x, box.y, box.width, box.height);

      // Draw label
      ctx.fillStyle = box.color;
      ctx.fillRect(
        box.x,
        box.y - 24,
        ctx.measureText(box.defect_label).width + 10,
        24
      );
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px sans-serif';
      ctx.fillText(box.defect_label, box.x + 5, box.y - 6);
    });

    // Draw current box being drawn
    if (currentBox) {
      ctx.strokeStyle = currentBox.color;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        currentBox.x,
        currentBox.y,
        currentBox.width,
        currentBox.height
      );
      ctx.setLineDash([]);
    }
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasCoordinates(e);
    setIsDrawing(true);
    setStartPos(pos);

    const selectedDefect = DEFECT_TYPES.find(
      (d) => d.key === selectedDefectType
    );
    if (!selectedDefect) return;

    setCurrentBox({
      id: `box-${Date.now()}`,
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
      color: selectedDefect.color,
      defect_type: selectedDefect.key,
      defect_label: selectedDefect.label,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos || !currentBox) return;

    const pos = getCanvasCoordinates(e);
    const width = pos.x - startPos.x;
    const height = pos.y - startPos.y;

    setCurrentBox({
      ...currentBox,
      width,
      height,
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentBox) return;

    if (Math.abs(currentBox.width) > 10 && Math.abs(currentBox.height) > 10) {
      const normalizedBox = {
        ...currentBox,
        x:
          currentBox.width < 0 ? currentBox.x + currentBox.width : currentBox.x,
        y:
          currentBox.height < 0
            ? currentBox.y + currentBox.height
            : currentBox.y,
        width: Math.abs(currentBox.width),
        height: Math.abs(currentBox.height),
      };

      if (replicateToAll) {
        // Replicate box to all patterns
        const newBoxes = { ...boundingBoxes };
        images.forEach((_, index) => {
          const boxWithNewId = {
            ...normalizedBox,
            id: `box-${Date.now()}-${index}`, // Unique ID for each pattern
          };
          newBoxes[index] = [...(newBoxes[index] || []), boxWithNewId];
        });
        setBoundingBoxes(newBoxes);
      } else {
        // Add box only to current image
        setBoundingBoxes((prev) => ({
          ...prev,
          [currentImageIndex]: [
            ...(prev[currentImageIndex] || []),
            normalizedBox,
          ],
        }));
      }
    }

    setIsDrawing(false);
    setStartPos(null);
    setCurrentBox(null);
  };

  const handleDeleteBox = (boxId: string) => {
    setBoundingBoxes((prev) => ({
      ...prev,
      [currentImageIndex]: (prev[currentImageIndex] || []).filter(
        (box) => box.id !== boxId
      ),
    }));
  };

  const handleClearAll = () => {
    setBoundingBoxes((prev) => ({
      ...prev,
      [currentImageIndex]: [],
    }));
  };

  const getTotalBoxCount = () => {
    return Object.values(boundingBoxes).reduce(
      (sum, boxes) => sum + boxes.length,
      0
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await onSubmit(boundingBoxes);
      setSubmissionResult(result);
      setShowSuccessModal(true);
    } catch (error: any) {
      console.group('📦 Error submitting bounding boxes');

      console.error('➡️ Full error object:', error);

      console.log('➡️ error.message:', error?.message);
      console.log('➡️ error.type:', error?.type);
      console.log('➡️ error.status:', error?.status);
      console.log('➡️ error.details:', error?.details);

      console.log('➡️ Axios error response:', error?.response);
      console.log('➡️ Axios error data:', error?.response?.data);
      console.log('➡️ Axios error status:', error?.response?.status);
      console.log('➡️ Axios error headers:', error?.response?.headers);

      console.log('➡️ Axios request config:', error?.config);

      console.groupEnd();
      const errorMessage =
        error?.message || 'Failed to submit. Please try again.';
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const currentBoxes = boundingBoxes[currentImageIndex] || [];
  const selectedDefect = DEFECT_TYPES.find((d) => d.key === selectedDefectType);

  return (
    <div
      className="bg-gray-100 flex flex-col"
      style={{ height: 'calc(100vh - 32px)' }}
    >
      {/* Header */}
      <header className="flex-shrink-0 flex h-14 items-center justify-between border-b bg-white px-4 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">Annotate Defects - {ppid}</h1>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
            {getTotalBoxCount()} boxes total
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDiscard}
            disabled={submitting}
          >
            Discard
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit All'}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar - Thumbnails */}
        <div className="w-48 bg-white border-r overflow-y-auto flex-shrink-0">
          <div className="p-2">
            <h3 className="text-xs font-semibold text-gray-600 mb-2 px-2">
              PATTERNS
            </h3>
            <div className="space-y-1">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentImageIndex(idx)}
                  className={`w-full p-2 rounded-lg border-2 transition-all ${
                    currentImageIndex === idx
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="relative">
                    <img
                      src={img}
                      alt={`Pattern ${idx + 1}`}
                      className="w-full h-20 object-cover rounded"
                    />
                    {(boundingBoxes[idx]?.length || 0) > 0 && (
                      <div className="absolute top-1 right-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded">
                        {boundingBoxes[idx].length}
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
        </div>

        {/* Center - Image with Zoom/Pan */}
        <div className="flex-1 bg-gray-200 relative flex items-center justify-center min-w-0">
          <TransformWrapper
            ref={transformRef}
            initialScale={1}
            minScale={0.5}
            maxScale={5}
            doubleClick={{ disabled: true }}
            panning={{ disabled: isDrawing }}
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

                <TransformComponent
                  wrapperStyle={{ width: '100%', height: '100%' }}
                >
                  <div className="relative inline-block">
                    <img
                      ref={imageRef}
                      src={images[currentImageIndex]}
                      alt={`Pattern ${currentImageIndex + 1}`}
                      className="max-w-none"
                      draggable={false}
                      style={{ display: 'block' }}
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0 cursor-crosshair"
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      style={{
                        width: imageRef.current?.width || 'auto',
                        height: imageRef.current?.height || 'auto',
                      }}
                    />
                  </div>
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        </div>

        {/* Right Sidebar - Defect Selection & Box List */}
        <div className="w-80 bg-white border-l overflow-y-auto flex-shrink-0">
          <div className="p-4 space-y-4">
            {/* Replication Toggle */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Copy className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">
                    Auto-Replicate
                  </span>
                </div>
                <button
                  onClick={() => setReplicateToAll(!replicateToAll)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    replicateToAll ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      replicateToAll ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="text-xs text-blue-700 mt-1">
                {replicateToAll
                  ? 'Boxes will be copied to all 15 patterns'
                  : 'Boxes only on current pattern'}
              </p>
            </div>

            {/* Defect Type Selection */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Select Defect Type</h3>
              <div className="space-y-1 max-h-64 overflow-y-auto border rounded-lg p-2">
                {DEFECT_TYPES.map((defect) => (
                  <button
                    key={defect.key}
                    onClick={() => setSelectedDefectType(defect.key)}
                    className={`w-full p-2 rounded text-left text-sm transition-all flex items-center gap-2 ${
                      selectedDefectType === defect.key
                        ? 'bg-blue-50 border-2 border-blue-500 font-medium'
                        : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: defect.color }}
                    />
                    <span className="flex-1">{defect.label}</span>
                    {selectedDefectType === defect.key && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    )}
                  </button>
                ))}
              </div>
              {selectedDefect && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                  Draw boxes for: <strong>{selectedDefect.label}</strong>
                </div>
              )}
            </div>

            {/* Current Pattern Boxes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">
                  Pattern {currentImageIndex + 1} Boxes ({currentBoxes.length})
                </h3>
                {currentBoxes.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                    className="text-red-600 hover:text-red-700 h-7 text-xs"
                  >
                    Clear All
                  </Button>
                )}
              </div>

              {currentBoxes.length === 0 ? (
                <div className="text-center text-gray-400 py-6 text-sm border rounded-lg">
                  No boxes drawn
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {currentBoxes.map((box, index) => (
                    <div
                      key={box.id}
                      className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg border text-xs"
                    >
                      <div
                        className="w-3 h-3 rounded mt-0.5 flex-shrink-0"
                        style={{ backgroundColor: box.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {box.defect_label}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {Math.round(box.x)}, {Math.round(box.y)} ·{' '}
                          {Math.round(box.width)}×{Math.round(box.height)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteBox(box.id)}
                        className="text-red-600 hover:text-red-700 h-6 w-6 p-0 flex-shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 text-green-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-full h-full"
                >
                  <path
                    fillRule="evenodd"
                    d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2">
                {submissionResult?.hasErrors
                  ? 'Partially Submitted'
                  : 'Successfully Submitted!'}
              </h2>
              <p className="text-gray-600 mb-4">
                {submissionResult?.message ||
                  `Annotated ${getTotalBoxCount()} defect${
                    getTotalBoxCount() !== 1 ? 's' : ''
                  } across ${Object.keys(boundingBoxes).length} pattern${
                    Object.keys(boundingBoxes).length !== 1 ? 's' : ''
                  } for PPID ${ppid}`}
              </p>
              {submissionResult?.hasErrors &&
                submissionResult?.annotations?.errors && (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-left text-sm">
                    <p className="font-semibold text-yellow-800 mb-2">
                      Some annotations failed:
                    </p>
                    <ul className="text-yellow-700 space-y-1 max-h-32 overflow-y-auto">
                      {submissionResult.annotations.errors
                        .slice(0, 5)
                        .map((err: any, idx: number) => (
                          <li key={idx} className="text-xs">
                            Index {err.index}:{' '}
                            {Object.values(err.errors || {})
                              .flat()
                              .join(', ')}
                          </li>
                        ))}
                      {submissionResult.annotations.errors.length > 5 && (
                        <li className="text-xs italic">
                          ...and{' '}
                          {submissionResult.annotations.errors.length - 5} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              <Button onClick={onDiscard} className="w-full">
                Go Back to Self Learning
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default BoundingBoxPage;
