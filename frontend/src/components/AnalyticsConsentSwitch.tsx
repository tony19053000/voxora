import React from 'react';
import { Info } from 'lucide-react';
import { AnalyticsContext } from './AnalyticsProvider';

export default function AnalyticsConsentSwitch() {
  const { isAnalyticsOptedIn } = React.useContext(AnalyticsContext);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-gray-800 mb-2">Privacy</h3>
        <p className="text-sm text-gray-600 mb-4">
          Voxora keeps meeting recordings, transcripts, and summaries on your device by default.
        </p>
      </div>

      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div>
          <h4 className="font-semibold text-gray-800">Analytics</h4>
          <p className="text-sm text-gray-600">Disabled in this adapted build</p>
        </div>
        <div className="text-sm font-medium text-gray-500">
          {isAnalyticsOptedIn ? 'On' : 'Off'}
        </div>
      </div>

      <div className="flex items-start gap-2 p-2 bg-blue-50 rounded border border-blue-200">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-blue-700">
          <p className="mb-1">
            This adapted build does not initialize outbound analytics or telemetry.
          </p>
          <p>Review the local privacy policy in the repository for deployment-specific guidance.</p>
        </div>
      </div>
    </div>
  );
}
