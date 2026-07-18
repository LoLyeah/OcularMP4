import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'OcularMP4 — Private media conversion',
  description: 'A private, browser-native video and audio converter with bilingual presets and offline support.',
  manifest: '/manifest.json',
  icons: {
    icon: [{url: '/favicon.svg', type: 'image/svg+xml'}],
    shortcut: '/favicon.svg',
    apple: '/icon-192.svg',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" data-theme="dark" data-motion="system">
      <body suppressHydrationWarning className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
