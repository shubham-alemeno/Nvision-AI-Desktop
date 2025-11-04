# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Nvision AI is an Electron-based desktop application for automated display panel defect detection. The app captures images of LCD/display panels using various test patterns, uploads them to cloud storage, and uses AI to detect manufacturing defects. It supports three modes: Defect Checker, NTF (No Trouble Found) Checker, and Data Collection.

**Current Version**: 4.9.3

## Technology Stack

- **Framework**: Electron + React + TypeScript + Vite
- **UI**: React with Tailwind CSS and Radix UI components
- **Image Storage**: DigitalOcean Spaces (S3-compatible)
- **Error Tracking**: Sentry
- **Camera**: MediaDevices API with advanced resolution and device management

## Development Commands

### Running the Application
```bash
# Start dev server with hot reload
npm run dev

# Production build (bumps patch version)
npm run build

# Run production mode
npm start
```

### Version Management
```bash
# Bump version and build
npm run build:major   # x.0.0
npm run build:minor   # x.y.0
npm run build:patch   # x.y.z

# Bump version only (no build)
npm run version:major
npm run version:minor
npm run version:patch
```

Version bumping automatically:
- Updates package.json version
- Creates a version-specific output directory in `dist_electron/{version}/`
- Version info is stored in localStorage and cleared on updates to reset app state

## Architecture

### Electron Main Process (`main.js`)

The main process handles:
- **Window Management**: Frameless window with custom titlebar, tray integration
- **Environment Switching**: Toggle between Production/Staging via Ctrl+Alt+P or tray menu
  - Production: https://nvision.alemeno.com
  - Staging: https://nvision-staging.alemeno.com
- **Image Upload**: S3-compatible upload to DigitalOcean Spaces
- **IPC Handlers**: Window controls, image saving, environment management

Key IPC channels:
- `get-current-environment`: Returns current environment config
- `toggle-environment`: Switches between prod/staging
- `upload-image`: Uploads captured image to cloud storage
- `save-test-images`: Saves images locally for testing

### React Application (`src/`)

#### Core State Management (`App.tsx`)

The main App component manages:
- **Authentication**: Token-based auth with localStorage persistence
- **Page Navigation**: Multi-page flow (login → checker → capture → review → analysis)
- **Capture Flow**: Coordinates camera capture, upload, and defect prediction
- **Polling**: Asynchronous task polling for AI inference results (5s interval, 10 attempts max)

Important state:
- `activePage`: Current page in the app flow
- `routineType`: 'defect-checker' | 'ntf-checker' | 'data-collection'
- `uploadedImageUrls`: Array of S3 URLs for captured images
- `predictedDefects`: AI inference results
- `selectedDefects`: User-configured defect types to check

#### Camera System (`src/contexts/cameraContext.tsx`)

The CameraProvider manages camera hardware with:
- **Device Management**: Auto-detection of physical cameras (filters out OBS/virtual cameras)
- **Resolution Management**: Tests camera capabilities and provides supported resolutions
  - Presets: 4K (3840×2160), QHD (2560×1440), Full HD (1920×1080), HD (1280×720)
  - Dynamically tests each resolution with 5s timeout
- **Stream Control**: Setup, teardown, and settings adjustment (exposure, brightness, contrast)
- **Image Capture**: Canvas-based snapshot capture at full resolution

Key functions:
- `setupCamera(resolution?, deviceId?)`: Initialize camera stream
- `setResolution(resolution)`: Switch resolution on-the-fly
- `setDevice(device)`: Switch camera device
- `captureImage()`: Capture PNG snapshot
- `adjustCameraSettings(settings)`: Apply camera controls (exposure, brightness, contrast)

#### Test Patterns

15 standardized test patterns for defect detection:
- White (AAA), Black (BBB), Cyan (CCC), Gray50 (DDD), Red (EEE), Green (FFF), Blue (GGG)
- Gray75 (HHH), Gray Vertical (III), Color Bars (JJJ), Focus (KKK)
- Black with White Border (LLL), Cross Hatch (MMM), 16 Bar Gray (NNN), Black & White (OOO)

Each pattern has configurable EBC settings (Exposure, Brightness, Contrast) stored in localStorage as `patternEBC`.

#### API Service (`src/services/api.ts`)

Centralized API layer with:
- **Environment-Aware**: Automatically uses current environment (prod/staging)
- **Error Classification**: Network, authentication, validation, server errors
- **Retry Logic**: Intelligent retry for network/server errors
- **Token Management**: Automatic token refresh and logout on 401/403
- **Sentry Integration**: Automatic error reporting

Key functions:
- `createDisplayPanel(payload)`: Submit images for defect analysis
- `getTaskStatus(taskUuid)`: Poll task completion
- `retryDisplayPanel(ppid)`: Retry failed inference
- `getUserFromToken(token)`: Validate and get user data

#### Defect Types

15 configurable defect types (stored in localStorage as `selectedDefects`):
- Abnormal Display, Horizontal/Vertical Line, Horizontal/Vertical Band
- Particles, White Patch, Polariser Scratches/Dent
- Light Leakage, Mura, Incoming Border Patch
- Pixel Bright Dot, Incoming Galaxy, LED Off, Bleeding

### Page Flow

1. **Login** → Authenticate user
2. **Dashboard** → Overview and navigation hub
3. **Checker Pages** (DefectChecker/NTFChecker/DataCollection) → Start session with PPID
4. **Image Capture** (fullscreen) → Cycle through 15 test patterns
5. **Review** → Approve/retake captured images
6. **Predicted Defects** → Display AI analysis results
7. **Defect Analysis** → Manual defect confirmation (data collection mode only)

## Key Development Patterns

### Image Capture Flow

1. User enters PPID and focus distance
2. Camera enters fullscreen mode
3. For each test pattern:
   - Display pattern on screen
   - Apply pattern-specific EBC settings
   - Capture image from camera
   - Upload to S3 (parallel with next capture)
4. Exit fullscreen → Review page
5. If approved → Submit for AI inference
6. Poll for results every 5s (max 10 attempts)

### Error Handling

- All API calls use `classifyError()` for consistent error types
- Network errors show retry option
- Auth errors trigger logout
- Validation errors display field-specific messages
- All errors logged to Sentry with context tags

### Environment Management

The app can switch between Production and Staging environments:
- Triggered by Ctrl+Alt+P or tray menu
- Forces user logout on switch
- Shows notification with new environment
- State persisted in main process (not localStorage)

## Important Files

- `main.js`: Electron main process, S3 upload, IPC handlers
- `preload.js`: Context bridge for secure IPC
- `src/App.tsx`: Main application state and routing
- `src/contexts/cameraContext.tsx`: Camera hardware management
- `src/services/api.ts`: API client with error handling
- `src/components/ImageCaptureProcess.tsx`: Image capture orchestration
- `package.json`: Build config, version, dependencies

## Deployment

Built executables are placed in `dist_electron/{version}/` with version-specific folders.

The Electron Builder config targets Windows NSIS installer with product name "Nvision AI".

## Notes

- **Credentials Warning**: `main.js` contains hardcoded S3 credentials (lines 193-194). These should be moved to environment variables.
- **Version Clearing**: On version change, localStorage is completely cleared to reset app state.
- **Camera Permissions**: App requires camera access on first run. Permission errors are user-facing.
- **Fullscreen Mode**: Capture process uses native fullscreen to maximize display area for pattern detection.
