import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, ArrowLeft } from 'lucide-react';
import {
  getBatches,
  getBatchStatistics,
  getBatchPPIDs,
  createDataset,
  getDatasetCreationTaskStatus,
  triggerTraining,
} from '@/services/api';
import { useAppMode } from '@/contexts/appModeContext';

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
}

const NewModelTrainingPage: React.FC<NewModelTrainingPageProps> = ({
  onBackToSelfLearning,
  selectedBatchSlug,
}) => {
  const { isTestMode } = useAppMode();
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchStatistics, setBatchStatistics] = useState<Record<string, BatchStatistics>>({});
  const [batchAnnotations, setBatchAnnotations] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  // Training flow states
  const [trainingBatchSlug, setTrainingBatchSlug] = useState<string | null>(null);
  const [datasetCreationStatus, setDatasetCreationStatus] = useState<string>('');
  const [datasetCreationStatusDisplay, setDatasetCreationStatusDisplay] = useState<string>('');
  const [datasetProgressPercentage, setDatasetProgressPercentage] = useState<number>(0);
  const [isCreatingDataset, setIsCreatingDataset] = useState(false);

  const fetchBatchesAndStatistics = async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: Get all batches
      const response = await getBatches();
      console.log('Batches response:', response);

      const batchesData = Array.isArray(response) ? response : (response.results || []);
      setBatches(batchesData);

      // Step 2: Get statistics and PPIDs for each batch
      const dataPromises = batchesData.map(async (batch: Batch) => {
        try {
          const [stats, annotations] = await Promise.all([
            getBatchStatistics(batch.slug),
            getBatchPPIDs(batch.slug),
          ]);
          return { slug: batch.slug, stats, annotations };
        } catch (err) {
          console.error(`Error fetching data for ${batch.slug}:`, err);
          return { slug: batch.slug, stats: null, annotations: null };
        }
      });

      const dataResults = await Promise.all(dataPromises);
      const statsMap: Record<string, BatchStatistics> = {};
      const annotationsMap: Record<string, any> = {};

      dataResults.forEach(({ slug, stats, annotations }) => {
        if (stats) {
          statsMap[slug] = stats;
        }
        if (annotations) {
          annotationsMap[slug] = annotations;
        }
      });

      setBatchStatistics(statsMap);
      setBatchAnnotations(annotationsMap);

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

  // Get user-friendly status message
  const getStatusMessage = (status: string, statusDisplay?: string): string => {
    // Prefer status_display from API if available
    if (statusDisplay) {
      return statusDisplay;
    }

    // Fallback formatting: convert snake_case to Title Case
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Poll dataset creation task status
  const pollDatasetCreationStatus = async (taskUuid: string): Promise<string | null> => {
    const maxAttempts = 40; // Poll for up to 20 minutes (30s intervals)
    const pollInterval = 30000; // 30 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const taskStatus = await getDatasetCreationTaskStatus(taskUuid);
        console.log('Dataset creation status:', taskStatus);

        setDatasetCreationStatus(taskStatus.status || 'processing');
        setDatasetCreationStatusDisplay(taskStatus.status_display || '');
        setDatasetProgressPercentage(taskStatus.progress_percentage || 0);

        if (taskStatus.status === 'completed') {
          return taskStatus.vertex_dataset_id;
        } else if (taskStatus.status === 'failed' || taskStatus.status === 'cancelled') {
          throw new Error(`Dataset creation ${taskStatus.status}: ${taskStatus.error_message || 'Unknown error'}`);
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (err: any) {
        console.error('Error polling dataset creation status:', err);
        throw err;
      }
    }

    throw new Error('Dataset creation timed out after 20 minutes');
  };

  const handleRequestTraining = async (batch: Batch) => {
    setTrainingBatchSlug(batch.slug);
    setIsCreatingDataset(true);
    setDatasetCreationStatus('pending');
    setDatasetCreationStatusDisplay('Pending');
    setDatasetProgressPercentage(0);
    setError(null);

    try {
      // Step 1: Get batch PPIDs and defects
      console.log('Fetching batch PPIDs...');
      const batchPPIDsData = await getBatchPPIDs(batch.slug);
      console.log('Batch PPIDs data:', batchPPIDsData);

      const ppids = batchPPIDsData.ppids || [];
      const defectNames = batchPPIDsData.defects?.map((d: any) => d.defect_name) || [];

      if (ppids.length === 0) {
        throw new Error('No PPIDs found in this batch');
      }

      // Step 2: Create dataset
      console.log('Creating dataset...');
      setDatasetCreationStatus('preparing');
      const datasetResponse = await createDataset({
        dataset_name: `dataset_${batch.name}`,
        description: `Dataset for defect detection - ${batch.name}`,
        test_type: isTestMode ? 'test' : 'production',
        ppids: ppids,
        defect_names: defectNames,
        start_date: new Date().toISOString(),
      });

      console.log('Dataset creation initiated:', datasetResponse);

      const taskUuid = datasetResponse.task_uuid;
      if (!taskUuid) {
        throw new Error('Dataset creation did not return task_uuid');
      }

      // Step 3: Poll for dataset completion
      console.log('Polling for dataset creation completion...');
      const vertexDatasetId = await pollDatasetCreationStatus(taskUuid);

      if (!vertexDatasetId) {
        throw new Error('Dataset creation completed but did not return vertex_dataset_id');
      }

      console.log('Dataset created successfully. Vertex Dataset ID:', vertexDatasetId);

      // Step 4: Trigger training with vertex_dataset_id
      setDatasetCreationStatus('triggering_training');
      console.log('Triggering training with vertex_dataset_id:', vertexDatasetId);
      const trainingResponse = await triggerTraining(batch.slug, {
        model_display_name: `${batch.name} - ${new Date().toLocaleDateString()}`,
        description: `Training model for defect detection - ${batch.name}`,
        model_type: 'object_detection',
        edge_model_type: 'MOBILE_TF_VERSATILE_1',
        training_budget_hours: 8,
        vertex_dataset_id: vertexDatasetId,
        training_parameters: {
          epochs: 50,
          batch_size: 16,
          learning_rate: 0.001,
          optimizer: 'adam',
        },
      });

      console.log('Training triggered:', trainingResponse);

      // Show success message
      const successMessage = [
        `Training triggered successfully for ${batch.name}!`,
        ``,
        `Dataset: ${datasetResponse.dataset_name}`,
        `Training Log UUID: ${trainingResponse.training_log_uuid || 'N/A'}`,
        ``,
        `You will be notified when training is complete.`
      ].join('\n');

      alert(successMessage);

      // Refresh batches to update status
      await fetchBatchesAndStatistics();
    } catch (err: any) {
      console.error('Error in training flow:', err);
      setError(err.message || 'Failed to trigger training');
    } finally {
      setIsCreatingDataset(false);
      setTrainingBatchSlug(null);
      setDatasetCreationStatus('');
      setDatasetCreationStatusDisplay('');
      setDatasetProgressPercentage(0);
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
                    const annotations = batchAnnotations[batch.slug];
                    const defectStats = stats?.statistics?.defect_statistics || [];
                    const ppidCount = annotations?.total_ppids || 0;
                    const totalAnnotations = annotations?.total_annotations || 0;

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
                                {ppidCount > 0 && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {ppidCount} PPIDs • {totalAnnotations} annotations
                                  </div>
                                )}
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
                                  <div className="flex flex-col items-center gap-2">
                                    <Button
                                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-base font-medium"
                                      onClick={() => handleRequestTraining(batch)}
                                      disabled={isCreatingDataset && trainingBatchSlug === batch.slug}
                                    >
                                      {isCreatingDataset && trainingBatchSlug === batch.slug ? (
                                        <span className="flex items-center gap-2">
                                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                          Processing...
                                        </span>
                                      ) : (
                                        `Request new model training for ${batch.name}`
                                      )}
                                    </Button>
                                    {isCreatingDataset && trainingBatchSlug === batch.slug && datasetCreationStatus && (
                                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 text-center">
                                        <div className="font-medium">
                                          {getStatusMessage(datasetCreationStatus, datasetCreationStatusDisplay)}
                                        </div>
                                        {datasetProgressPercentage > 0 && (
                                          <div className="text-xs mt-1">
                                            {datasetProgressPercentage.toFixed(1)}% complete
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
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
