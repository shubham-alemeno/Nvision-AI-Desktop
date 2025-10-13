import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getLiveAccuracy, ApiError } from "@/services/api";
import { Search, RefreshCw, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppMode } from "../contexts/appModeContext";

interface DefectAccuracy {
  defect_name: string;
  accuracy: number;
  total_panels: number;
  tp: number;
  tn: number;
  fp: number;
  fn: number;
}

interface NTFAccuracy {
  defect_name: string;
  accuracy: number;
  total_panels: number;
  tp: number;
  tn: number;
  fp: number;
  fn: number;
}

interface AccuracyData {
  defect_checker_accuracy: {
    defects: DefectAccuracy[];
    average_accuracy: number;
    combined_accuracy: number;
  };
  ntf_checker_accuracy: {
    defects: NTFAccuracy[];
    average_accuracy: number;
    combined_accuracy: number;
  };
}

function Dashboard() {
  const [accuracyData, setAccuracyData] = useState<AccuracyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [groupFilter, setGroupFilter] = useState(true);
  const [serverHealthy, setServerHealthy] = useState(true); // Placeholder for server health
  const { isTestMode } = useAppMode();

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

      const data = await getLiveAccuracy(params);
      console.log("Accuracy Data:", data);
      setAccuracyData(data);

      // Placeholder: Assume server is healthy if we got data
      setServerHealthy(true);
    } catch (error) {
      const apiError = error as ApiError;
      console.error("Error fetching accuracy data:", apiError);

      let errorMessage = "Failed to load accuracy data";

      if (apiError.type === "network") {
        errorMessage =
          "Network error. Please check your connection and try again.";
        setServerHealthy(false);
      } else if (apiError.type === "server") {
        errorMessage = "Server error. Please try again later.";
        setServerHealthy(false);
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
  }, [isTestMode]);

  const formatPercentage = (value: number) => {
    return `${Math.round(value * 100)}%`;
  };

  if (loading) {
    return (
      <div className="max-w-full mx-auto space-y-6 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center py-8">
              <div className="text-gray-500">Loading...</div>
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

  return (
    <div className="max-w-full mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Dashboard</span>
            {/* Server Health Status */}
            {/* <div className="flex items-center gap-2">
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
                {serverHealthy ? "Server Healthy" : "Server Down"}
              </span>
            </div> */}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* App Mode Display */}
          <div className="flex items-center gap-4 mb-6">
            <span className="font-semibold">App mode:</span>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-200 dark:bg-gray-700">
              {isTestMode ? "Test" : "Production"}
            </span>
          </div>

          {/* Filters */}
          <div className="space-y-4 mb-6">
            {/* Row 1: Date Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="block text-sm font-medium mb-1">
                  From Date
                </Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="block text-sm font-medium mb-1">
                  To Date
                </Label>
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
          </div>

          {/* Defect Checker Accuracy Section */}
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">Defect Checker Accuracy</h2>

            <div className="overflow-x-auto mb-4">
              <table className="min-w-full table-auto border-collapse border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                      Defect
                    </th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                      Accuracy
                    </th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                      Total Panels Tested
                    </th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                      TP
                    </th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                      TN
                    </th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                      FP
                    </th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                      FN
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {accuracyData?.defect_checker_accuracy?.defects?.map(
                    (defect, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {defect.defect_name}
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {formatPercentage(defect.accuracy)}
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {defect.total_panels}
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {defect.tp}
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {defect.tn}
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {defect.fp}
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {defect.fn}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* Average and Combined Accuracy */}
            <div className="space-y-2">
              <p className="text-lg font-semibold">
                Average Defect Checker Accuracy:{" "}
                {accuracyData?.defect_checker_accuracy?.average_accuracy
                  ? formatPercentage(
                      accuracyData.defect_checker_accuracy.average_accuracy
                    )
                  : "N/A"}
              </p>
              <p className="text-lg font-semibold">
                Combined Defect Checker Accuracy:{" "}
                {accuracyData?.defect_checker_accuracy?.combined_accuracy
                  ? formatPercentage(
                      accuracyData.defect_checker_accuracy.combined_accuracy
                    )
                  : "N/A"}
              </p>
            </div>
          </div>

          {/* NTF Checker Accuracy Section */}
          <div>
            <h2 className="text-xl font-bold mb-4">NTF Checker Accuracy</h2>

            <div className="overflow-x-auto mb-4">
              <table className="min-w-full table-auto border-collapse border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                      Defect
                    </th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                      Accuracy
                    </th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                      Total Panels Tested
                    </th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                      TP
                    </th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                      TN
                    </th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                      FP
                    </th>
                    <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm">
                      FN
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {accuracyData?.ntf_checker_accuracy?.defects?.map(
                    (defect, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {defect.defect_name}
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {formatPercentage(defect.accuracy)}
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {defect.total_panels}
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {defect.tp}
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {defect.tn}
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {defect.fp}
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {defect.fn}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>

            {/* Average and Combined Accuracy */}
            <div className="space-y-2">
              <p className="text-lg font-semibold">
                Average NTF Checker Accuracy:{" "}
                {accuracyData?.ntf_checker_accuracy?.average_accuracy
                  ? formatPercentage(
                      accuracyData.ntf_checker_accuracy.average_accuracy
                    )
                  : "N/A"}
              </p>
              <p className="text-lg font-semibold">
                Combined NTF Checker Accuracy:{" "}
                {accuracyData?.ntf_checker_accuracy?.combined_accuracy
                  ? formatPercentage(
                      accuracyData.ntf_checker_accuracy.combined_accuracy
                    )
                  : "N/A"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Dashboard;
