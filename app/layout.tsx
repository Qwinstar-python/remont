import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-sans',
  display: 'swap'
});

const playfair = Playfair_Display({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-serif',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap'
});

export const metadata: Metadata = {
  title: {
    default: 'RE:FORM — брендовый ресейл',
    template: '%s — RE:FORM'
  },
  description:
    'Магазин брендовой одежды RE:FORM: оригинальные вещи, честное описание состояния, проверка подлинности и доставка по России.',
  applicationName: 'RE:FORM',
  keywords: [
    'брендовая одежда',
    'ресейл',
    'Stone Island',
    'Carhartt',
    'The North Face',
    'интернет-магазин'
  ],
  openGraph: {
    title: 'RE:FORM — брендовый ресейл',
    description:
      'Оригинальные брендовые вещи с честным описанием состояния и проверкой подлинности.',
    type: 'website',
    locale: 'ru_RU',
    siteName: 'RE:FORM'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RE:FORM — брендовый ресейл',
    description:
      'Оригинальные брендовые вещи с честным описанием состояния и проверкой подлинности.'
  },
  robots: {
    index: true,
    follow: true
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F6F4EF'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
