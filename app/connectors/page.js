import ConnectorConfig from '../components/ConnectorConfig';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';

export const metadata = { title: 'Connectors — Arvo' };

export default function ConnectorsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Connectors" description="Connect a data source so the agent answers with live orders, tickets, and more." />
      <Card>
        <CardContent className="p-6">
          <ConnectorConfig />
        </CardContent>
      </Card>
    </div>
  );
}
