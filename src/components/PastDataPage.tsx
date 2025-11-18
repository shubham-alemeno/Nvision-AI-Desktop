import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getPastTasks, ApiError, getPastTasksForExport } from "@/services/api";
import { Search, Download, RefreshCw, Loader2, ChevronDown, ChevronUp, Calendar, X, Database, ImageIcon, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppMode } from "../contexts/appModeContext";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

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
  const [isExporting, setIsExporting] = useState(false);
  const [isNTFMode, setIsNTFMode] = useState(false); // false = Defect Checker, true = NTF
  const { isTestMode } = useAppMode();

  // UI state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [jumpToPage, setJumpToPage] = useState("");
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const fetchPastTasks = async (page = 1, overrides = {}) => {
    try {
      setLoading(true);
      console.log("Fetching page:", page);

      // Append time to dates: from_date at 00:00:00, to_date at 23:59:59
      const fromDateTime = fromDate ? `${fromDate}T00:00:00` : undefined;
      const toDateTime = toDate ? `${toDate}T23:59:59` : undefined;

      const params = {
        page,
        from_date: fromDateTime,
        to_date: toDateTime,
        ppid: ppidSearch || undefined,
        group: groupFilter,
        test_type: isTestMode ? "test" : "production",
        qa: isNTFMode, // false = Defect Checker, true = NTF
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
      const apiError = error as ApiError;
      console.error("Error fetching past tasks:", apiError);

      let errorMessage = "Failed to load past tasks";

      if (apiError.type === "network") {
        errorMessage =
          "Network error. Please check your connection and try again.";
      } else if (apiError.type === "server") {
        errorMessage = "Server error. Please try again later.";
      } else if (apiError.type === "authentication") {
        errorMessage = "Authentication error. Please log in again.";
      } else if (apiError.type === "validation") {
        errorMessage = "Invalid search parameters. Please check your filters.";
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    fetchPastTasks();
  };

  // Export to Excel functionality
  // const exportToExcel = () => {
  //   if (pastTasks.length === 0) {
  //     alert("No data to export");
  //     return;
  //   }

  //   // Prepare data for Excel export
  //   const exportData = pastTasks.map((task) => {
  //     // Format predictions
  //     const predictions = formatDefects(task.Prediction);

  //     // Get categorized corrections
  //     const corrections = getCategorizedCorrections(
  //       task.Prediction,
  //       task.Correction
  //     );

  //     return {
  //       PPID: task.PPID,
  //       Timestamp: formatTimestamp(task.Timestamp),
  //       // 'True Defects': formatDefects(task.TrueDefects), // Commented out for now
  //       Predictions: predictions,
  //       "Correctly Identified (TP)":
  //         corrections.correctlyIdentified.join(", ") || "-",
  //       "Wrongly Identified (FP)":
  //         corrections.wronglyIdentified.join(", ") || "-",
  //       "Missed out Defect (FN)":
  //         corrections.missedOutDefects.join(", ") || "-",
  //       "TN": corrections.tbd.join(", ") || "-",
  //       "Created By": task.Created_By || "N/A",
  //     };
  //   });

  //   // Create CSV content
  //   const headers = Object.keys(exportData[0]).join(",");
  //   const csvContent = [
  //     headers,
  //     ...exportData.map((row) =>
  //       Object.values(row)
  //         .map((value) => `"${String(value).replace(/"/g, '""')}"`)
  //         .join(",")
  //     ),
  //   ].join("\n");

  //   // Download file
  //   const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  //   const link = document.createElement("a");
  //   const url = URL.createObjectURL(blob);
  //   link.setAttribute("href", url);
  //   link.setAttribute(
  //     "download",
  //     `past_data_${new Date().toISOString().split("T")[0]}.csv`
  //   );
  //   link.style.visibility = "hidden";
  //   document.body.appendChild(link);
  //   link.click();
  //   document.body.removeChild(link);
  // };

  // Using the separate export function
  const exportToExcel = async () => {
    try {
      setIsExporting(true); // Start loader

      // Append time to dates: from_date at 00:00:00, to_date at 23:59:59
      const fromDateTime = fromDate ? `${fromDate}T00:00:00` : undefined;
      const toDateTime = toDate ? `${toDate}T23:59:59` : undefined;

      // Get all data without pagination for export
      const allTasksResponse = await getPastTasksForExport({
        from_date: fromDateTime,
        to_date: toDateTime,
        ppid: ppidSearch || undefined,
        group: groupFilter,
        test_type: isTestMode ? "test" : "production",
        qa: isNTFMode, // false = Defect Checker, true = NTF
      });

      const allTasks = allTasksResponse.tasks || allTasksResponse;

      if (!allTasks || allTasks.length === 0) {
        alert("No data to export");
        return;
      }

      console.log(allTasks);

      // Rest of the export logic remains the same...
      const exportData = allTasks.map((task) => {
        // Filter predictions for NTF mode
        let filteredPredictions = task.Prediction;
        if (isNTFMode && task.Prediction) {
          filteredPredictions = Object.keys(task.Prediction)
            .filter(key => key.toLowerCase().includes('ntf'))
            .reduce((obj, key) => {
              obj[key] = task.Prediction[key];
              return obj;
            }, {});
        }

        const predictions = formatDefects(filteredPredictions);
        const corrections = getCategorizedCorrections(
          task.Prediction,
          task.Correction,
          isNTFMode // Filter to only NTF defects in NTF mode
        );
        return {
          PPID: task.PPID,
          "Prediction Type": isNTFMode ? "NTF" : "Defect Checker",
          Timestamp: formatTimestamp(task.Timestamp),
          Predictions: predictions,
          "Correctly Identified (TP)":
            corrections.correctlyIdentified.join(", ") || "-",
          "Wrongly Identified (FP)":
            corrections.wronglyIdentified.join(", ") || "-",
          "Missed out Defect (FN)":
            corrections.missedOutDefects.join(", ") || "-",
          TN: corrections.tbd.join(", ") || "-",
          "Created By": task.Created_By || "-",
        };
      });

      const headers = Object.keys(exportData[0]).join(",");
      const csvContent = [
        headers,
        ...exportData.map((row) =>
          Object.values(row)
            .map((value) => `"${String(value).replace(/"/g, '""')}"`)
            .join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      const dataType = isNTFMode ? "NTF" : "Defect_Checker";
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `past_data_${dataType}_${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error exporting data:", error);
      alert("Failed to export data. Please try again.");
    } finally {
      setIsExporting(false); // Stop loader regardless of success or failure
    }
  };

  // Helper function to get categorized corrections
  const getCategorizedCorrections = (predictions, corrections, filterNTFOnly = false) => {
    const result = {
      correctlyIdentified: [], // TP
      wronglyIdentified: [], // FP
      missedOutDefects: [], // FN
      tbd: [], // TN
    };

    if (!predictions && !corrections) return result;

    // Get all unique defect keys
    let allKeys = new Set([
      ...Object.keys(predictions || {}),
      ...Object.keys(corrections || {}),
    ]);

    // Filter to only NTF defects if in NTF mode
    if (filterNTFOnly) {
      allKeys = new Set([...allKeys].filter(key => key.toLowerCase().includes('ntf')));
    }

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
      // True Negative - only if explicitly marked as TN
      else if (!predicted && correction === "True Negative") {
        result.tbd.push(prettyName);
      }
      // Note: Defects without corrections are not categorized
    });

    return result;
  };

  // Modified useEffect and search function
  const handleSearch = () => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    setCurrentPage(1); // Reset to first page when searching
    fetchPastTasks(1);
  };

  // Initial load and when test mode or NTF mode changes
  useEffect(() => {
    setCurrentPage(1); // Reset to first page when mode changes
    fetchPastTasks(1);
    setIsInitialLoad(false); // Mark that initial load is complete
  }, [isTestMode, isNTFMode]); // Re-fetch when test mode or NTF mode changes

  // Handle pagination changes (not on initial load)
  useEffect(() => {
    if (!isInitialLoad) {
      // Scroll to top immediately when page changes
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      fetchPastTasks(currentPage);
    }
  }, [currentPage]);

  const handleReset = () => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    setFromDate("");
    setToDate("");
    setPpidSearch("");
    setGroupFilter(true); // Reset to default (whole group)
    setCurrentPage(1); // Reset to first page

    // Call API directly with cleared filters (ignores stale state issue)
    fetchPastTasks(1, {
      from_date: undefined,
      to_date: undefined,
      ppid: undefined,
      group: true, // Default to whole group
      test_type: isTestMode ? "test" : "production",
      qa: isNTFMode, // Preserve current mode (Defect Checker or NTF)
    });
  };

  const handleNextPage = () => {
    if (nextUrl) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePreviousPage = () => {
    if (previousUrl) {
      setCurrentPage((prev) => prev - 1);
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
    if (!defects) return "-";

    const activeDefects = Object.entries(defects)
      .filter(([key, value]) => value === true)
      .map(([key]) => key.replace("def_", "").replace(/_/g, " "))
      .map((defect) => defect.charAt(0).toUpperCase() + defect.slice(1));

    return activeDefects.length > 0 ? activeDefects.join(", ") : "-";
  };

  // Updated function to render predictions with each defect on a new line
  // const renderPredictions = (predictions) => {
  //   // Case 1: No prediction data available
  //   if (!predictions) {
  //     return <span className="text-gray-500">No Data</span>;
  //   }

  //   const items = Object.keys(predictions)
  //     .map((key) => {
  //       const defectName = key.replace("def_", "").replace(/_/g, " ");
  //       const prettyName =
  //         defectName.charAt(0).toUpperCase() + defectName.slice(1);
  //       const predicted = predictions[key] === true;
  //       if (predicted) {
  //         return prettyName;
  //       }
  //       return null;
  //     })
  //     .filter(Boolean);

  //   // Case 2: Predictions exist but no defects were predicted
  //   return items.length > 0 ? (
  //     <div className="space-y-1">
  //       {items.map((item, idx) => (
  //         <div key={idx} className="text-black font-medium">
  //           {item}
  //         </div>
  //       ))}
  //     </div>
  //   ) : (
  //     <span className="text-green-600 font-medium">No Defects</span>
  //   );
  // };

  // Alternative: Use badges for compact display
  const renderPredictions = (predictions) => {
    if (!predictions) {
      return <span className="text-gray-500 text-sm">-</span>;
    }

    const items = Object.keys(predictions)
      .filter((key) => {
        // Filter to only NTF defects if in NTF mode
        if (isNTFMode) {
          return key.toLowerCase().includes('ntf');
        }
        return true;
      })
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
      <div className="flex flex-wrap gap-0.5 max-h-20 overflow-y-auto">
        {items.map((item, idx) => (
          <Badge key={idx} className="text-[11px] px-1.5 py-0 bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100 hover:text-blue-800">
            {item}
          </Badge>
        ))}
      </div>
    ) : (
      <span className="text-gray-500 text-sm">-</span>
    );
  };

  // New function to render true defects (commented out for now)
  const renderTrueDefects = (trueDefects) => {
    // Commented out since we don't have this data yet
    // if (!trueDefects) return <span className="text-gray-500">-</span>;

    // const items = Object.keys(trueDefects)
    //   .filter(key => trueDefects[key] === true)
    //   .map(key => {
    //     const defectName = key.replace('def_', '').replace(/_/g, ' ');
    //     return defectName.charAt(0).toUpperCase() + defectName.slice(1);
    //   });

    // return items.length > 0 ? items.join(', ') : '-';

    return <span className="text-gray-500">-</span>;
  };

  // Updated function to render correction categories with badges in a scrollable container
  const renderCorrectionCategory = (items, color = 'gray') => {
    if (!items || items.length === 0) {
      return <span className="text-gray-500 text-sm">-</span>;
    }

    // Color mapping for badges with hover states
    const colorClasses = {
      green: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100 hover:text-green-800',
      red: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100 hover:text-red-800',
      gray: 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-100 hover:text-gray-800'
    };

    const badgeClass = colorClasses[color] || colorClasses.gray;

    return (
      <div className="flex flex-wrap gap-0.5 max-h-20 overflow-y-auto">
        {items.map((item, idx) => (
          <Badge key={idx} className={`text-[11px] px-1.5 py-0 ${badgeClass}`}>
            {item}
          </Badge>
        ))}
      </div>
    );
  };

  // Function to open panel images in a new window
  const openImagesWindow = (task: any, ppid: string) => {
    const panelImages = task.PanelImages;
    const panelImagesUnprocessed = task.PanelImages_Unprocessed;

    if (!panelImages && !panelImagesUnprocessed) {
      alert("No images available for this panel");
      return;
    }

    // Create HTML content for the new window
    const imageOrder = [
      'white', 'black', 'cyan', 'gray50', 'red', 'green', 'blue',
      'gray75', 'grayvertical', 'colorbars', 'focus', 'blackwithwhiteborder',
      'crosshatch', '16bargray', 'black&white', 'scratches'
    ];

    const imageLabels: Record<string, string> = {
      'white': 'White (AAA)',
      'black': 'Black (BBB)',
      'cyan': 'Cyan (CCC)',
      'gray50': 'Gray 50 (DDD)',
      'red': 'Red (EEE)',
      'green': 'Green (FFF)',
      'blue': 'Blue (GGG)',
      'gray75': 'Gray 75 (HHH)',
      'grayvertical': 'Gray Vertical (III)',
      'colorbars': 'Color Bars (JJJ)',
      'focus': 'Focus (KKK)',
      'blackwithwhiteborder': 'Black with White Border (LLL)',
      'crosshatch': 'Cross Hatch (MMM)',
      '16bargray': '16 Bar Gray (NNN)',
      'black&white': 'Black & White (OOO)',
      'scratches': 'Scratches'
    };

    // Create image data objects for both processed and unprocessed
    const processedImageData = imageOrder
      .filter(key => panelImages && panelImages[key])
      .map(key => ({
        url: panelImages[key],
        filename: `processed_${imageLabels[key].replace(/[^a-zA-Z0-9]/g, '_')}.png`
      }));

    const unprocessedImageData = imageOrder
      .filter(key => panelImagesUnprocessed && panelImagesUnprocessed[key])
      .map(key => ({
        url: panelImagesUnprocessed[key],
        filename: `original_${imageLabels[key].replace(/[^a-zA-Z0-9]/g, '_')}.png`
      }));

    // Generate HTML for processed images
    const processedImagesHTML = imageOrder
      .filter(key => panelImages && panelImages[key])
      .map(key => `
        <div style="margin-bottom: 20px; page-break-inside: avoid;">
          <h3 style="margin: 10px 0; font-size: 16px; font-weight: bold;">${imageLabels[key]}</h3>
          <img src="${panelImages[key]}"
               style="max-width: 100%; height: auto; border: 1px solid #ccc; border-radius: 4px;"
               alt="${imageLabels[key]}" />
        </div>
      `)
      .join('');

    // Generate HTML for unprocessed images
    const unprocessedImagesHTML = imageOrder
      .filter(key => panelImagesUnprocessed && panelImagesUnprocessed[key])
      .map(key => `
        <div style="margin-bottom: 20px; page-break-inside: avoid;">
          <h3 style="margin: 10px 0; font-size: 16px; font-weight: bold;">${imageLabels[key]}</h3>
          <img src="${panelImagesUnprocessed[key]}"
               style="max-width: 100%; height: auto; border: 1px solid #ccc; border-radius: 4px;"
               alt="${imageLabels[key]}" />
        </div>
      `)
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Panel Images - ${ppid}</title>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              background-color: #f5f5f5;
            }
            h1 {
              color: #333;
              margin-bottom: 10px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
              flex-wrap: wrap;
              gap: 12px;
            }
            .header-left {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .toggle-container {
              display: inline-flex;
              background-color: #e5e7eb;
              border-radius: 8px;
              padding: 4px;
            }
            .toggle-btn {
              background-color: transparent;
              color: #6b7280;
              border: none;
              padding: 8px 16px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 600;
              transition: all 0.2s;
            }
            .toggle-btn.active {
              background-color: white;
              color: #1f2937;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .toggle-btn:hover:not(.active) {
              color: #1f2937;
            }
            .download-btn {
              background-color: #10b981;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 600;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .download-btn:hover {
              background-color: #059669;
            }
            .download-btn:disabled {
              background-color: #9ca3af;
              cursor: not-allowed;
            }
            .container {
              max-width: 1200px;
              margin: 0 auto;
              background: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .images-container {
              display: none;
            }
            .images-container.active {
              display: block;
            }
            @media print {
              body { background: white; }
              .container { box-shadow: none; }
              .download-btn, .toggle-container { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="header-left">
                <h1>Panel Images - ${ppid}</h1>
                ${panelImages && panelImagesUnprocessed ? `
                <div class="toggle-container">
                  <button class="toggle-btn active" onclick="toggleView('processed')" id="processedBtn">
                    Processed (Cropped)
                  </button>
                  <button class="toggle-btn" onclick="toggleView('original')" id="originalBtn">
                    Original (Uncropped)
                  </button>
                </div>
                ` : ''}
              </div>
              <button class="download-btn" onclick="downloadAllImages()" id="downloadBtn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Download All as ZIP
              </button>
            </div>

            ${panelImages ? `
            <div id="processedImages" class="images-container active">
              ${processedImagesHTML}
            </div>
            ` : ''}

            ${panelImagesUnprocessed ? `
            <div id="originalImages" class="images-container">
              ${unprocessedImagesHTML}
            </div>
            ` : ''}
          </div>

          <script>
            const processedImageData = ${JSON.stringify(processedImageData)};
            const unprocessedImageData = ${JSON.stringify(unprocessedImageData)};
            const ppid = "${ppid}";
            let currentView = 'processed';

            function toggleView(view) {
              currentView = view;

              // Update button states
              const processedBtn = document.getElementById('processedBtn');
              const originalBtn = document.getElementById('originalBtn');

              if (processedBtn && originalBtn) {
                if (view === 'processed') {
                  processedBtn.classList.add('active');
                  originalBtn.classList.remove('active');
                } else {
                  originalBtn.classList.add('active');
                  processedBtn.classList.remove('active');
                }
              }

              // Toggle image containers
              const processedContainer = document.getElementById('processedImages');
              const originalContainer = document.getElementById('originalImages');

              if (processedContainer) {
                processedContainer.classList.toggle('active', view === 'processed');
              }
              if (originalContainer) {
                originalContainer.classList.toggle('active', view === 'original');
              }
            }

            async function downloadAllImages() {
              const btn = document.getElementById('downloadBtn');
              btn.disabled = true;
              btn.innerHTML = '<span>Downloading...</span>';

              try {
                const zip = new JSZip();
                const imageData = currentView === 'processed' ? processedImageData : unprocessedImageData;
                const folderName = currentView === 'processed'
                  ? "${ppid}_processed_images"
                  : "${ppid}_original_images";
                const imgFolder = zip.folder(folderName);

                // Fetch all images and add to ZIP
                const promises = imageData.map(async (img) => {
                  try {
                    const response = await fetch(img.url);
                    const blob = await response.blob();
                    imgFolder.file(img.filename, blob);
                  } catch (error) {
                    console.error('Error fetching image:', img.url, error);
                  }
                });

                await Promise.all(promises);

                // Generate ZIP file
                const content = await zip.generateAsync({type: 'blob'});

                // Download ZIP
                const link = document.createElement('a');
                link.href = URL.createObjectURL(content);
                link.download = folderName + '.zip';
                link.click();

                btn.disabled = false;
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>Download All as ZIP';
              } catch (error) {
                console.error('Error creating ZIP:', error);
                alert('Failed to download images. Please try again.');
                btn.disabled = false;
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>Download All as ZIP';
              }
            }
          </script>
        </body>
      </html>
    `;

    // Open new window
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(htmlContent);
      newWindow.document.close();
    } else {
      alert("Please allow pop-ups to view images");
    }
  };

  // Helper function to count active filters
  const getActiveFilterCount = () => {
    let count = 0;
    if (fromDate) count++;
    if (toDate) count++;
    if (ppidSearch) count++;
    if (!groupFilter) count++; // Count non-default values
    return count;
  };

  // Helper function to get active filter summary
  const getActiveFilterSummary = () => {
    const filters = [];
    if (fromDate) filters.push({ label: "From", value: fromDate, key: "from" });
    if (toDate) filters.push({ label: "To", value: toDate, key: "to" });
    if (ppidSearch) filters.push({ label: "PPID", value: ppidSearch, key: "ppid" });
    if (!groupFilter) filters.push({ label: "Group", value: "This Account", key: "group" });
    return filters;
  };

  // Helper function to clear individual filter
  const clearFilter = (key: string) => {
    if (key === "from") setFromDate("");
    if (key === "to") setToDate("");
    if (key === "ppid") setPpidSearch("");
    if (key === "group") setGroupFilter(true);
  };

  // Helper function to truncate text
  const truncateText = (text, maxLength = 50) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  // Quick filter functions
  const setQuickDateFilter = (days) => {
    const today = new Date();
    const toDateStr = today.toISOString().split("T")[0];

    if (days === 0) {
      // Today - same day with time 00:00:00 to 23:59:59
      setFromDate(toDateStr);
      setToDate(toDateStr);
    } else {
      // Last N days
      const fromDateObj = new Date();
      fromDateObj.setDate(fromDateObj.getDate() - days);
      setFromDate(fromDateObj.toISOString().split("T")[0]);
      setToDate(toDateStr);
    }
  };

  // Handle page jump
  const handlePageJump = () => {
    const pageNum = parseInt(jumpToPage);
    if (pageNum && pageNum > 0 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      setJumpToPage("");
      // Scroll handled by useEffect when currentPage changes
    }
  };

  if (loading && currentPage === 1) {
    return (
      <div className="max-w-full mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-10 w-40" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Data type toggle skeleton */}
            <div className="flex items-center gap-4">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-32" />
            </div>

            {/* Filters skeleton */}
            <Skeleton className="h-10 w-40" />

            {/* Table skeleton */}
            <div className="border rounded-lg overflow-hidden">
              {/* Table header */}
              <div className="bg-gray-50 border-b p-4">
                <div className="grid grid-cols-7 gap-4">
                  {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <Skeleton key={i} className="h-4" />
                  ))}
                </div>
              </div>
              {/* Table rows */}
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="border-b p-4">
                  <div className="grid grid-cols-7 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                      <Skeleton key={j} className="h-6" />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination skeleton */}
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
            <CardTitle>Past Data</CardTitle>
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
            <span>Past Data</span>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                Total Tasks: {totalTasks.toLocaleString()}
              </span>
              <Button
                onClick={exportToExcel}
                disabled={isExporting}
                className="flex items-center gap-2"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Export to Excel
                  </>
                )}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* App Mode and Data Type Display */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Data Type:</span>
              <div className="flex gap-2">
                <Button
                  onClick={() => setIsNTFMode(false)}
                  variant={!isNTFMode ? "default" : "outline"}
                  size="sm"
                >
                  Defect Checker
                </Button>
                <Button
                  onClick={() => setIsNTFMode(true)}
                  variant={isNTFMode ? "default" : "outline"}
                  size="sm"
                >
                  NTF
                </Button>
              </div>
            </div>
          </div>

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
                  onClick={() => fetchPastTasks(currentPage)}
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickDateFilter(0)}
                    className="flex items-center gap-1"
                  >
                    <Calendar className="h-3 w-3" />
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickDateFilter(7)}
                    className="flex items-center gap-1"
                  >
                    <Calendar className="h-3 w-3" />
                    Last 7 Days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickDateFilter(30)}
                    className="flex items-center gap-1"
                  >
                    <Calendar className="h-3 w-3" />
                    Last 30 Days
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                      setFromDate(firstDay.toISOString().split("T")[0]);
                      setToDate(today.toISOString().split("T")[0]);
                    }}
                    className="flex items-center gap-1"
                  >
                    <Calendar className="h-3 w-3" />
                    This Month
                  </Button>
                </div>
              </div>

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

              {/* Row 2: PPID + Group */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="block text-sm font-medium mb-1">Search PPID</Label>
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
            </CollapsibleContent>
          </Collapsible>

          <div className="overflow-x-auto">
            <table className="min-w-full table-auto border-collapse border border-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-sm sticky left-0 bg-gray-50 z-10 w-24">
                    PPID
                  </th>
                  <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-sm w-28">
                    Timestamp
                  </th>
                  {/* Commented out True Defects column for now */}
                  {/* <th className="border border-gray-200 px-4 py-3 text-left font-semibold text-sm w-[12%]">
                    True defects
                  </th> */}
                  <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-sm w-32">
                    Predictions
                  </th>
                  <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-sm w-32">
                    Correctly Identified (TP)
                  </th>
                  <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-sm w-32">
                    Wrongly Identified (FP)
                  </th>
                  <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-sm w-32">
                    Missed out Defect (FN)
                  </th>
                  <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-sm w-32">
                    TN
                  </th>
                  <th className="border border-gray-200 px-2 py-2 text-left font-semibold text-sm w-24">
                    Created By
                  </th>
                  <th className="border border-gray-200 px-2 py-2 text-center font-semibold text-sm w-20">
                    Images
                  </th>
                </tr>
              </thead>
              <tbody>
                {pastTasks.length > 0 ? (
                  pastTasks.map((task, idx) => {
                    const corrections = getCategorizedCorrections(
                      task.Prediction,
                      task.Correction,
                      isNTFMode // Filter to only NTF defects in NTF mode
                    );

                    return (
                      <tr key={task.PPID || idx} className="hover:bg-gray-50">
                        <td className="border border-gray-200 px-2 py-2 text-sm font-mono sticky left-0 bg-white hover:bg-gray-50 z-10">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  className="block break-words cursor-pointer hover:text-blue-600 transition-colors"
                                  onClick={() => {
                                    navigator.clipboard.writeText(task.PPID);
                                    // Optional: Show a brief notification
                                    const toast = document.createElement('div');
                                    toast.textContent = 'PPID copied!';
                                    toast.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50';
                                    document.body.appendChild(toast);
                                    setTimeout(() => toast.remove(), 2000);
                                  }}
                                >
                                  {task.PPID}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Click to copy PPID</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                        <td className="border border-gray-200 px-2 py-2 text-sm whitespace-nowrap">
                          <div className="flex flex-col">
                            <span>{new Date(task.Timestamp).toLocaleDateString('en-GB')}</span>
                            <span className="text-gray-500">{new Date(task.Timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </td>
                        {/* Commented out True Defects column */}
                        {/* <td className="border border-gray-200 px-4 py-3 text-sm align-top">
                          <div className="break-words">
                            {renderTrueDefects(task.TrueDefects)}
                          </div>
                        </td> */}
                        <td className="border border-gray-200 px-2 py-2 text-sm align-top">
                          {renderPredictions(task.Prediction)}
                        </td>
                        <td className="border border-gray-200 px-2 py-2 text-sm align-top">
                          {renderCorrectionCategory(
                            corrections.correctlyIdentified,
                            'green'
                          )}
                        </td>
                        <td className="border border-gray-200 px-2 py-2 text-sm align-top">
                          {renderCorrectionCategory(
                            corrections.wronglyIdentified,
                            'red'
                          )}
                        </td>
                        <td className="border border-gray-200 px-2 py-2 text-sm align-top">
                          {renderCorrectionCategory(
                            corrections.missedOutDefects
                          )}
                        </td>
                        <td className="border border-gray-200 px-2 py-2 text-sm align-top">
                          {renderCorrectionCategory(corrections.tbd)}
                        </td>
                        <td className="border border-gray-200 px-2 py-2 text-sm">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block">{truncateText(task.Created_By || "-", 15)}</span>
                              </TooltipTrigger>
                              {task.Created_By && task.Created_By.length > 15 && (
                                <TooltipContent>
                                  <p>{task.Created_By}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                        <td className="border border-gray-200 px-2 py-2 text-sm text-center">
                          {(task.PanelImages || task.PanelImages_Unprocessed) ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    onClick={() => openImagesWindow(task, task.PPID)}
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-sm"
                                  >
                                    <ImageIcon className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>View all panel images</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={9}
                      className="border border-gray-200"
                    >
                      {/* Empty State */}
                      <div className="flex flex-col items-center justify-center py-16 px-4">
                        <div className="rounded-full bg-gray-100 p-6 mb-4">
                          <Database className="h-12 w-12 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          No tasks found
                        </h3>
                        <p className="text-sm text-gray-500 text-center max-w-md mb-4">
                          {getActiveFilterCount() > 0
                            ? "No tasks match your current filters. Try adjusting your search criteria."
                            : "No data has been collected yet. Start by using the Defect Checker or Data Collection features."}
                        </p>
                        {getActiveFilterCount() > 0 && (
                          <Button
                            variant="outline"
                            onClick={handleReset}
                            className="flex items-center gap-2"
                          >
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

          {/* Enhanced Pagination */}
          <div className="mt-6 space-y-4">
            {/* Pagination Info and Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              {/* Results Count */}
              <div className="text-sm text-gray-600">
                Showing{" "}
                <span className="font-semibold">
                  {totalTasks > 0 ? (currentPage - 1) * 20 + 1 : 0}
                </span>{" "}
                to{" "}
                <span className="font-semibold">
                  {Math.min(currentPage * 20, totalTasks)}
                </span>{" "}
                of <span className="font-semibold">{totalTasks.toLocaleString()}</span> results
              </div>

              {/* Page Navigation */}
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <Button
                  onClick={handlePreviousPage}
                  disabled={!previousUrl || loading}
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
                  disabled={!nextUrl || loading}
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
                  onKeyPress={(e) => e.key === "Enter" && handlePageJump()}
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
              Showing 20 items per page
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PastDataPage;
