import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getLiveAccuracy, getHealthCheck, ApiError } from "@/services/api";
import { Search, RefreshCw, Activity, ChevronDown, ChevronUp, Settings2, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppMode } from "../contexts/appModeContext";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface DefectMetrics {
  "True Positive": number;
  "True Negative": number;
  "False Positive": number;
  "False Negative": number;
  total_panels: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
}

interface AccuracyData {
  status: string;
  defect_accuracy: {
    [defectName: string]: DefectMetrics;
  };
  overall_accuracy: {
    average_accuracy: number;
    combined_accuracy: number;
  };
  tasks_overview: {
    total_tasks: number;
    tasks_with_feedback: number;
  };
}

function Dashboard() {
  const [defectCheckerData, setDefectCheckerData] = useState<AccuracyData | null>(null);
  const [ntfCheckerData, setNtfCheckerData] = useState<AccuracyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [groupFilter, setGroupFilter] = useState(true);
  const [serverHealthy, setServerHealthy] = useState(true);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const { isTestMode } = useAppMode();

  // UI state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const saved = localStorage.getItem('dashboardVisibleColumns');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved column visibility:', e);
      }
    }
    return {
      accuracy: true,
      precision: true,
      recall: true,
      f1_score: true,
      total_panels: true,
      tp: true,
      tn: true,
      fp: true,
      fn: true,
    };
  });

  const fetchHealthStatus = async () => {
    try {
      const data = await getHealthCheck();
      console.log("Health Status:", data);

      if (data.status === "success" && data.health_score !== undefined) {
        setHealthScore(data.health_score);
        // Consider server healthy if health score is above 50%
        setServerHealthy(data.health_score > 50);
      }
    } catch (error) {
      const apiError = error as ApiError;
      console.error("Error fetching health status:", apiError);
      setServerHealthy(false);
      setHealthScore(null);
    }
  };

  const fetchAccuracyData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        group: groupFilter,
        test_type: isTestMode ? "test" : "production",
      };

      if (fromDate) {
        params.from_date = new Date(fromDate).toISOString();
      }
      if (toDate) {
        params.to_date = new Date(toDate).toISOString();
      }

      // Fetch both defect checker and NTF checker data in parallel
      const [defectData, ntfData] = await Promise.all([
        getLiveAccuracy({ ...params, qa: false }),
        getLiveAccuracy({ ...params, qa: true }),
      ]);

      console.log("Defect Checker Data:", defectData);
      console.log("NTF Checker Data:", ntfData);

      setDefectCheckerData(defectData);
      setNtfCheckerData(ntfData);
    } catch (error) {
      const apiError = error as ApiError;
      console.error("Error fetching accuracy data:", apiError);

      let errorMessage = "Failed to load accuracy data";

      if (apiError.type === "network") {
        errorMessage =
          "Network error. Please check your connection and try again.";
      } else if (apiError.type === "server") {
        errorMessage = "Server error. Please try again later.";
      } else if (apiError.type === "authentication") {
        errorMessage = "Authentication error. Please log in again.";
      } else if (apiError.type === "validation") {
        errorMessage = "Invalid parameters. Please check your filters.";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchAccuracyData();
  };

  const handleReset = () => {
    setFromDate("");
    setToDate("");
    setGroupFilter(true);
    // Fetch with reset filters
    setTimeout(() => fetchAccuracyData(), 0);
  };

  const handleRetry = () => {
    fetchAccuracyData();
  };

  useEffect(() => {
    fetchAccuracyData();
    fetchHealthStatus();

    // Refresh health status every 60 seconds
    const healthInterval = setInterval(() => {
      fetchHealthStatus();
    }, 60000);

    return () => clearInterval(healthInterval);
  }, [isTestMode]);

  // Save visible columns to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('dashboardVisibleColumns', JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const formatPercentage = (value: number) => {
    return `${Math.round(value * 100)}%`;
  };

  // Helper function to get row color based on accuracy
  const getAccuracyColor = (accuracy: number) => {
    const percentage = accuracy * 100;
    if (percentage >= 90) return "bg-green-50 hover:bg-green-100";
    if (percentage >= 70) return "bg-yellow-50 hover:bg-yellow-100";
    return "bg-red-50 hover:bg-red-100";
  };

  // Helper function to truncate text
  const truncateText = (text: string, maxLength: number = 30) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  // Helper function to count active filters
  const getActiveFilterCount = () => {
    let count = 0;
    if (fromDate) count++;
    if (toDate) count++;
    if (!groupFilter) count++; // Count non-default values
    return count;
  };

  // Helper function to get active filter summary
  const getActiveFilterSummary = () => {
    const filters = [];
    if (fromDate) filters.push({ label: "From", value: fromDate, key: "from" });
    if (toDate) filters.push({ label: "To", value: toDate, key: "to" });
    if (!groupFilter) filters.push({ label: "Group", value: "This Account", key: "group" });
    return filters;
  };

  // Helper function to clear individual filter
  const clearFilter = (key: string) => {
    if (key === "from") setFromDate("");
    if (key === "to") setToDate("");
    if (key === "group") setGroupFilter(true);
  };

  // Helper function to toggle column visibility
  const toggleColumn = (column: keyof typeof visibleColumns) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [column]: !prev[column],
    }));
  };

  // Column labels mapping
  const columnLabels: Record<keyof typeof visibleColumns, string> = {
    accuracy: "Accuracy",
    precision: "Precision",
    recall: "Recall",
    f1_score: "F1 Score",
    total_panels: "Total Panels",
    tp: "TP",
    tn: "TN",
    fp: "FP",
    fn: "FN",
  };

  if (loading) {
    return (
      <div className="max-w-full mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-6 w-24" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Filter skeleton */}
            <div className="space-y-2">
              <Skeleton className="h-10 w-40" />
            </div>

            {/* Tabs skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-10 w-64" />

              {/* Summary cards skeleton */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="border">
                    <CardContent className="pt-6">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-20" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Table skeleton */}
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Skeleton className="h-9 w-32" />
                </div>
                <div className="border rounded-lg overflow-hidden">
                  {/* Table header */}
                  <div className="bg-gray-50 border-b p-4">
                    <div className="grid grid-cols-5 gap-4">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Skeleton key={i} className="h-4" />
                      ))}
                    </div>
                  </div>
                  {/* Table rows */}
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="border-b p-4">
                      <div className="grid grid-cols-5 gap-4">
                        {[1, 2, 3, 4, 5].map((j) => (
                          <Skeleton key={j} className="h-4" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
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
            <CardTitle>Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col justify-center items-center py-8 space-y-4">
              <div className="text-red-500 text-center">{error}</div>
              <Button
                onClick={handleRetry}
                disabled={loading}
                className="flex items-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Retrying...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Try Again</span>
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render accuracy table with all enhancements
  const renderAccuracyTable = (data: AccuracyData | null, title: string, filterNTFOnly: boolean = false) => {
    if (!data) return null;

    // Filter defect_accuracy to only NTF defects if filterNTFOnly is true
    let filteredDefectAccuracy = data.defect_accuracy;
    if (filterNTFOnly && data.defect_accuracy) {
      filteredDefectAccuracy = Object.entries(data.defect_accuracy)
        .filter(([defectName]) => defectName.toLowerCase().includes('ntf'))
        .reduce((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {} as typeof data.defect_accuracy);
    }

    return (
      <div>
        {/* Summary Cards at Top */}
        <div className={`grid grid-cols-1 ${filterNTFOnly ? 'md:grid-cols-2' : 'md:grid-cols-3'} gap-4 mb-6`}>
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600 mb-1">Average Accuracy</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {data.overall_accuracy?.average_accuracy
                      ? formatPercentage(data.overall_accuracy.average_accuracy)
                      : "N/A"}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          {/* Only show Combined Accuracy for Defect Checker, not NTF */}
          {!filterNTFOnly && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600 mb-1">Combined Accuracy</p>
                    <p className="text-2xl font-bold text-green-900">
                      {data.overall_accuracy?.combined_accuracy
                        ? formatPercentage(data.overall_accuracy.combined_accuracy)
                        : "N/A"}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          )}

          {data.tasks_overview && (
            <Card className="border-purple-200 bg-purple-50">
              <CardContent className="pt-6">
                <div>
                  <p className="text-sm font-medium text-purple-600 mb-1">Tasks Overview</p>
                  <p className="text-lg font-semibold text-purple-900">
                    {data.tasks_overview.tasks_with_feedback} / {data.tasks_overview.total_tasks}
                  </p>
                  <p className="text-xs text-purple-600">with feedback</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Column Visibility Controls */}
        <div className="mb-4 flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Columns
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {Object.entries(columnLabels).map(([key, label]) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={visibleColumns[key as keyof typeof visibleColumns]}
                  onCheckedChange={() => toggleColumn(key as keyof typeof visibleColumns)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto border-collapse border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm sticky left-0 bg-gray-50 z-10">
                  Defect
                </th>
                {visibleColumns.accuracy && (
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                    Accuracy
                  </th>
                )}
                {visibleColumns.precision && (
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                    Precision
                  </th>
                )}
                {visibleColumns.recall && (
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                    Recall
                  </th>
                )}
                {visibleColumns.f1_score && (
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                    F1 Score
                  </th>
                )}
                {visibleColumns.total_panels && (
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                    Total Panels
                  </th>
                )}
                {visibleColumns.tp && (
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                    TP
                  </th>
                )}
                {visibleColumns.tn && (
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                    TN
                  </th>
                )}
                {visibleColumns.fp && (
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                    FP
                  </th>
                )}
                {visibleColumns.fn && (
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                    FN
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredDefectAccuracy && Object.keys(filteredDefectAccuracy).length > 0 ? (
                Object.entries(filteredDefectAccuracy).map(([defectName, metrics], idx) => {
                  const typedMetrics = metrics as DefectMetrics;
                  const rowColorClass = getAccuracyColor(typedMetrics.accuracy);
                  const isTruncated = defectName.length > 30;

                  return (
                    <tr key={idx} className={rowColorClass}>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <td className="border border-gray-200 px-4 py-3 text-sm font-medium sticky left-0 z-10 bg-inherit">
                              {truncateText(defectName)}
                            </td>
                          </TooltipTrigger>
                          {isTruncated && (
                            <TooltipContent>
                              <p>{defectName}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                      {visibleColumns.accuracy && (
                        <td className="border border-gray-200 px-4 py-3 text-sm font-semibold">
                          {formatPercentage(typedMetrics.accuracy)}
                        </td>
                      )}
                      {visibleColumns.precision && (
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {formatPercentage(typedMetrics.precision)}
                        </td>
                      )}
                      {visibleColumns.recall && (
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {formatPercentage(typedMetrics.recall)}
                        </td>
                      )}
                      {visibleColumns.f1_score && (
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {formatPercentage(typedMetrics.f1_score)}
                        </td>
                      )}
                      {visibleColumns.total_panels && (
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {typedMetrics.total_panels}
                        </td>
                      )}
                      {visibleColumns.tp && (
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {typedMetrics["True Positive"]}
                        </td>
                      )}
                      {visibleColumns.tn && (
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {typedMetrics["True Negative"]}
                        </td>
                      )}
                      {visibleColumns.fp && (
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {typedMetrics["False Positive"]}
                        </td>
                      )}
                      {visibleColumns.fn && (
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {typedMetrics["False Negative"]}
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={Object.values(visibleColumns).filter(Boolean).length + 1}
                    className="border border-gray-200"
                  >
                    {/* Empty State */}
                    <div className="flex flex-col items-center justify-center py-16 px-4">
                      <div className="rounded-full bg-gray-100 p-6 mb-4">
                        <Activity className="h-12 w-12 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        No accuracy data available
                      </h3>
                      <p className="text-sm text-gray-500 text-center max-w-md">
                        No defect accuracy data has been recorded yet. Start by using the Defect Checker or NTF Checker features to collect data.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-full mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Dashboard</span>
            {/* Server Health Status */}
            <div className="flex items-center gap-2">
              <Activity
                className={`h-5 w-5 ${
                  serverHealthy ? "text-green-500" : "text-red-500"
                }`}
              />
              <span
                className={`text-sm font-semibold ${
                  serverHealthy ? "text-green-600" : "text-red-600"
                }`}
              >
                {healthScore !== null
                  ? `Server Health: ${healthScore.toFixed(2)}%`
                  : serverHealthy
                  ? "Server Healthy"
                  : "Server Down"}
              </span>
            </div>
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
                  onClick={() => {
                    fetchAccuracyData();
                    fetchHealthStatus();
                  }}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
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
              {/* Row 1: Date Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="block text-sm font-medium mb-1">From Date</Label>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label className="block text-sm font-medium mb-1">To Date</Label>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Row 2: Group Filter */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="block text-sm font-medium mb-1">Group</Label>
                  <select
                    value={groupFilter.toString()}
                    onChange={(e) => setGroupFilter(e.target.value === "true")}
                    className="w-full border border-gray-300 rounded-md p-2 h-10"
                  >
                    <option value="false">This Account</option>
                    <option value="true">Whole Group</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Actions */}
              <div className="flex gap-4">
                <Button
                  onClick={handleSearch}
                  disabled={loading}
                  className="h-10 flex items-center justify-center gap-2"
                >
                  <Search className="h-4 w-4" />
                  {loading ? "Searching..." : "Search"}
                </Button>
                <Button variant="outline" onClick={handleReset} className="h-10">
                  Reset
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Tabs for Defect Checker and NTF Checker */}
          <Tabs defaultValue="defect-checker" className="w-full">
            <TabsList className="grid w-full md:w-auto md:inline-flex grid-cols-2 mb-6">
              <TabsTrigger value="defect-checker">Defect Checker</TabsTrigger>
              <TabsTrigger value="ntf-checker">NTF Checker</TabsTrigger>
            </TabsList>

            <TabsContent value="defect-checker">
              {renderAccuracyTable(defectCheckerData, "Defect Checker Accuracy", false)}
            </TabsContent>

            <TabsContent value="ntf-checker">
              {renderAccuracyTable(ntfCheckerData, "NTF Checker Accuracy", true)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default Dashboard;
