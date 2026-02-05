# Frontend Polling Flow

## Overview

```
Trigger Training → Poll Training → Poll Deployment → Poll Benchmark → Done
```

## How Task UUIDs Flow Between Steps

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: Trigger Training                                                   │
│  POST /api/self-learning/batches/batch-4/trigger_training/                  │
│                                                                             │
│  Response contains: training_task.task_uuid ─────────────────────┐          │
└─────────────────────────────────────────────────────────────────────────────┘
                                                                   │
                                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: Poll Training Status                                               │
│  GET /api/self-learning/training-tasks/{training_task_uuid}/status/         │
│                                                                             │
│  When status="completed", response contains: deployment_task_uuid ───┐      │
└─────────────────────────────────────────────────────────────────────────────┘
                                                                       │
                                                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: Poll Deployment Status                                             │
│  GET /api/self-learning/model-deployment/{deployment_task_uuid}/status/     │
│                                                                             │
│  When status="completed", response contains: benchmark_task_uuid ─────┐     │
└─────────────────────────────────────────────────────────────────────────────┘
                                                                        │
                                                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: Poll Benchmark Status                                              │
│  GET /api/self-learning/benchmarks/{benchmark_task_uuid}/status/            │
│                                                                             │
│  When status="completed" → Pipeline finished!                               │
└─────────────────────────────────────────────────────────────────────────────┘
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
        "task_uuid": "abc-123-...",   // ◀═══ SAVE THIS for Step 2
        "status": "pending"
    }
}
```

**How to get UUID for next step:**
```javascript
const response = await triggerTraining();
const trainingTaskUuid = response.training_task.task_uuid;  // ◀═══ Use in Step 2
```

---

## Step 2: Poll Training Status

**Request:**
```
GET /api/self-learning/training-tasks/{training_task_uuid}/status/
                                       ▲
                                       └── From Step 1: response.training_task.task_uuid
```

**Response (In Progress):**
```json
{
    "status": "success",
    "task_uuid": "abc-123-...",
    "status": "training",
    "progress_percentage": 45,
    "deployment_task_uuid": null       // Not available yet
}
```

**Response (Completed):**
```json
{
    "status": "success",
    "task_uuid": "abc-123-...",
    "status": "completed",
    "progress_percentage": 100,
    "deployment_task_uuid": "def-456-..."  // ◀═══ SAVE THIS for Step 3
}
```

**How to get UUID for next step:**
```javascript
// Poll every 30-60 seconds (training takes hours)
while (true) {
    const response = await pollTrainingStatus(trainingTaskUuid);
    
    if (response.status === 'completed') {
        if (response.deployment_task_uuid) {
            const deploymentTaskUuid = response.deployment_task_uuid;  // ◀═══ Use in Step 3
            pollDeployment(deploymentTaskUuid);
            break;
        } else {
            // Deployment not created yet, keep polling
            await sleep(5000);
        }
    } else if (response.status === 'failed') {
        showError(response.error_message);
        break;
    }
    
    await sleep(30000);
}
```

---

## Step 3: Poll Deployment Status

**Request:**
```
GET /api/self-learning/model-deployment/{deployment_task_uuid}/status/
                                         ▲
                                         └── From Step 2: response.deployment_task_uuid
