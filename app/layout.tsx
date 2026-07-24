import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-barlow',
  display: 'swap',
});

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-barlow-condensed',
  display: 'swap',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? process.env.NEXT_PUBLIC_SITE_URL
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'Free Roof Inspection — American Master Roofing (Houston, TX)',
  description:
    'Book a free roof inspection in Houston, TX. A trained inspector walks your roof, photographs every finding, and gives you a straight answer — maintenance, repair, replacement, or nothing at all.',
  robots: { index: true, follow: true },
  openGraph: {
    title: 'Free Roof Inspection — American Master Roofing',
    description:
      'A trained inspector walks your roof, photographs every finding, and gives you a straight answer. Free inspection, no obligation. Houston, TX.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#1b2a5b',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${barlow.variable} ${barlowCondensed.variable} ${plexMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
