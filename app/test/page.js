import VoiceAgent from '../components/VoiceAgent';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';

export const metadata = { title: 'Test call — Arvo' };

export default function TestPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Test call" description="Start a live voice conversation with your agent, right in the browser." />
      <Card className="bg-gradient-to-b from-indigo-50/40 to-white">
        <CardContent className="p-6">
          <VoiceAgent />
        </CardContent>
      </Card>
    </div>
  );
}
