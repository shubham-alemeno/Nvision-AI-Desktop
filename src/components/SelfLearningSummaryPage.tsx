import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { getDefectOverview } from '@/services/api';

interface ModelInfo {
  model_id: string;
  model_version: number;
  model_name: string;
  batch_name: string;
  batch_uuid: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  avg_inference_latency_ms: number;
  last_updated: string;
  training_date: string;
  deployment_date: string;
  status: string;
  notes: string;
  benchmark_count: number;
  training_annotations_count: number;
  defect_specific_metrics?: {
    accuracy: number;
    precision: number;
    recall: number;
    f1_score: number;
    fn: number;
    fp: number;
    tn: number;
    tp: number;
    support: number;
  };
}

interface ModelSummary {
  total_models: number;
  deployed_models: number;
  best_accuracy: number;
  best_f1_score: number;
  latest_model_date: string;
}

interface AnnotationStatistics {
  total_panels_annotated: number;
  panels_pending_review: number;
  panels_approved: number;
  panels_rejected: number;
  panels_used_for_training: number;
  total_annotations: number;
  annotations_by_status: {
    approved: number;
    pending: number;
    rejected: number;
  };
  unique_annotators: number;
  date_range: {
    first_annotation: string;
    last_annotation: string;
  };
}

interface DefectInfo {
  defect_id: number;
  defect_name: string;
  fault_code: string;
  annotation_statistics: AnnotationStatistics;
  models: ModelInfo[];
  model_summary: ModelSummary;
}

interface DefectOverviewResponse {
  status: string;
  total_defects: number;
  defects: DefectInfo[];
}

interface SelfLearningSummaryPageProps {
  onNavigateToTraining: () => void;
}

const SelfLearningSummaryPage: React.FC<SelfLearningSummaryPageProps> = ({
  onNavigateToTraining,
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DefectOverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getDefectOverview();
      setData(response);
    } catch (err: any) {
      console.error('Error fetching defect overview:', err);
      setError(err.message || 'Failed to load defect overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleRefresh = () => {
    fetchOverview();
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
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

  if (error && !data) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Self Learning Summary</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                title="Refresh Data"
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
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

  const defects = data?.defects || [];

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Self Learning Summary</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                title="Refresh Data"
                disabled={loading}
              >
                <RotateCcw
                  className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`}
                />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {defects.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No defect data available.
            </div>
          ) : (
            <div className="space-y-8">
              {/* Annotation Statistics Table */}
              <div>
                <div className="overflow-x-auto">
                  <table className="min-w-full table-auto border-collapse border border-gray-300 dark:border-gray-700">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                      <tr>
                        <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left font-semibold">
                          Defect
                        </th>
                        <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-center font-semibold">
                          Annotated Panels
                        </th>
                        <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-center font-semibold">
                          Pending review panels
                        </th>
                        <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-center font-semibold">
                          Approved Panels
                        </th>
                        <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-center font-semibold">
                          Discarded Panels
                        </th>
                        <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-center font-semibold">
                          Used Panels
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {defects.map((defect, index) => (
                        <tr
                          key={defect.defect_id}
                          className={`${
                            index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-850'
                          } hover:bg-gray-100 dark:hover:bg-gray-800`}
                        >
                          <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 font-medium">
                            {defect.defect_name}
                          </td>
                          <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-center">
                            {defect.annotation_statistics.total_panels_annotated}
                          </td>
                          <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-center">
                            {defect.annotation_statistics.panels_pending_review}
                          </td>
                          <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-center">
                            {defect.annotation_statistics.panels_approved}
                          </td>
                          <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-center">
                            {defect.annotation_statistics.panels_rejected}
                          </td>
                          <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-center">
                            {defect.annotation_statistics.panels_used_for_training}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Model Performance Table */}
              <div>
                <div className="overflow-x-auto">
                  <table className="min-w-full table-auto border-collapse border border-gray-300 dark:border-gray-700">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                      <tr>
                        <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left font-semibold">
                          Defect
                        </th>
                        <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-center font-semibold">
                          Live AI Model Version
                        </th>
                        <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-center font-semibold">
                          Accuracy on superset dataset
                        </th>
                        <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-center font-semibold">
                          Last updated on
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {defects.map((defect, index) => {
                        // Find the deployed model or the latest model
                        const deployedModel = defect.models.find(m => m.status === 'deployed');
                        const latestModel = defect.models.length > 0
                          ? defect.models.reduce((latest, current) =>
                              new Date(current.last_updated) > new Date(latest.last_updated) ? current : latest
                            )
                          : null;
                        const displayModel = deployedModel || latestModel;

                        return (
                          <tr
                            key={defect.defect_id}
                            className={`${
                              index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-850'
                            } hover:bg-gray-100 dark:hover:bg-gray-800`}
                          >
                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 font-medium">
                              {defect.defect_name}
                            </td>
                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-center">
                              {displayModel ? `V${displayModel.model_version}` : 'N/A'}
                            </td>
                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-center">
                              {displayModel
                                ? displayModel.defect_specific_metrics?.accuracy != null
                                  ? `${(displayModel.defect_specific_metrics.accuracy * 100).toFixed(0)}%`
                                  : `${(displayModel.accuracy * 100).toFixed(0)}%`
                                : 'N/A'}
                            </td>
                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-center">
                              {displayModel ? formatDate(displayModel.last_updated) : 'N/A'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Request Training Button */}
              <div className="flex justify-start">
                <Button
                  onClick={onNavigateToTraining}
                  className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-base font-medium"
                >
                  Request for new model training
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SelfLearningSummaryPage;
