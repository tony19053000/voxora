export interface AnalyticsProperties {
  [key: string]: string;
}

export interface DeviceInfo {
  platform: string;
  os_version: string;
  architecture: string;
}

export interface UserSession {
  session_id: string;
  user_id: string;
  start_time: string;
  last_heartbeat: string;
  is_active: boolean;
}

export class Analytics {
  private static currentUserId: string | null = null;

  static async init(): Promise<void> {}

  static async disable(): Promise<void> {
    this.currentUserId = null;
  }

  static async isEnabled(): Promise<boolean> {
    return false;
  }

  static async track(_eventName: string, _properties?: AnalyticsProperties): Promise<void> {}

  static async identify(userId: string, _properties?: AnalyticsProperties): Promise<void> {
    this.currentUserId = userId;
  }

  static async startSession(userId: string): Promise<string | null> {
    this.currentUserId = userId;
    return `disabled_${Date.now()}`;
  }

  static async endSession(): Promise<void> {}

  static async trackDailyActiveUser(): Promise<void> {}

  static async trackUserFirstLaunch(): Promise<void> {}

  static async isSessionActive(): Promise<boolean> {
    return false;
  }

  static async getPersistentUserId(): Promise<string> {
    if (typeof window === 'undefined') {
      return 'user_disabled';
    }

    const existing = window.sessionStorage.getItem('voxora_user_id');
    if (existing) {
      this.currentUserId = existing;
      return existing;
    }

    const userId = `user_${Date.now()}`;
    window.sessionStorage.setItem('voxora_user_id', userId);
    this.currentUserId = userId;
    return userId;
  }

  static async checkAndTrackFirstLaunch(): Promise<void> {}

  static async checkAndTrackDailyUsage(): Promise<void> {}

  static getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  static async getDeviceInfo(): Promise<DeviceInfo> {
    const platform = typeof navigator === 'undefined' ? 'unknown' : navigator.platform || 'unknown';
    return {
      platform,
      os_version: platform,
      architecture: 'unknown',
    };
  }

  static async trackSessionStarted(_sessionId: string): Promise<void> {}

  static async trackSessionEnded(_sessionId: string): Promise<void> {}

  static async cleanup(): Promise<void> {}

  static async trackAppStarted(): Promise<void> {}

  static async trackPageView(_pageName: string): Promise<void> {}

  static async trackButtonClick(_buttonName: string, _location?: string): Promise<void> {}

  static async trackFeatureUsed(_featureName: string): Promise<void> {}

  static async trackBackendConnection(_success: boolean, _errorType?: string): Promise<void> {}

  static async trackError(_errorType: string, _errorMessage?: string): Promise<void> {}

  static async trackMeetingDeleted(_meetingId: string): Promise<void> {}

  static async trackSettingsChanged(_settingType: string, _newValue: string): Promise<void> {}

  static async trackCopy(_contentType: string, _properties?: AnalyticsProperties): Promise<void> {}

  static async trackMeetingCompleted(_meetingId: string, _properties?: AnalyticsProperties): Promise<void> {}

  static async updateMeetingCount(): Promise<void> {}

  static async getMeetingsCountToday(): Promise<number> {
    return 0;
  }

  static async calculateDaysSince(_key: string): Promise<number> {
    return 0;
  }

  static async trackTranscriptionError(_errorType: string, _details?: string): Promise<void> {}

  static async trackTranscriptionSuccess(_provider: string, _duration?: number): Promise<void> {}

  static async trackSummaryGenerationStarted(_modelProvider: string, _modelName: string, _transcriptLength: number): Promise<void> {}

  static async trackSummaryGenerationCompleted(
    _modelProvider: string,
    _modelName: string,
    _success: boolean,
    _durationSeconds?: number,
    _errorMessage?: string
  ): Promise<void> {}

  static async trackSummaryRegenerated(_modelProvider: string, _modelName: string): Promise<void> {}

  static async trackModelChanged(_oldProvider: string, _oldModel: string, _newProvider: string, _newModel: string): Promise<void> {}

  static async trackCustomPromptUsed(_promptLength: number): Promise<void> {}
}

export default Analytics;
