import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Check,
  X,
  ZoomIn,
  ZoomOut,
  Trash2,
  Save,
  Maximize2,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  bulkCreatePPIDAnnotation,
  bulkDeletePPIDAnnotation,
  bulkUpdatePPIDAnnotation,
} from '@/services/api';
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
  created_at: string;
  created_by: string;
  notes: string | null;
}

interface PanelImage {
  id: number;
  base_pattern: string;
  image_url: string;
  annotation_count: number;
  annotations: Annotation[];
}

interface AnnotationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  ppid: string;
  panelImages: PanelImage[];
  onApprove: (
    ppid: string,
    annotationIds?: number[],
    notes?: string
  ) => Promise<void>;
  onReject: (
    ppid: string,
    annotationIds?: number[],
    notes?: string
  ) => Promise<void>;
  onRefresh?: () => Promise<void>;
  customSaveHandler?: (
    ppid: string,
    newAnnotations: Array<{
      defect_id: number;
      bbox: { x: number; y: number; width: number; height: number };
    }>
  ) => Promise<void>;
  hideApproveReject?: boolean;
}

// Defect types and colors matching BoundingBoxPage
const DEFECT_TYPES = [
  { name: 'Abnormal Display', color: '#ef4444', id: 1 },
  { name: 'Horizontal Line', color: '#f97316', id: 2 },
  { name: 'Horizontal Band', color: '#f59e0b', id: 3 },
  { name: 'Vertical Line', color: '#eab308', id: 4 },
  { name: 'Vertical Band', color: '#84cc16', id: 5 },
  { name: 'Particles', color: '#22c55e', id: 6 },
  { name: 'White Patch', color: '#10b981', id: 7 },
  { name: 'Polariser Scratches / Dent', color: '#14b8a6', id: 8 },
  { name: 'Light Leakage', color: '#06b6d4', id: 9 },
  { name: 'Mura', color: '#0ea5e9', id: 10 },
  { name: 'Incoming Border Patch', color: '#3b82f6', id: 11 },
  { name: 'Pixel Bright Dot', color: '#6366f1', id: 12 },
  { name: 'Incoming Galaxy', color: '#8b5cf6', id: 13 },
  { name: 'Led Off', color: '#a855f7', id: 14 },
  { name: 'Bleeding', color: '#d946ef', id: 15 },
];

const getDefectColor = (defectName: string): string => {
  const defect = DEFECT_TYPES.find((d) => d.name === defectName);
  return defect?.color || '#6b7280';
};

// Desired handle size on screen (px). Hit area is larger for easier clicking.
const SCREEN_HANDLE_PX = 14;
const SCREEN_HIT_PX = 22;

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: 'nw-resize', n: 'ns-resize', ne: 'ne-resize',
  e: 'ew-resize',  se: 'se-resize', s: 'ns-resize',
  sw: 'sw-resize', w: 'ew-resize',
};

function getResizeHandles(
  x: number, y: number, w: number, h: number
): Array<{ handle: ResizeHandle; cx: number; cy: number }> {
  return [
    { handle: 'nw', cx: x,       cy: y       },
    { handle: 'n',  cx: x + w/2, cy: y       },
    { handle: 'ne', cx: x + w,   cy: y       },
    { handle: 'e',  cx: x + w,   cy: y + h/2 },
    { handle: 'se', cx: x + w,   cy: y + h   },
    { handle: 's',  cx: x + w/2, cy: y + h   },
    { handle: 'sw', cx: x,       cy: y + h   },
    { handle: 'w',  cx: x,       cy: y + h/2 },
  ];
}

// halfSize: canvas-pixel hit radius (computed from screen px * scale)
function hitTestHandle(
  pos: { x: number; y: number },
  handles: Array<{ handle: ResizeHandle; cx: number; cy: number }>,
  halfSize: number
): ResizeHandle | null {
  for (const h of handles) {
    if (pos.x >= h.cx - halfSize && pos.x <= h.cx + halfSize &&
        pos.y >= h.cy - halfSize && pos.y <= h.cy + halfSize) {
      return h.handle;
    }
  }
  return null;
}

// Returns canvas-pixels-per-screen-pixel for a canvas element
function getCanvasScale(canvas: HTMLCanvasElement): number {
  const rect = canvas.getBoundingClientRect();
  return rect.width > 0 ? canvas.width / rect.width : 1;
}

