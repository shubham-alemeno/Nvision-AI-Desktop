import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { getPastTasks } from '@/services/api';

function PastDataPage() {
  const [pastTasks, setPastTasks] = useState([]);
  const [totalTasks, setTotalTasks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [nextUrl, setNextUrl] = useState(null);
  const [previousUrl, setPreviousUrl] = useState(null);

  const fetchPastTasks = async (page = 1) => {
    try {
      setLoading(true);
      console.log('Fetching page:', page);
      const data = await getPastTasks(page);
      console.log('API Response:', data);

      if (data.results && data.results.tasks) {
        setPastTasks(data.results.tasks);
        setTotalTasks(data.results.total_tasks || data.count || 0);
      } else {
        setPastTasks([]);
      }

      setNextUrl(data.next);
      setPreviousUrl(data.previous);
    } catch (error) {
      console.error('Error fetching past tasks:', error);
      setError('Failed to load past tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPastTasks(currentPage);
  }, [currentPage]);

  const handleNextPage = () => {
    if (nextUrl) {
      setCurrentPage((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePreviousPage = () => {
    if (previousUrl) {
      setCurrentPage((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDefects = (defects) => {
    if (!defects) return 'N/A';

    const activeDefects = Object.entries(defects)
      .filter(([key, value]) => value === true)
      .map(([key]) => key.replace('def_', '').replace(/_/g, ' '))
      .map((defect) => defect.charAt(0).toUpperCase() + defect.slice(1));

    return activeDefects.length > 0 ? activeDefects.join(', ') : 'None';
  };

  // const formatCorrections = (corrections) => {
  //   if (!corrections) return 'N/A';

  //   const activeCorrections = Object.entries(corrections)
  //     .filter(([key, value]) => value !== null && value !== false)
  //     .map(
  //       ([key, value]) =>
  //         `${key.replace('def_', '').replace(/_/g, ' ')}: ${value}`
  //     )
  //     .map(
  //       (correction) => correction.charAt(0).toUpperCase() + correction.slice(1)
  //     );

  //   return activeCorrections.length > 0 ? activeCorrections.join(', ') : 'None';
  // };

  const renderDefectsWithCorrections = (predictions, corrections) => {
    if (!predictions && !corrections) return 'N/A';

    const items = Object.keys({
      ...predictions,
      ...corrections,
    })
      .map((key) => {
        const defectName = key.replace('def_', '').replace(/_/g, ' ');
        const prettyName =
          defectName.charAt(0).toUpperCase() + defectName.slice(1);

        const predicted = predictions?.[key] === true;
        const correction = corrections?.[key];

        // Case 1: True Positive → Green
        if (predicted && correction !== 'False Positive') {
          return (
            <span key={key} className="text-green-600 font-medium">
              {prettyName}
            </span>
          );
        }

        // Case 2: False Positive → Green + Strikethrough
        if (predicted && correction === 'False Positive') {
          return (
            <span key={key} className="text-green-600 line-through font-medium">
              {prettyName}
            </span>
          );
        }

        // Case 3: False Negative → Blue
        if (!predicted && correction && correction !== 'False Positive') {
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
              ,{' '}
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
    <div className="max-w-3xl mx-auto space-y-6">
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
          {(nextUrl || previousUrl) && (
            <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
              <div>Showing page {currentPage} of results</div>
              <div className="flex space-x-2">
                {previousUrl && (
                  <button
                    onClick={handlePreviousPage}
                    disabled={loading}
                    className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                )}
                {nextUrl && (
                  <button
                    onClick={handleNextPage}
                    disabled={loading}
                    className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default PastDataPage;
