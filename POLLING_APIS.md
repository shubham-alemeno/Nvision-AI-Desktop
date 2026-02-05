# NVision Training Pipeline - Polling APIs Documentation

## Overview

This document lists all the APIs you can use to poll the status of each step in the training pipeline:

1. **Dataset Creation** → 2. **Model Training** → 3. **Model Deployment** → 4. **Model Benchmarking**

---

## 1. Trigger Training Flow

### Trigger Training for a Batch

```
POST /api/self-learning/batches/{batch_slug}/trigger_training/
```

**Request Body:**
```json
{
    "dataset_task_id": "uuid-of-dataset-creation-task",
    "model_type": "object_detection",
    "edge_model_type": "MOBILE_TF_VERSATILE_1",
    "training_budget_hours": 8,
    "training_parameters": {}
}
```

**Note:** `model_display_name` will be auto-generated as `multi_label_model_batch{N}` if not provided.

**Response:**
```json
{
    "status": "success",
    "message": "Training triggered for batch: Batch-4",
    "training_task": {
        "task_uuid": "abc123-def456-...",
        "model_display_name": "multi_label_model_batch4",
        "status": "pending",
        "dataset_task_uuid": "xyz789-...",
        ...
    }
}
```

---

## 2. Polling APIs for Each Step

### Step 1: Dataset Creation Task Status

**Option A - ViewSet Retrieve (Full Details):**
```
GET /api/self-learning/dataset-creation/tasks/{task_uuid}/
```

**Response:**
```json
{
    "task_uuid": "abc123-...",
    "dataset_name": "dataset_batch4_v1",
    "status": "uploading_images",
    "progress_percentage": 45.5,
    "total_images": 1000,
    "processed_images": 455,
    "vertex_dataset_id": null,
    "gcs_bucket": "nvision-bucket",
    "gcs_folder_path": "datasets/dataset_batch4_v1_20260115_120000",
    "created_at": "2026-01-15T10:00:00Z",
    "updated_at": "2026-01-15T10:05:00Z",
    "completed_at": null,
    "error_message": null
}
```

**Option B - Lightweight Status Endpoint:**
```
GET /api/self-learning/dataset-creation/{task_uuid}/status/
```

**Status Values:**
- `pending` - Task created, waiting to start
- `preparing` - Preparing data for upload
- `uploading_images` - Uploading images to GCS
- `creating_annotations` - Creating annotation JSONL
- `importing_to_vertex` - Importing to Vertex AI
- `completed` - Successfully completed
- `failed` - Failed with error
- `cancelled` - Cancelled by user

---

### Step 2: Model Training Task Status

**Option A - ViewSet Retrieve (Full Details):**
```
GET /api/self-learning/model-training/{task_uuid}/
```

**Option B - Lightweight Status Endpoint (Recommended for Polling):**
```
GET /api/self-learning/model-training/{task_uuid}/status/
```

**Response:**
```json
{
    "status": "success",
    "task_uuid": "abc123-...",
    "model_display_name": "multi_label_model_batch4",
    "task_status": "training",
    "progress_percentage": 65.0,
    "progress_detail": {
        "stage": "training",
        "message": "Model training in progress"
    },
    "training_pipeline_id": "projects/.../trainingPipelines/123",
    "model_id": null,
    "created_at": "2026-01-15T10:30:00Z",
    "started_at": "2026-01-15T10:31:00Z",
    "completed_at": null,
    "error_message": null
}
```

**Status Values:**
- `pending` - Task created, waiting to start
- `preparing` - Preparing training configuration
- `training` - Training in progress on Vertex AI
- `evaluating` - Model evaluation in progress
- `deploying` - (Legacy) Deploying to endpoint
- `completed` - Training completed successfully
- `failed` - Training failed
- `cancelled` - Training cancelled

---

### Step 3: Model Deployment Task Status

```
GET /api/self-learning/model-deployment/{task_uuid}/status/
```

**Response:**
```json
{
    "status": "success",
    "task_uuid": "def456-...",
    "model_name": "multi_label_model_batch4",
    "model_version": 3,
    "deployment_status": "updating_config",
    "progress_percentage": 70.0,
    "local_model_path": "/tf_serving/tf_models/multi_label_model_batch4/3",
    "gcs_model_uri": "gs://nvision-bucket/exports/...",
    "created_at": "2026-01-15T14:00:00Z",
    "started_at": "2026-01-15T14:01:00Z",
    "completed_at": null,
    "error_message": null,
    "deployment_summary": {}
}
```

