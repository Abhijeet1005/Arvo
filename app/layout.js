import './globals.css';
import { DashboardShell } from '@/components/dashboard-shell';

export const metadata = {
  title: 'Arvo — AI Support Agents',
  description: 'AI voice support agents',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <DashboardShell>{children}</DashboardShell>
      </body>
    </html>
  );
}
