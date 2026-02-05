import React, { useState, useEffect, useRef } from 'react';
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
  getBatchPipelineStatus,
} from '@/services/api';
import { useAppMode } from '@/contexts/appModeContext';

// localStorage keys for state persistence
const STORAGE_KEYS = {
  DATASET_CREATION: 'model_training_dataset_creation',
  TRAINING_PROGRESS: 'model_training_progress',
  DEPLOYMENT_PROGRESS: 'model_training_deployment',
  BENCHMARK_PROGRESS: 'model_training_benchmark',
  PIPELINE_STATUS: 'model_training_pipeline_status',
  DISMISSED_BATCHES: 'model_training_dismissed_batches', // Batches user dismissed after failure
};

// Types for persisted state
interface DatasetCreationState {
  batchSlug: string;
  taskUuid: string;
  status: string;
  statusDisplay: string;
  progressPercentage: number;
  startedAt: number;
}

interface TrainingProgressState {
  [batchSlug: string]: {
    task_uuid: string; // Training task UUID for lightweight polling
    status: string;
    progress_percentage: number;
    training_stage: string | null;
    started_at: string | null;
    estimated_completion: string | null;
    training_status?: string; // API field: pending, preparing, training, evaluating, deploying, completed, failed
    model_display_name?: string;
    error_message?: string | null; // Error message when training fails
    completed_at?: string | null; // When training completed (success or failure)
    deployment_task_uuid?: string | null; // Provided by API when training completes
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

interface DeploymentProgressState {
  [batchSlug: string]: {
    task_uuid: string;
    model_name: string;
    model_version: number;
    deployment_status: string;
    progress_percentage: number;
    started_at: string | null;
    completed_at: string | null;
    error_message?: string | null; // Error message when deployment fails
    benchmark_task_uuid?: string | null; // Provided by API when deployment completes
  };
}

interface BenchmarkProgressState {
  [batchSlug: string]: {
    task_uuid: string;
    model_name: string;
    model_version: number;
    status: string;
    progress_percentage: number;
    started_at: string | null;
    completed_at: string | null;
    error_message?: string | null; // Error message when benchmark fails
    results?: {
      accuracy?: number;
      precision?: number;
      recall?: number;
      f1_score?: number;
    };
  };
}

interface PipelineStatusState {
  [batchSlug: string]: {
    current_phase:
      | 'dataset_creation'
      | 'dataset_creation_failed'
      | 'training'
      | 'training_failed'
      | 'deployment'
      | 'deployment_failed'
      | 'benchmarking'
      | 'benchmarking_failed'
      | 'completed';
    training_completed_at?: string;
    deployment_completed_at?: string;
    benchmark_completed_at?: string;
  };
}

// Helper functions for localStorage state management
const saveDatasetCreationState = (state: DatasetCreationState) => {
  try {
    localStorage.setItem(STORAGE_KEYS.DATASET_CREATION, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save dataset creation state:', error);
  }
};

const loadDatasetCreationState = (): DatasetCreationState | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DATASET_CREATION);
    if (!stored) return null;

    const state = JSON.parse(stored) as DatasetCreationState;

    // Check if state is too old (older than 24 hours)
    const hoursSinceStart = (Date.now() - state.startedAt) / (1000 * 60 * 60);
    if (hoursSinceStart > 24) {
      clearDatasetCreationState();
      return null;
    }

    return state;
  } catch (error) {
    console.error('Failed to load dataset creation state:', error);
    return null;
  }
};

const clearDatasetCreationState = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.DATASET_CREATION);
  } catch (error) {
    console.error('Failed to clear dataset creation state:', error);
  }
};

const saveTrainingProgressState = (state: TrainingProgressState) => {
  try {
    localStorage.setItem(STORAGE_KEYS.TRAINING_PROGRESS, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save training progress state:', error);
  }
};

const loadTrainingProgressState = (): TrainingProgressState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.TRAINING_PROGRESS);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to load training progress state:', error);
    return {};
  }
};

const saveDatasetCreationProgressState = (state: DatasetCreationProgressState) => {
  try {
    localStorage.setItem('model_training_dataset_creation_progress', JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save dataset creation progress state:', error);
  }
};

const loadDatasetCreationProgressState = (): DatasetCreationProgressState => {
  try {
    const stored = localStorage.getItem('model_training_dataset_creation_progress');
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to load dataset creation progress state:', error);
    return {};
  }
};

const saveDeploymentProgressState = (state: DeploymentProgressState) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.DEPLOYMENT_PROGRESS,
      JSON.stringify(state)
    );
  } catch (error) {
    console.error('Failed to save deployment progress state:', error);
  }
};

const loadDeploymentProgressState = (): DeploymentProgressState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DEPLOYMENT_PROGRESS);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to load deployment progress state:', error);
    return {};
  }
};

const saveBenchmarkProgressState = (state: BenchmarkProgressState) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.BENCHMARK_PROGRESS,
      JSON.stringify(state)
    );
  } catch (error) {
    console.error('Failed to save benchmark progress state:', error);
  }
};

const loadBenchmarkProgressState = (): BenchmarkProgressState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.BENCHMARK_PROGRESS);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to load benchmark progress state:', error);
    return {};
  }
};

const savePipelineStatusState = (state: PipelineStatusState) => {
  try {
    localStorage.setItem(STORAGE_KEYS.PIPELINE_STATUS, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save pipeline status state:', error);
  }
};

const loadPipelineStatusState = (): PipelineStatusState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PIPELINE_STATUS);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    console.error('Failed to load pipeline status state:', error);
    return {};
  }
};

// Dismissed batches - batches the user dismissed after failure (allows fresh start)
const saveDismissedBatches = (batches: Set<string>) => {
  try {
    localStorage.setItem(
      STORAGE_KEYS.DISMISSED_BATCHES,
      JSON.stringify([...batches])
    );
  } catch (error) {
    console.error('Failed to save dismissed batches:', error);
  }
};

