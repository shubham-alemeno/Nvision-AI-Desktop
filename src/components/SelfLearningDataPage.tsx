import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  RotateCcw,
  Cpu,
  Search,
  ChevronDown,
  ChevronUp,
  X,
  TrendingUp,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import {
  getAnnotationStatsOverview,
  getAnnotationStatsPanels,
  getAnnotationPPIDList,
  getDefects,
  bulkUpdateAnnotationStatus,
} from '@/services/api';
import AnnotationReviewModal from './AnnotationReviewModal';
import ImageViewerModal from './ImageViewerModal';

interface OverviewStats {
  status: string;
  statistics: {
    total_annotations: number;
    status_breakdown: Array<{
      status: string;
      count: number;
    }>;
    defect_breakdown: Array<{
      defect__defect_name: string;
      count: number;
    }>;
    pattern_breakdown: Array<{
      base_pattern__pattern_name: string;
      count: number;
    }>;
  };
}

interface PanelStats {
  status: string;
  timestamp: string;
  panel_summary: {
    total_panels_annotated: number;
    panels_pending_review: number;
    panels_fully_approved: number;
    panels_discarded: number;
    panels_mixed_status: number;
    panels_used_in_training: number;
    panels_not_used_in_training: number;
  };
  training_usage: {
    used_count: number;
    not_used_count: number;
    usage_percentage: number;
  };
}

interface PPIDAnnotation {
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
  created_by_email: string;
  notes: string | null;
}

interface PPIDPanelImage {
  id: number;
  base_pattern: string;
  image_url: string;
  cropped_url: string | null;
  annotation_count: number;
  annotations: PPIDAnnotation[];
}

interface PPIDItem {
  ppid: string;
  test_type: string;
  panel_created_at: string;
  annotation_summary: {
    total_annotations: number;
    first_annotated: string;
    last_annotated: string;
    status_breakdown: {
      approved?: number;
      pending?: number;
      rejected?: number;
    };
    defect_breakdown: {
      [defectName: string]: number;
    };
  };
  panel_images: PPIDPanelImage[];
}

interface PPIDListResponse {
  status: string;
  total_ppids: number;
  ppids: PPIDItem[];
  filters_applied: {
    ppids: string[] | null;
    test_type: string | null;
    annotation_status: string | null;
    defect_id: number | null;
    defect_name: string | null;
  };
}

interface Defect {
  id: number;
  defect_name: string;
  defect_type: string;
}

interface SelfLearningDataPageProps {
  onNavigateToTraining?: (batchSlug?: string) => void;
  userData?: any; // User data from token
}

