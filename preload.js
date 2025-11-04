const { contextBridge, ipcRenderer, webFrame } = require('electron');

// Zoom in with Ctrl + or Ctrl =
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
    e.preventDefault();
    webFrame.setZoomLevel(webFrame.getZoomLevel() + 1);
  }
  // Disable reload shortcuts
  if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R')) {
    e.preventDefault();
  }
  if (e.key === 'F5') {
    e.preventDefault();
  }
});

contextBridge.exposeInMainWorld('electronAPI', {
  // takeScreenshot: () => ipcRenderer.send('take-screenshot'),
  // sendScreenshotData: (imageData) => ipcRenderer.send('screenshot-taken', imageData),
  // onScreenshotSaved: (callback) => {
  //   ipcRenderer.on('screenshot-saved', (event, filePath) => callback(filePath));
  // },

  saveTestImages: (imageDataArray) => ipcRenderer.send('save-test-images', imageDataArray),
  onTestImagesSaved: (callback) => {
    ipcRenderer.on('test-images-saved', (event, filePaths) => callback(filePaths));
  },
  uploadImage: (data) => ipcRenderer.invoke('upload-image', data),

  enableFullScreen: () => ipcRenderer.send('set-fullscreen', true),
  disableFullScreen: () => ipcRenderer.send('set-fullscreen', false),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),


  // Environment switching
  toggleEnvironment: () => ipcRenderer.send('toggle-environment'),
  getCurrentEnvironment: () => ipcRenderer.invoke('get-current-environment'),
  onEnvironmentChanged: (callback) => ipcRenderer.on('environment-changed', callback),

  // Auto-updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.send('install-update'),
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (event, data) => callback(data));
  },

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});