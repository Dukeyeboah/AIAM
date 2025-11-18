import type React from 'react';
import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';
import { AuthProvider } from '@/providers/auth-provider';
import { AuthModalProvider } from '@/providers/auth-modal-provider';
import { AppShell } from '@/components/app-shell';

const geist = Geist({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'aiam - Daily Affirmations for Your Soul',
  description:
    'Generate personalized affirmations for every aspect of your life',
  generator: 'v0.app',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <body className={`${geist.className} font-sans antialiased`}>
        <AuthProvider>
          <AuthModalProvider>
            <AppShell>{children}</AppShell>
            <Toaster />
            <Analytics />
          </AuthModalProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
