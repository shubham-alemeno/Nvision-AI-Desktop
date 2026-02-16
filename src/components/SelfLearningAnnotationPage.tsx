import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Search,
  ChevronDown,
  ChevronUp,
  X,
  RotateCcw,
  PenBox,
  ImageIcon,
  Database,
  Calendar,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getUnannotatedPanels,
  annotateExistingPanel,
} from '@/services/api';
import AnnotationReviewModal from './AnnotationReviewModal';
import ImageViewerModal from './ImageViewerModal';

interface PanelImage {
  id: number;
  image_url: string;
  cropped_url: string | null;
  base_pattern: number;
  base_pattern_name: string;
  base_pattern_code: string;
  created_at: string;
  used_for_training: boolean;
  annotation_count: number;
  has_annotations: boolean;
}

interface UnannotatedPanel {
  id: number;
  ppid: string;
  created_at: string;
  test_type: string;
  is_cropped: boolean;
  created_by_username: string;
  total_images: number;
  annotated_images_count: number;
  unannotated_images_count: number;
  panel_images?: PanelImage[];
}

const SelfLearningAnnotationPage: React.FC = () => {
  const [panels, setPanels] = useState<UnannotatedPanel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [jumpToPage, setJumpToPage] = useState('');
  const pageSize = 20;

  // Filters
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [ppidSearch, setPpidSearch] = useState('');
  const [testTypeFilter, setTestTypeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Annotation modal state
  const [annotationModalOpen, setAnnotationModalOpen] = useState(false);
  const [selectedPanelImages, setSelectedPanelImages] = useState<any[]>([]);
  const [annotatingPPID, setAnnotatingPPID] = useState('');

  // Image viewer modal state
  const [viewerModalOpen, setViewerModalOpen] = useState(false);
  const [viewerPanelImages, setViewerPanelImages] = useState<any[]>([]);
  const [viewerPPID, setViewerPPID] = useState('');

  const fetchPanels = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        page,
        page_size: pageSize,
        include_images: true,
      };
      if (ppidSearch) params.ppid = ppidSearch;
      if (testTypeFilter) params.test_type = testTypeFilter;
      if (fromDate) params.from_date = `${fromDate}T00:00:00`;
      if (toDate) params.to_date = `${toDate}T23:59:59`;

      const data = await getUnannotatedPanels(params);

      setPanels(data.results || []);
      setTotalCount(data.count || 0);
      setTotalPages(data.total_pages || 1);
      setCurrentPage(data.current_page || page);
      setHasNext(!!data.next);
      setHasPrevious(!!data.previous);
    } catch (err: any) {
      console.error('Error fetching unannotated panels:', err);
      setError(err.message || 'Failed to load unannotated panels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPanels(1);
  }, []);

  // Handle pagination changes
  useEffect(() => {
    if (currentPage > 1) {
      fetchPanels(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const handleSearch = () => {
    window.scrollTo(0, 0);
    setCurrentPage(1);
    fetchPanels(1);
  };

  const handleReset = () => {
    window.scrollTo(0, 0);
    setPpidSearch('');
    setTestTypeFilter('');
    setFromDate('');
    setToDate('');
    setCurrentPage(1);
    setTimeout(() => fetchPanels(1), 0);
  };

  const handleNextPage = () => {
    if (hasNext) {
      window.scrollTo(0, 0);
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePreviousPage = () => {
    if (hasPrevious && currentPage > 1) {
      window.scrollTo(0, 0);
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handlePageJump = () => {
    const pageNum = parseInt(jumpToPage);
    if (pageNum && pageNum > 0 && pageNum <= totalPages) {
      window.scrollTo(0, 0);
      setCurrentPage(pageNum);
      setJumpToPage('');
    }
  };

  // Transform API panel_images to the format AnnotationReviewModal expects
  const transformPanelImages = (panelImages: PanelImage[]) => {
    return panelImages.map((img) => ({
      id: img.id,
      base_pattern: img.base_pattern_name,
      image_url: img.cropped_url || img.image_url,
      annotation_count: img.annotation_count,
      annotations: [],
    }));
  };

  const handleAnnotateClick = (panel: UnannotatedPanel) => {
    if (!panel.panel_images || panel.panel_images.length === 0) {
      alert('No images available for annotation');
      return;
    }

    const transformed = transformPanelImages(panel.panel_images);
    setSelectedPanelImages(transformed);
    setAnnotatingPPID(panel.ppid);
    setAnnotationModalOpen(true);
  };

  const handleViewImages = (panel: UnannotatedPanel) => {
    if (!panel.panel_images || panel.panel_images.length === 0) {
      alert('No images available');
      return;
    }

    const transformed = transformPanelImages(panel.panel_images);
    setViewerPanelImages(transformed);
    setViewerPPID(panel.ppid);
    setViewerModalOpen(true);
  };

  const handleCustomSave = async (
    ppid: string,
    newAnnotations: Array<{
      defect_id: number;
      bbox: { x: number; y: number; width: number; height: number };
    }>
  ) => {
    // Convert drawn annotations to the annotate_existing_panel API format
    // Each annotation gets replicated across all available panel images
    const apiAnnotations: Array<{
      panel_image_id: number;
      defect: number;
      x: number;
      y: number;
      width: number;
      height: number;
      visible_on: boolean;
      status: string;
    }> = [];

    for (const ann of newAnnotations) {
      for (const panelImg of selectedPanelImages) {
        apiAnnotations.push({
          panel_image_id: panelImg.id,
          defect: ann.defect_id,
          x: ann.bbox.x,
          y: ann.bbox.y,
          width: ann.bbox.width,
          height: ann.bbox.height,
          visible_on: true,
          status: 'pending',
        });
      }
    }

    await annotateExistingPanel({ ppid, annotations: apiAnnotations });

    // Close modal and refresh data
    setAnnotationModalOpen(false);
    setSelectedPanelImages([]);
    setAnnotatingPPID('');
    await fetchPanels(currentPage);
  };

  // Filter helpers
  const getActiveFilterCount = () => {
    let count = 0;
    if (ppidSearch) count++;
    if (testTypeFilter) count++;
    if (fromDate) count++;
    if (toDate) count++;
    return count;
  };

  const getActiveFilterSummary = () => {
    const filters: Array<{ label: string; value: string; key: string }> = [];
    if (ppidSearch) filters.push({ label: 'PPID', value: ppidSearch, key: 'ppid' });
    if (testTypeFilter) filters.push({ label: 'Test Type', value: testTypeFilter, key: 'test_type' });
    if (fromDate) filters.push({ label: 'From', value: fromDate, key: 'from' });
    if (toDate) filters.push({ label: 'To', value: toDate, key: 'to' });
    return filters;
  };

  const clearFilter = (key: string) => {
    if (key === 'ppid') setPpidSearch('');
    if (key === 'test_type') setTestTypeFilter('');
    if (key === 'from') setFromDate('');
    if (key === 'to') setToDate('');
  };

  // Quick date filter
  const setQuickDateFilter = (days: number) => {
    const today = new Date();
    const toDateStr = today.toISOString().split('T')[0];
    if (days === 0) {
      setFromDate(toDateStr);
      setToDate(toDateStr);
    } else {
      const fromDateObj = new Date();
      fromDateObj.setDate(fromDateObj.getDate() - days);
      setFromDate(fromDateObj.toISOString().split('T')[0]);
      setToDate(toDateStr);
    }
  };

  // Loading skeleton
  if (loading && currentPage === 1) {
    return (
      <div className="max-w-full mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-8 w-64" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Skeleton className="h-10 w-40" />
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 border-b p-4">
                <div className="grid grid-cols-6 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-4" />
                  ))}
                </div>
              </div>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="border-b p-4">
                  <div className="grid grid-cols-6 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((j) => (
                      <Skeleton key={j} className="h-6" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-9 w-64" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-full mx-auto space-y-6 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Past Unannotated Panels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col justify-center items-center py-8 space-y-4">
              <div className="text-red-500 text-center">{error}</div>
              <Button
                onClick={() => fetchPanels(currentPage)}
                disabled={loading}
                className="flex items-center space-x-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Try Again</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Past Unannotated Panels</span>
            <span className="text-sm text-gray-500">
              Unannotated Panels: {totalCount.toLocaleString()}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Collapsible Filters */}
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen} className="mb-6">
            <div className="flex items-center justify-between">
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2 mb-2">
                  <Search className="h-4 w-4" />
                  Filters
                  {getActiveFilterCount() > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {getActiveFilterCount()}
                    </Badge>
                  )}
                  {filtersOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <div className="flex gap-2">
                <Button
                  onClick={() => fetchPanels(currentPage)}
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Active Filter Summary */}
            {!filtersOpen && getActiveFilterCount() > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 mb-2">
                {getActiveFilterSummary().map((filter) => (
                  <Badge
                    key={filter.key}
                    variant="secondary"
                    className="flex items-center gap-1 px-2 py-1"
                  >
                    <span className="text-sm">
                      <span className="font-semibold">{filter.label}:</span> {filter.value}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearFilter(filter.key);
                      }}
                      className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <CollapsibleContent className="space-y-4 mt-4 p-4 border rounded-lg bg-gray-50">
              {/* Quick Date Filters */}
              <div>
                <Label className="block text-sm font-medium mb-2">Quick Filters</Label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setQuickDateFilter(0)} className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Today
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setQuickDateFilter(7)} className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Last 7 Days
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setQuickDateFilter(30)} className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Last 30 Days
                  </Button>
                </div>
              </div>

              {/* Row 1: Date Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="block text-sm font-medium mb-1">From Date</Label>
                  <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full" />
                </div>
                <div>
                  <Label className="block text-sm font-medium mb-1">To Date</Label>
                  <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full" />
                </div>
              </div>

              {/* Row 2: PPID + Test Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="block text-sm font-medium mb-1">Search PPID</Label>
                  <Input
                    placeholder="Enter PPID"
                    value={ppidSearch}
                    onChange={(e) => setPpidSearch(e.target.value)}
                    className="w-full"
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <div>
                  <Label className="block text-sm font-medium mb-1">Test Type</Label>
                  <select
                    value={testTypeFilter}
                    onChange={(e) => setTestTypeFilter(e.target.value)}
                    className="w-full border border-gray-300 rounded-md p-2 h-10"
                  >
                    <option value="">All</option>
                    <option value="production">Production</option>
                    <option value="test">Test</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <Button onClick={handleSearch} disabled={loading} className="h-10 flex items-center justify-center gap-2">
                  <Search className="h-4 w-4" />
                  {loading ? 'Searching...' : 'Search'}
                </Button>
                <Button variant="outline" onClick={handleReset} className="h-10">
                  Reset
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto border-collapse border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                    PPID
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                    Created At
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-center font-semibold text-sm">
                    Test Type
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-center font-semibold text-sm">
                    Images
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                    Created By
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-center font-semibold text-sm">
                    Annotate
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-center font-semibold text-sm">
                    View
                  </th>
                </tr>
              </thead>
              <tbody>
                {panels.length > 0 ? (
                  panels.map((panel, idx) => (
                    <tr
                      key={panel.ppid}
                      className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100`}
                    >
                      <td className="border border-gray-200 px-4 py-3 text-sm font-mono">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="cursor-pointer hover:text-blue-600 transition-colors"
                                onClick={() => {
                                  navigator.clipboard.writeText(panel.ppid);
                                  const toast = document.createElement('div');
                                  toast.textContent = 'PPID copied!';
                                  toast.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50';
                                  document.body.appendChild(toast);
                                  setTimeout(() => toast.remove(), 2000);
                                }}
                              >
                                {panel.ppid}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Click to copy PPID</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-sm whitespace-nowrap">
                        <div className="flex flex-col">
                          <span>{new Date(panel.created_at).toLocaleDateString('en-GB')}</span>
                          <span className="text-gray-500">
                            {new Date(panel.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-sm text-center">
                        <Badge
                          className={`text-[11px] px-1.5 py-0 ${
                            panel.test_type === 'production'
                              ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100 hover:text-green-800'
                              : 'bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100 hover:text-yellow-800'
                          }`}
                        >
                          {panel.test_type}
                        </Badge>
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-sm text-center">
                        <span className="text-gray-600">{panel.total_images}</span>
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-sm">
                        {panel.created_by_username || '-'}
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-sm text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                onClick={() => handleAnnotateClick(panel)}
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-sm text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                              >
                                <PenBox className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Annotate this panel</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-sm text-center">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                onClick={() => handleViewImages(panel)}
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-sm"
                              >
                                <ImageIcon className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>View panel images</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="border border-gray-200">
                      <div className="flex flex-col items-center justify-center py-16 px-4">
                        <div className="rounded-full bg-gray-100 p-6 mb-4">
                          <Database className="h-12 w-12 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          No unannotated panels found
                        </h3>
                        <p className="text-sm text-gray-500 text-center max-w-md mb-4">
                          {getActiveFilterCount() > 0
                            ? 'No panels match your current filters. Try adjusting your search criteria.'
                            : 'All panels have been annotated. Great work!'}
                        </p>
                        {getActiveFilterCount() > 0 && (
                          <Button variant="outline" onClick={handleReset} className="flex items-center gap-2">
                            <X className="h-4 w-4" />
                            Clear Filters
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {panels.length > 0 && (
            <div className="mt-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-sm text-gray-600">
                  Showing{' '}
                  <span className="font-semibold">
                    {totalCount > 0 ? (currentPage - 1) * pageSize + 1 : 0}
                  </span>{' '}
                  to{' '}
                  <span className="font-semibold">
                    {Math.min(currentPage * pageSize, totalCount)}
                  </span>{' '}
                  of <span className="font-semibold">{totalCount.toLocaleString()}</span> results
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <Button onClick={handlePreviousPage} disabled={!hasPrevious || loading} variant="outline" size="sm">
                    Previous
                  </Button>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded border">
                    <span className="text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                  </div>
                  <Button onClick={handleNextPage} disabled={!hasNext || loading} variant="outline" size="sm">
                    Next
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Label htmlFor="jump-to-page-annotation" className="text-sm whitespace-nowrap">
                    Jump to:
                  </Label>
                  <Input
                    id="jump-to-page-annotation"
                    type="number"
                    min="1"
                    max={totalPages}
                    value={jumpToPage}
                    onChange={(e) => setJumpToPage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handlePageJump()}
                    placeholder="Page"
                    className="w-20 h-9"
                  />
                  <Button onClick={handlePageJump} disabled={!jumpToPage || loading} variant="outline" size="sm">
                    Go
                  </Button>
                </div>
              </div>

              <div className="text-sm text-gray-500 text-center">
                Showing {pageSize} items per page
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Annotation Modal */}
      {selectedPanelImages.length > 0 && (
        <AnnotationReviewModal
          isOpen={annotationModalOpen}
          onClose={() => {
            setAnnotationModalOpen(false);
            setSelectedPanelImages([]);
            setAnnotatingPPID('');
          }}
          ppid={annotatingPPID}
          panelImages={selectedPanelImages}
          onApprove={async () => {}}
          onReject={async () => {}}
          customSaveHandler={handleCustomSave}
          hideApproveReject={true}
        />
      )}

      {/* Image Viewer Modal (Read-only) */}
      {viewerPanelImages.length > 0 && (
        <ImageViewerModal
          isOpen={viewerModalOpen}
          onClose={() => {
            setViewerModalOpen(false);
            setViewerPanelImages([]);
            setViewerPPID('');
          }}
          ppid={viewerPPID}
          panelImages={viewerPanelImages}
        />
      )}
    </div>
  );
};

export default SelfLearningAnnotationPage;