const loadDismissedBatches = (): Set<string> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DISMISSED_BATCHES);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch (error) {
    console.error('Failed to load dismissed batches:', error);
    return new Set();
  }
};

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
  const [batchStatistics, setBatchStatistics] = useState<
    Record<string, BatchStatistics>
  >({});
  const [batchAnnotations, setBatchAnnotations] = useState<Record<string, any>>(
    {}
  );
  const [error, setError] = useState<string | null>(null);

  // Training flow states
  const [trainingBatchSlug, setTrainingBatchSlug] = useState<string | null>(
    null
  );
  const [datasetCreationTaskUuid, setDatasetCreationTaskUuid] = useState<
    string | null
  >(null);
  const [datasetCreationStatus, setDatasetCreationStatus] =
    useState<string>('');
  const [datasetCreationStatusDisplay, setDatasetCreationStatusDisplay] =
    useState<string>('');
  const [datasetProgressPercentage, setDatasetProgressPercentage] =
    useState<number>(0);
  const [isCreatingDataset, setIsCreatingDataset] = useState(false);

  // Pipeline progress states (from pipeline-status API)
  const [datasetCreationProgress, setDatasetCreationProgress] =
    useState<DatasetCreationProgressState>({});
  const [trainingProgress, setTrainingProgress] =
    useState<TrainingProgressState>({});
  const [deploymentProgress, setDeploymentProgress] =
    useState<DeploymentProgressState>({});
  const [benchmarkProgress, setBenchmarkProgress] =
    useState<BenchmarkProgressState>({});
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatusState>({});

  // Dismissed batches - batches where user clicked "Dismiss & Retry" after failure
  // These batches should show the "Request new model training" button
  const [dismissedBatches, setDismissedBatches] = useState<Set<string>>(() =>
    loadDismissedBatches()
  );

  // Refs to track polling intervals
  const datasetPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const trainingPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchBatchesAndStatistics = async () => {
    setLoading(true);
    setError(null);
    try {
      // Step 1: Get all batches
      const response = await getBatches();
      console.log('Batches response:', response);

      const batchesData = Array.isArray(response)
        ? response
        : response.results || [];
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

  // Load persisted state on mount
  useEffect(() => {
    // 1. Load all persisted states
    const savedDatasetCreationProgress = loadDatasetCreationProgressState();
    const savedTrainingProgress = loadTrainingProgressState();
    const savedDeploymentProgress = loadDeploymentProgressState();
    const savedBenchmarkProgress = loadBenchmarkProgressState();
    const savedPipelineStatus = loadPipelineStatusState();

    if (Object.keys(savedDatasetCreationProgress).length > 0) {
      setDatasetCreationProgress(savedDatasetCreationProgress);
    }
    if (Object.keys(savedTrainingProgress).length > 0) {
      setTrainingProgress(savedTrainingProgress);
    }
    if (Object.keys(savedDeploymentProgress).length > 0) {
      setDeploymentProgress(savedDeploymentProgress);
    }
    if (Object.keys(savedBenchmarkProgress).length > 0) {
      setBenchmarkProgress(savedBenchmarkProgress);
    }
    if (Object.keys(savedPipelineStatus).length > 0) {
      setPipelineStatus(savedPipelineStatus);
    }

    // Load dataset creation state
    const savedDatasetState = loadDatasetCreationState();
    if (savedDatasetState) {
      console.log('Recovering dataset creation state:', savedDatasetState);
      setTrainingBatchSlug(savedDatasetState.batchSlug);
      setDatasetCreationTaskUuid(savedDatasetState.taskUuid);
      setDatasetCreationStatus(savedDatasetState.status);
      setDatasetCreationStatusDisplay(savedDatasetState.statusDisplay);
      setDatasetProgressPercentage(savedDatasetState.progressPercentage);
      setIsCreatingDataset(true);

      // Resume polling for this dataset creation
      resumeDatasetCreationPolling(
        savedDatasetState.taskUuid,
        savedDatasetState.batchSlug
      );
    }

    // 2. Fetch batches and immediately poll for active training
    const initializePolling = async () => {
      await fetchBatchesAndStatistics();

      // After batches loaded, check for any in training and poll immediately
      const response = await getBatches();
      const batchesData = Array.isArray(response)
        ? response
        : response.results || [];

      // Clean up stale progress for batches that are now 'draft'
      // This happens when backend resets a batch's training status
      const draftBatchSlugs = batchesData
        .filter((b: any) => b.status === 'draft')
        .map((b: any) => b.slug);

      if (draftBatchSlugs.length > 0) {
        const staleSlugs = draftBatchSlugs.filter(
          (slug: string) => savedTrainingProgress[slug]
        );
        if (staleSlugs.length > 0) {
          console.log(
            'Cleaning up stale progress for draft batches:',
            staleSlugs
          );
          const cleanedProgress = { ...savedTrainingProgress };
          const cleanedDeployment = { ...savedDeploymentProgress };
          const cleanedBenchmark = { ...savedBenchmarkProgress };
          const cleanedPipeline = { ...savedPipelineStatus };

          staleSlugs.forEach((slug: string) => {
            delete cleanedProgress[slug];
            delete cleanedDeployment[slug];
            delete cleanedBenchmark[slug];
            delete cleanedPipeline[slug];
          });

          // Update state and localStorage
          setTrainingProgress(cleanedProgress);
          setDeploymentProgress(cleanedDeployment);
          setBenchmarkProgress(cleanedBenchmark);
          setPipelineStatus(cleanedPipeline);
          saveTrainingProgressState(cleanedProgress);
          saveDeploymentProgressState(cleanedDeployment);
          saveBenchmarkProgressState(cleanedBenchmark);
          savePipelineStatusState(cleanedPipeline);
        }
      }

      // Note: Pipeline status polling useEffect will handle fetching progress for training batches
    };

    initializePolling();

    // Cleanup on unmount
    return () => {
      if (datasetPollingIntervalRef.current)
        clearInterval(datasetPollingIntervalRef.current);
      if (trainingPollingIntervalRef.current)
        clearInterval(trainingPollingIntervalRef.current);
    };
  }, []);

  // ==================== SIMPLIFIED PIPELINE POLLING ====================
  // Single useEffect to poll pipeline-status for all batches that have started the pipeline
  useEffect(() => {
    // Find batches that need pipeline status polling
    // Poll ANY batch that isn't 'draft' to get its pipeline status
    // This includes 'training', 'completed', 'failed', etc.
    const batchesToPoll = batches.filter((b) => {
      if (dismissedBatches.has(b.slug)) return false;

      // Poll any batch that's not in draft status
      // We need to fetch pipeline-status to show proper UI (dataset/training/deployment/benchmark progress)
      if (b.status === 'draft') return false;

      // If we already have complete pipeline data showing all phases are done, stop polling
      const currentPhase = pipelineStatus[b.slug]?.current_phase;
      if (
        currentPhase === 'completed' &&
        benchmarkProgress[b.slug]?.status === 'completed'
      ) {
        return false;
      }

      // If any phase failed and we have that info, stop polling
      if (currentPhase && currentPhase.includes('_failed')) {
        // But only stop if we have the error details already
        if (
          (currentPhase === 'dataset_creation_failed' && datasetCreationProgress[b.slug]?.error_message) ||
          (currentPhase === 'training_failed' && trainingProgress[b.slug]?.error_message) ||
          (currentPhase === 'deployment_failed' && deploymentProgress[b.slug]?.error_message) ||
          (currentPhase === 'benchmarking_failed' && benchmarkProgress[b.slug]?.error_message)
        ) {
          return false;
        }
      }

      return true;
    });

    if (batchesToPoll.length === 0) {
      // Clear interval if no batches to poll
      if (trainingPollingIntervalRef.current) {
        clearInterval(trainingPollingIntervalRef.current);
        trainingPollingIntervalRef.current = null;
      }
      return;
    }

    const pollPipelineStatus = async () => {
      console.log(
        'Polling pipeline status for:',
        batchesToPoll.map((b) => b.slug)
      );

      const progressPromises = batchesToPoll.map(async (batch) => {
        try {
          const pipelineStatus = await getBatchPipelineStatus(batch.slug);
          return { slug: batch.slug, pipelineStatus };
        } catch (err) {
          console.error(
            `Error fetching pipeline status for ${batch.slug}:`,
            err
          );
          return { slug: batch.slug, pipelineStatus: null };
        }
      });

      const results = await Promise.all(progressPromises);

      results.forEach(({ slug, pipelineStatus }) => {
        if (!pipelineStatus || pipelineStatus.status !== 'success') return;

        // Update dataset creation progress if dataset_creation data exists
        if (pipelineStatus.dataset_creation) {
          const dataset = pipelineStatus.dataset_creation;
          setDatasetCreationProgress((prev) => {
            const updated = {
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
            };
            saveDatasetCreationProgressState(updated);
            return updated;
          });

          // Check if dataset creation just completed and training hasn't started yet
          if (
            dataset.status === 'completed' &&
            dataset.vertex_dataset_id &&
            !pipelineStatus.training
          ) {
            // Trigger training automatically
            console.log(
              `Dataset creation completed for ${slug}. Triggering training...`
            );
            continueWithTraining(
              slug,
              dataset.task_uuid,
              dataset.vertex_dataset_id
            ).catch((err) => {
              console.error('Error triggering training:', err);
            });
          }
        }

        // Update training progress if training data exists
        if (pipelineStatus.training) {
          const training = pipelineStatus.training;
          setTrainingProgress((prev) => {
            const updated = {
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
            };
            saveTrainingProgressState(updated);
            return updated;
          });
        }

        // Update deployment progress if deployment data exists
        if (pipelineStatus.deployment) {
          const deployment = pipelineStatus.deployment;
          setDeploymentProgress((prev) => {
            const updated = {
              ...prev,
              [slug]: {
                task_uuid: deployment.task_uuid,
                model_name: deployment.model_name || '',
                model_version: deployment.model_version || 0,
                deployment_status: deployment.status,
                progress_percentage: deployment.progress_percentage || 0,
                started_at: deployment.started_at || null,
                completed_at: deployment.completed_at || null,
                error_message: deployment.error_message || null,
              },
            };
            saveDeploymentProgressState(updated);
            return updated;
          });
        }

        // Update benchmark progress if benchmarking data exists
        if (pipelineStatus.benchmarking) {
          const benchmark = pipelineStatus.benchmarking;
          setBenchmarkProgress((prev) => {
            const updated = {
              ...prev,
              [slug]: {
                task_uuid: benchmark.task_uuid,
                model_name: benchmark.model_name || '',
                model_version: benchmark.model_version || 0,
                status: benchmark.status,
                progress_percentage: benchmark.progress_percentage || 0,
                started_at: benchmark.started_at || null,
                completed_at: benchmark.completed_at || null,
                error_message: benchmark.error_message || null,
                // Results are directly on benchmark object, not nested in 'results'
                results:
                  benchmark.accuracy !== undefined
                    ? {
                        accuracy: benchmark.accuracy,
                        precision: benchmark.precision,
                        recall: benchmark.recall,
                        f1_score: benchmark.f1_score,
                      }
                    : undefined,
              },
            };
            saveBenchmarkProgressState(updated);
            return updated;
          });
        }

        // Update pipeline phase
        if (pipelineStatus.current_phase) {
          setPipelineStatus((prev) => ({
            ...prev,
            [slug]: {
              ...prev[slug],
              current_phase: pipelineStatus.current_phase,
            },
          }));
        }
      });
    };

    // Poll immediately
    pollPipelineStatus();

    // Clear existing interval before setting new one
    if (trainingPollingIntervalRef.current) {
      clearInterval(trainingPollingIntervalRef.current);
    }

    // Set up polling interval (every 30 seconds)
    trainingPollingIntervalRef.current = setInterval(pollPipelineStatus, 30000);

    return () => {
      if (trainingPollingIntervalRef.current) {
        clearInterval(trainingPollingIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    batches.map((b) => `${b.slug}:${b.status}`).join(','),
    dismissedBatches.size,
  ]);

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
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Resume dataset creation polling from saved state
  const resumeDatasetCreationPolling = async (
    datasetTaskUuid: string,
    batchSlug: string
  ) => {
    try {
      console.log(
        'Resuming dataset creation polling for task:',
        datasetTaskUuid
      );
      const datasetCompleted = await pollDatasetCreationStatus(
        datasetTaskUuid,
        batchSlug
      );

      if (datasetCompleted) {
        // Continue with training trigger using the dataset task UUID
        await continueWithTraining(batchSlug, datasetTaskUuid);
      }
    } catch (err: any) {
      console.error('Error resuming dataset creation polling:', err);
      setError(err.message || 'Failed to resume dataset creation');
      clearDatasetCreationState();
      setIsCreatingDataset(false);
      setTrainingBatchSlug(null);
    }
  };

  // Continue with training after dataset creation
  const continueWithTraining = async (
    batchSlug: string,
    datasetTaskId: string,
    vertexDatasetId?: string
  ) => {
    try {
      const batch = batches.find((b) => b.slug === batchSlug);
      console.log(batches, batchSlug);
      if (!batch) {
        throw new Error('Batch not found');
      }

      setDatasetCreationStatus('triggering_training');
      console.log('Triggering training with dataset_task_id:', datasetTaskId);

      const trainingResponse = await triggerTraining(batchSlug, {
        dataset_task_id: datasetTaskId,
        model_display_name: `${
          batch.name
        } - ${new Date().toLocaleDateString()}`,
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

      // Extract training task UUID from response
      const trainingTaskUuid = trainingResponse.training_task?.task_uuid;
      const modelDisplayName =
        trainingResponse.training_task?.model_display_name;

      if (trainingTaskUuid) {
        // Remove from dismissed batches first (in case user retried after failure)
        setDismissedBatches((prev) => {
          if (prev.has(batchSlug)) {
            const updated = new Set<string>(prev);
            updated.delete(batchSlug);
            saveDismissedBatches(updated);
            return updated;
          }
          return prev;
        });

        // Initialize training progress with task UUID for polling
        const initialProgress = {
          task_uuid: trainingTaskUuid,
          status: 'pending',
          progress_percentage: 0,
          training_stage: 'pending',
          started_at: new Date().toISOString(),
          estimated_completion: null,
          training_status: 'pending',
          model_display_name: modelDisplayName,
        };

        console.log(
          'Setting training progress for batch:',
          batchSlug,
          initialProgress
        );

        setTrainingProgress((prev) => {
          const updated = { ...prev, [batchSlug]: initialProgress };
          // Save to localStorage with the updated state
          saveTrainingProgressState(updated);
          return updated;
        });

        console.log('Training task UUID stored for polling:', trainingTaskUuid);
      } else {
        console.warn('No training task UUID in response:', trainingResponse);
      }

      // Clear dataset creation state
      clearDatasetCreationState();

      // Refresh batches to update status (training progress will show in UI automatically)
      await fetchBatchesAndStatistics();
    } catch (err: any) {
      console.error('Error triggering training:', err);
      throw err;
    } finally {
      setIsCreatingDataset(false);
      setTrainingBatchSlug(null);
      setDatasetCreationStatus('');
      setDatasetCreationStatusDisplay('');
      setDatasetProgressPercentage(0);
    }
  };

  // Poll dataset creation task status with persistence
  const pollDatasetCreationStatus = async (
    taskUuid: string,
    batchSlug: string
  ): Promise<string | null> => {
    const maxAttempts = 40; // Poll for up to 20 minutes (30s intervals)
    const pollInterval = 30000; // 30 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const taskStatus = await getDatasetCreationTaskStatus(taskUuid);
        console.log('Dataset creation status:', taskStatus);

        const newStatus = taskStatus.status || 'processing';
        const newStatusDisplay = taskStatus.status_display || '';
        const newProgress = taskStatus.progress_percentage || 0;

        setDatasetCreationStatus(newStatus);
        setDatasetCreationStatusDisplay(newStatusDisplay);
        setDatasetProgressPercentage(newProgress);

        // Persist state
        saveDatasetCreationState({
          batchSlug,
          taskUuid,
          status: newStatus,
          statusDisplay: newStatusDisplay,
          progressPercentage: newProgress,
          startedAt: Date.now(),
        });

        if (taskStatus.status === 'completed') {
          clearDatasetCreationState();
          return taskStatus.vertex_dataset_id;
        } else if (
          taskStatus.status === 'failed' ||
          taskStatus.status === 'cancelled'
        ) {
          clearDatasetCreationState();
          throw new Error(
            `Dataset creation ${taskStatus.status}: ${
              taskStatus.error_message || 'Unknown error'
            }`
          );
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (err: any) {
        console.error('Error polling dataset creation status:', err);
        clearDatasetCreationState();
        throw err;
      }
    }

    clearDatasetCreationState();
    throw new Error('Dataset creation timed out after 20 minutes');
  };

  const handleRequestTraining = async (batch: Batch) => {
    console.log(batch);
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
      const defectNames =
        batchPPIDsData.defects?.map((d: any) => d.defect_name) || [];

      if (ppids.length === 0) {
        throw new Error('No PPIDs found in this batch');
      }

      // Step 2: Create dataset (backend will set batch status to 'training')
      console.log('Creating dataset...');
      setDatasetCreationStatus('preparing');
      const datasetResponse = await createDataset({
        batch_slug: batch.slug,
        description: `Dataset for defect detection - ${batch.name}`,
        test_type: isTestMode ? 'test' : 'production',
        ppids: ppids,
        defect_names: defectNames,
        start_date: new Date().toISOString(),
      });

      console.log('Dataset creation initiated:', datasetResponse);

      const datasetTaskUuid = datasetResponse.task_uuid;
      if (!datasetTaskUuid) {
        throw new Error('Dataset creation did not return task_uuid');
      }

      // Backend has set batch status to 'training'
      // Now we need to wait for dataset creation to complete, then trigger training
      console.log(
        'Dataset creation started. Task UUID:',
        datasetTaskUuid
      );

      // Clear local state - pipeline-status polling will show dataset progress
      clearDatasetCreationState();
      setIsCreatingDataset(false);
      setTrainingBatchSlug(null);
      setDatasetCreationStatus('');
      setDatasetCreationStatusDisplay('');
      setDatasetProgressPercentage(0);

      // Refresh batches to get updated status (should be 'training' now)
      await fetchBatchesAndStatistics();

      // Pipeline-status polling will detect when dataset is complete and trigger training
      // (handled in the polling useEffect)
    } catch (err: any) {
      console.error('Error in training flow:', err);

      // Provide user-friendly error messages
      let errorMessage = 'Failed to trigger training';
      if (err.message) {
        // Check for common error patterns
        if (
          err.message.includes('500') ||
          err.message.includes('Internal Server Error')
        ) {
          errorMessage =
            'Server error occurred. Please try again later or contact the team if the issue persists.';
        } else if (
          err.message.includes('Network') ||
          err.message.includes('fetch')
        ) {
          errorMessage =
            'Network error. Please check your connection and try again.';
        } else if (err.message.includes('401') || err.message.includes('403')) {
          errorMessage = 'Authentication error. Please log in again.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      clearDatasetCreationState();
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
                      Min Total Pending review & approved annotated images
                      required
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-6 py-3 text-center w-1/5"></th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => {
                    const stats = batchStatistics[batch.slug];
                    const annotations = batchAnnotations[batch.slug];
                    const defectStats =
                      stats?.statistics?.defect_statistics || [];
                    const ppidCount = annotations?.total_ppids || 0;
                    const totalAnnotations =
                      annotations?.total_annotations || 0;

                    // If statistics are still loading (not fetched yet)
                    if (!stats) {
                      return (
                        <tr
                          key={batch.slug}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <td className="border border-gray-300 dark:border-gray-700 px-6 py-4">
                            <div className="font-semibold text-lg">
                              {batch.name}
                            </div>
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

                    // If statistics loaded but no defects configured
                    if (defectStats.length === 0) {
                      return (
                        <tr
                          key={batch.slug}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <td className="border border-gray-300 dark:border-gray-700 px-6 py-4">
                            <div className="font-semibold text-lg">
                              {batch.name}
                            </div>
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
                            <div className="text-sm text-gray-500">
                              No defects configured
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    const allDefectsMeetThreshold = defectStats.every(
                      (d) => d.meets_threshold
                    );

                    return (
                      <React.Fragment key={batch.slug}>
                        {defectStats.map((defect, defectIndex) => (
                          <tr
                            key={`${batch.slug}-${defect.defect_id}`}
                            id={
                              defectIndex === 0
                                ? `batch-${batch.slug}`
                                : undefined
                            }
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
                                <div className="font-semibold text-lg">
                                  {batch.name}
                                </div>
                                {ppidCount > 0 && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {ppidCount} PPIDs • {totalAnnotations}{' '}
                                    annotations
                                  </div>
                                )}
                              </td>
                            )}
                            <td className="border border-gray-300 dark:border-gray-700 px-6 py-4">
                              <div className="font-medium">
                                {defect.defect_name}
                              </div>
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
                                {/* TRAINING FAILED */}
                                {trainingProgress[batch.slug]
                                  ?.training_status === 'failed' ? (
                                  <div className="text-center py-4 px-4">
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-center gap-2">
                                        <svg
                                          className="w-6 h-6 text-red-500"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                          />
                                        </svg>
                                        <span className="text-base font-semibold text-red-600 dark:text-red-400">
                                          Training Failed
                                        </span>
                                      </div>

                                      {trainingProgress[batch.slug]
                                        .error_message && (
                                        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                                          {
                                            trainingProgress[batch.slug]
                                              .error_message
                                          }
                                        </div>
                                      )}

                                      {trainingProgress[batch.slug]
                                        .started_at && (
                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                          Started:{' '}
                                          {new Date(
                                            trainingProgress[
                                              batch.slug
                                            ].started_at!
                                          ).toLocaleString('en-GB')}
                                        </div>
                                      )}

                                      {trainingProgress[batch.slug]
                                        .completed_at && (
                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                          Failed at:{' '}
                                          {new Date(
                                            trainingProgress[
                                              batch.slug
                                            ].completed_at!
                                          ).toLocaleString('en-GB')}
                                        </div>
                                      )}

                                      {/* <Button
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm"
                                        onClick={() => {
                                          // Clear failed training state and add to dismissed batches
                                          setTrainingProgress((prev) => {
                                            const updated = { ...prev };
                                            delete updated[batch.slug];
                                            saveTrainingProgressState(updated);
                                            return updated;
                                          });
                                          // Add to dismissed batches so polling won't pick it up again
                                          setDismissedBatches((prev) => {
                                            const updated = new Set<string>(
                                              prev
                                            );
                                            updated.add(batch.slug);
                                            saveDismissedBatches(updated);
                                            return updated;
                                          });
                                        }}
                                      >
                                        Dismiss & Retry
                                      </Button> */}
                                    </div>
                                  </div>
                                ) : /* DEPLOYMENT FAILED - Show training completed + deployment error */
                                deploymentProgress[batch.slug]
                                  ?.deployment_status === 'failed' ? (
                                  <div className="text-center py-4 px-4">
                                    <div className="space-y-4">
                                      {/* Training Success Section */}
                                      <div className="border-l-4 border-green-500 pl-3 text-left">
                                        <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                                          ✓ Training Completed
                                        </div>
                                        {trainingProgress[batch.slug]
                                          ?.model_display_name && (
                                          <div className="text-xs text-gray-600 dark:text-gray-400">
                                            Model:{' '}
                                            {
                                              trainingProgress[batch.slug]
                                                .model_display_name
                                            }
                                          </div>
                                        )}
                                        {trainingProgress[batch.slug]
                                          ?.completed_at && (
                                          <div className="text-xs text-gray-500">
                                            {new Date(
                                              trainingProgress[
                                                batch.slug
                                              ].completed_at!
                                            ).toLocaleString('en-GB')}
                                          </div>
                                        )}
                                      </div>

                                      {/* Deployment Failed Section */}
                                      <div className="border-l-4 border-red-500 pl-3 text-left">
                                        <div className="flex items-center gap-2">
                                          <svg
                                            className="w-5 h-5 text-red-500"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                            />
                                          </svg>
                                          <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                                            Deployment Failed
                                          </span>
                                        </div>

                                        {deploymentProgress[batch.slug]
                                          .error_message && (
                                          <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded mt-2">
                                            {
                                              deploymentProgress[batch.slug]
                                                .error_message
                                            }
                                          </div>
                                        )}

                                        <div className="text-xs text-gray-500 mt-1">
                                          Model:{' '}
                                          {
                                            deploymentProgress[batch.slug]
                                              .model_name
                                          }{' '}
                                          v
                                          {
                                            deploymentProgress[batch.slug]
                                              .model_version
                                          }
                                        </div>

                                        {deploymentProgress[batch.slug]
                                          .completed_at && (
                                          <div className="text-xs text-gray-500">
                                            Failed at:{' '}
                                            {new Date(
                                              deploymentProgress[
                                                batch.slug
                                              ].completed_at!
                                            ).toLocaleString('en-GB')}
                                          </div>
                                        )}
                                      </div>

                                      <div className="text-xs text-gray-500 mt-2">
                                        Please contact the team to resolve this
                                        issue.
                                      </div>
                                    </div>
                                  </div>
                                ) : /* BENCHMARK FAILED - Show training + deployment completed + benchmark error */
                                benchmarkProgress[batch.slug]?.status ===
                                  'failed' ? (
                                  <div className="text-center py-4 px-4">
                                    <div className="space-y-4">
                                      {/* Training Success Section */}
                                      <div className="border-l-4 border-green-500 pl-3 text-left">
                                        <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                                          ✓ Training Completed
                                        </div>
                                        {trainingProgress[batch.slug]
                                          ?.completed_at && (
                                          <div className="text-xs text-gray-500">
                                            {new Date(
                                              trainingProgress[
                                                batch.slug
                                              ].completed_at!
                                            ).toLocaleString('en-GB')}
                                          </div>
                                        )}
                                      </div>

                                      {/* Deployment Success Section */}
                                      <div className="border-l-4 border-purple-500 pl-3 text-left">
                                        <div className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                                          ✓ Deployment Completed
                                        </div>
                                        {deploymentProgress[batch.slug]
                                          ?.completed_at && (
                                          <div className="text-xs text-gray-500">
                                            {new Date(
                                              deploymentProgress[
                                                batch.slug
                                              ].completed_at!
                                            ).toLocaleString('en-GB')}
                                          </div>
                                        )}
                                      </div>

                                      {/* Benchmark Failed Section */}
                                      <div className="border-l-4 border-red-500 pl-3 text-left">
                                        <div className="flex items-center gap-2">
                                          <svg
                                            className="w-5 h-5 text-red-500"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                            />
                                          </svg>
                                          <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                                            Benchmarking Failed
                                          </span>
                                        </div>

                                        {benchmarkProgress[batch.slug]
                                          .error_message && (
                                          <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded mt-2">
                                            {
                                              benchmarkProgress[batch.slug]
                                                .error_message
                                            }
                                          </div>
                                        )}

                                        {benchmarkProgress[batch.slug]
                                          .completed_at && (
                                          <div className="text-xs text-gray-500 mt-1">
                                            Failed at:{' '}
                                            {new Date(
                                              benchmarkProgress[
                                                batch.slug
                                              ].completed_at!
                                            ).toLocaleString('en-GB')}
                                          </div>
                                        )}
                                      </div>

                                      <div className="text-xs text-gray-500 mt-2">
                                        Please contact the team to resolve this
                                        issue.
                                      </div>
                                    </div>
                                  </div>
                                ) : /* TRAINING COMPLETED - Show only when training is done AND deployment hasn't started yet */
                                trainingProgress[batch.slug]
                                    ?.training_status === 'completed' &&
                                  !dismissedBatches.has(batch.slug) &&
                                  !deploymentProgress[batch.slug] ? (
                                  <div className="text-center py-4 px-4">
                                    <div className="space-y-3">
                                      {/* Completed Progress Bar */}
                                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                        <div
                                          className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full"
                                          style={{ width: '100%' }}
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <div className="text-base font-semibold text-green-600 dark:text-green-400">
                                          ✓ Training Completed
                                        </div>

                                        {trainingProgress[batch.slug]
                                          .model_display_name && (
                                          <div className="text-sm text-gray-700 dark:text-gray-300">
                                            Model:{' '}
                                            {
                                              trainingProgress[batch.slug]
                                                .model_display_name
                                            }
                                          </div>
                                        )}

                                        {trainingProgress[batch.slug]
                                          .completed_at && (
                                          <div className="text-xs text-gray-600 dark:text-gray-400">
                                            Completed:{' '}
                                            {new Date(
                                              trainingProgress[
                                                batch.slug
                                              ].completed_at!
                                            ).toLocaleString('en-GB')}
                                          </div>
                                        )}

                                        <div className="text-sm text-gray-500 mt-2">
                                          <div className="flex items-center justify-center gap-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-green-600"></div>
                                            <span>
                                              Checking deployment status...
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ) : /* DATASET CREATION COMPLETED, WAITING FOR TRAINING */
                                datasetCreationProgress[batch.slug] &&
                                  datasetCreationProgress[batch.slug].status ===
                                    'completed' &&
                                  !trainingProgress[batch.slug] ? (
                                  <div className="text-center py-4 px-4">
                                    <div className="space-y-3">
                                      {/* Completed Progress Bar */}
                                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                        <div
                                          className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full"
                                          style={{ width: '100%' }}
                                        />
                                      </div>

                                      <div className="space-y-1">
                                        <div className="text-base font-semibold text-green-600 dark:text-green-400">
                                          ✓ Dataset Created Successfully
                                        </div>

                                        <div className="text-sm text-gray-700 dark:text-gray-300">
                                          Dataset:{' '}
                                          {
                                            datasetCreationProgress[batch.slug]
                                              .dataset_name
                                          }
                                        </div>

                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                          Images:{' '}
                                          {
                                            datasetCreationProgress[batch.slug]
                                              .total_images
                                          }
                                        </div>

                                        {datasetCreationProgress[batch.slug]
                                          .completed_at && (
                                          <div className="text-xs text-gray-600 dark:text-gray-400">
                                            Completed:{' '}
                                            {new Date(
                                              datasetCreationProgress[
                                                batch.slug
                                              ].completed_at!
                                            ).toLocaleString('en-GB')}
                                          </div>
                                        )}

                                        <div className="text-sm text-gray-500 mt-2">
                                          <div className="flex items-center justify-center gap-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-600"></div>
                                            <span>
                                              Waiting for training to start...
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ) : /* DATASET CREATION IN PROGRESS - Show when dataset is being created */
                                datasetCreationProgress[batch.slug] &&
                                  datasetCreationProgress[batch.slug].status !==
                                    'completed' &&
                                  datasetCreationProgress[batch.slug].status !==
                                    'failed' ? (
                                  <div className="text-center py-4 px-4">
                                    <div className="space-y-3">
                                      {/* Progress Bar */}
                                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                        <div
                                          className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-3 rounded-full transition-all duration-500"
                                          style={{
                                            width: `${
                                              datasetCreationProgress[batch.slug]
                                                .progress_percentage
                                            }%`,
                                          }}
                                        />
                                      </div>

                                      {/* Progress Details */}
                                      <div className="space-y-1">
                                        <div className="text-base font-semibold text-indigo-600 dark:text-indigo-400">
                                          Creating Dataset:{' '}
                                          {datasetCreationProgress[
                                            batch.slug
                                          ].progress_percentage.toFixed(1)}
                                          %
                                        </div>

                                        <div className="text-sm text-gray-700 dark:text-gray-300">
                                          Status:{' '}
                                          <span className="font-medium capitalize">
                                            {datasetCreationProgress[
                                              batch.slug
                                            ].status.replace(/_/g, ' ')}
                                          </span>
                                        </div>

                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                          Images:{' '}
                                          {
                                            datasetCreationProgress[batch.slug]
                                              .processed_images
                                          }{' '}
                                          /{' '}
                                          {
                                            datasetCreationProgress[batch.slug]
                                              .total_images
                                          }
                                        </div>

                                        {datasetCreationProgress[batch.slug]
                                          .created_at && (
                                          <div className="text-xs text-gray-600 dark:text-gray-400">
                                            Started:{' '}
                                            {new Date(
                                              datasetCreationProgress[
                                                batch.slug
                                              ].created_at!
                                            ).toLocaleString('en-GB')}
                                          </div>
                                        )}
                                      </div>

                                      {/* Loading Indicator */}
                                      <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-indigo-600"></div>
                                      </div>
                                    </div>
                                  </div>
                                ) : /* TRAINING IN PROGRESS - Only show when training is active (not completed) */
                                trainingProgress[batch.slug]?.task_uuid &&
                                  trainingProgress[batch.slug]?.training_status !==
                                    'completed' &&
                                  !dismissedBatches.has(batch.slug) ? (
                                  <div className="text-center py-4 px-4">
                                    <div className="space-y-3">
                                      {/* Progress Bar */}
                                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                        <div
                                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                                          style={{
                                            width: `${
                                              trainingProgress[batch.slug]
                                                .progress_percentage
                                            }%`,
                                          }}
                                        />
                                      </div>

                                      {/* Progress Details */}
                                      <div className="space-y-1">
                                        <div className="text-base font-semibold text-blue-600 dark:text-blue-400">
                                          Training in Progress:{' '}
                                          {trainingProgress[
                                            batch.slug
                                          ].progress_percentage.toFixed(1)}
                                          %
                                        </div>

                                        {trainingProgress[batch.slug]
                                          .training_stage && (
                                          <div className="text-sm text-gray-700 dark:text-gray-300">
                                            Stage:{' '}
                                            <span className="font-medium capitalize">
                                              {
                                                trainingProgress[batch.slug]
                                                  .training_stage
                                              }
                                            </span>
                                          </div>
                                        )}

                                        {trainingProgress[batch.slug]
                                          .started_at && (
                                          <div className="text-xs text-gray-600 dark:text-gray-400">
                                            Started:{' '}
                                            {new Date(
                                              trainingProgress[
                                                batch.slug
                                              ].started_at!
                                            ).toLocaleString('en-GB')}
                                          </div>
                                        )}

                                        {trainingProgress[batch.slug]
                                          .estimated_completion && (
                                          <div className="text-xs text-gray-600 dark:text-gray-400">
                                            Est. completion:{' '}
                                            {new Date(
                                              trainingProgress[
                                                batch.slug
                                              ].estimated_completion!
                                            ).toLocaleString('en-GB')}
                                          </div>
                                        )}
                                      </div>

                                      {/* Loading Indicator */}
                                      <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-600"></div>
                                      </div>
                                    </div>
                                  </div>
                                ) : /* DEPLOYMENT IN PROGRESS */
                                deploymentProgress[batch.slug] &&
                                  deploymentProgress[batch.slug]
                                    .deployment_status !== 'completed' &&
                                  deploymentProgress[batch.slug]
                                    .deployment_status !== 'failed' ? (
                                  <div className="text-center py-4 px-4">
                                    <div className="space-y-3">
                                      {/* Progress Bar */}
                                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                        <div
                                          className="bg-gradient-to-r from-purple-500 to-purple-600 h-3 rounded-full transition-all duration-500"
                                          style={{
                                            width: `${
                                              deploymentProgress[batch.slug]
                                                .progress_percentage
                                            }%`,
                                          }}
                                        />
                                      </div>

                                      {/* Progress Details */}
                                      <div className="space-y-1">
                                        <div className="text-base font-semibold text-purple-600 dark:text-purple-400">
                                          Deploying Model:{' '}
                                          {deploymentProgress[
                                            batch.slug
                                          ].progress_percentage.toFixed(1)}
                                          %
                                        </div>

                                        <div className="text-sm text-gray-700 dark:text-gray-300">
                                          Status:{' '}
                                          <span className="font-medium capitalize">
                                            {getStatusMessage(
                                              deploymentProgress[batch.slug]
                                                .deployment_status
                                            )}
                                          </span>
                                        </div>

                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                          Model:{' '}
                                          {
                                            deploymentProgress[batch.slug]
                                              .model_name
                                          }{' '}
                                          v
                                          {
                                            deploymentProgress[batch.slug]
                                              .model_version
                                          }
                                        </div>

                                        {deploymentProgress[batch.slug]
                                          .started_at && (
                                          <div className="text-xs text-gray-600 dark:text-gray-400">
                                            Started:{' '}
                                            {new Date(
                                              deploymentProgress[
                                                batch.slug
                                              ].started_at!
                                            ).toLocaleString('en-GB')}
                                          </div>
                                        )}
                                      </div>

                                      {/* Loading Indicator */}
                                      <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-purple-600"></div>
                                      </div>
                                    </div>
                                  </div>
                                ) : /* BENCHMARKING IN PROGRESS */
                                benchmarkProgress[batch.slug] &&
                                  benchmarkProgress[batch.slug].status !==
                                    'completed' &&
                                  benchmarkProgress[batch.slug].status !==
                                    'failed' ? (
                                  <div className="text-center py-4 px-4">
                                    <div className="space-y-3">
                                      {/* Progress Bar */}
                                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                        <div
                                          className="bg-gradient-to-r from-orange-500 to-orange-600 h-3 rounded-full transition-all duration-500"
                                          style={{
                                            width: `${
                                              benchmarkProgress[batch.slug]
                                                .progress_percentage
                                            }%`,
                                          }}
                                        />
                                      </div>

                                      {/* Progress Details */}
                                      <div className="space-y-1">
                                        <div className="text-base font-semibold text-orange-600 dark:text-orange-400">
                                          Running Benchmarks:{' '}
                                          {benchmarkProgress[
                                            batch.slug
                                          ].progress_percentage.toFixed(1)}
                                          %
                                        </div>

                                        <div className="text-sm text-gray-700 dark:text-gray-300">
                                          Status:{' '}
                                          <span className="font-medium capitalize">
                                            {
                                              benchmarkProgress[batch.slug]
                                                .status
                                            }
                                          </span>
                                        </div>

                                        <div className="text-xs text-gray-600 dark:text-gray-400">
                                          Model:{' '}
                                          {
                                            benchmarkProgress[batch.slug]
                                              .model_name
                                          }{' '}
                                          v
                                          {
                                            benchmarkProgress[batch.slug]
                                              .model_version
                                          }
                                        </div>

                                        {benchmarkProgress[batch.slug]
                                          .started_at && (
                                          <div className="text-xs text-gray-600 dark:text-gray-400">
                                            Started:{' '}
                                            {new Date(
                                              benchmarkProgress[
                                                batch.slug
                                              ].started_at!
                                            ).toLocaleString('en-GB')}
                                          </div>
                                        )}
                                      </div>

                                      {/* Loading Indicator */}
                                      <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-orange-600"></div>
                                      </div>
                                    </div>
                                  </div>
                                ) : /* PIPELINE COMPLETED */
                                pipelineStatus[batch.slug]?.current_phase ===
                                    'completed' ||
                                  benchmarkProgress[batch.slug]?.status ===
                                    'completed' ? (
                                  <div className="py-4 px-4">
                                    {/* Success Header */}
                                    <div className="text-center mb-4">
                                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-2">
                                        <svg
                                          className="w-6 h-6 text-green-600 dark:text-green-400"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                          />
                                        </svg>
                                      </div>
                                      <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                                        Model Successfully Trained & Integrated
                                      </div>
                                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        {deploymentProgress[batch.slug]
                                          ?.model_name && (
                                          <>
                                            {
                                              deploymentProgress[batch.slug]
                                                .model_name
                                            }{' '}
                                            v
                                            {
                                              deploymentProgress[batch.slug]
                                                .model_version
                                            }{' '}
                                            is now active
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    {/* Benchmark Results Card */}
                                    {benchmarkProgress[batch.slug]?.results && (
                                      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mb-3">
                                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                                          Benchmark Results
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <div className="text-center p-2 bg-white dark:bg-gray-800 rounded">
                                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                              {(
                                                benchmarkProgress[batch.slug]
                                                  .results!.accuracy! * 100
                                              ).toFixed(1)}
                                              %
                                            </div>
                                            <div className="text-xs text-gray-500">
                                              Accuracy
                                            </div>
                                          </div>
                                          <div className="text-center p-2 bg-white dark:bg-gray-800 rounded">
                                            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                                              {(
                                                benchmarkProgress[batch.slug]
                                                  .results!.f1_score! * 100
                                              ).toFixed(1)}
                                              %
                                            </div>
                                            <div className="text-xs text-gray-500">
                                              F1 Score
                                            </div>
                                          </div>
                                          <div className="text-center p-2 bg-white dark:bg-gray-800 rounded">
                                            <div className="text-lg font-bold text-green-600 dark:text-green-400">
                                              {(
                                                benchmarkProgress[batch.slug]
                                                  .results!.precision! * 100
                                              ).toFixed(1)}
                                              %
                                            </div>
                                            <div className="text-xs text-gray-500">
                                              Precision
                                            </div>
                                          </div>
                                          <div className="text-center p-2 bg-white dark:bg-gray-800 rounded">
                                            <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                                              {(
                                                benchmarkProgress[batch.slug]
                                                  .results!.recall! * 100
                                              ).toFixed(1)}
                                              %
                                            </div>
                                            <div className="text-xs text-gray-500">
                                              Recall
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Timeline */}
                                    <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                      {trainingProgress[batch.slug]
                                        ?.completed_at && (
                                        <div className="flex items-center gap-2">
                                          <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                          Training completed:{' '}
                                          {new Date(
                                            trainingProgress[
                                              batch.slug
                                            ].completed_at!
                                          ).toLocaleString('en-GB')}
                                        </div>
                                      )}
                                      {deploymentProgress[batch.slug]
                                        ?.completed_at && (
                                        <div className="flex items-center gap-2">
                                          <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                          Deployed:{' '}
                                          {new Date(
                                            deploymentProgress[
                                              batch.slug
                                            ].completed_at!
                                          ).toLocaleString('en-GB')}
                                        </div>
                                      )}
                                      {benchmarkProgress[batch.slug]
                                        ?.completed_at && (
                                        <div className="flex items-center gap-2">
                                          <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                          Benchmarked:{' '}
                                          {new Date(
                                            benchmarkProgress[
                                              batch.slug
                                            ].completed_at!
                                          ).toLocaleString('en-GB')}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : /* REQUEST TRAINING BUTTON - Only show for draft batches */
                                batch.status === 'draft' ? (
                                  allDefectsMeetThreshold ? (
                                    <div className="flex flex-col items-center gap-2">
                                      <Button
                                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-base font-medium"
                                        onClick={() =>
                                          handleRequestTraining(batch)
                                        }
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
                                      {isCreatingDataset &&
                                        trainingBatchSlug === batch.slug &&
                                        datasetCreationStatus && (
                                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 text-center">
                                            <div className="font-medium">
                                              {getStatusMessage(
                                                datasetCreationStatus,
                                                datasetCreationStatusDisplay
                                              )}
                                            </div>
                                            {datasetProgressPercentage > 0 && (
                                              <div className="text-xs mt-1">
                                                {datasetProgressPercentage.toFixed(
                                                  1
                                                )}
                                                % complete
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
                                        Request new model training for{' '}
                                        {batch.name}
                                      </Button>
                                      <div className="text-sm text-gray-900 dark:text-gray-300 mt-2 font-medium">
                                        Not enough images
                                      </div>
                                    </div>
                                  )
                                ) : (
                                  /* Batch has status other than draft/training/completed - show status */
                                  <div className="text-center py-4">
                                    <div className="text-base text-gray-700 dark:text-gray-300">
                                      Status:{' '}
                                      <span className="font-semibold capitalize">
                                        {batch.status}
                                      </span>
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
