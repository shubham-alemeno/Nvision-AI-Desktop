/// <reference types="vite/client" />

interface UpdateStatusData {
  status: 'checking' | 'not-available' | 'downloading' | 'ready-to-install' | 'error';
  progress?: number;
  bytesPerSecond?: number;
  transferred?: number;
  total?: number;
  error?: string;
}

interface ElectronAPI {
  saveTestImages: (imageDataArray: string[]) => void;
  onTestImagesSaved: (callback: (filePaths: string[]) => void) => void;
  uploadImage: (data: { imageData: string; ppid: string; patternName: string; isTestMode: boolean }) => Promise<string>;
  enableFullScreen: () => void;
  disableFullScreen: () => void;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  toggleEnvironment: () => void;
  getCurrentEnvironment: () => Promise<{ isProduction: boolean; baseUrl: string; environment: string }>;
  onEnvironmentChanged: (callback: (event: any, data: any) => void) => void;
  checkForUpdates: () => Promise<{ success: boolean; updateInfo?: any; error?: string }>;
  installUpdate: () => void;
  onUpdateStatus: (callback: (data: UpdateStatusData) => void) => void;
  removeAllListeners: (channel: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
