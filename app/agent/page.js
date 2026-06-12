import AgentConfig from '../components/AgentConfig';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';

export const metadata = { title: 'Agent — Arvo' };

export default function AgentPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Agent" description="Configure how your agent sounds and behaves." />
      <Card>
        <CardContent className="p-6">
          <AgentConfig />
        </CardContent>
      </Card>
    </div>
  );
}
