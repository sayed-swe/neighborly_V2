import { Fraunces, Instrument_Sans } from 'next/font/google';
import Providers from './providers';
import ServiceWorker from '@/components/ServiceWorker';
import { themeBootScript } from '@/lib/theme';
import './globals.css';
import './landing.css';
import './auth.css';
import './app-shell.css';
import './feed.css';
import './admin.css';
import './features.css';
import './theme.css';

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-fraunces', axes: ['opsz', 'SOFT'], display: 'swap' });
const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', display: 'swap' });

export const metadata = {
  title: { default: 'Neighborly: your neighborhood, within reach', template: '%s · Neighborly' },
  description: 'Verified neighbours, local news, help, trade, trusted services, lost & found and emergency alerts within 1–10 km of home.',
  applicationName: 'Neighborly',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport = { themeColor: '#1f4d3a', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    // data-theme is set by the boot script before hydration, so React must not complain about it
    <html lang="en" className={`${fraunces.variable} ${instrument.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <a href="#main" className="skip-link">Skip to content</a>
        <Providers>{children}</Providers>
        <ServiceWorker />
      </body>
    </html>
  );
}
