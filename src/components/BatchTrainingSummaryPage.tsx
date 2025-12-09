import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import {
  getBatchStatistics,
  triggerTraining,
} from '@/services/api';

interface DefectStatistic {
  defect_id: number;
  defect_name: string;
  total_annotations: number;
  approved_annotations: number;
  pending_annotations: number;
  rejected_annotations: number;
  meets_threshold: boolean;
  threshold: number;
}

interface BatchStatistics {
  status: string;
  batch_name: string;
  statistics: {
    defect_count: number;
    total_annotations: number;
    approved_annotations: number;
    pending_annotations: number;
    min_threshold: number;
    defect_statistics: DefectStatistic[];
  };
}

interface BatchTrainingSummaryPageProps {
  batchSlug: string;
  batchName: string;
  onBack: () => void;
  onTrainingTriggered: () => void;
}

const BatchTrainingSummaryPage: React.FC<BatchTrainingSummaryPageProps> = ({
  batchSlug,
  batchName,
  onBack,
  onTrainingTriggered,
}) => {
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState<BatchStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);

  const fetchStatistics = async () => {
    setLoading(true);
    setError(null);
    try {
      const stats = await getBatchStatistics(batchSlug);
      setStatistics(stats);
    } catch (err: any) {
      console.error('Error fetching batch statistics:', err);
      setError(err.message || 'Failed to load batch statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, [batchSlug]);

  const handleRequestTraining = async () => {
    setTriggering(true);
    setError(null);
    try {
      // Trigger training with complete parameters
      const trainingResponse = await triggerTraining(batchSlug, {
        model_display_name: `${batchName} - ${new Date().toLocaleDateString()}`,
        description: `Training model for defect detection - ${batchName}`,
        model_type: 'object_detection',
        edge_model_type: 'MOBILE_TF_VERSATILE_1',
        training_budget_hours: 8,
        training_parameters: {
          epochs: 50,
          batch_size: 16,
          learning_rate: 0.001,
          optimizer: 'adam',
        },
      });

      console.log('Training triggered:', trainingResponse);

      alert(
        `Training triggered successfully for ${batchName}!\nTraining Log UUID: ${trainingResponse.training_log_uuid}`
      );

      // Navigate back to the training page
      onTrainingTriggered();
    } catch (err: any) {
      console.error('Error triggering training:', err);
      setError(err.message || 'Failed to trigger training');
    } finally {
      setTriggering(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8">
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !statistics) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <CardTitle>Self Learning Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const defectStats = statistics?.statistics?.defect_statistics || [];
  const allDefectsMeetThreshold = defectStats.every(d => d.meets_threshold);

  // Calculate panel-level statistics from defect statistics
  const calculatePanelStats = () => {
    const panelStats: Record<string, {
      annotated: number;
      pending: number;
      approved: number;
      discarded: number;
      used: number;
    }> = {};

    defectStats.forEach(defect => {
      if (!panelStats[defect.defect_name]) {
        panelStats[defect.defect_name] = {
          annotated: defect.total_annotations,
          pending: defect.pending_annotations,
          approved: defect.approved_annotations,
          discarded: defect.rejected_annotations || 0,
          used: 0, // This info is not in the API response
        };
      }
    });

    return panelStats;
  };

  const panelStats = calculatePanelStats();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <CardTitle>Self Learning Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* First Table: Panel Statistics */}
          <div className="mb-8">
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full table-auto border-collapse">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-left font-semibold">
                      Defect
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-center font-semibold">
                      Annotated Panels
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-center font-semibold">
                      Pending review panels
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-center font-semibold">
                      Approved Panels
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-center font-semibold">
                      Discarded Panels
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-center font-semibold">
                      Used Panels
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {defectStats.map((defect, index) => (
                    <tr
                      key={defect.defect_id}
                      className={`${
                        index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-850'
                      } hover:bg-gray-100 dark:hover:bg-gray-800`}
                    >
                      <td className="border border-gray-300 dark:border-gray-700 px-6 py-3 font-medium">
                        {defect.defect_name}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-center">
                        {defect.total_annotations}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-center text-yellow-600 dark:text-yellow-400 font-semibold">
                        {defect.pending_annotations}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-center text-green-600 dark:text-green-400 font-semibold">
                        {defect.approved_annotations}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-center text-red-600 dark:text-red-400 font-semibold">
                        {defect.rejected_annotations || 0}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-center">
                        {panelStats[defect.defect_name]?.used || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Second Table: Model Information (Placeholder - needs API 3.10, 3.11) */}
          <div className="mb-8">
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full table-auto border-collapse">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-left font-semibold">
                      Defect
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-center font-semibold">
                      Live AI Model Version
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-center font-semibold">
                      Accuracy on superset dataset
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-center font-semibold">
                      Last updated on
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {defectStats.map((defect, index) => (
                    <tr
                      key={defect.defect_id}
                      className={`${
                        index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-850'
                      } hover:bg-gray-100 dark:hover:bg-gray-800`}
                    >
                      <td className="border border-gray-300 dark:border-gray-700 px-6 py-3 font-medium">
                        {defect.defect_name}
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-center text-gray-500">
                        V0
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-center text-gray-500">
                        -
                      </td>
                      <td className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-center text-gray-500">
                        -
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Warning if not ready */}
          {!allDefectsMeetThreshold && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-800 dark:text-yellow-200 font-semibold">
                  Not enough images for training
                </p>
                <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                  Some defects do not meet the minimum threshold. Please annotate more images before requesting training.
                </p>
              </div>
            </div>
          )}

          {/* Request Training Button */}
          <div className="flex justify-start">
            <Button
              onClick={handleRequestTraining}
              disabled={!allDefectsMeetThreshold || triggering}
              className={`px-8 py-3 text-base font-medium ${
                allDefectsMeetThreshold
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-400 text-white cursor-not-allowed'
              }`}
            >
              {triggering ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  Processing...
                </span>
              ) : (
                'Request for new model training'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BatchTrainingSummaryPage;