const SelfLearningDataPage: React.FC<SelfLearningDataPageProps> = ({
  onNavigateToTraining,
  userData,
}) => {
  // Check if user is from alemeno group
  // console.log(userData.groups[0].name)
  const isAlemenoUser = userData.groups[0].name === 'alemeno';
  const [loading, setLoading] = useState(false);
  const [overviewStats, setOverviewStats] = useState<OverviewStats | null>(
    null
  );
  const [panelStats, setPanelStats] = useState<PanelStats | null>(null);
  const [ppidListData, setPpidListData] = useState<PPIDListResponse | null>(
    null
  );
  const [defects, setDefects] = useState<Defect[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [viewerModalOpen, setViewerModalOpen] = useState(false);
  const [selectedPPID, setSelectedPPID] = useState<PPIDItem | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [jumpToPage, setJumpToPage] = useState('');

  // Filter states
  const [filters, setFilters] = useState({
    ppid: '',
    test_type: '' as '' | 'production' | 'test',
    status: '' as '' | 'pending' | 'approved' | 'rejected',
    defect: '' as string,
    from_date: '',
    to_date: '',
  });

  const fetchDefects = async () => {
    try {
      const defectsData = await getDefects();
      setDefects(defectsData);
    } catch (err: any) {
      console.error('Error fetching defects:', err);
    }
  };

  const fetchOverviewData = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      // Build params based on filters
      const params: any = {};
      if (filters.from_date) params.from_date = filters.from_date;
      if (filters.to_date) params.to_date = filters.to_date;
      if (filters.defect) params.defect = parseInt(filters.defect);
      if (filters.test_type) params.test_type = filters.test_type;

      const overview = await getAnnotationStatsOverview(params);
      setOverviewStats(overview);

      const panels = await getAnnotationStatsPanels(params);
      setPanelStats(panels);

      // Fetch PPID list with filters and pagination
      const ppidParams: any = {
        page,
        page_size: pageSize,
      };
      if (filters.ppid) ppidParams.ppid = filters.ppid;
      if (filters.test_type) ppidParams.test_type = filters.test_type;
      if (filters.status) ppidParams.status = filters.status;
      if (filters.defect) ppidParams.defect = parseInt(filters.defect);
      if (filters.from_date) ppidParams.from_date = filters.from_date;
      if (filters.to_date) ppidParams.to_date = filters.to_date;

      const ppidData = await getAnnotationPPIDList(ppidParams);
      setPpidListData(ppidData);

      // Update pagination state from response
      if (ppidData.pagination) {
        setTotalRecords(ppidData.pagination.total_records || 0);
        setTotalPages(ppidData.pagination.total_pages || 1);
        setCurrentPage(ppidData.pagination.current_page || 1);
        setHasNext(ppidData.pagination.has_next || false);
        setHasPrevious(ppidData.pagination.has_previous || false);
      } else {
        // Fallback if pagination data is missing
        setTotalRecords(ppidData.ppids?.length || 0);
        setTotalPages(1);
        setCurrentPage(1);
        setHasNext(false);
        setHasPrevious(false);
      }
    } catch (err: any) {
      console.error('Error fetching overview data:', err);
      setError(err.message || 'Failed to load overview data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDefects();
    fetchOverviewData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle pagination changes (only when user navigates pages)
  useEffect(() => {
    if (currentPage > 1) {
      fetchOverviewData(currentPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const handleRefresh = () => {
    fetchOverviewData(currentPage);
  };

  const handleSearch = () => {
    // Scroll to top when searching
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    setCurrentPage(1); // Reset to first page when searching
    fetchOverviewData(1);
  };

  const handleReset = () => {
    // Scroll to top when resetting
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    setFilters({
      ppid: '',
      test_type: '',
      status: '',
      defect: '',
      from_date: '',
      to_date: '',
    });
    setCurrentPage(1); // Reset to first page
    setTimeout(() => fetchOverviewData(1), 0);
  };

  // Pagination handlers
  const handleNextPage = () => {
    if (hasNext && currentPage < totalPages) {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePreviousPage = () => {
    if (hasPrevious && currentPage > 1) {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      setCurrentPage((prev) => prev - 1);
    }
  };

  const handlePageJump = () => {
    const pageNum = parseInt(jumpToPage);
    if (pageNum && pageNum > 0 && pageNum <= totalPages) {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      setCurrentPage(pageNum);
      setJumpToPage('');
    }
  };

  // Helper function to count active filters
  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.ppid) count++;
    if (filters.test_type) count++;
    if (filters.status) count++;
    if (filters.defect) count++;
    if (filters.from_date) count++;
    if (filters.to_date) count++;
    return count;
  };

  // Helper function to get active filter summary
  const getActiveFilterSummary = () => {
    const filtersList = [];
    if (filters.ppid)
      filtersList.push({ label: 'PPID', value: filters.ppid, key: 'ppid' });
    if (filters.test_type)
      filtersList.push({
        label: 'Test Type',
        value: filters.test_type,
        key: 'test_type',
      });
    if (filters.status)
      filtersList.push({
        label: 'Status',
        value: filters.status,
        key: 'status',
      });
    if (filters.defect) {
      const defectName =
        defects.find((d) => d.id.toString() === filters.defect)?.defect_name ||
        filters.defect;
      filtersList.push({ label: 'Defect', value: defectName, key: 'defect' });
    }
    if (filters.from_date)
      filtersList.push({
        label: 'From',
        value: filters.from_date,
        key: 'from_date',
      });
    if (filters.to_date)
      filtersList.push({ label: 'To', value: filters.to_date, key: 'to_date' });
    return filtersList;
  };

  // Helper function to clear individual filter
  const clearFilter = (key: string) => {
    setFilters((prev) => ({ ...prev, [key]: '' }));
  };

  // Open review modal for a specific PPID
  const handleOpenReview = (ppidItem: PPIDItem) => {
    setSelectedPPID(ppidItem);
    setReviewModalOpen(true);
  };

  // Open viewer modal for a specific PPID
  const handleOpenViewer = (ppidItem: PPIDItem) => {
    setSelectedPPID(ppidItem);
    setViewerModalOpen(true);
  };

  // Get overall status for PPID
  const getOverallStatus = (statusBreakdown: {
    approved?: number;
    pending?: number;
    rejected?: number;
  }) => {
    const approved = statusBreakdown.approved || 0;
    const pending = statusBreakdown.pending || 0;
    const rejected = statusBreakdown.rejected || 0;

    if (pending > 0) {
      return {
        label: 'Pending Review',
        color: 'bg-yellow-100 text-yellow-700',
      };
    } else if (approved > 0 && rejected === 0) {
      return {
        label: 'Approved',
        color: 'bg-green-100 text-green-700',
      };
    } else if (rejected > 0) {
      return {
        label: 'Rejected',
        color: 'bg-red-100 text-red-700',
      };
    }
    return { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-700' };
  };

  // Handle approve annotations
  const handleApprove = async (
    ppid: string,
    annotationIds?: number[],
    notes?: string
  ) => {
    try {
      if (annotationIds && annotationIds.length > 0) {
        // Approve specific annotations
        const payload = {
          display_panels: [
            {
              ppid,
              annotations: annotationIds.map((id) => {
                const ann: any = {
                  annotation_id: id,
                  action: 'approve',
                };
                if (notes && notes.trim() !== '') {
                  ann.notes = notes;
                }
                return ann;
              }),
            },
          ],
        };
        console.log('Sending approve payload:', JSON.stringify(payload, null, 2));
        await bulkUpdateAnnotationStatus(payload);
      } else {
        // Approve entire PPID
        await bulkUpdateAnnotationStatus({
          display_panels: [
            {
              ppid,
              action: 'approve',
              ...(notes && notes.trim() !== '' ? { notes } : {}),
            },
          ],
        });
      }

      // Refresh data
      await fetchOverviewData(currentPage);

      // Show success message
      alert(`Successfully approved annotations for ${ppid}`);
    } catch (err: any) {
      console.error('Error approving annotations:', err);
      console.error('Full error details:', JSON.stringify(err, null, 2));
      console.error('Error response:', err.response?.data);
      alert(`Failed to approve: ${err.message}\n\nDetails: ${JSON.stringify(err.response?.data || err.details || {})}`);
    }
  };

  // Handle reject annotations
  const handleReject = async (
    ppid: string,
    annotationIds?: number[],
    notes?: string
  ) => {
    try {
      if (annotationIds && annotationIds.length > 0) {
        // Reject specific annotations
        await bulkUpdateAnnotationStatus({
          display_panels: [
            {
              ppid,
              annotations: annotationIds.map((id) => ({
                annotation_id: id,
                action: 'reject',
                ...(notes && notes.trim() !== '' ? { notes } : {}),
              })),
            },
          ],
        });
      } else {
        // Reject entire PPID
        await bulkUpdateAnnotationStatus({
          display_panels: [
            {
              ppid,
              action: 'reject',
              ...(notes && notes.trim() !== '' ? { notes } : {}),
            },
          ],
        });
      }

      // Refresh data
      await fetchOverviewData(currentPage);

      // Show success message
      alert(`Successfully rejected annotations for ${ppid}`);
    } catch (err: any) {
      console.error('Error rejecting annotations:', err);
      console.error('Full error details:', JSON.stringify(err, null, 2));
      console.error('Error response:', err.response?.data);
      alert(`Failed to reject: ${err.message}\n\nDetails: ${JSON.stringify(err.response?.data || err.details || {})}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>Self Learning Data</span>
              {/* {onNavigateToTraining && (
                <Button
                  onClick={() => onNavigateToTraining()}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
                >
                  <Cpu className="mr-2 w-5 h-5" />
                  Model Training
                </Button>
              )} */}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Collapsible Filters */}
            <Collapsible
              open={filtersOpen}
              onOpenChange={setFiltersOpen}
              className="mb-6"
            >
              <div className="flex items-center justify-between">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 mb-2"
                  >
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
                    onClick={handleRefresh}
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    className="flex items-center gap-2"
                  >
                    <RotateCcw
                      className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                    />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* Active Filter Summary - Show when collapsed */}
              {!filtersOpen && getActiveFilterCount() > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 mb-2">
                  {getActiveFilterSummary().map((filter) => (
                    <Badge
                      key={filter.key}
                      variant="secondary"
                      className="flex items-center gap-1 px-2 py-1"
                    >
                      <span className="text-xs">
                        <span className="font-semibold">{filter.label}:</span>{' '}
                        {filter.value}
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
                {/* Row 1: PPID and Test Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="block text-sm font-medium mb-1">
                      PPID
                    </Label>
                    <Input
                      type="text"
                      value={filters.ppid}
                      onChange={(e) =>
                        setFilters({ ...filters, ppid: e.target.value })
                      }
                      placeholder="Search PPID"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label className="block text-sm font-medium mb-1">
                      Test Type
                    </Label>
                    <select
                      value={filters.test_type}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          test_type: e.target.value as any,
                        })
                      }
                      className="w-full border border-gray-300 rounded-md p-2 h-10"
                    >
                      <option value="">All</option>
                      <option value="production">Production</option>
                      <option value="test">Test</option>
                    </select>
                  </div>
                </div>

                {/* Row 2: Status and Defect */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="block text-sm font-medium mb-1">
                      Status
                    </Label>
                    <select
                      value={filters.status}
                      onChange={(e) =>
                        setFilters({
                          ...filters,
                          status: e.target.value as any,
                        })
                      }
                      className="w-full border border-gray-300 rounded-md p-2 h-10"
                    >
                      <option value="">All</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div>
                    <Label className="block text-sm font-medium mb-1">
                      Defect
                    </Label>
                    <select
                      value={filters.defect}
                      onChange={(e) =>
                        setFilters({ ...filters, defect: e.target.value })
                      }
                      className="w-full border border-gray-300 rounded-md p-2 h-10"
                    >
                      <option value="">All</option>
                      {defects.map((defect) => (
                        <option key={defect.id} value={defect.id.toString()}>
                          {defect.defect_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 3: Date Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="block text-sm font-medium mb-1">
                      From Date
                    </Label>
                    <Input
                      type="date"
                      value={filters.from_date}
                      onChange={(e) =>
                        setFilters({ ...filters, from_date: e.target.value })
                      }
                      className="w-full"
                    />
                  </div>
                  <div>
                    <Label className="block text-sm font-medium mb-1">
                      To Date
                    </Label>
                    <Input
                      type="date"
                      value={filters.to_date}
                      onChange={(e) =>
                        setFilters({ ...filters, to_date: e.target.value })
                      }
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Row 4: Actions */}
                <div className="flex gap-4">
                  <Button
                    onClick={handleSearch}
                    disabled={loading}
                    className="h-10 flex items-center justify-center gap-2"
                  >
                    <Search className="h-4 w-4" />
                    {loading ? 'Searching...' : 'Search'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="h-10"
                  >
                    Reset
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
              </div>
            ) : overviewStats && panelStats ? (
              <div className="space-y-6">
                {/* Summary Cards - Similar to Dashboard */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="border-blue-200 bg-blue-50">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-600 mb-1">
                            Total Annotated Panels
                          </p>
                          <p className="text-3xl font-bold text-blue-900">
                            {panelStats.panel_summary.total_panels_annotated}
                          </p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-blue-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-yellow-200 bg-yellow-50">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-yellow-600 mb-1">
                            Pending Review Panels
                          </p>
                          <p className="text-3xl font-bold text-yellow-900">
                            {panelStats.panel_summary.panels_pending_review}
                          </p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-yellow-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-green-200 bg-green-50">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-green-600 mb-1">
                            Approved Panels
                          </p>
                          <p className="text-3xl font-bold text-green-900">
                            {panelStats.panel_summary.panels_fully_approved}
                          </p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-green-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Secondary Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-red-200 bg-red-50">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-red-600 mb-1">
                            Discarded Panels
                          </p>
                          <p className="text-3xl font-bold text-red-900">
                            {panelStats.panel_summary.panels_discarded}
                          </p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-red-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-purple-200 bg-purple-50">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-purple-600 mb-1">
                            Used Panels
                          </p>
                          <p className="text-3xl font-bold text-purple-900">
                            {panelStats.panel_summary.panels_used_in_training}
                          </p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-purple-500" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* PPID List Table */}
                {ppidListData && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-4">
                      PPID List ({totalRecords} total)
                    </h3>
                    {ppidListData.ppids.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 border rounded-lg">
                        No PPIDs found with the current filters
                      </div>
                    ) : (
                      <div className="overflow-x-auto border rounded-lg">
                        <table className="min-w-full table-auto border-collapse">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                                PPID
                              </th>
                              <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                                Annotated On
                              </th>
                              <th className="border border-gray-200 px-4 py-3 text-center font-semibold text-sm">
                                Status
                              </th>
                              {isAlemenoUser && (
                                <th className="border border-gray-200 px-4 py-3 text-center font-semibold text-sm">
                                  Review
                                </th>
                              )}
                              <th className="border border-gray-200 px-4 py-3 text-center font-semibold text-sm">
                                Images
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {ppidListData.ppids.map((item, index) => {
                              const status = getOverallStatus(
                                item.annotation_summary.status_breakdown
                              );
                              return (
                                <tr
                                  key={item.ppid}
                                  className={`${
                                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                                  } hover:bg-gray-100`}
                                >
                                  <td className="border border-gray-200 px-4 py-3 text-sm font-medium">
                                    {item.ppid}
                                  </td>
                                  <td className="border border-gray-200 px-4 py-3 text-sm text-gray-600">
                                    {new Date(
                                      item.annotation_summary.first_annotated ||
                                        item.panel_created_at
                                    ).toLocaleDateString()}
                                  </td>
                                  <td className="border border-gray-200 px-4 py-3 text-center">
                                    <span
                                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${status.color}`}
                                    >
                                      {status.label}
                                    </span>
                                  </td>
                                  {isAlemenoUser && (
                                    <td className="border border-gray-200 px-4 py-3 text-center">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleOpenReview(item)}
                                        className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                                      >
                                        Review
                                      </Button>
                                    </td>
                                  )}
                                  <td className="border border-gray-200 px-4 py-3 text-center">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleOpenViewer(item)}
                                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    >
                                      View Images
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Pagination UI */}
                    {ppidListData.ppids.length > 0 && (
                      <div className="mt-6 space-y-4">
                        {/* Pagination Info and Controls */}
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                          {/* Results Count */}
                          <div className="text-sm text-gray-600">
                            Showing{' '}
                            <span className="font-semibold">
                              {totalRecords > 0 ? (currentPage - 1) * pageSize + 1 : 0}
                            </span>{' '}
                            to{' '}
                            <span className="font-semibold">
                              {Math.min(currentPage * pageSize, totalRecords)}
                            </span>{' '}
                            of <span className="font-semibold">{totalRecords.toLocaleString()}</span> results
                          </div>

                          {/* Page Navigation */}
                          <div className="flex items-center gap-2 flex-wrap justify-center">
                            <Button
                              onClick={handlePreviousPage}
                              disabled={!hasPrevious || loading}
                              variant="outline"
                              size="sm"
                            >
                              Previous
                            </Button>

                            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded border">
                              <span className="text-sm text-gray-600">
                                Page {currentPage} of {totalPages}
                              </span>
                            </div>

                            <Button
                              onClick={handleNextPage}
                              disabled={!hasNext || loading}
                              variant="outline"
                              size="sm"
                            >
                              Next
                            </Button>
                          </div>

                          {/* Jump to Page */}
                          <div className="flex items-center gap-2">
                            <Label htmlFor="jump-to-page" className="text-sm whitespace-nowrap">
                              Jump to:
                            </Label>
                            <Input
                              id="jump-to-page"
                              type="number"
                              min="1"
                              max={totalPages}
                              value={jumpToPage}
                              onChange={(e) => setJumpToPage(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && handlePageJump()}
                              placeholder="Page"
                              className="w-20 h-9"
                            />
                            <Button
                              onClick={handlePageJump}
                              disabled={!jumpToPage || loading}
                              variant="outline"
                              size="sm"
                            >
                              Go
                            </Button>
                          </div>
                        </div>

                        {/* Note about items per page */}
                        <div className="text-sm text-gray-500 text-center">
                          Showing {pageSize} items per page
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-20 text-gray-500">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Annotation Review Modal */}
        {selectedPPID && (
          <AnnotationReviewModal
            isOpen={reviewModalOpen}
            onClose={() => {
              setReviewModalOpen(false);
              setSelectedPPID(null);
            }}
            ppid={selectedPPID.ppid}
            panelImages={selectedPPID.panel_images}
            onApprove={handleApprove}
            onReject={handleReject}
            onRefresh={async () => {
              // Refresh the overview data
              await fetchOverviewData(currentPage);

              // Find and update the selected PPID with fresh data
              const freshData = await getAnnotationPPIDList({
                ppid: selectedPPID.ppid,
                page: 1,
                page_size: 1,
              });

              if (freshData.ppids && freshData.ppids.length > 0) {
                setSelectedPPID(freshData.ppids[0]);
              }
            }}
          />
        )}

        {/* Image Viewer Modal (Read-only) */}
        {selectedPPID && (
          <ImageViewerModal
            isOpen={viewerModalOpen}
            onClose={() => {
              setViewerModalOpen(false);
              setSelectedPPID(null);
            }}
            ppid={selectedPPID.ppid}
            panelImages={selectedPPID.panel_images}
          />
        )}
      </div>
    </div>
  );
};

export default SelfLearningDataPage;
