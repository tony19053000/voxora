'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import 'sonner/dist/styles.css';

const DesktopShell = dynamic(
  () => import('./desktop-shell').then((module) => module.DesktopShell),
  { ssr: false }
);

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function ClientShell({ children }: { children: React.ReactNode }) {
  const [isTauri, setIsTauri] = useState<boolean | null>(null);

  useEffect(() => {
    setIsTauri(Boolean(window.__TAURI_INTERNALS__));
  }, []);

  useEffect(() => {
    if (isTauri === null) {
      return;
    }

    document.body.style.overflow = isTauri ? 'hidden' : 'auto';
    document.body.style.height = isTauri ? '100%' : 'auto';

    return () => {
      document.body.style.overflow = '';
      document.body.style.height = '';
    };
  }, [isTauri]);

  return (
    <>
      {isTauri ? <DesktopShell>{children}</DesktopShell> : children}
      <Toaster position="bottom-center" richColors closeButton />
    </>
  );
}
