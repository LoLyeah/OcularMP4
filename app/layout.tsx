import type {Metadata} from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css'; // Global styles

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Video Encoder & Preset Studio',
  description: 'AI-assisted, hardware-accelerated, browser-based video transcoding with custom presets.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body suppressHydrationWarning className="bg-[#0F1115] text-[#D1D5DB] font-sans antialiased min-h-screen selection:bg-sky-500/30 selection:text-sky-200">
        {children}
      </body>
    </html>
  );
}
