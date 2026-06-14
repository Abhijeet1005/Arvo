import VoiceAgent from '../components/VoiceAgent';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';

export const metadata = { title: 'Test call — Arvo' };

export default function TestPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Test call" description="Start a live voice conversation with your agent, right in the browser." />
      <Card className="bg-emerald-50/40 dark:bg-emerald-500/10">
        <CardContent className="p-6">
          <VoiceAgent />
        </CardContent>
      </Card>
    </div>
  );
}