```

**Response (In Progress):**
```json
{
    "status": "success",
    "task_uuid": "def-456-...",
    "deployment_status": "downloading",
    "progress_percentage": 40,
    "benchmark_task_uuid": null        // Not available yet
}
```

**Response (Completed):**
```json
{
    "status": "success",
    "task_uuid": "def-456-...",
    "deployment_status": "completed",
    "progress_percentage": 100,
    "benchmark_task_uuid": "ghi-789-..."  // ◀═══ SAVE THIS for Step 4
}
```

**How to get UUID for next step:**
```javascript
// Poll every 10 seconds (deployment takes minutes)
while (true) {
    const response = await pollDeploymentStatus(deploymentTaskUuid);
    
    if (response.deployment_status === 'completed') {
        if (response.benchmark_task_uuid) {
            const benchmarkTaskUuid = response.benchmark_task_uuid;  // ◀═══ Use in Step 4
            pollBenchmark(benchmarkTaskUuid);
            break;
        } else {
            // Benchmark not created yet, keep polling
            await sleep(5000);
        }
    } else if (response.deployment_status === 'failed') {
        showError(response.error_message);
        break;
    }
    
    await sleep(10000);
}
```

---

## Step 4: Poll Benchmark Status

**Request:**
```
GET /api/self-learning/benchmarks/{benchmark_task_uuid}/status/
                                   ▲
                                   └── From Step 3: response.benchmark_task_uuid
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
while (true) {
    const response = await pollBenchmarkStatus(benchmarkTaskUuid);
    
    if (response.status === 'completed') {
        showSuccess('Pipeline complete!');
        showMetrics(response);  // accuracy, f1_score, etc.
        break;
    } else if (response.status === 'failed') {
        showError(response.error_message);
        break;
    }
    
    await sleep(10000);
}
```

---

## Complete Polling Code

```javascript
async function runPipeline(batchSlug, trainingParams) {
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: Trigger training
    // ═══════════════════════════════════════════════════════════════════════
    const trigger = await fetch(`/api/self-learning/batches/${batchSlug}/trigger_training/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trainingParams)
    });
    const triggerResponse = await trigger.json();
    
    // Extract training_task_uuid from trigger response
    const trainingTaskUuid = triggerResponse.training_task.task_uuid;
    console.log('Training started, task UUID:', trainingTaskUuid);
    
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: Poll training → Get deployment_task_uuid when completed
    // ═══════════════════════════════════════════════════════════════════════
    const deploymentTaskUuid = await pollUntilComplete(
        `/api/self-learning/training-tasks/${trainingTaskUuid}/status/`,
        'status',
        'deployment_task_uuid',  // ◀═══ This field contains the next UUID
        30000  // 30s interval (training takes hours)
    );
    console.log('Training completed, deployment task UUID:', deploymentTaskUuid);
    
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: Poll deployment → Get benchmark_task_uuid when completed
    // ═══════════════════════════════════════════════════════════════════════
    const benchmarkTaskUuid = await pollUntilComplete(
        `/api/self-learning/model-deployment/${deploymentTaskUuid}/status/`,
        'deployment_status',
        'benchmark_task_uuid',  // ◀═══ This field contains the next UUID
        10000  // 10s interval (deployment takes minutes)
    );
    console.log('Deployment completed, benchmark task UUID:', benchmarkTaskUuid);
    
    // ═══════════════════════════════════════════════════════════════════════
    // STEP 4: Poll benchmark → Done when completed
    // ═══════════════════════════════════════════════════════════════════════
    const benchmarkResult = await pollUntilComplete(
        `/api/self-learning/benchmarks/${benchmarkTaskUuid}/status/`,
        'status',
        null,  // No next step
        10000
    );
    
    console.log('Pipeline complete!');
    return benchmarkResult;
}

/**
 * Generic polling function
 * @param {string} url - Endpoint to poll
 * @param {string} statusField - Field name containing status ('status' or 'deployment_status')
 * @param {string|null} nextUuidField - Field name containing next task UUID (null if last step)
 * @param {number} interval - Polling interval in ms
 * @returns {Promise<string|object>} - Next task UUID or final response
 */
async function pollUntilComplete(url, statusField, nextUuidField, interval) {
    while (true) {
        const response = await fetch(url).then(r => r.json());
        const currentStatus = response[statusField];
        
        console.log(`Polling ${url} - Status: ${currentStatus}, Progress: ${response.progress_percentage}%`);
        
        if (currentStatus === 'completed') {
            if (nextUuidField) {
                // Return the UUID for the next step
                const nextUuid = response[nextUuidField];
                if (nextUuid) {
                    return nextUuid;
                }
                // UUID not available yet, wait and retry
                console.log(`Waiting for ${nextUuidField} to be available...`);
                await new Promise(r => setTimeout(r, 5000));
                continue;
            }
            // Last step - return full response
            return response;
        }
        
        if (currentStatus === 'failed') {
            throw new Error(response.error_message || 'Task failed');
        }
        
        // Update UI with progress
        updateProgressUI(currentStatus, response.progress_percentage);
        
        await new Promise(r => setTimeout(r, interval));
    }
}
```

---

## UUID Flow Summary Table

| Step | Endpoint | UUID Comes From | UUID Field in Response |
|------|----------|-----------------|------------------------|
| 1. Trigger | `POST .../trigger_training/` | - | `training_task.task_uuid` |
| 2. Poll Training | `GET .../training-tasks/{uuid}/status/` | Step 1 response | `deployment_task_uuid` |
| 3. Poll Deployment | `GET .../model-deployment/{uuid}/status/` | Step 2 response | `benchmark_task_uuid` |
| 4. Poll Benchmark | `GET .../benchmarks/{uuid}/status/` | Step 3 response | - (final step) |

---

## Alternative: Single Endpoint Polling (Simpler)

Instead of chaining UUIDs, poll one endpoint that returns everything:

**Request:**
```
GET /api/self-learning/batches/batch-4/pipeline-status/
```

**Response:**
```json
{
    "status": "success",
    "batch_slug": "batch-4",
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

**Simpler Polling Code:**
```javascript
async function pollPipelineStatus(batchSlug) {
    while (true) {
        const response = await fetch(
            `/api/self-learning/batches/${batchSlug}/pipeline-status/`
        ).then(r => r.json());
        
        console.log('Current phase:', response.current_phase);
        
        // Check current phase
        switch (response.current_phase) {
            case 'training':
                updateUI('Training...', response.training.progress_percentage);
                break;
            case 'deployment':
                updateUI('Deploying...', response.deployment.progress_percentage);
                break;
            case 'benchmarking':
                updateUI('Benchmarking...', response.benchmarking.progress_percentage);
                break;
            case 'completed':
                showSuccess('Pipeline complete!', response.benchmarking);
                return response;
            case 'training_failed':
            case 'deployment_failed':
            case 'benchmark_failed':
                showError(response.current_phase);
                return response;
        }
        
        await new Promise(r => setTimeout(r, 10000));
    }
}
```

**Advantage:** No need to track UUIDs between steps - just poll one endpoint and check `current_phase`.