**Status Values:**
- `pending` - Task created, waiting to start
- `downloading` - Downloading model from GCS
- `extracting` - Extracting model artifacts
- `updating_config` - Updating TF Serving config
- `updating_mappings` - Updating model mappings
- `completed` - Deployment completed successfully
- `failed` - Deployment failed
- `cancelled` - Deployment cancelled

---

### Step 4: Model Benchmark Task Status

**Option A - ViewSet Retrieve (Full Details):**
```
GET /api/self-learning/model-benchmark/{task_uuid}/
```

**Option B - Lightweight Status Endpoint (Recommended for Polling):**
```
GET /api/self-learning/model-benchmark/{task_uuid}/status/
```

**Response:**
```json
{
    "task_uuid": "ghi789-...",
    "model_name": "multi_label_model_batch4",
    "model_version": 3,
    "status": "running",
    "progress_percentage": 45.0,
    "created_at": "2026-01-15T15:00:00Z",
    "started_at": "2026-01-15T15:01:00Z",
    "completed_at": null
}
```

**Full Results (when completed):**
```
GET /api/self-learning/model-benchmark/{task_uuid}/results/
```

**Response:**
```json
{
    "status": "success",
    "benchmark": {
        "task_uuid": "ghi789-...",
        "model_name": "multi_label_model_batch4",
        "model_version": 3,
        "status": "completed",
        "accuracy": 0.92,
        "precision": 0.89,
        "recall": 0.94,
        "f1_score": 0.91,
        "avg_inference_latency": 45.2,
        "per_class_metrics": {
            "scratch": {"precision": 0.90, "recall": 0.92, "f1": 0.91},
            "crack": {"precision": 0.88, "recall": 0.95, "f1": 0.91}
        },
        "total_test_images": 500
    },
    "summary": {...}
}
```

**Status Values:**
- `pending` - Task created, waiting to start
- `running` - Benchmarking in progress
- `completed` - Benchmarking completed
- `failed` - Benchmarking failed
- `cancelled` - Benchmarking cancelled

---

## 3. Batch Training Progress (Alternative)

You can also poll the batch directly to get training progress:

```
GET /api/self-learning/batches/{batch_slug}/training-progress/
```

**Response:**
```json
{
    "batch_uuid": "batch-uuid-...",
    "batch_name": "Batch-4",
    "batch_status": "training",
    "training_progress_percentage": 65.0,
    "training_stage": "training",
    "training_started_at": "2026-01-15T10:31:00Z",
    "training_completed_at": null,
    "estimated_completion_time": "2026-01-15T18:31:00Z",
    "current_training_task_uuid": "abc123-...",
    "elapsed_time_hours": 4.5,
    "estimated_remaining_hours": 3.5,
    "training_task": {
        "task_uuid": "abc123-...",
        "model_display_name": "multi_label_model_batch4",
        "status": "training",
        "progress_percentage": 65.0,
        ...
    }
}
```

---

## 4. Complete Polling Flow Example

