import type { Update } from '@tauri-apps/plugin-updater';
import { getVersion } from '@tauri-apps/api/app';

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  version?: string;
  date?: string;
  body?: string;
  downloadUrl?: string;
}

export interface UpdateProgress {
  downloaded: number;
  total: number;
  percentage: number;
}

export class UpdateService {
  private lastCheckTime: number | null = null;
  private readonly CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

  async checkForUpdates(force = false): Promise<UpdateInfo> {
    if (!force && this.lastCheckTime) {
      const timeSinceLastCheck = Date.now() - this.lastCheckTime;
      if (timeSinceLastCheck < this.CHECK_INTERVAL_MS) {
        return {
          available: false,
          currentVersion: await getVersion(),
        };
      }
    }

    this.lastCheckTime = Date.now();
    return {
      available: false,
      currentVersion: await getVersion(),
    };
  }

  async downloadAndInstall(
    _update: Update,
    onProgress?: (progress: UpdateProgress) => void
  ): Promise<void> {
    onProgress?.({ downloaded: 0, total: 0, percentage: 0 });
  }

  async getCurrentVersion(): Promise<string> {
    return getVersion();
  }

  wasCheckedRecently(): boolean {
    if (!this.lastCheckTime) return false;
    const timeSinceLastCheck = Date.now() - this.lastCheckTime;
    return timeSinceLastCheck < this.CHECK_INTERVAL_MS;
  }
}

// Export singleton instance
export const updateService = new UpdateService();
