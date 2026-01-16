import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

import { SessionProvider } from '@/components/providers/SessionProvider';
import MobileScrollFix from '@/components/layout/MobileScrollFix';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'Clevio LMS',
  description: 'Learning management system for Clevio Admin, Coach, and Coder roles.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <MobileScrollFix />
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
