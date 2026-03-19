import { useCallback, useEffect, useState } from 'react';
import { updateService, UpdateInfo } from '@/services/updateService';

interface UseUpdateCheckOptions {
  checkOnMount?: boolean;
  showNotification?: boolean;
  onUpdateAvailable?: (info: UpdateInfo) => void;
}

export function useUpdateCheck(options: UseUpdateCheckOptions = {}) {
  const { checkOnMount = false, onUpdateAvailable } = options;
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkForUpdates = useCallback(async (_force = false) => {
    setIsChecking(true);
    const info = await updateService.checkForUpdates(false);
    setUpdateInfo(info);
    setIsChecking(false);
    if (onUpdateAvailable && info.available) {
      onUpdateAvailable(info);
    }
  }, [onUpdateAvailable]);

  useEffect(() => {
    if (checkOnMount) {
      void checkForUpdates(false);
      return;
    }
    setIsChecking(false);
  }, [checkOnMount, checkForUpdates]);

  return {
    updateInfo,
    isChecking,
    checkForUpdates,
  };
}