const AnnotationReviewModal: React.FC<AnnotationReviewModalProps> = ({
  isOpen,
  onClose,
  ppid,
  panelImages,
  onApprove,
  onReject,
  onRefresh,
  customSaveHandler,
  hideApproveReject,
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [notes, setNotes] = useState('');
  const [selectedAnnotations, setSelectedAnnotations] = useState<Set<number>>(
    new Set()
  );
  const [processing, setProcessing] = useState(false);
  const [deletedAnnotations, setDeletedAnnotations] = useState<Set<number>>(
    new Set()
  );
  const [annotationsVisible, setAnnotationsVisible] = useState(true);
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [selectedDefectType, setSelectedDefectType] = useState(DEFECT_TYPES[0]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(
    null
  );
  const [currentBox, setCurrentBox] = useState<any | null>(null);
  const [newAnnotations, setNewAnnotations] = useState<{
    [imageIndex: number]: Array<{
      uid: string; // Unique identifier for each annotation
      defect_name: string;
      defect_id: number;
      bbox: { x: number; y: number; width: number; height: number };
      color: string;
    }>;
  }>({});

  const [highlightedAnnotation, setHighlightedAnnotation] = useState<
    | { type: 'existing'; id: number }
    | { type: 'new'; uid: string }
    | null
  >(null);
  const [resizingState, setResizingState] = useState<{
    kind: 'new' | 'existing';
    uid: string | null;   // for new annotations
    id: number | null;    // for existing annotations
    handle: ResizeHandle;
    startMousePos: { x: number; y: number };
    originalBbox: { x: number; y: number; width: number; height: number };
  } | null>(null);
  const [modifiedExistingAnnotations, setModifiedExistingAnnotations] = useState<{
    [id: number]: { x: number; y: number; width: number; height: number };
  }>({});
  const [hoveredHandle, setHoveredHandle] = useState<ResizeHandle | null>(null);
  const didJustResize = useRef(false);
  const rightClickPanState = useRef<{
    startClientX: number;
    startClientY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const transformRef = useRef<any>(null);
  console.log(panelImages, currentImageIndex);
  const currentImage = panelImages[currentImageIndex];
  const hasNext = currentImageIndex < panelImages.length - 1;
  const hasPrev = currentImageIndex > 0;

  // Setup canvas and load image
  useEffect(() => {
    if (!isOpen || !currentImage) return;

    // Wait for refs to be ready
    const checkAndLoadImage = () => {
      const img = imageRef.current;
      const canvas = canvasRef.current;

      if (!img || !canvas) {
        console.log('Missing refs or image:', {
          img: !!img,
          canvas: !!canvas,
          currentImage: !!currentImage,
        });
        // Retry after a short delay if refs aren't ready yet
        setTimeout(checkAndLoadImage, 50);
        return;
      }

      console.log('Loading image:', currentImage.image_url);

      const handleImageLoad = () => {
        console.log('Image loaded:', img.naturalWidth, 'x', img.naturalHeight);
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          console.error('Image dimensions are 0');
          return;
        }

        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        console.log('Canvas set to:', canvas.width, 'x', canvas.height);

        redrawCanvas();

        // Reset transform to center the image after a short delay
        setTimeout(() => {
          if (transformRef.current) {
            console.log('Resetting transform');
            transformRef.current.resetTransform();
          }
        }, 100);
      };

      // Clear previous image
      img.onload = null;
      img.src = '';

      // Set new image
      img.onload = handleImageLoad;
      img.onerror = (e) => {
        console.error('Image failed to load:', e);
      };
      img.src = currentImage.image_url;

      // Check if image is already cached and loaded
      if (img.complete && img.naturalWidth > 0) {
        console.log('Image already loaded from cache');
        handleImageLoad();
      }
    };

    checkAndLoadImage();

    return () => {
      const img = imageRef.current;
      if (img) {
        img.onload = null;
        img.onerror = null;
      }
    };
  }, [currentImageIndex, currentImage, isOpen]);

  // Redraw canvas when annotations change
  useEffect(() => {
    const img = imageRef.current;
    if (img && img.complete) {
      redrawCanvas();
    }
  }, [deletedAnnotations, annotationsVisible, newAnnotations, currentBox, highlightedAnnotation, resizingState, modifiedExistingAnnotations]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !currentImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw annotations if visible
    if (annotationsVisible) {
      // Draw existing annotations from backend
      currentImage.annotations.forEach((annotation) => {
        if (deletedAnnotations.has(annotation.id)) return; // Skip deleted
        if (!annotation.bbox) return;

        const color = getDefectColor(annotation.defect);
        // Use locally modified bbox if the user has resized this annotation
        const bbox = modifiedExistingAnnotations[annotation.id] || annotation.bbox;

        // Convert normalized coordinates to pixel coordinates
        const x = bbox.x * canvas.width;
        const y = bbox.y * canvas.height;
        const width = bbox.width * canvas.width;
        const height = bbox.height * canvas.height;

        // Draw box (highlighted = glow + thicker border)
        const isHighlightedExisting =
          highlightedAnnotation?.type === 'existing' &&
          highlightedAnnotation.id === annotation.id;
        ctx.shadowColor = isHighlightedExisting ? color : 'transparent';
        ctx.shadowBlur = isHighlightedExisting ? 18 : 0;
        ctx.strokeStyle = color;
        ctx.lineWidth = isHighlightedExisting ? 5 : 3;
        ctx.strokeRect(x, y, width, height);
        ctx.shadowBlur = 0;
        ctx.lineWidth = 3;

        // Draw label background
        const label = annotation.defect + (modifiedExistingAnnotations[annotation.id] ? ' *' : '');
        ctx.font = '14px sans-serif';
        const labelWidth = ctx.measureText(label).width + 10;
        ctx.fillStyle = color;
        ctx.fillRect(x, y - 24, labelWidth, 24);

        // Draw label text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, x + 5, y - 6);

        // Draw resize handles if this existing annotation is highlighted
        if (isHighlightedExisting) {
          const scale = getCanvasScale(canvas);
          const hs = SCREEN_HANDLE_PX * scale;
          const handles = getResizeHandles(x, y, width, height);
          handles.forEach(({ cx, cy }) => {
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = Math.max(1, scale);
            ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
            ctx.strokeRect(cx - hs / 2, cy - hs / 2, hs, hs);
          });
          ctx.lineWidth = 3;
        }
      });

      // Draw newly created annotations
      const newBoxes = newAnnotations[currentImageIndex] || [];
      newBoxes.forEach((newBox) => {
        const x = newBox.bbox.x * canvas.width;
        const y = newBox.bbox.y * canvas.height;
        const width = newBox.bbox.width * canvas.width;
        const height = newBox.bbox.height * canvas.height;

        // Draw box (highlighted = glow + thicker border)
        const isHighlightedNew =
          highlightedAnnotation?.type === 'new' &&
          highlightedAnnotation.uid === newBox.uid;
        ctx.shadowColor = isHighlightedNew ? newBox.color : 'transparent';
        ctx.shadowBlur = isHighlightedNew ? 18 : 0;
        ctx.strokeStyle = newBox.color;
        ctx.lineWidth = isHighlightedNew ? 5 : 3;
        ctx.strokeRect(x, y, width, height);
        ctx.shadowBlur = 0;
        ctx.lineWidth = 3;

        // Draw label
        ctx.font = '14px sans-serif';
        const labelWidth = ctx.measureText(newBox.defect_name).width + 10;
        ctx.fillStyle = newBox.color;
        ctx.fillRect(x, y - 24, labelWidth, 24);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(newBox.defect_name, x + 5, y - 6);

        // Draw resize handles if this box is highlighted
        if (isHighlightedNew) {
          const scale = getCanvasScale(canvas);
          const hs = SCREEN_HANDLE_PX * scale; // canvas px
          const handles = getResizeHandles(x, y, width, height);
          handles.forEach(({ cx, cy }) => {
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = Math.max(1, scale);
            ctx.fillRect(cx - hs / 2, cy - hs / 2, hs, hs);
            ctx.strokeRect(cx - hs / 2, cy - hs / 2, hs, hs);
          });
          ctx.lineWidth = 3;
        }
      });
    }

    // Always draw current box being drawn (dashed)
    if (currentBox && isDrawMode) {
      ctx.strokeStyle = selectedDefectType.color;
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

  const handleNext = () => {
    if (hasNext) {
      setCurrentImageIndex((prev) => prev + 1);
      setSelectedAnnotations(new Set());
      setHighlightedAnnotation(null);
      setNotes('');
    }
  };

  const handlePrev = () => {
    if (hasPrev) {
      setCurrentImageIndex((prev) => prev - 1);
      setSelectedAnnotations(new Set());
      setHighlightedAnnotation(null);
      setNotes('');
    }
  };

  const handleDeleteAnnotation = (annotationId: number) => {
    // Find the defect type of this annotation
    let defectType: string | null = null;

    for (const img of panelImages) {
      const annotation = img.annotations.find((a) => a.id === annotationId);
      if (annotation) {
        defectType = annotation.defect;
        break;
      }
    }

    if (!defectType) return;

    // Mark ALL annotations with this defect type as deleted (across all patterns)
    setDeletedAnnotations((prev) => {
      const newSet = new Set(prev);

      panelImages.forEach((img) => {
        img.annotations.forEach((ann) => {
          if (ann.defect === defectType) {
            newSet.add(ann.id);
          }
        });
      });

      return newSet;
    });
  };

  const handleRestoreAnnotation = (annotationId: number) => {
    // Find the defect type of this annotation
    let defectType: string | null = null;

    for (const img of panelImages) {
      const annotation = img.annotations.find((a) => a.id === annotationId);
      if (annotation) {
        defectType = annotation.defect;
        break;
      }
    }

    if (!defectType) return;

    // Restore ALL annotations with this defect type (across all patterns)
    setDeletedAnnotations((prev) => {
      const newSet = new Set(prev);

      panelImages.forEach((img) => {
        img.annotations.forEach((ann) => {
          if (ann.defect === defectType) {
            newSet.delete(ann.id);
          }
        });
      });

      return newSet;
    });
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Priority 1: Right-click → start pan
    if (e.button === 2) {
      const state = transformRef.current?.instance?.transformState;
      if (!state) return;
      rightClickPanState.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPosX: state.positionX,
        startPosY: state.positionY,
      };
      e.preventDefault();
      return;
    }

    // Priority 2: Left-click on a resize handle of the highlighted annotation (new or existing)
    if (e.button === 0 && highlightedAnnotation) {
      const canvas = canvasRef.current;
      const pos = getCanvasCoordinates(e);
      if (canvas && pos) {
        const scale = getCanvasScale(canvas);
        const hitHalf = (SCREEN_HIT_PX / 2) * scale;

        if (highlightedAnnotation.type === 'new') {
          const ann = (newAnnotations[currentImageIndex] || []).find(
            (a) => a.uid === highlightedAnnotation.uid
          );
          if (ann) {
            const handles = getResizeHandles(
              ann.bbox.x * canvas.width, ann.bbox.y * canvas.height,
              ann.bbox.width * canvas.width, ann.bbox.height * canvas.height
            );
            const hitHandle = hitTestHandle(pos, handles, hitHalf);
            if (hitHandle) {
              setResizingState({ kind: 'new', uid: ann.uid, id: null, handle: hitHandle, startMousePos: pos, originalBbox: { ...ann.bbox } });
              e.preventDefault();
              return;
            }
          }
        } else {
          const ann = currentImage.annotations.find(a => a.id === highlightedAnnotation.id);
          if (ann) {
            const bbox = modifiedExistingAnnotations[ann.id] || ann.bbox;
            if (bbox) {
              const handles = getResizeHandles(
                bbox.x * canvas.width, bbox.y * canvas.height,
                bbox.width * canvas.width, bbox.height * canvas.height
              );
              const hitHandle = hitTestHandle(pos, handles, hitHalf);
              if (hitHandle) {
                setResizingState({ kind: 'existing', uid: null, id: ann.id, handle: hitHandle, startMousePos: pos, originalBbox: { ...bbox } });
                e.preventDefault();
                return;
              }
            }
          }
        }
      }
    }

    // Priority 3: Left-click in draw mode → draw box
    if (!isDrawMode) return;

    const pos = getCanvasCoordinates(e);
    if (!pos) return;

    setIsDrawing(true);
    setStartPos(pos);
    setCurrentBox({
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Handle right-click pan
    if (rightClickPanState.current && transformRef.current) {
      const { startClientX, startClientY, startPosX, startPosY } = rightClickPanState.current;
      const dx = e.clientX - startClientX;
      const dy = e.clientY - startClientY;
      const scale = transformRef.current.instance?.transformState?.scale ?? 1;
      transformRef.current.setTransform(startPosX + dx, startPosY + dy, scale, 0);
      return;
    }

    // Handle resize drag
    if (resizingState) {
      const canvas = canvasRef.current;
      const pos = getCanvasCoordinates(e);
      if (!canvas || !pos) return;

      const dx = (pos.x - resizingState.startMousePos.x) / canvas.width;
      const dy = (pos.y - resizingState.startMousePos.y) / canvas.height;
      const orig = resizingState.originalBbox;
      let { x, y, width, height } = orig;

      switch (resizingState.handle) {
        case 'se': width = orig.width + dx; height = orig.height + dy; break;
        case 'sw': x = orig.x + dx; width = orig.width - dx; height = orig.height + dy; break;
        case 'ne': width = orig.width + dx; y = orig.y + dy; height = orig.height - dy; break;
        case 'nw': x = orig.x + dx; y = orig.y + dy; width = orig.width - dx; height = orig.height - dy; break;
        case 'n':  y = orig.y + dy; height = orig.height - dy; break;
        case 's':  height = orig.height + dy; break;
        case 'e':  width = orig.width + dx; break;
        case 'w':  x = orig.x + dx; width = orig.width - dx; break;
      }

      const MIN_SIZE = 0.005;
      width = Math.max(MIN_SIZE, width);
      height = Math.max(MIN_SIZE, height);
      x = Math.max(0, Math.min(x, 1 - width));
      y = Math.max(0, Math.min(y, 1 - height));

      if (resizingState.kind === 'new') {
        setNewAnnotations((prev) => {
          const updated = { ...prev };
          for (let i = 0; i < panelImages.length; i++) {
            updated[i] = (updated[i] || []).map((ann) =>
              ann.uid === resizingState.uid
                ? { ...ann, bbox: { x, y, width, height } }
                : ann
            );
          }
          return updated;
        });
      } else {
        setModifiedExistingAnnotations((prev) => ({
          ...prev,
          [resizingState.id!]: { x, y, width, height },
        }));
      }
      return;
    }

    // Hover: update cursor when mouse moves over handles of the highlighted annotation
    if (highlightedAnnotation) {
      const canvas = canvasRef.current;
      const pos = getCanvasCoordinates(e);
      if (canvas && pos) {
        const scale = getCanvasScale(canvas);
        const hitHalf = (SCREEN_HIT_PX / 2) * scale;
        let bbox: { x: number; y: number; width: number; height: number } | undefined;

        if (highlightedAnnotation.type === 'new') {
          const ann = (newAnnotations[currentImageIndex] || []).find(
            (a) => a.uid === highlightedAnnotation.uid
          );
          bbox = ann?.bbox;
        } else {
          const ann = currentImage?.annotations.find((a) => a.id === highlightedAnnotation.id);
          bbox = modifiedExistingAnnotations[highlightedAnnotation.id] || ann?.bbox;
        }

        if (bbox) {
          const handles = getResizeHandles(
            bbox.x * canvas.width, bbox.y * canvas.height,
            bbox.width * canvas.width, bbox.height * canvas.height
          );
          setHoveredHandle(hitTestHandle(pos, handles, hitHalf));
        } else {
          setHoveredHandle(null);
        }
      }
    } else {
      setHoveredHandle(null);
    }

    // Handle draw
    if (!isDrawing || !startPos || !currentBox || !isDrawMode) return;

    const pos = getCanvasCoordinates(e);
    if (!pos) return;

    setCurrentBox({
      x: startPos.x,
      y: startPos.y,
      width: pos.x - startPos.x,
      height: pos.y - startPos.y,
    });
  };

  const handleMouseUp = () => {
    // Handle right-click pan end
    if (rightClickPanState.current) {
      rightClickPanState.current = null;
      return;
    }

    // Handle resize end
    if (resizingState) {
      didJustResize.current = true;
      setResizingState(null);
      return;
    }

    if (!isDrawing || !currentBox || !isDrawMode) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Only save if box is big enough
    if (Math.abs(currentBox.width) > 10 && Math.abs(currentBox.height) > 10) {
      // Normalize box (handle negative dimensions)
      const normalizedBox = {
        x:
          currentBox.width < 0 ? currentBox.x + currentBox.width : currentBox.x,
        y:
          currentBox.height < 0
            ? currentBox.y + currentBox.height
            : currentBox.y,
        width: Math.abs(currentBox.width),
        height: Math.abs(currentBox.height),
      };

      // Generate a unique ID for this annotation (timestamp + random)
      const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Convert to normalized coordinates (0-1)
      const newAnnotation = {
        uid: uniqueId,
        defect_name: selectedDefectType.name,
        defect_id: selectedDefectType.id,
        bbox: {
          x: normalizedBox.x / canvas.width,
          y: normalizedBox.y / canvas.height,
          width: normalizedBox.width / canvas.width,
          height: normalizedBox.height / canvas.height,
        },
        color: selectedDefectType.color,
      };

      // Add this annotation to ALL patterns (0 to 14)
      setNewAnnotations((prev) => {
        const updated = { ...prev };
        for (let i = 0; i < panelImages.length; i++) {
          updated[i] = [
            ...(updated[i] || []),
            newAnnotation,
          ];
        }
        return updated;
      });
    }

    setIsDrawing(false);
    setStartPos(null);
    setCurrentBox(null);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawMode) return;
    if (didJustResize.current) {
      didJustResize.current = false;
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || !currentImage) return;

    const pos = getCanvasCoordinates(e);
    if (!pos) return;

    // Check new annotations first (topmost)
    const currentNewAnnotations = newAnnotations[currentImageIndex] || [];
    for (let i = currentNewAnnotations.length - 1; i >= 0; i--) {
      const annotation = currentNewAnnotations[i];
      if (!annotation.bbox) continue;
      const bx = annotation.bbox.x * canvas.width;
      const by = annotation.bbox.y * canvas.height;
      const bw = annotation.bbox.width * canvas.width;
      const bh = annotation.bbox.height * canvas.height;
      if (pos.x >= bx && pos.x <= bx + bw && pos.y >= by && pos.y <= by + bh) {
        setHighlightedAnnotation(
          highlightedAnnotation?.type === 'new' && highlightedAnnotation.uid === annotation.uid
            ? null
            : { type: 'new', uid: annotation.uid }
        );
        return;
      }
    }

    // Then check existing annotations
    for (let i = currentImage.annotations.length - 1; i >= 0; i--) {
      const annotation = currentImage.annotations[i];
      if (!annotation.bbox || deletedAnnotations.has(annotation.id)) continue;
      const bx = annotation.bbox.x * canvas.width;
      const by = annotation.bbox.y * canvas.height;
      const bw = annotation.bbox.width * canvas.width;
      const bh = annotation.bbox.height * canvas.height;
      if (pos.x >= bx && pos.x <= bx + bw && pos.y >= by && pos.y <= by + bh) {
        setHighlightedAnnotation(
          highlightedAnnotation?.type === 'existing' && highlightedAnnotation.id === annotation.id
            ? null
            : { type: 'existing', id: annotation.id }
        );
        return;
      }
    }

    // Clicked empty space — deselect
    setHighlightedAnnotation(null);
  };

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawMode) return; // Don't delete in draw mode

    const canvas = canvasRef.current;
    if (!canvas || !currentImage) return;

    const pos = getCanvasCoordinates(e);
    if (!pos) return;

    console.log('Double click at:', pos);

    // Check new annotations first (most recently drawn)
    const currentNewAnnotations = newAnnotations[currentImageIndex] || [];
    console.log('New annotations count:', currentNewAnnotations.length);

    for (let i = currentNewAnnotations.length - 1; i >= 0; i--) {
      const annotation = currentNewAnnotations[i];
      if (!annotation.bbox) continue;

      const bbox = {
        x: annotation.bbox.x * canvas.width,
        y: annotation.bbox.y * canvas.height,
        width: annotation.bbox.width * canvas.width,
        height: annotation.bbox.height * canvas.height,
      };

      console.log('Checking new annotation', i, ':', bbox, 'against', pos);

      if (
        pos.x >= bbox.x &&
        pos.x <= bbox.x + bbox.width &&
        pos.y >= bbox.y &&
        pos.y <= bbox.y + bbox.height
      ) {
        console.log('Deleting new annotation with UID:', annotation.uid);
        handleDeleteNewAnnotation(annotation.uid);
        return;
      }
    }

    // Then check existing annotations
    for (let i = currentImage.annotations.length - 1; i >= 0; i--) {
      const annotation = currentImage.annotations[i];
      if (!annotation.bbox || deletedAnnotations.has(annotation.id)) continue;

      const bbox = {
        x: annotation.bbox.x * canvas.width,
        y: annotation.bbox.y * canvas.height,
        width: annotation.bbox.width * canvas.width,
        height: annotation.bbox.height * canvas.height,
      };

      if (
        pos.x >= bbox.x &&
        pos.x <= bbox.x + bbox.width &&
        pos.y >= bbox.y &&
        pos.y <= bbox.y + bbox.height
      ) {
        handleDeleteAnnotation(annotation.id);
        return;
      }
    }
  };

  const handleDeleteNewAnnotation = (uid: string) => {
    // Remove annotation with this UID from ALL patterns
    setNewAnnotations((prev) => {
      const updated = { ...prev };

      // For each pattern, find and remove the annotation with matching UID
      for (let i = 0; i < panelImages.length; i++) {
        const patternAnnotations = updated[i] || [];
        // Find and remove annotation with matching UID
        const filtered = patternAnnotations.filter((ann) => ann.uid !== uid);
        updated[i] = filtered;
      }

      return updated;
    });
  };

  const toggleAnnotation = (annotationId: number) => {
    const newSet = new Set(selectedAnnotations);
    if (newSet.has(annotationId)) {
      newSet.delete(annotationId);
    } else {
      newSet.add(annotationId);
    }
    setSelectedAnnotations(newSet);
  };

  const handleApproveSelected = async () => {
    if (selectedAnnotations.size === 0 && currentImage.annotations.length > 0) {
      const annotationIds = currentImage.annotations
        .filter((a) => !deletedAnnotations.has(a.id))
        .map((a) => a.id);
      setProcessing(true);
      try {
        await onApprove(ppid, annotationIds, notes);
        if (hasNext) {
          handleNext();
        } else {
          onClose();
        }
      } finally {
        setProcessing(false);
      }
    } else if (selectedAnnotations.size > 0) {
      setProcessing(true);
      try {
        await onApprove(ppid, Array.from(selectedAnnotations), notes);
        setSelectedAnnotations(new Set());
        setNotes('');
      } finally {
        setProcessing(false);
      }
    }
  };

  const handleRejectSelected = async () => {
    if (selectedAnnotations.size === 0 && currentImage.annotations.length > 0) {
      const annotationIds = currentImage.annotations
        .filter((a) => !deletedAnnotations.has(a.id))
        .map((a) => a.id);
      setProcessing(true);
      try {
        await onReject(ppid, annotationIds, notes);
        if (hasNext) {
          handleNext();
        } else {
          onClose();
        }
      } finally {
        setProcessing(false);
      }
    } else if (selectedAnnotations.size > 0) {
      setProcessing(true);
      try {
        await onReject(ppid, Array.from(selectedAnnotations), notes);
        setSelectedAnnotations(new Set());
        setNotes('');
      } finally {
        setProcessing(false);
      }
    }
  };

  const handleApproveAll = async () => {
    setProcessing(true);
    try {
      await onApprove(ppid, undefined, notes);
      onClose();
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectAll = async () => {
    setProcessing(true);
    try {
      await onReject(ppid, undefined, notes);
      onClose();
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveChanges = async () => {
    const hasNewAnnotations = Object.values(newAnnotations).some(
      (arr: any) => arr && arr.length > 0
    );
    const hasDeletions = deletedAnnotations.size > 0;
    const hasModifications = Object.keys(modifiedExistingAnnotations).length > 0;

    if (!hasNewAnnotations && !hasDeletions && !hasModifications) {
      alert('No changes to save');
      return;
    }

    setProcessing(true);
    try {
      // Count actual annotations for user message (on current pattern)
      const deletedCountForMessage = currentImage.annotations.filter((a) =>
        deletedAnnotations.has(a.id)
      ).length;
      const addedCountForMessage = newAnnotations[currentImageIndex]?.length || 0;
      const modifiedCountForMessage = Object.keys(modifiedExistingAnnotations).length;

      // Delete annotations using bulk PPID deletion
      if (hasDeletions) {
        // Group deleted annotations by defect type for API
        const defectTypesToDelete = new Set<number>();

        Array.from(deletedAnnotations).forEach((annotationId) => {
          // Find the defect type for this annotation
          panelImages.forEach((img) => {
            const annotation = img.annotations.find((a) => a.id === annotationId);
            if (annotation) {
              const defectType = DEFECT_TYPES.find(
                (d) => d.name === annotation.defect
              );
              if (defectType) {
                defectTypesToDelete.add(defectType.id);
              }
            }
          });
        });

        console.log('Deleting defect types:', Array.from(defectTypesToDelete));

        // Delete each defect type across all patterns in the PPID
        for (const defectId of defectTypesToDelete) {
          const result = await bulkDeletePPIDAnnotation({
            ppid,
            defect: defectId,
          });
          console.log(
            `Successfully deleted ${result.annotations_deleted} annotation(s) for defect ${defectId}`
          );
        }
      }

      // Update modified existing annotations
      if (hasModifications) {
        for (const idStr of Object.keys(modifiedExistingAnnotations)) {
          const id = parseInt(idStr);
          const bbox = modifiedExistingAnnotations[id];
          let defectId: number | null = null;
          for (const img of panelImages) {
            const ann = img.annotations.find((a) => a.id === id);
            if (ann) {
              const defectType = DEFECT_TYPES.find((d) => d.name === ann.defect);
              defectId = defectType?.id ?? null;
              break;
            }
          }
          if (defectId) {
            const result = await bulkUpdatePPIDAnnotation({
              ppid,
              defect: defectId,
              x: bbox.x,
              y: bbox.y,
              width: bbox.width,
              height: bbox.height,
            });
            console.log(`Successfully updated ${result.annotations_updated} annotation(s) for id ${id}`);
          }
        }
      }

      // Add new annotations
      if (hasNewAnnotations) {
        // Collect unique defect boxes by UID - one per drawn annotation
        const uniqueAnnotations = new Map<string, {
          defect_id: number;
          bbox: { x: number; y: number; width: number; height: number };
        }>();

        Object.entries(newAnnotations).forEach(
          ([imageIndexStr, annotations]) => {
            if (Array.isArray(annotations) && annotations.length > 0) {
              annotations.forEach((ann) => {
                // Use UID to track each unique annotation
                if (!uniqueAnnotations.has(ann.uid)) {
                  uniqueAnnotations.set(ann.uid, {
                    defect_id: ann.defect_id,
                    bbox: ann.bbox,
                  });
                }
              });
            }
          }
        );

        console.log('Adding unique annotations:', Array.from(uniqueAnnotations.values()));

        if (customSaveHandler) {
          // Use custom save handler (e.g., for annotating existing past data panels)
          await customSaveHandler(ppid, Array.from(uniqueAnnotations.values()));
        } else {
          // Default: Create each annotation across all 15 patterns using bulk PPID creation
          for (const [uid, data] of uniqueAnnotations) {
            const result = await bulkCreatePPIDAnnotation({
              ppid,
              defect: data.defect_id,
              x: data.bbox.x,
              y: data.bbox.y,
              width: data.bbox.width,
              height: data.bbox.height,
              status: 'pending',
              visible_on: true,
            });
            console.log(
              `Successfully created ${result.annotations_created} annotation(s) for UID ${uid}`
            );
          }
        }
      }

      // Clear local state
      setDeletedAnnotations(new Set());
      setNewAnnotations({});
      setModifiedExistingAnnotations({});

      // Refresh data from server
      if (onRefresh) {
        await onRefresh();
      }

      const parts = [
        deletedCountForMessage > 0 ? `deleted ${deletedCountForMessage}` : '',
        modifiedCountForMessage > 0 ? `modified ${modifiedCountForMessage}` : '',
        addedCountForMessage > 0 ? `added ${addedCountForMessage} new` : '',
      ].filter(Boolean);
      alert(`Successfully ${parts.join(' • ')} annotation(s) per pattern`);
    } catch (err: any) {
      console.error('Error saving changes:', err);
      console.error('Error details:', JSON.stringify(err, null, 2));
      alert(
        `Failed to save changes: ${err.message}\n\nPlease check the console for details.`
      );
    } finally {
      setProcessing(false);
    }
  };

  if (!currentImage) return null;

  const activeAnnotations = currentImage.annotations.filter(
    (a) => !deletedAnnotations.has(a.id)
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[98vw] max-h-[98vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-3 border-b bg-gray-50 flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <div>
              <span className="text-xl font-semibold">
                {hideApproveReject ? 'Annotate Panel' : 'Review Annotations'} - {ppid}
              </span>
              <p className="text-sm text-gray-600 font-normal mt-1">
                Pattern {currentImageIndex + 1} of {panelImages.length} •{' '}
                {currentImage.annotation_count} annotations
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Sidebar - Pattern Thumbnails */}
          <div className="w-48 bg-white border-r overflow-y-auto flex-shrink-0">
            <div className="p-2">
              <h3 className="text-xs font-semibold text-gray-600 mb-2 px-2">
                PATTERNS
              </h3>
              <div className="space-y-1">
                {panelImages.map((img, idx) => {
                  // Calculate active annotation count (excluding deleted ones)
                  const activeCount = img.annotations.filter(
                    (a) => !deletedAnnotations.has(a.id)
                  ).length;
                  const newCount = newAnnotations[idx]?.length || 0;

                  return (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`w-full p-2 rounded-lg border-2 transition-all ${
                        currentImageIndex === idx
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div
                        className="relative bg-white rounded"
                        style={{ height: '80px' }}
                      >
                        <img
                          src={img.image_url}
                          alt={`Pattern ${idx + 1}`}
                          className="w-full h-full object-contain rounded"
                        />
                        {activeCount > 0 && (
                          <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded">
                            {activeCount}
                          </div>
                        )}
                        {newCount > 0 && (
                          <div className="absolute top-1 left-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded">
                            +{newCount}
                          </div>
                        )}
                      </div>
                      <div className="text-xs font-medium text-center mt-1">
                        Pattern {idx + 1}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Center - Canvas Area */}
          <div className="flex-1 bg-gray-900 relative overflow-hidden min-h-0">
            <TransformWrapper
              ref={transformRef}
              initialScale={1}
              minScale={0.1}
              maxScale={5}
              doubleClick={{ disabled: true }}
              panning={{ disabled: isDrawMode || highlightedAnnotation !== null }}
              wheel={{ disabled: false }}
              centerOnInit={true}
              limitToBounds={false}
              alignmentAnimation={{ sizeX: 0, sizeY: 0 }}
            >
              {({ zoomIn, zoomOut, resetTransform }) => (
                <>
                  {/* Zoom Controls */}
                  <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => zoomIn()}
                      className="shadow-lg h-8 w-8 p-0"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => zoomOut()}
                      className="shadow-lg h-8 w-8 p-0"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => resetTransform()}
                      className="shadow-lg h-8 w-8 p-0"
                      title="Center & Fit View"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                    <div className="h-px bg-gray-300" />
                    <Button
                      size="sm"
                      variant={annotationsVisible ? 'secondary' : 'outline'}
                      onClick={() => setAnnotationsVisible(!annotationsVisible)}
                      className="shadow-lg h-8 w-8 p-0"
                      title={
                        annotationsVisible
                          ? 'Hide Annotations'
                          : 'Show Annotations'
                      }
                    >
                      {annotationsVisible ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  <TransformComponent
                    wrapperStyle={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    contentStyle={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div>
                      <img
                        ref={imageRef}
                        src={currentImage.image_url}
                        alt={`Pattern ${currentImage.base_pattern}`}
                        style={{ display: 'none' }}
                      />
                      <canvas
                        ref={canvasRef}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        onDoubleClick={handleCanvasDoubleClick}
                        onClick={handleCanvasClick}
                        onContextMenu={(e) => e.preventDefault()}
                        style={{
                          maxWidth: '100%',
                          height: 'auto',
                          cursor: resizingState
                            ? HANDLE_CURSORS[resizingState.handle]
                            : isDrawMode
                            ? 'crosshair'
                            : hoveredHandle
                            ? HANDLE_CURSORS[hoveredHandle]
                            : 'pointer',
                        }}
                      />
                    </div>
                  </TransformComponent>
                </>
              )}
            </TransformWrapper>
          </div>

          {/* Right Sidebar - Defect Selection & Annotations */}
          <div className="w-80 bg-white border-l overflow-y-auto flex-shrink-0">
            <div className="p-4 space-y-4">
              {/* Info Banner */}
              {/* <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  <strong>Note:</strong> When you draw or delete an annotation, it immediately appears/disappears on <strong>all 15 patterns</strong>. Click "Save Changes" to persist to the database.
                </p>
              </div> */}

              {/* Draw Mode Toggle */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-blue-900">
                    Draw Mode
                  </span>
                  <button
                    onClick={() => setIsDrawMode(!isDrawMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isDrawMode ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isDrawMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                {isDrawMode && (
                  <p className="text-xs text-blue-700">
                    Select defect type below and draw boxes on the image
                  </p>
                )}
              </div>

              {/* Defect Type Selection - Grid Layout like BoundingBoxPage */}
              {isDrawMode && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">
                    Select Defect Type
                  </h3>
                  <div className="space-y-1 max-h-64 overflow-y-auto border rounded-lg p-2">
                    {DEFECT_TYPES.map((defect) => (
                      <button
                        key={defect.id}
                        onClick={() => setSelectedDefectType(defect)}
                        className={`w-full p-2 rounded text-left text-sm transition-all flex items-center gap-2 ${
                          selectedDefectType.id === defect.id
                            ? 'bg-blue-50 border-2 border-blue-500 font-medium'
                            : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: defect.color }}
                        />
                        <span className="flex-1">{defect.name}</span>
                        {selectedDefectType.id === defect.id && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        )}
                      </button>
                    ))}
                  </div>
                  {selectedDefectType && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                      Draw boxes for: <strong>{selectedDefectType.name}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Annotations */}
              <div>
                <h3 className="font-semibold mb-2 text-sm">
                  Annotations ({activeAnnotations.length}
                  {newAnnotations[currentImageIndex]?.length
                    ? ` + ${newAnnotations[currentImageIndex].length} new`
                    : ''}
                  )
                </h3>
                {currentImage.annotations.length === 0 &&
                !newAnnotations[currentImageIndex]?.length ? (
                  <p className="text-sm text-gray-500 text-center py-4 border rounded">
                    No annotations
                  </p>
                ) : (
                  <div className="space-y-2">
                    {/* Existing annotations */}
                    {currentImage.annotations.map((annotation) => {
                      const isDeleted = deletedAnnotations.has(annotation.id);
                      const isSelected = selectedAnnotations.has(annotation.id);
                      const isModified = !!modifiedExistingAnnotations[annotation.id];
                      return (
                        <div
                          key={annotation.id}
                          className={`p-2 border rounded text-xs transition ${
                            isDeleted
                              ? 'border-red-300 bg-red-50 opacity-50'
                              : highlightedAnnotation?.type === 'existing' && highlightedAnnotation.id === annotation.id
                              ? 'border-yellow-400 bg-yellow-50 ring-2 ring-yellow-300'
                              : isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div
                              onClick={() => {
                                if (isDeleted) return;
                                toggleAnnotation(annotation.id);
                                setHighlightedAnnotation(
                                  highlightedAnnotation?.type === 'existing' && highlightedAnnotation.id === annotation.id
                                    ? null
                                    : { type: 'existing', id: annotation.id }
                                );
                              }}
                              className={`flex-1 ${
                                !isDeleted && 'cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center gap-1 mb-1">
                                <div
                                  className="w-3 h-3 rounded"
                                  style={{
                                    backgroundColor: getDefectColor(
                                      annotation.defect
                                    ),
                                  }}
                                />
                                <span
                                  className={`font-medium ${
                                    isDeleted && 'line-through'
                                  }`}
                                >
                                  {annotation.defect}
                                </span>
                                {isModified && (
                                  <span className="text-orange-600 font-semibold ml-1">
                                    (MODIFIED)
                                  </span>
                                )}
                              </div>
                              <div className="text-gray-500">
                                by {annotation.created_by}
                              </div>
                            </div>
                            <div>
                              {isDeleted ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleRestoreAnnotation(annotation.id)
                                  }
                                  className="h-6 px-2 text-xs"
                                >
                                  Restore
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    handleDeleteAnnotation(annotation.id)
                                  }
                                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* New annotations */}
                    {newAnnotations[currentImageIndex]?.map(
                      (annotation) => {
                        return (
                          <div
                            key={annotation.uid}
                            onClick={() =>
                              setHighlightedAnnotation(
                                highlightedAnnotation?.type === 'new' && highlightedAnnotation.uid === annotation.uid
                                  ? null
                                  : { type: 'new', uid: annotation.uid }
                              )
                            }
                            className={`p-2 border rounded text-xs transition cursor-pointer ${
                              highlightedAnnotation?.type === 'new' && highlightedAnnotation.uid === annotation.uid
                                ? 'border-yellow-400 bg-yellow-50 ring-2 ring-yellow-300'
                                : 'border-green-300 bg-green-50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-1 mb-1">
                                  <div
                                    className="w-3 h-3 rounded"
                                    style={{
                                      backgroundColor: annotation.color,
                                    }}
                                  />
                                  <span className="font-medium">
                                    {annotation.defect_name}
                                  </span>
                                  <span className="text-green-700 ml-1 font-semibold">
                                    (NEW)
                                  </span>
                                </div>
                                <div className="text-gray-500">by you</div>
                              </div>
                              <div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    handleDeleteNewAnnotation(annotation.uid)
                                  }
                                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Notes (Optional)
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add review notes..."
                  rows={3}
                  className="text-sm"
                />
              </div>

              {/* Current Image Actions */}
              {!hideApproveReject && (
              <div>
                <h3 className="text-sm font-semibold mb-2">
                  Current Image Actions
                </h3>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full text-green-600 border-green-600 hover:bg-green-50"
                    onClick={handleApproveSelected}
                    disabled={processing}
                    size="sm"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    {selectedAnnotations.size > 0
                      ? `Approve Selected (${selectedAnnotations.size})`
                      : 'Approve This Image'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full text-red-600 border-red-600 hover:bg-red-50"
                    onClick={handleRejectSelected}
                    disabled={processing}
                    size="sm"
                  >
                    <X className="w-4 h-4 mr-1" />
                    {selectedAnnotations.size > 0
                      ? `Reject Selected (${selectedAnnotations.size})`
                      : 'Reject This Image'}
                  </Button>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50 flex-shrink-0">
          {/* Save Changes Banner */}
          {(() => {
            // Count actual deleted annotations on current pattern
            const deletedCount = currentImage.annotations.filter((a) =>
              deletedAnnotations.has(a.id)
            ).length;

            // Count actual new annotations on current pattern
            const newCount = newAnnotations[currentImageIndex]?.length || 0;
            const modifiedCount = Object.keys(modifiedExistingAnnotations).length;

            const hasChanges = deletedCount > 0 || newCount > 0 || modifiedCount > 0;

            return hasChanges ? (
              <div className="flex items-center gap-3 px-3 py-2 bg-orange-50 border border-orange-200 rounded-md">
                <span className="text-sm text-orange-800 font-medium">
                  {[
                    deletedCount > 0 ? `${deletedCount} deletion(s)` : '',
                    modifiedCount > 0 ? `${modifiedCount} modified` : '',
                    newCount > 0 ? `${newCount} new` : '',
                  ].filter(Boolean).join(' • ')}
                </span>
              <Button
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white"
                onClick={handleSaveChanges}
                disabled={processing}
              >
                <Save className="w-4 h-4 mr-1" />
                Save Changes
              </Button>
            </div>
            ) : null;
          })()}

          <div className="flex gap-2 ml-auto">
            {!hideApproveReject && (
              <>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleApproveAll}
                  disabled={processing}
                >
                  <Check className="w-4 h-4 mr-1" />
                  Approve All
                </Button>
                <Button
                  size="sm"
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleRejectAll}
                  disabled={processing}
                >
                  <X className="w-4 h-4 mr-1" />
                  Reject All
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              disabled={processing}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AnnotationReviewModal;
