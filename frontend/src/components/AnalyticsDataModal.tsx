'use client';

import React from 'react';
import { X, Shield } from 'lucide-react';

interface AnalyticsDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDisable: () => void;
}

export default function AnalyticsDataModal({
  isOpen,
  onClose,
  onConfirmDisable,
}: AnalyticsDataModalProps) {
  void onConfirmDisable;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="mx-4 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Privacy Notice</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="mb-1 font-semibold">Analytics are disabled in this build.</p>
            <p>
              Voxora keeps recordings, transcripts, and summaries on your device by default. No
              outbound analytics or telemetry are initialized in this adapted build.
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-700">
            <h3 className="mb-2 font-semibold text-gray-900">Local-first behavior</h3>
            <ul className="ml-4 space-y-1">
              <li>• Recordings are stored locally.</li>
              <li>• Meeting transcripts and summaries remain in local storage unless you configure an external provider.</li>
              <li>• External providers, if enabled, are governed by their own policies.</li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-gray-200 bg-gray-50 p-6">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
