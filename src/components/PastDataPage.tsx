import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getPastTasks } from "@/services/api";
import { Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppMode } from "../contexts/appModeContext";

function PastDataPage() {
  const [pastTasks, setPastTasks] = useState([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [nextUrl, setNextUrl] = useState(null);
  const [previousUrl, setPreviousUrl] = useState(null);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [ppidSearch, setPpidSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState(true); // Changed default to true
  const { isTestMode } = useAppMode();

  const fetchPastTasks = async (page = 1, overrides = {}) => {
    try {
      setLoading(true);
      console.log("Fetching page:", page);

      const params = {
        page,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        ppid: ppidSearch || undefined,
        group: groupFilter,
        test_type: isTestMode ? "test" : "production",
        ...overrides, // allow reset to inject clean params
      };

      const data = await getPastTasks(params);
      console.log("API Response:", data);

      if (data.results && data.results.tasks) {
        setPastTasks(data.results.tasks);
        setTotalTasks(data.results.total_tasks || 0);
        setTotalPages(Math.ceil(data.results.total_tasks / 20));
      } else {
        setPastTasks([]);
        setTotalTasks(0);
        setTotalPages(1);
      }

      setNextUrl(data.next);
      setPreviousUrl(data.previous);
    } catch (error) {
      console.error("Error fetching past tasks:", error);
      setError("Failed to load past tasks");
    } finally {
      setLoading(false);
    }
  };

  // Export to Excel functionality
  const exportToExcel = () => {
    if (pastTasks.length === 0) {
      alert("No data to export");
      return;
    }

    // Prepare data for Excel export
    const exportData = pastTasks.map((task) => {
      // Format predictions
      const predictions = formatDefects(task.Prediction);

      // Get categorized corrections
      const corrections = getCategorizedCorrections(
        task.Prediction,
        task.Correction
      );

      return {
        PPID: task.PPID,
        Timestamp: formatTimestamp(task.Timestamp),
        // 'True Defects': formatDefects(task.TrueDefects), // Commented out for now
        Predictions: predictions,
        "Correctly Identified (TP)":
          corrections.correctlyIdentified.join(", ") || "-",
        "Wrongly Identified (FP)":
          corrections.wronglyIdentified.join(", ") || "-",
        "Missed out Defect (FN)":
          corrections.missedOutDefects.join(", ") || "-",
        "TBD (TN)": corrections.tbd.join(", ") || "-",
        "Created By": task.Created_By || "N/A",
      };
    });

    // Create CSV content
    const headers = Object.keys(exportData[0]).join(",");
    const csvContent = [
      headers,
      ...exportData.map((row) =>
        Object.values(row)
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    // Download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `past_data_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper function to get categorized corrections
  const getCategorizedCorrections = (predictions, corrections) => {
    const result = {
      correctlyIdentified: [], // TP
      wronglyIdentified: [], // FP
      missedOutDefects: [], // FN
      tbd: [], // TN
    };

    if (!predictions && !corrections) return result;

    // Get all unique defect keys
    const allKeys = new Set([
      ...Object.keys(predictions || {}),
      ...Object.keys(corrections || {}),
    ]);

    allKeys.forEach((key) => {
      const defectName = key.replace("def_", "").replace(/_/g, " ");
      const prettyName =
        defectName.charAt(0).toUpperCase() + defectName.slice(1);

      const predicted = predictions?.[key] === true;
      const correction = corrections?.[key];

      // True Positive - correctly identified
      if (predicted && correction !== "False Positive") {
        result.correctlyIdentified.push(prettyName);
      }
      // False Positive - wrongly identified
      else if (predicted && correction === "False Positive") {
        result.wronglyIdentified.push(prettyName);
      }
      // False Negative - missed out defects
      else if (!predicted && correction === "False Negative") {
        result.missedOutDefects.push(prettyName);
      }
      // True Negative - TBD (not predicted and no correction, or explicitly marked as TN)
      else if (!predicted && (!correction || correction === "True Negative")) {
        result.tbd.push(prettyName);
      }
    });

    return result;
  };

  // Modified useEffect and search function
  const handleSearch = () => {
    setCurrentPage(1); // Reset to first page when searching
    fetchPastTasks(1);
  };

  // Initial load and when test mode changes
  useEffect(() => {
    setCurrentPage(1); // Reset to first page when mode changes
    fetchPastTasks(1);
  }, [isTestMode]); // Re-fetch when test mode changes

  // Add a separate useEffect for pagination only
  useEffect(() => {
    if (currentPage > 1) {
      fetchPastTasks(currentPage);
    }
  }, [currentPage]);

  const handleReset = () => {
    setFromDate("");
    setToDate("");
    setPpidSearch("");
    setGroupFilter(true); // Reset to default (whole group)

    // Call API directly with cleared filters (ignores stale state issue)
    fetchPastTasks(1, {
      from_date: undefined,
      to_date: undefined,
      ppid: undefined,
      group: true, // Default to whole group
      test_type: isTestMode ? "test" : "production",
    });
  };

  const handleNextPage = () => {
    if (nextUrl) {
      setCurrentPage((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePreviousPage = () => {
    if (previousUrl) {
      setCurrentPage((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Updated formatTimestamp function to use DD/MM/YYYY format
  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();

    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");

    // Convert to 12-hour format
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12; // convert 0 -> 12

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds} ${ampm}`;
  };

  const formatDefects = (defects) => {
    if (!defects) return "N/A";

    const activeDefects = Object.entries(defects)
      .filter(([key, value]) => value === true)
      .map(([key]) => key.replace("def_", "").replace(/_/g, " "))
      .map((defect) => defect.charAt(0).toUpperCase() + defect.slice(1));

    return activeDefects.length > 0 ? activeDefects.join(", ") : "None";
  };

  // Updated function to render predictions with each defect on a new line
  const renderPredictions = (predictions) => {
    if (!predictions) return <span className="text-gray-500">N/A</span>;

    const items = Object.keys(predictions)
      .map((key) => {
        const defectName = key.replace("def_", "").replace(/_/g, " ");
        const prettyName =
          defectName.charAt(0).toUpperCase() + defectName.slice(1);

        const predicted = predictions[key] === true;

        if (predicted) {
          return prettyName;
        }
        return null;
      })
      .filter(Boolean);

    return items.length > 0 ? (
      <div className="space-y-1">
        {items.map((item, idx) => (
          <div key={idx} className="text-black font-medium">
            {item}
          </div>
        ))}
      </div>
    ) : (
      <span className="text-gray-500">None</span>
    );
  };

  // New function to render true defects (commented out for now)
  const renderTrueDefects = (trueDefects) => {
    // Commented out since we don't have this data yet
    // if (!trueDefects) return <span className="text-gray-500">N/A</span>;

    // const items = Object.keys(trueDefects)
    //   .filter(key => trueDefects[key] === true)
    //   .map(key => {
    //     const defectName = key.replace('def_', '').replace(/_/g, ' ');
    //     return defectName.charAt(0).toUpperCase() + defectName.slice(1);
    //   });

    // return items.length > 0 ? items.join(', ') : 'None';

    return <span className="text-gray-500">N/A</span>;
  };

  // Updated function to render correction categories with each defect on a new line
  const renderCorrectionCategory = (items) => {
    if (!items || items.length === 0) {
      return <span className="text-gray-500">-</span>;
    }

    return (
      <div className="space-y-1">
        {items.map((item, idx) => (
          <div key={idx} className="text-black font-medium">
            {item}
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-full mx-auto space-y-6 p-4">
        <Card>
          <CardHeader>
            <CardTitle>Past Data</CardTitle>
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
            <CardTitle>Past Data</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center py-8">
              <div className="text-red-500">{error}</div>
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
            <span>Past Data</span>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                Total Tasks: {totalTasks.toLocaleString()}
              </span>
              <Button
                onClick={exportToExcel}
                variant="outline"
                size="sm"
                disabled={pastTasks.length === 0}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export to Excel
              </Button>
            </div>
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

            {/* Row 2: PPID + Group */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="block text-sm font-medium mb-1">
                  Search PPID
                </Label>
                <Input
                  placeholder="Enter PPID"
                  value={ppidSearch}
                  onChange={(e) => setPpidSearch(e.target.value)}
                  className="w-full"
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
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

          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed border-collapse border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm w-[8%]">
                    PPID
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm w-[10%]">
                    Timestamp
                  </th>
                  {/* Commented out True Defects column for now */}
                  {/* <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm w-[12%]">
                    True defects
                  </th> */}
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm w-[12%]">
                    Predictions
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm w-[12%]">
                    Correctly Identified (TP)
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm w-[12%]">
                    Wrongly Identified (FP)
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm w-[12%]">
                    Missed out Defect (FN)
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm w-[12%]">
                    TBD (TN)
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm w-[10%]">
                    Created By
                  </th>
                </tr>
              </thead>
              <tbody>
                {pastTasks.length > 0 ? (
                  pastTasks.map((task, idx) => {
                    const corrections = getCategorizedCorrections(
                      task.Prediction,
                      task.Correction
                    );

                    return (
                      <tr key={task.PPID || idx} className="hover:bg-gray-50">
                        <td className="border border-gray-200 px-4 py-3 text-sm font-mono">
                          {task.PPID}
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {formatTimestamp(task.Timestamp)}
                        </td>
                        {/* Commented out True Defects column */}
                        {/* <td className="border border-gray-200 px-4 py-3 text-sm align-top">
                          <div className="break-words">
                            {renderTrueDefects(task.TrueDefects)}
                          </div>
                        </td> */}
                        <td className="border border-gray-200 px-4 py-3 text-sm align-top">
                          <div className="break-words">
                            {renderPredictions(task.Prediction)}
                          </div>
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-sm align-top">
                          <div className="break-words">
                            {renderCorrectionCategory(
                              corrections.correctlyIdentified
                            )}
                          </div>
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-sm align-top">
                          <div className="break-words">
                            {renderCorrectionCategory(
                              corrections.wronglyIdentified
                            )}
                          </div>
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-sm align-top">
                          <div className="break-words">
                            {renderCorrectionCategory(
                              corrections.missedOutDefects
                            )}
                          </div>
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-sm align-top">
                          <div className="break-words">
                            {renderCorrectionCategory(corrections.tbd)}
                          </div>
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-sm">
                          {task.Created_By || "N/A"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan="7" // Updated colspan since we have 7 columns now (8 when True Defects is uncommented)
                      className="text-center py-8 text-gray-500 border border-gray-200"
                    >
                      No past tasks found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination info */}
          <div className="mt-6 flex flex-col sm:flex-row justify-between items-center text-sm text-gray-600">
            <div>
              Showing page {currentPage} of {totalPages}
            </div>
            <div className="mt-2 sm:mt-0 flex space-x-2">
              <button
                onClick={handlePreviousPage}
                disabled={!previousUrl || loading}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="px-4 py-2 bg-gray-100 rounded">
                Page {currentPage} of {totalPages}
              </div>
              <button
                onClick={handleNextPage}
                disabled={!nextUrl || loading}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PastDataPage;