```javascript
// Frontend polling example

async function pollTrainingProgress(batchSlug, trainingTaskUuid) {
    const pollInterval = 30000; // 30 seconds
    
    // Poll until completed or failed
    while (true) {
        // Poll training status
        const response = await fetch(
            `/api/self-learning/model-training/${trainingTaskUuid}/status/`
        );
        const data = await response.json();
        
        console.log(`Training Progress: ${data.progress_percentage}%`);
        console.log(`Status: ${data.task_status}`);
        
        if (data.task_status === 'completed') {
            console.log('Training completed! Model ID:', data.model_id);
            
            // Now poll for deployment
            return pollDeploymentStatus(trainingTaskUuid);
        }
        
        if (data.task_status === 'failed') {
            console.error('Training failed:', data.error_message);
            return null;
        }
        
        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
}

async function pollDeploymentStatus(trainingTaskUuid) {
    const pollInterval = 10000; // 10 seconds
    
    // Get deployment task UUID first
    const deployments = await fetch(
        `/api/self-learning/model-deployment/list/?training_task_uuid=${trainingTaskUuid}`
    );
    const deploymentsData = await deployments.json();
    
    if (deploymentsData.deployments.length === 0) {
        // Wait for deployment to be created
        await new Promise(resolve => setTimeout(resolve, 5000));
        return pollDeploymentStatus(trainingTaskUuid);
    }
    
    const deploymentTaskUuid = deploymentsData.deployments[0].task_uuid;
    
    while (true) {
        const response = await fetch(
            `/api/self-learning/model-deployment/${deploymentTaskUuid}/status/`
        );
        const data = await response.json();
        
        console.log(`Deployment Progress: ${data.progress_percentage}%`);
        console.log(`Status: ${data.deployment_status}`);
        
        if (data.deployment_status === 'completed') {
            console.log('Deployment completed!');
            return pollBenchmarkStatus(deploymentTaskUuid);
        }
        
        if (data.deployment_status === 'failed') {
            console.error('Deployment failed:', data.error_message);
            return null;
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
}

async function pollBenchmarkStatus(deploymentTaskUuid) {
    const pollInterval = 10000; // 10 seconds
    
    // Get benchmark task for this deployment
    const benchmarks = await fetch(
        `/api/self-learning/model-benchmark/?status=running`
    );
    const benchmarksData = await benchmarks.json();
    
    const benchmark = benchmarksData.find(b => 
        b.deployment_task_uuid === deploymentTaskUuid
    );
    
    if (!benchmark) {
        // Wait for benchmark to be created
        await new Promise(resolve => setTimeout(resolve, 5000));
        return pollBenchmarkStatus(deploymentTaskUuid);
    }
    
    const benchmarkTaskUuid = benchmark.task_uuid;
    
    while (true) {
        const response = await fetch(
            `/api/self-learning/model-benchmark/${benchmarkTaskUuid}/status/`
        );
        const data = await response.json();
        
        console.log(`Benchmark Progress: ${data.progress_percentage}%`);
        console.log(`Status: ${data.status}`);
        
        if (data.status === 'completed') {
            // Get full results
            const results = await fetch(
                `/api/self-learning/model-benchmark/${benchmarkTaskUuid}/results/`
            );
            return await results.json();
        }
        
        if (data.status === 'failed') {
            console.error('Benchmark failed:', data.error_message);
            return null;
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
}

// Usage
pollTrainingProgress('batch-4', 'training-task-uuid')
    .then(results => {
        if (results) {
            console.log('Pipeline completed successfully!');
            console.log('Benchmark Results:', results);
        }
    });
```

---

## 5. Naming Convention Summary

| Entity | Naming Format | Example |
|--------|--------------|---------|
| Dataset Name | `dataset_batch{N}_v{version}` | `dataset_batch4_v3` |
| Model Display Name | `multi_label_model_batch{N}` | `multi_label_model_batch4` |
| TF Serving Model Path | `/tf_serving/tf_models/multi_label_model_batch{N}/{version}/` | `/tf_serving/tf_models/multi_label_model_batch4/3/` |

---

## 6. Task Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BATCH                                          │
│  uuid: batch-4-uuid                                                        │
│  name: "Batch-4"                                                           │
│  status: "training"                                                        │
└─────────────┬───────────────────────────────────────────────────────────────┘
              │
              │ has many
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DATASET CREATION TASK                                 │
│  task_uuid: dataset-task-uuid                                              │
│  dataset_name: "dataset_batch4_v1"                                         │
│  batch: batch-4-uuid  ←─────────────── MAPPING                             │
│  status: "completed"                                                       │
│  vertex_dataset_id: "projects/.../datasets/123"                            │
└─────────────┬───────────────────────────────────────────────────────────────┘
              │
              │ referenced by
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MODEL TRAINING TASK                                   │
│  task_uuid: training-task-uuid                                             │
│  model_display_name: "multi_label_model_batch4"                            │
│  batch: batch-4-uuid  ←─────────────── MAPPING                             │
│  dataset_task: dataset-task-uuid  ←─── MAPPING                             │
│  status: "completed"                                                       │
│  model_id: "projects/.../models/456"                                       │
└─────────────┬───────────────────────────────────────────────────────────────┘
              │
              │ triggers
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MODEL DEPLOYMENT TASK                                 │
│  task_uuid: deployment-task-uuid                                           │
│  model_name: "multi_label_model_batch4"                                    │
│  model_version: 3                                                          │
│  training_task: training-task-uuid  ←── MAPPING                            │
│  batch: batch-4-uuid  ←─────────────── MAPPING                             │
│  status: "completed"                                                       │
└─────────────┬───────────────────────────────────────────────────────────────┘
              │
              │ triggers
              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MODEL BENCHMARK                                     │
│  task_uuid: benchmark-task-uuid                                            │
│  model_name: "multi_label_model_batch4"                                    │
│  model_version: 3                                                          │
│  deployment_task: deployment-task-uuid  ←── MAPPING                        │
│  batch: batch-4-uuid  ←─────────────────── MAPPING                         │
│  status: "completed"                                                       │
│  accuracy: 0.92, f1_score: 0.91                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

All mappings now properly maintained end-to-end!
