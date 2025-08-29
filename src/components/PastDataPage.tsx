import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getPastTasks } from "@/services/api";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [groupFilter, setGroupFilter] = useState(false);

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

  // Modified useEffect and search function
  const handleSearch = () => {
    setCurrentPage(1); // Reset to first page when searching
    fetchPastTasks(1);
  };

  // Remove the dependency array from useEffect to prevent auto-triggering
  useEffect(() => {
    fetchPastTasks(1);
  }, []);

  // Add a separate useEffect for pagination only
  useEffect(() => {
    if (currentPage > 1) {
      fetchPastTasks(currentPage);
    }
  }, [currentPage]);

 const handleReset = () => {
  setFromDate('');
  setToDate('');
  setPpidSearch('');
  setGroupFilter(false);

  // Call API directly with cleared filters (ignores stale state issue)
  fetchPastTasks(1, {
    from_date: undefined,
    to_date: undefined,
    ppid: undefined,
    group: false,
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

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDefects = (defects) => {
    if (!defects) return "N/A";

    const activeDefects = Object.entries(defects)
      .filter(([key, value]) => value === true)
      .map(([key]) => key.replace("def_", "").replace(/_/g, " "))
      .map((defect) => defect.charAt(0).toUpperCase() + defect.slice(1));

    return activeDefects.length > 0 ? activeDefects.join(", ") : "None";
  };

  const renderDefectsWithCorrections = (predictions, corrections) => {
    if (!predictions && !corrections)
      return <span style={{ color: "green" }}>N/A</span>;

    const items = Object.keys({
      ...predictions,
      ...corrections,
    })
      .map((key) => {
        const defectName = key.replace("def_", "").replace(/_/g, " ");
        const prettyName =
          defectName.charAt(0).toUpperCase() + defectName.slice(1);

        const predicted = predictions?.[key] === true;
        const correction = corrections?.[key];

        // Case 1: True Positive → Green
        if (predicted && correction !== "False Positive") {
          return (
            <span key={key} className="text-green-600 font-medium">
              {prettyName}
            </span>
          );
        }

        // Case 2: False Positive → Green + Strikethrough
        if (predicted && correction === "False Positive") {
          return (
            <span key={key} className="text-green-600 line-through font-medium">
              {prettyName}
            </span>
          );
        }

        // Case 3: False Negative → Blue
        if (!predicted && correction && correction !== "False Positive") {
          return (
            <span key={key} className="text-blue-600 font-medium">
              {prettyName}
            </span>
          );
        }

        return null;
      })
      .filter(Boolean); // remove nulls

    // Join spans with commas
    return items.length > 0 ? (
      items.map((item, idx) => (
        <React.Fragment key={idx}>
          {item}
          {idx < items.length - 1 && (
            <span className="whitespace-pre text-green-600 font-medium">
              ,{" "}
            </span>
          )}
        </React.Fragment>
      ))
    ) : (
      <span className="text-green-600 font-medium">None</span>
    );
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 p-4">
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
      <div className="max-w-6xl mx-auto space-y-6 p-4">
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
    <div className="max-w-5xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Past Data</span>
            <span className="text-sm text-gray-500">
              Total Tasks: {totalTasks.toLocaleString()}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
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
              <Button
                variant="outline"
                onClick={handleReset}
                className="h-10"
              >
                Reset
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed border-collapse border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm w-[15%]">
                    PPID
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm w-[20%]">
                    Timestamp
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm w-[32.5%]">
                    Predictions
                  </th>
                  <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm w-[32.5%]">
                    Corrections
                  </th>
                </tr>
              </thead>
              <tbody>
                {pastTasks.length > 0 ? (
                  pastTasks.map((task, idx) => (
                    <tr key={task.PPID || idx} className="hover:bg-gray-50">
                      <td className="border border-gray-200 px-4 py-3 text-sm font-mono">
                        {task.PPID}
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-sm">
                        {formatTimestamp(task.Timestamp)}
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-sm align-top">
                        <div className="break-words">
                          <span className="text-green-600 font-medium">
                            {formatDefects(task.Prediction)}
                          </span>
                        </div>
                      </td>
                      <td className="border border-gray-200 px-4 py-3 text-sm align-top">
                        <div className="break-words">
                          {renderDefectsWithCorrections(
                            task.Prediction,
                            task.Correction
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="4"
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
