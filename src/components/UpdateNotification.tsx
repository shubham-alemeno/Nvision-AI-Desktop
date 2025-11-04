import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, X } from 'lucide-react';

interface UpdateStatus {
  status: 'checking' | 'not-available' | 'downloading' | 'ready-to-install' | 'error';
  progress?: number;
  error?: string;
}

/**
 * Optional component to show update status in the app UI
 *
 * Usage:
 * 1. Import in App.tsx: import UpdateNotification from './components/UpdateNotification';
 * 2. Add to your UI: <UpdateNotification />
 *
 * The component will automatically show/hide based on update status
 */
const UpdateNotification: React.FC = () => {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Listen for update status from main process
    const handleUpdateStatus = (data: UpdateStatus) => {
      setUpdateStatus(data);
      setDismissed(false);
    };

    if (window.electronAPI?.onUpdateStatus) {
      window.electronAPI.onUpdateStatus(handleUpdateStatus);
    }

    // Cleanup
    return () => {
      if (window.electronAPI?.removeAllListeners) {
        window.electronAPI.removeAllListeners('update-status');
      }
    };
  }, []);

  const handleCheckUpdate = async () => {
    if (window.electronAPI?.checkForUpdates) {
      const result = await window.electronAPI.checkForUpdates();
      console.log('Update check result:', result);
    }
  };

  const handleInstall = () => {
    if (window.electronAPI?.installUpdate) {
      window.electronAPI.installUpdate();
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  // Don't show if dismissed or no status
  if (dismissed || !updateStatus) return null;

  // Don't show "not-available" status
  if (updateStatus.status === 'not-available') return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <Card className="shadow-lg border-2">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              {updateStatus.status === 'checking' && (
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                  <div>
                    <p className="font-semibold">Checking for updates...</p>
                    <p className="text-sm text-gray-600">Please wait</p>
                  </div>
                </div>
              )}

              {updateStatus.status === 'downloading' && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Download className="w-5 h-5 text-blue-500" />
                    <p className="font-semibold">Downloading update...</p>
                  </div>
                  {updateStatus.progress !== undefined && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${updateStatus.progress}%` }}
                      />
                    </div>
                  )}
                  <p className="text-sm text-gray-600 mt-1">
                    {updateStatus.progress}% complete
                  </p>
                </div>
              )}

              {updateStatus.status === 'ready-to-install' && (
                <div>
                  <p className="font-semibold text-green-600 mb-2">
                    Update ready to install!
                  </p>
                  <p className="text-sm text-gray-600 mb-3">
                    Restart the app to apply the update.
                  </p>
                  <Button
                    onClick={handleInstall}
                    className="w-full"
                    size="sm"
                  >
                    Restart Now
                  </Button>
                </div>
              )}

              {updateStatus.status === 'error' && (
                <div>
                  <p className="font-semibold text-red-600 mb-1">
                    Update failed
                  </p>
                  <p className="text-sm text-gray-600 mb-2">
                    {updateStatus.error || 'An error occurred while checking for updates'}
                  </p>
                  <Button
                    onClick={handleCheckUpdate}
                    variant="outline"
                    size="sm"
                  >
                    Try Again
                  </Button>
                </div>
              )}
            </div>

            <button
              onClick={handleDismiss}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UpdateNotification;
