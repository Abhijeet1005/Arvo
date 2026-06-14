import './globals.css';
import { Inter } from 'next/font/google';
import { DashboardShell } from '@/components/dashboard-shell';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata = {
  title: 'Arvo — AI Support Agents',
  description: 'AI voice support agents',
};

// Set the theme class before paint to avoid a flash of the wrong theme.
const themeScript = `
try {
  var t = localStorage.getItem('theme');
  if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
} catch (e) {}
`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  );
}
