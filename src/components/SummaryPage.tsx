import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, RotateCcw } from "lucide-react";
import { useAppMode } from "../contexts/appModeContext";
import { getPanelStats, ApiError } from "@/services/api";

interface DefectStat {
  defect_name: string;
  fault_code: string;
  panel_count: number;
}

interface StatsData {
  total_images_captured: number;
  total_panels_tested: number;
  defect_statistics: DefectStat[];
}

const SummaryPage: React.FC = () => {
  const { isTestMode } = useAppMode();
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [defects, setDefects] = useState<DefectStat[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [fullStatsData, setFullStatsData] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const data = await getPanelStats();
      setFullStatsData(data);
      const modeData = isTestMode ? data.test : data.production;
      setStatsData(modeData);
      setDefects(modeData.defect_statistics);
    } catch (error) {
      const apiError = error as ApiError;
      console.error("Error fetching panel statistics:", apiError);

      let errorMessage = "Failed to load panel statistics";

      if (apiError.type === "network") {
        errorMessage =
          "Network error. Please check your connection and try again.";
      } else if (apiError.type === "server") {
        errorMessage = "Server error. Please try again later.";
      } else if (apiError.type === "authentication") {
        errorMessage = "Authentication error. Please log in again.";
      }

      setError(errorMessage);

      // Set default empty data instead of showing error
      // setStatsData({
      //   total_images_captured: 0,
      //   total_panels_tested: 0,
      //   defect_statistics: []
      // });
      // setDefects([]);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleRetry = () => {
    fetchStats();
  };

  const updateDisplayedData = (data: any, testMode: boolean) => {
    const modeData = testMode ? data.test : data.production;
    setStatsData(modeData);
    setDefects(modeData.defect_statistics);
  };

  useEffect(() => {
    if (fullStatsData) {
      updateDisplayedData(fullStatsData, isTestMode);
    }
  }, [isTestMode, fullStatsData]);

  useEffect(() => {
    fetchStats();
    // eslint-disable-next-line
  }, [refreshTrigger]);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  if (error) {
    return (
      <div className="max-w-full mx-auto space-y-6 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col justify-center items-center py-8 space-y-4">
              <div className="text-red-500 text-center">{error}</div>
              <Button
                onClick={handleRetry}
                disabled={statsLoading}
                className="flex items-center space-x-2"
              >
                {statsLoading ? (
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <CardTitle>Statistics</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            title="Refresh Statistics"
          >
            <RotateCcw className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {statsLoading ? (
          <p>Loading statistics...</p>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              <tr className="border-b">
                <td className="py-3">Total panels tested</td>
                <td className="py-3">
                  {statsData ? statsData.total_panels_tested : 0}
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-3">Total images captured</td>
                <td className="py-3">
                  {statsData ? statsData.total_images_captured : 0}
                </td>
              </tr>
              {defects.map((defect, i) => (
                <tr key={i} className="border-b">
                  <td className="py-3">Panels with {defect.defect_name}</td>
                  <td className="py-3">{defect.panel_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
};

export default SummaryPage;
