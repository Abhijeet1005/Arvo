import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/page-header';

export const metadata = { title: 'Settings — Arvo' };

function Row({ label, value, note }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {note && <div className="text-xs text-muted-foreground">{note}</div>}
      </div>
      <div className="shrink-0 text-sm">{value}</div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Workspace and account settings." />

      <Card>
        <CardContent className="space-y-3 p-6">
          <Row label="Product name" value="Arvo" />
          <Row label="Plan" value={<Badge variant="secondary">Free · testing</Badge>} note="Move to a paid plan before serving real clients." />
          <Row label="Voice engine" value={<Badge variant="success">Connected</Badge>} note="Configured securely on the server." />
          <Row label="Phone number" value={<Badge variant="secondary">Not connected</Badge>} note="Connect Twilio / Exotel to take real calls." />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-sm font-semibold">Accounts & teams</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Login, multiple workspaces, and per-client data isolation are planned — see <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">PLAN.md</code> for the authentication and data-source roadmap.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
