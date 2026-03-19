'use client';

import './globals.css';
import { Source_Sans_3 } from 'next/font/google';
import { ClientShell } from './client-shell';

const sourceSans3 = Source_Sans_3({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-source-sans-3',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sourceSans3.variable} font-sans antialiased`}>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
