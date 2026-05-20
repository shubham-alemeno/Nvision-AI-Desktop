import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RotateCcw, ArrowLeft } from 'lucide-react';
import {
  getBatches,
  getBatchStatistics,
  getBatchPPIDs,
  createDataset,
  triggerTraining,
  getBatchPipelineStatus,
} from '@/services/api';
import { useAppMode } from '@/contexts/appModeContext';

interface TrainingProgressState {
  [batchSlug: string]: {
    task_uuid: string;
    status: string;
    progress_percentage: number;
    training_stage: string | null;
    started_at: string | null;
    estimated_completion: string | null;
    training_status?: string;
    model_display_name?: string;
    error_message?: string | null;
    completed_at?: string | null;
  };
}

interface DatasetCreationProgressState {
  [batchSlug: string]: {
    task_uuid: string;
    dataset_name: string;
    status: string;
    progress_percentage: number;
    total_images: number;
    processed_images: number;
    created_at: string | null;
    completed_at: string | null;
    error_message?: string | null;
  };
}

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

  const [trainingBatchSlug, setTrainingBatchSlug] = useState<string | null>(null);
  const [isCreatingDataset, setIsCreatingDataset] = useState(false);

  const [datasetCreationProgress, setDatasetCreationProgress] =
    useState<DatasetCreationProgressState>({});
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgressState>({});

  const trainingPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Track batches that have reached a terminal pipeline phase so we stop polling them
  const resolvedBatchesRef = useRef<Set<string>>(new Set());

  const fetchBatchesAndStatistics = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const response = await getBatches();
      const batchesData = Array.isArray(response) ? response : response.results || [];
      setBatches(batchesData);

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
        if (stats) statsMap[slug] = stats;
        if (annotations) annotationsMap[slug] = annotations;
      });

      setBatchStatistics(statsMap);
      setBatchAnnotations(annotationsMap);

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
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatchesAndStatistics();
    return () => {
      if (trainingPollingIntervalRef.current)
        clearInterval(trainingPollingIntervalRef.current);
    };
  }, []);

  // Poll pipeline-status for non-draft batches that haven't been resolved yet.
  // The API is the single source of truth — no localStorage.
  useEffect(() => {
    const batchesToPoll = batches.filter((b) => {
      if (b.status === 'draft') return false;
      if (resolvedBatchesRef.current.has(b.slug)) return false;
      return true;
    });

    if (batchesToPoll.length === 0) {
      if (trainingPollingIntervalRef.current) {
        clearInterval(trainingPollingIntervalRef.current);
        trainingPollingIntervalRef.current = null;
      }
      return;
    }

    const pollPipelineStatus = async () => {
      console.log('Polling pipeline status for:', batchesToPoll.map((b) => b.slug));

      const progressPromises = batchesToPoll.map(async (batch) => {
        try {
          const status = await getBatchPipelineStatus(batch.slug);
          return { slug: batch.slug, pipelineData: status };
        } catch (err) {
          console.error(`Error fetching pipeline status for ${batch.slug}:`, err);
          return { slug: batch.slug, pipelineData: null };
        }
      });

      const results = await Promise.all(progressPromises);

      results.forEach(({ slug, pipelineData }: { slug: string; pipelineData: any }) => {
        if (!pipelineData || pipelineData.status !== 'success') return;

        const phase = pipelineData.current_phase;
        const datasetStatus = pipelineData.dataset_creation?.status;
        const trainingStatus = pipelineData.training?.status;

        const datasetFailed = datasetStatus === 'failed';
        const phaseFailed = phase != null && (phase as string).includes('_failed');
        const bothCompleted = trainingStatus === 'completed' && datasetStatus === 'completed';
        const isTerminal = datasetFailed || phaseFailed || bothCompleted;

        if (isTerminal) {
          resolvedBatchesRef.current.add(slug);
          if (datasetFailed) {
            const errMsg =
              pipelineData.dataset_creation?.error_message || 'Dataset creation failed';
            const batchName = batches.find((b: Batch) => b.slug === slug)?.name || slug;
            setError(`Dataset creation failed for "${batchName}": ${errMsg}`);
          }
          setTrainingProgress((prev) => {
            const updated = { ...prev };
            delete updated[slug];
            return updated;
          });
          setDatasetCreationProgress((prev) => {
            const updated = { ...prev };
            delete updated[slug];
            return updated;
          });
          setIsCreatingDataset(false);
          fetchBatchesAndStatistics(true);
          return;
        }

        // Update dataset creation progress
        if (pipelineData.dataset_creation) {
          const dataset = pipelineData.dataset_creation;
          setDatasetCreationProgress((prev) => ({
            ...prev,
            [slug]: {
              task_uuid: dataset.task_uuid,
              dataset_name: dataset.dataset_name || '',
              status: dataset.status,
              progress_percentage: dataset.progress_percentage || 0,
              total_images: dataset.total_images || 0,
              processed_images: dataset.processed_images || 0,
              created_at: dataset.created_at || null,
              completed_at: dataset.completed_at || null,
              error_message: dataset.error_message || null,
            },
          }));

          if (
            dataset.status === 'completed' &&
            dataset.vertex_dataset_id &&
            !pipelineData.training
          ) {
            console.log(`Dataset creation completed for ${slug}. Triggering training...`);
            continueWithTraining(slug, dataset.task_uuid, dataset.vertex_dataset_id).catch(
              (err) => console.error('Error triggering training:', err)
            );
          }
        }

        // Update training progress
        if (pipelineData.training) {
          const training = pipelineData.training;
          setTrainingProgress((prev) => ({
            ...prev,
            [slug]: {
              task_uuid: training.task_uuid,
              status: training.status,
              training_status: training.status,
              progress_percentage: training.progress_percentage || 0,
              training_stage: training.status,
              started_at: training.started_at || null,
              estimated_completion: null,
              model_display_name: training.model_display_name,
              error_message: training.error_message || null,
              completed_at: training.completed_at || null,
            },
          }));
        }
      });
    };

    pollPipelineStatus();

    if (trainingPollingIntervalRef.current) {
      clearInterval(trainingPollingIntervalRef.current);
    }
    trainingPollingIntervalRef.current = setInterval(pollPipelineStatus, 30000);

    return () => {
      if (trainingPollingIntervalRef.current) {
        clearInterval(trainingPollingIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches.map((b: Batch) => `${b.slug}:${b.status}`).join(',')]);

  const handleRefresh = () => {
    fetchBatchesAndStatistics();
  };

  const continueWithTraining = async (
    batchSlug: string,
    datasetTaskId: string,
    vertexDatasetId?: string
  ) => {
    try {
      const batch = batches.find((b) => b.slug === batchSlug);
      if (!batch) throw new Error('Batch not found');

      const trainingResponse = await triggerTraining(batchSlug, {
        dataset_task_id: datasetTaskId,
        model_display_name: `${batch.name} - ${new Date().toLocaleDateString()}`,
        description: `Training model for defect detection - ${batch.name}`,
        model_type: 'object_detection',
        edge_model_type: 'MOBILE_TF_VERSATILE_1',
        vertex_dataset_id: vertexDatasetId,
        training_budget_hours: 8,
        training_parameters: {
          epochs: 50,
          batch_size: 16,
          learning_rate: 0.001,
          optimizer: 'adam',
        },
      });

      console.log('Training triggered:', trainingResponse);

      const trainingTaskUuid = trainingResponse.training_task?.task_uuid;
      const modelDisplayName = trainingResponse.training_task?.model_display_name;

      if (trainingTaskUuid) {
        setTrainingProgress((prev) => ({
          ...prev,
          [batchSlug]: {
            task_uuid: trainingTaskUuid,
            status: 'pending',
            progress_percentage: 0,
            training_stage: 'pending',
            started_at: new Date().toISOString(),
            estimated_completion: null,
            training_status: 'pending',
            model_display_name: modelDisplayName,
          },
        }));
      }
    } catch (err: any) {
      console.error('Error triggering training:', err);
      throw err;
    } finally {
      setIsCreatingDataset(false);
      setTrainingBatchSlug(null);
    }
  };

  const handleRequestTraining = async (batch: Batch) => {
    setTrainingBatchSlug(batch.slug);
    setIsCreatingDataset(true);
    setError(null);

    // Allow this batch to be polled again (in case it was previously resolved)
    resolvedBatchesRef.current.delete(batch.slug);

    try {
      const batchPPIDsData = await getBatchPPIDs(batch.slug);
      const ppids = batchPPIDsData.ppids || [];
      const defectNames = batchPPIDsData.defects?.map((d: any) => d.defect_name) || [];

      if (ppids.length === 0) throw new Error('No PPIDs found in this batch');

      const datasetResponse = await createDataset({
        batch_slug: batch.slug,
        description: `Dataset for defect detection - ${batch.name}`,
        test_type: isTestMode ? 'test' : 'production',
        ppids,
        defect_names: defectNames,
        start_date: new Date().toISOString(),
      });

      // Immediately show a placeholder progress bar so the button doesn't reappear.
      // The polling handler will overwrite this with real API data on the next tick.
      setDatasetCreationProgress((prev: DatasetCreationProgressState) => ({
        ...prev,
        [batch.slug]: {
          task_uuid: datasetResponse?.task_uuid || '',
          dataset_name: '',
          status: 'processing',
          progress_percentage: 0,
          total_images: 0,
          processed_images: 0,
          created_at: new Date().toISOString(),
          completed_at: null,
        },
      }));

      // Mark the batch as non-draft locally so the polling effect picks it up
      // without needing a full fetchBatchesAndStatistics (which would flash the loading spinner).
      setBatches((prev: Batch[]) =>
        prev.map((b: Batch) => (b.slug === batch.slug ? { ...b, status: 'training' } : b))
      );

      setIsCreatingDataset(false);
      setTrainingBatchSlug(null);
    } catch (err: any) {
      console.error('Error in training flow:', err);

      let errorMessage = 'Failed to trigger training';
      if (err.message) {
        if (err.message.includes('500') || err.message.includes('Internal Server Error')) {
          errorMessage =
            'Server error occurred. Please try again later or contact the team if the issue persists.';
        } else if (err.message.includes('Network') || err.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (err.message.includes('401') || err.message.includes('403')) {
          errorMessage = 'Authentication error. Please log in again.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      setIsCreatingDataset(false);
      setTrainingBatchSlug(null);
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
              <RotateCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
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
                    <th className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-center w-1/5"></th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch: Batch) => {
                    const stats = batchStatistics[batch.slug];
                    const annotations = batchAnnotations[batch.slug];
                    const defectStats = stats?.statistics?.defect_statistics || [];
                    const ppidCount = annotations?.total_ppids || 0;
                    const totalAnnotations = annotations?.total_annotations || 0;

                    if (!stats) {
                      return (
                        <tr
                          key={batch.slug}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <td className="border border-gray-300 dark:border-gray-700 px-6 py-4">
                            <div className="font-semibold text-lg">{batch.name}</div>
                          </td>
                          <td
                            colSpan={4}
                            className="border border-gray-300 dark:border-gray-700 px-6 py-4 text-center text-gray-500"
                          >
                            Loading statistics...
                          </td>
                        </tr>
                      );
                    }

                    if (defectStats.length === 0) {
                      return (
                        <tr
                          key={batch.slug}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
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
                              {stats.statistics.approved_annotations} approved,{' '}
                              {stats.statistics.pending_annotations} pending
                            </div>
                          </td>
                          <td className="border border-gray-300 dark:border-gray-700 px-6 py-4 text-center">
                            <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                              {stats.statistics.min_threshold}
                            </div>
                          </td>
                          <td className="border border-gray-300 dark:border-gray-700 px-6 py-4 text-center">
                            <div className="text-sm text-gray-500">No defects configured</div>
                          </td>
                        </tr>
                      );
                    }

                    const allDefectsMeetThreshold = defectStats.every((d: DefectStatistic) => d.meets_threshold);

                    return (
                      <React.Fragment key={batch.slug}>
                        {defectStats.map((defect, defectIndex) => (
                          <tr
                            key={`${batch.slug}-${defect.defect_id}`}
                            id={defectIndex === 0 ? `batch-${batch.slug}` : undefined}
                            className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${
                              selectedBatchSlug === batch.slug
                                ? 'bg-blue-50 dark:bg-blue-900/20'
                                : ''
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
                              <div
                                className={`text-2xl font-bold ${
                                  defect.meets_threshold
                                    ? 'text-green-600 dark:text-green-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`}
                              >
                                {defect.total_annotations}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {defect.approved_annotations} approved,{' '}
                                {defect.pending_annotations} pending
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
                                {(() => {
                                  const dsProgress = datasetCreationProgress[batch.slug];
                                  const tp = trainingProgress[batch.slug];

                                  const isDatasetInProgress =
                                    dsProgress &&
                                    !['completed', 'failed'].includes(dsProgress.status);

                                  const isTrainingActive =
                                    tp &&
                                    !['completed', 'failed'].includes(
                                      tp.training_status || tp.status || ''
                                    );

                                  if (isDatasetInProgress) {
                                    return (
                                      <div className="text-center py-4 px-4">
                                        <div className="space-y-3">
                                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                            <div
                                              className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-3 rounded-full transition-all duration-500"
                                              style={{
                                                width: `${dsProgress.progress_percentage}%`,
                                              }}
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-base font-semibold text-indigo-600 dark:text-indigo-400">
                                              Creating Dataset:{' '}
                                              {dsProgress.progress_percentage.toFixed(1)}%
                                            </div>
                                            <div className="text-sm text-gray-700 dark:text-gray-300">
                                              Status:{' '}
                                              <span className="font-medium capitalize">
                                                {dsProgress.status.replace(/_/g, ' ')}
                                              </span>
                                            </div>
                                            <div className="text-xs text-gray-600 dark:text-gray-400">
                                              Images: {dsProgress.processed_images} /{' '}
                                              {dsProgress.total_images}
                                            </div>
                                            {dsProgress.created_at && (
                                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                                Started:{' '}
                                                {new Date(dsProgress.created_at).toLocaleString(
                                                  'en-GB'
                                                )}
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-indigo-600"></div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }

                                  if (isTrainingActive) {
                                    return (
                                      <div className="text-center py-4 px-4">
                                        <div className="space-y-3">
                                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                            <div
                                              className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                                              style={{
                                                width: `${tp.progress_percentage}%`,
                                              }}
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <div className="text-base font-semibold text-blue-600 dark:text-blue-400">
                                              Training in Progress:{' '}
                                              {tp.progress_percentage.toFixed(1)}%
                                            </div>
                                            {tp.training_stage && (
                                              <div className="text-sm text-gray-700 dark:text-gray-300">
                                                Stage:{' '}
                                                <span className="font-medium capitalize">
                                                  {tp.training_stage}
                                                </span>
                                              </div>
                                            )}
                                            {tp.started_at && (
                                              <div className="text-xs text-gray-600 dark:text-gray-400">
                                                Started:{' '}
                                                {new Date(tp.started_at).toLocaleString('en-GB')}
                                              </div>
                                            )}
                                          </div>
                                          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-600"></div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }

                                  if (allDefectsMeetThreshold) {
                                    return (
                                      <div className="flex flex-col items-center gap-2">
                                        <Button
                                          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-base font-medium"
                                          onClick={() => handleRequestTraining(batch)}
                                          disabled={
                                            isCreatingDataset &&
                                            trainingBatchSlug === batch.slug
                                          }
                                        >
                                          {isCreatingDataset &&
                                          trainingBatchSlug === batch.slug ? (
                                            <span className="flex items-center gap-2">
                                              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                              Processing...
                                            </span>
                                          ) : (
                                            `Request new model training for ${batch.name}`
                                          )}
                                        </Button>
                                      </div>
                                    );
                                  }

                                  return (
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
                                  );
                                })()}
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
