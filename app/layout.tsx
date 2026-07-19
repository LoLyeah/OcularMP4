import type {Metadata} from 'next';
import '@fontsource-variable/manrope';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'OcularMP4 — Private media conversion',
  description: 'A private, browser-native video and audio converter with bilingual presets and offline support.',
  metadataBase: new URL(process.env.APP_URL || 'https://ocularmp4-studio.warrant-kilter-6g.chatgpt.site'),
  manifest: '/manifest.json',
  icons: {
    icon: [{url: '/favicon.svg', type: 'image/svg+xml'}],
    shortcut: '/favicon.svg',
    apple: '/icon-192.svg',
  },
  openGraph: {
    title: 'OcularMP4 — Private media conversion',
    description: 'Batch queue, AI presets, and offline-ready local media conversion.',
    type: 'website',
    images: [{ url: '/og-v1.png', width: 1200, height: 630, alt: 'OcularMP4 private local media conversion' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OcularMP4 — Private media conversion',
    description: 'Batch queue, AI presets, and offline-ready local media conversion.',
    images: ['/og-v1.png'],
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" data-theme="dark" data-motion="system">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
