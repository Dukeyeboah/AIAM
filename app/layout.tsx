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
  title: 'aiam - Affirmations for Your Self Actualization',
  description:
    'Generate personalized affirmations for every aspect of your life. Use AI to create custom affirmations, visualize your future self, and hear them in your own voice.',
  generator: 'v0.app',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  openGraph: {
    title: 'aiam - Affirmations for Your Self Actualization',
    description:
      'Generate personalized affirmations for every aspect of your life. Use AI to create custom affirmations, visualize your future self, and hear them in your own voice.',
    url: 'https://aiam.space',
    siteName: 'aiam',
    images: [
      {
        url: 'https://aiam.space/images/aiam_image.jpg',
        width: 1200,
        height: 630,
        alt: 'aiam - Affirmations for Your Self Actualization',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'aiam - Affirmations for Your Self Actualization',
    description:
      'Generate personalized affirmations for every aspect of your life. Use AI to create custom affirmations, visualize your future self, and hear them in your own voice.',
    images: ['https://aiam.space/images/aiam_image.jpg'],
  },
  metadataBase: new URL('https://aiam.space'),
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
