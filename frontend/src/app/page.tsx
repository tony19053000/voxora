'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { WebMVP } from './_components/WebMVP';

const DesktopHome = dynamic(
  () => import('./_components/DesktopHome').then((module) => module.DesktopHome),
  { ssr: false }
);

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export default function Home() {
  const [isTauri, setIsTauri] = useState<boolean | null>(null);

  useEffect(() => {
    setIsTauri(Boolean(window.__TAURI_INTERNALS__));
  }, []);

  if (isTauri === null) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  return isTauri ? <DesktopHome /> : <WebMVP />;
}
