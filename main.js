const { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { autoUpdater } = require('electron-updater');

// const { STAGING_URL, PRODUCTION_URL } = require('./constants')
let mainWindow;
let tray = null;
let isProductionMode = true;

// Configure auto-updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

const PRODUCTION_URL = 'https://nvision.alemeno.com';
const STAGING_URL = 'https://nvision-staging.alemeno.com';

function createWindow() {
  mainWindow = new BrowserWindow({
    frame: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  setupTray();
  registerShortcuts();

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
  });

  // mainWindow.on('minimize', (event) => {
  //   event.preventDefault();
  //   mainWindow.hide();
  // });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupTray() {
  const iconPath = app.isPackaged
    ? path.join(__dirname, 'src/assets/nvision_logo.png')
    : path.join(__dirname, 'src/assets/nvision_logo.png');

  tray = new Tray(iconPath);

  updateTrayMenu();
  tray.setToolTip('Nvision AI');

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function updateTrayMenu() {
  if (!tray) return;

  const currentEnv = getCurrentEnvironment();
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      }
    },
    {
      label: `Mode: ${currentEnv.environment}`,
      click: () => toggleEnvironment()
    },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function registerShortcuts() {
  const envToggleShortcut = globalShortcut.register('CommandOrControl+Alt+P', () => {
    toggleEnvironment();
  });

  if (!envToggleShortcut) {
    console.log('Environment toggle shortcut registration failed');
  } else {
    console.log('Environment toggle shortcut registered: Ctrl+Alt+P');
  }
}

function getCurrentEnvironment() {
  return {
    isProduction: isProductionMode,
    baseUrl: isProductionMode ? PRODUCTION_URL : STAGING_URL,
    environment: isProductionMode ? 'Production' : 'Staging'
  };
}

function toggleEnvironment() {
  isProductionMode = !isProductionMode;
  const currentEnv = getCurrentEnvironment();

  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('environment-changed', currentEnv);
  }

  updateTrayMenu();

  // Show notification
  try {
    const notification = new Notification({
      title: 'Environment Switched',
      body: `Now using ${currentEnv.environment} environment\n${currentEnv.baseUrl}`
    });
    notification.show();
  } catch (error) {
    console.error('Failed to show notification:', error);
  }
}

// IPC Handlers
ipcMain.on('toggle-environment', () => {
  toggleEnvironment();
});

ipcMain.handle('get-current-environment', () => {
  return getCurrentEnvironment();
});

ipcMain.on('set-fullscreen', (event, flag) => {
  mainWindow?.setFullScreen(flag);
});

ipcMain.on('minimize-window', () => {
  mainWindow?.minimize();
});

ipcMain.on('maximize-window', () => {
  if (mainWindow) {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  }
});

ipcMain.on('close-window', () => {
  mainWindow?.close();
});

// Handle test image saving
ipcMain.on('save-test-images', (event, imageDataArray) => {
  const savePath = path.join(app.getPath('pictures'), 'NvisionTestData');

  if (!fs.existsSync(savePath)) {
    fs.mkdirSync(savePath, { recursive: true });
  }

  const sessionId = Date.now();
  const sessionPath = path.join(savePath, `session-${sessionId}`);

  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
  }

  const savedPaths = [];
  imageDataArray.forEach((imageData, index) => {
    const filePath = path.join(sessionPath, `image-${index + 1}.png`);
    const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
    fs.writeFileSync(filePath, base64Data, 'base64');
    savedPaths.push(filePath);
  });

  event.reply('test-images-saved', savedPaths);
});

// S3 Configuration
const s3Client = new S3Client({
  endpoint: 'https://blr1.digitaloceanspaces.com',
  region: 'blr1',
  credentials: {
    accessKeyId: 'DO801GNGMDNYAUGC8JYG',
    secretAccessKey: 'AtFgGOnOMcmtOg/3gky6XXyYXzneOZ3H89e3wclzFaw'
  }
});

ipcMain.handle('upload-image', async (event, { imageData, ppid, patternName, isTestMode }) => {
  try {
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const uploadPath = isTestMode ? 'test-images' : 'production-images';
    const timestamp = Date.now();
    const fileName = `${uploadPath}/${ppid}_${patternName}_${timestamp}.png`;

    const command = new PutObjectCommand({
      Bucket: 'rlogic-images-data',
      Key: fileName,
      Body: buffer,
      ContentEncoding: 'base64',
      ContentType: 'image/png',
      ACL: 'public-read'
    });

    await s3Client.send(command);
    return `https://rlogic-images-data.blr1.digitaloceanspaces.com/${fileName}`;
  } catch (error) {
    console.error('Error uploading to DigitalOcean:', error);
    throw error;
  }
});

// Auto-updater event handlers
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
  mainWindow?.webContents.send('update-status', { status: 'checking' });
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available:', info.version);

  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Available',
    message: `A new version (${info.version}) is available!`,
    detail: 'Would you like to download it now? The app will update when you restart.',
    buttons: ['Download', 'Later'],
    defaultId: 0,
    cancelId: 1
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.downloadUpdate();
      mainWindow?.webContents.send('update-status', { status: 'downloading' });
    }
  });
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available. Current version:', info.version);
  mainWindow?.webContents.send('update-status', { status: 'not-available' });
});

autoUpdater.on('error', (err) => {
  console.error('Error in auto-updater:', err);
  mainWindow?.webContents.send('update-status', { status: 'error', error: err.message });
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log(`Download progress: ${Math.round(progressObj.percent)}%`);
  mainWindow?.webContents.send('update-status', {
    status: 'downloading',
    progress: Math.round(progressObj.percent),
    bytesPerSecond: progressObj.bytesPerSecond,
    transferred: progressObj.transferred,
    total: progressObj.total
  });
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded:', info.version);

  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: 'Update downloaded successfully!',
    detail: 'The application will restart to install the update.',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    cancelId: 1
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    } else {
      mainWindow?.webContents.send('update-status', { status: 'ready-to-install' });
    }
  });
});

// IPC handler for manual update check
ipcMain.handle('check-for-updates', async () => {
  try {
    const result = await autoUpdater.checkForUpdates();
    return { success: true, updateInfo: result?.updateInfo };
  } catch (error) {
    console.error('Error checking for updates:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler to install pending update
ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall();
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  // Check for updates on startup (after 3 seconds delay)
  if (!app.isPackaged) {
    console.log('Development mode - skipping auto-update check');
  } else {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(err => {
        console.error('Failed to check for updates:', err);
      });
    }, 3000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});