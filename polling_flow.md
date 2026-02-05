# Frontend Polling Flow

## Overview

```
Trigger Training → Poll Training → Poll Deployment → Poll Benchmark → Done
```

---

## Step 1: Trigger Training

**Request:**
```
POST /api/self-learning/batches/batch-4/trigger_training/
```

**Response:**
```json
{
    "status": "success",
    "training_task": {
        "task_uuid": "abc-123-...",  // ← Use this to poll
        "status": "pending"
    }
}
```

---

## Step 2: Poll Training Status

**Request:**
```
GET /api/self-learning/training-tasks/abc-123-.../status/
```

**Response (In Progress):**
```json
{
    "status": "success",
    "task_uuid": "abc-123-...",
    "status": "training",
    "progress_percentage": 45,
    "deployment_task_uuid": null
}
```

**Response (Completed):**
```json
{
    "status": "success",
    "task_uuid": "abc-123-...",
    "status": "completed",
    "progress_percentage": 100,
    "deployment_task_uuid": "def-456-..."  // ← Use this to poll next
}
```

**Polling Logic:**
```javascript
// Poll every 30-60 seconds (training takes hours)
if (response.status === 'completed' && response.deployment_task_uuid) {
    // Move to deployment polling
    pollDeployment(response.deployment_task_uuid);
} else if (response.status === 'failed') {
    showError(response.error_message);
}
```

---

## Step 3: Poll Deployment Status

**Request:**
```
GET /api/self-learning/model-deployment/def-456-.../status/
```

**Response (In Progress):**
```json
{
    "status": "success",
    "task_uuid": "def-456-...",
    "deployment_status": "downloading",
    "progress_percentage": 40,
    "benchmark_task_uuid": null
}
```

**Response (Completed):**
```json
{
    "status": "success",
    "task_uuid": "def-456-...",
    "deployment_status": "completed",
    "progress_percentage": 100,
    "benchmark_task_uuid": "ghi-789-..."  // ← Use this to poll next
}
```

**Polling Logic:**
```javascript
// Poll every 10 seconds (deployment takes minutes)
if (response.deployment_status === 'completed' && response.benchmark_task_uuid) {
    // Move to benchmark polling
    pollBenchmark(response.benchmark_task_uuid);
} else if (response.deployment_status === 'failed') {
    showError(response.error_message);
}
```

---

## Step 4: Poll Benchmark Status

**Request:**
```
GET /api/self-learning/benchmarks/ghi-789-.../status/
```

**Response (In Progress):**
```json
{
    "status": "success",
    "task_uuid": "ghi-789-...",
    "status": "running",
    "progress_percentage": 60
}
```

**Response (Completed):**
```json
{
    "status": "success",
    "task_uuid": "ghi-789-...",
    "status": "completed",
    "progress_percentage": 100,
    "accuracy": 0.94,
    "f1_score": 0.92
}
```

**Polling Logic:**
```javascript
// Poll every 10 seconds
if (response.status === 'completed') {
    showSuccess('Pipeline complete!');
} else if (response.status === 'failed') {
    showError(response.error_message);
}
```

---

## Complete Polling Code

```javascript
async function runPipeline(batchSlug, trainingParams) {
    // 1. Trigger training
    const trigger = await fetch(`/api/self-learning/batches/${batchSlug}/trigger_training/`, {
        method: 'POST',
        body: JSON.stringify(trainingParams)
    });
    const { training_task } = await trigger.json();
    
    // 2. Poll training
    const deploymentTaskUuid = await pollUntilComplete(
        `/api/self-learning/training-tasks/${training_task.task_uuid}/status/`,
        'status',
        'deployment_task_uuid',
        30000  // 30s interval
    );
    
    // 3. Poll deployment
    const benchmarkTaskUuid = await pollUntilComplete(
        `/api/self-learning/model-deployment/${deploymentTaskUuid}/status/`,
        'deployment_status',
        'benchmark_task_uuid',
        10000  // 10s interval
    );
    
    // 4. Poll benchmark
    await pollUntilComplete(
        `/api/self-learning/benchmarks/${benchmarkTaskUuid}/status/`,
        'status',
        null,
        10000
    );
    
    console.log('Pipeline complete!');
}

async function pollUntilComplete(url, statusField, nextUuidField, interval) {
    while (true) {
        const response = await fetch(url).then(r => r.json());
        const status = response[statusField];
        
        if (status === 'completed') {
            return nextUuidField ? response[nextUuidField] : null;
        }
        if (status === 'failed') {
            throw new Error(response.error_message);
        }
        
        await new Promise(r => setTimeout(r, interval));
    }
}
```

---

## Alternative: Single Endpoint Polling

Use `pipeline-status` to get everything in one call:

**Request:**
```
GET /api/self-learning/batches/batch-4/pipeline-status/
```

**Response:**
```json
{
    "status": "success",
    "current_phase": "deployment",
    "training": {
        "task_uuid": "abc-123-...",
        "status": "completed",
        "progress_percentage": 100
    },
    "deployment": {
        "task_uuid": "def-456-...",
        "status": "downloading",
        "progress_percentage": 40
    },
    "benchmarking": null
}
```

This is simpler - just poll one endpoint and check `current_phase`.
