import KnowledgeUpload from '../components/KnowledgeUpload';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';

export const metadata = { title: 'Knowledge base — Arvo' };

export default function KnowledgePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Knowledge base" description="Upload documents or paste text — the agent answers from it." />
      <Card>
        <CardContent className="p-6">
          <KnowledgeUpload />
        </CardContent>
      </Card>
    </div>
  );
}
