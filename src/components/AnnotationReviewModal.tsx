import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
}

const AnnotationReviewModal: React.FC<AnnotationReviewModalProps> = ({
  isOpen,
  onClose,
  ppid,
  panelImages,
  onApprove,
  onReject,
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [notes, setNotes] = useState('');
  const [selectedAnnotations, setSelectedAnnotations] = useState<Set<number>>(
    new Set()
  );
  const [processing, setProcessing] = useState(false);
  const [zoom, setZoom] = useState(1);

  const currentImage = panelImages[currentImageIndex];
  const hasNext = currentImageIndex < panelImages.length - 1;
  const hasPrev = currentImageIndex > 0;

  const handleNext = () => {
    if (hasNext) {
      setCurrentImageIndex((prev) => prev + 1);
      setSelectedAnnotations(new Set());
      setNotes('');
      setZoom(1);
    }
  };

  const handlePrev = () => {
    if (hasPrev) {
      setCurrentImageIndex((prev) => prev - 1);
      setSelectedAnnotations(new Set());
      setNotes('');
      setZoom(1);
    }
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
      // No selection - approve all annotations in current image
      const annotationIds = currentImage.annotations.map((a) => a.id);
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
      // Approve selected annotations
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
      // No selection - reject all annotations in current image
      const annotationIds = currentImage.annotations.map((a) => a.id);
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
      // Reject selected annotations
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

  if (!currentImage) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Review Annotations - {ppid}</span>
            <Badge variant="secondary">
              {currentImageIndex + 1} / {panelImages.length}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image Display */}
          <div
            className="relative bg-gray-100 rounded-lg overflow-hidden"
            style={{ minHeight: '400px' }}
          >
            <div className="absolute top-2 right-2 z-10 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setZoom(Math.min(3, zoom + 0.25))}
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center justify-center p-4 overflow-auto">
              <div
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center',
                }}
              >
                <img
                  src={currentImage.image_url}
                  alt={`Pattern ${currentImage.base_pattern}`}
                  className="max-w-full h-auto"
                />
              </div>
            </div>

            {/* Pattern Info */}
            <div className="absolute bottom-2 left-2 bg-black/70 text-white px-3 py-1 rounded">
              Pattern: {currentImage.base_pattern}
            </div>
          </div>

          {/* Annotations List */}
          <div>
            <h3 className="font-semibold mb-2">
              Annotations ({currentImage.annotation_count})
            </h3>
            {currentImage.annotations.length === 0 ? (
              <p className="text-sm text-gray-500">
                No annotations for this pattern
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {currentImage.annotations.map((annotation) => (
                  <div
                    key={annotation.id}
                    onClick={() => toggleAnnotation(annotation.id)}
                    className={`p-3 border rounded cursor-pointer transition ${
                      selectedAnnotations.has(annotation.id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-sm">
                          {annotation.defect}
                        </span>
                        <Badge
                          variant={
                            annotation.status === 'approved'
                              ? 'default'
                              : annotation.status === 'pending'
                              ? 'secondary'
                              : 'destructive'
                          }
                          className="ml-2 text-xs"
                        >
                          {annotation.status}
                        </Badge>
                      </div>
                      <div className="text-xs text-gray-500">
                        by {annotation.created_by}
                      </div>
                    </div>
                    {annotation.bbox && (
                      <div className="text-xs text-gray-500 mt-1">
                        BBox: ({(annotation.bbox.x * 100).toFixed(1)}%,{' '}
                        {(annotation.bbox.y * 100).toFixed(1)}%, w:
                        {(annotation.bbox.width * 100).toFixed(1)}%, h:
                        {(annotation.bbox.height * 100).toFixed(1)}%)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Notes (Optional)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes for this review..."
              rows={2}
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={!hasPrev || processing}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-gray-500">
              Image {currentImageIndex + 1} of {panelImages.length}
            </span>
            <Button
              variant="outline"
              onClick={handleNext}
              disabled={!hasNext || processing}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

        <DialogFooter className="flex flex-wrap gap-2">
          {/* Current Image Actions */}
          <div className="flex gap-2 flex-1">
            <Button
              variant="outline"
              className="text-green-600 border-green-600 hover:bg-green-50"
              onClick={handleApproveSelected}
              disabled={processing}
            >
              <Check className="w-4 h-4 mr-1" />
              {selectedAnnotations.size > 0
                ? `Approve Selected (${selectedAnnotations.size})`
                : 'Approve This Image'}
            </Button>
            <Button
              variant="outline"
              className="text-red-600 border-red-600 hover:bg-red-50"
              onClick={handleRejectSelected}
              disabled={processing}
            >
              <X className="w-4 h-4 mr-1" />
              {selectedAnnotations.size > 0
                ? `Reject Selected (${selectedAnnotations.size})`
                : 'Reject This Image'}
            </Button>
          </div>

          {/* Bulk Actions */}
          <div className="flex gap-2">
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={handleApproveAll}
              disabled={processing}
            >
              <Check className="w-4 h-4 mr-1" />
              Approve All
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleRejectAll}
              disabled={processing}
            >
              <X className="w-4 h-4 mr-1" />
              Reject All
            </Button>
          </div>

          <Button variant="ghost" onClick={onClose} disabled={processing}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AnnotationReviewModal;
