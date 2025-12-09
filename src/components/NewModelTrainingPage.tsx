import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, ArrowLeft } from 'lucide-react';
import {
  getBatches,
  getBatchStatistics,
} from '@/services/api';

interface DefectStatistic {
  defect_id: number;
  defect_name: string;
  total_annotations: number;
  approved_annotations: number;
  pending_annotations: number;
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

interface Batch {
  slug: string;
  name: string;
  defect_count: number;
  is_ready_for_training: boolean;
  status?: string;
  created_at?: string;
  description?: string;
  training_requested_at?: string;
}

interface NewModelTrainingPageProps {
  onBackToSelfLearning?: () => void;
  selectedBatchSlug?: string;
  onViewBatchSummary?: (batchSlug: string, batchName: string) => void;
}

const NewModelTrainingPage: React.FC<NewModelTrainingPageProps> = ({
  onBackToSelfLearning,
  selectedBatchSlug,
  onViewBatchSummary,
}) => {
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchStatistics, setBatchStatistics] = useState<Record<string, BatchStatistics>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchBatchesAndStatistics = async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: Get all batches
      const response = await getBatches();
      console.log('Batches response:', response);

      const batchesData = Array.isArray(response) ? response : (response.results || []);
      setBatches(batchesData);

      // Step 2: Get statistics for each batch
      const statisticsPromises = batchesData.map(async (batch: Batch) => {
        try {
          const stats = await getBatchStatistics(batch.slug);
          return { slug: batch.slug, stats };
        } catch (err) {
          console.error(`Error fetching statistics for ${batch.slug}:`, err);
          return { slug: batch.slug, stats: null };
        }
      });

      const statisticsResults = await Promise.all(statisticsPromises);
      const statsMap: Record<string, BatchStatistics> = {};

      statisticsResults.forEach(({ slug, stats }) => {
        if (stats) {
          statsMap[slug] = stats;
        }
      });

      setBatchStatistics(statsMap);

      // If a specific batch is selected, scroll to it
      if (selectedBatchSlug) {
        setTimeout(() => {
          const element = document.getElementById(`batch-${selectedBatchSlug}`);
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    } catch (err: any) {
      console.error('Error fetching batches:', err);
      setError(err.message || 'Failed to load batches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatchesAndStatistics();
  }, []);

  const handleRefresh = () => {
    fetchBatchesAndStatistics();
  };

  const handleViewBatchSummary = (batch: Batch) => {
    if (onViewBatchSummary) {
      onViewBatchSummary(batch.slug, batch.name);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            {onBackToSelfLearning && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onBackToSelfLearning}
                title="Back to Self Learning Data"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <CardTitle>New Model Training</CardTitle>
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
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No batches found. Create a batch to start training.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300 dark:border-gray-700">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-left w-1/5">
                      Batch
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-left w-1/5">
                      Defect
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-center w-1/5">
                      Total Pending review & approved annotated images
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-center w-1/5">
                      Min Total Pending review & approved annotated images required
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-center w-1/5">

                    </th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => {
                    const stats = batchStatistics[batch.slug];
                    const defectStats = stats?.statistics?.defect_statistics || [];

                    // If statistics are still loading (not fetched yet)
                    if (!stats) {
                      return (
                        <tr key={batch.slug} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="border border-gray-300 dark:border-gray-700 px-6 py-4">
                            <div className="font-semibold text-lg">{batch.name}</div>
                          </td>
                          <td colSpan={4} className="border border-gray-300 dark:border-gray-700 px-6 py-4 text-center text-gray-500">
                            Loading statistics...
                          </td>
                        </tr>
                      );
                    }

                    // If statistics loaded but no defects configured
                    if (defectStats.length === 0) {
                      return (
                        <tr key={batch.slug} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="border border-gray-300 dark:border-gray-700 px-6 py-4">
                            <div className="font-semibold text-lg">{batch.name}</div>
                          </td>
                          <td className="border border-gray-300 dark:border-gray-700 px-6 py-4 text-center text-gray-500">
                            -
                          </td>
                          <td className="border border-gray-300 dark:border-gray-700 px-6 py-4 text-center">
                            <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                              {stats.statistics.total_annotations}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {stats.statistics.approved_annotations} approved, {stats.statistics.pending_annotations} pending
                            </div>
                          </td>
                          <td className="border border-gray-300 dark:border-gray-700 px-6 py-4 text-center">
                            <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                              {stats.statistics.min_threshold}
                            </div>
                          </td>
                          <td className="border border-gray-300 dark:border-gray-700 px-6 py-4 text-center">
                            <div className="text-sm text-gray-500">
                              No defects configured
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    const allDefectsMeetThreshold = defectStats.every(d => d.meets_threshold);

                    return (
                      <React.Fragment key={batch.slug}>
                        {defectStats.map((defect, defectIndex) => (
                          <tr
                            key={`${batch.slug}-${defect.defect_id}`}
                            id={defectIndex === 0 ? `batch-${batch.slug}` : undefined}
                            className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${
                              selectedBatchSlug === batch.slug ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                            }`}
                          >
                            {defectIndex === 0 && (
                              <td
                                className="border border-gray-300 dark:border-gray-700 px-6 py-4"
                                rowSpan={defectStats.length}
                              >
                                <div className="font-semibold text-lg">{batch.name}</div>
                              </td>
                            )}
                            <td className="border border-gray-300 dark:border-gray-700 px-6 py-4">
                              <div className="font-medium">{defect.defect_name}</div>
                            </td>
                            <td className="border border-gray-300 dark:border-gray-700 px-6 py-4 text-center">
                              <div className={`text-2xl font-bold ${
                                defect.meets_threshold ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                              }`}>
                                {defect.total_annotations}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {defect.approved_annotations} approved, {defect.pending_annotations} pending
                              </div>
                            </td>
                            <td className="border border-gray-300 dark:border-gray-700 px-6 py-4 text-center">
                              <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                                {defect.threshold}
                              </div>
                            </td>
                            {defectIndex === 0 && (
                              <td
                                className="border border-gray-300 dark:border-gray-700 px-6 py-4 text-center"
                                rowSpan={defectStats.length}
                              >
                                {batch.status === 'training' || batch.status === 'training_requested' ? (
                                  <div className="text-center py-4">
                                    <div className="text-base font-medium text-gray-900 dark:text-white">
                                      New model training requested on{' '}
                                      {batch.training_requested_at
                                        ? new Date(batch.training_requested_at).toLocaleDateString('en-GB')
                                        : new Date().toLocaleDateString('en-GB')}
                                    </div>
                                  </div>
                                ) : batch.status === 'completed' ? (
                                  <div className="text-center py-4">
                                    <div className="text-base font-medium text-green-600 dark:text-green-400">
                                      Training completed
                                    </div>
                                  </div>
                                ) : allDefectsMeetThreshold ? (
                                  <Button
                                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-base font-medium"
                                    onClick={() => handleViewBatchSummary(batch)}
                                  >
                                    Request new model training for {batch.name}
                                  </Button>
                                ) : (
                                  <div className="text-center py-4">
                                    <Button
                                      className="bg-gray-400 text-white px-6 py-3 text-base font-medium cursor-not-allowed"
                                      disabled
                                    >
                                      Request new model training for {batch.name}
                                    </Button>
                                    <div className="text-sm text-gray-900 dark:text-gray-300 mt-2 font-medium">
                                      Not enough images
                                    </div>
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NewModelTrainingPage;
