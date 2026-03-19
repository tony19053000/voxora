import React, { useEffect, useState } from "react";
import { getVersion } from '@tauri-apps/api/app';
import Image from 'next/image';
import AnalyticsConsentSwitch from "./AnalyticsConsentSwitch";

export function About() {
    const [currentVersion, setCurrentVersion] = useState<string>('0.3.0');

    useEffect(() => {
        getVersion().then(setCurrentVersion).catch(console.error);
    }, []);

    return (
        <div className="p-4 space-y-4 h-[80vh] overflow-y-auto">
            <div className="text-center">
                <div className="mb-3">
                    <Image
                        src="/icon_128x128.png"
                        alt="Voxora logo"
                        width={64}
                        height={64}
                        className="mx-auto"
                    />
                </div>
                <h1 className="text-xl font-semibold text-gray-900">Voxora</h1>
                <span className="text-sm text-gray-500"> v{currentVersion}</span>
                <p className="text-medium text-gray-600 mt-1">
                    Record, transcribe, and summarize meetings locally.
                </p>
            </div>

            <div className="space-y-3">
                <h2 className="text-base font-semibold text-gray-800">What makes Voxora useful</h2>
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 rounded p-3 hover:bg-gray-100 transition-colors">
                        <h3 className="font-bold text-sm text-gray-900 mb-1">Privacy-first</h3>
                        <p className="text-xs text-gray-600 leading-relaxed">Meeting data stays on your machine unless you choose an external provider.</p>
                    </div>
                    <div className="bg-gray-50 rounded p-3 hover:bg-gray-100 transition-colors">
                        <h3 className="font-bold text-sm text-gray-900 mb-1">Flexible models</h3>
                        <p className="text-xs text-gray-600 leading-relaxed">Use local models or connect a compatible API without changing your workflow.</p>
                    </div>
                    <div className="bg-gray-50 rounded p-3 hover:bg-gray-100 transition-colors">
                        <h3 className="font-bold text-sm text-gray-900 mb-1">Local-first</h3>
                        <p className="text-xs text-gray-600 leading-relaxed">Run core meeting capture and transcription locally with minimal setup changes.</p>
                    </div>
                    <div className="bg-gray-50 rounded p-3 hover:bg-gray-100 transition-colors">
                        <h3 className="font-bold text-sm text-gray-900 mb-1">Desktop-ready</h3>
                        <p className="text-xs text-gray-600 leading-relaxed">Built for recording, reviewing, and exporting meetings in one desktop app.</p>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 rounded p-3">
                <p className="text-sm text-blue-800">
                    Voxora is configured for local-first use. Automatic update delivery and external support endpoints are disabled in this adapted build.
                </p>
            </div>

            <div className="pt-2 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-400">
                    Adapted desktop build with preserved upstream licensing.
                </p>
            </div>

            <AnalyticsConsentSwitch />
        </div>
    );
}
