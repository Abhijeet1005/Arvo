'use client';

// LinkedIn: notes the operator sends by hand (LinkedIn has no messaging API,
// and automating it gets accounts restricted), and post drafts for the
// operator's own profile from the weekly review.
import { useState } from 'react';
import { Check, ExternalLink, LoaderCircle, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { relativeTime } from '@/lib/demos/ui';
import { cn } from '@/lib/utils';
import { api, CopyButton, Empty, InMark, SectionTitle, StageBadge } from './shared';

function Note({ p, reload }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function markSent() {
    setBusy(true);
    try {
      await api(`/api/autopilot/prospects/${p.id}`, { method: 'PATCH', body: { action: 'linkedin_sent' } });
      await reload();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{p.name}</span>
            <StageBadge stage={p.stage} />
          </div>
        </div>
        <p className="rounded-lg bg-secondary/60 p-3 text-sm">{p.note}</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <CopyButton value={p.note} label="Copy note" />
          <a href={p.linkedin} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-xs font-semibold hover:border-emerald-400">
            <InMark /> Open profile <ExternalLink className="size-3.5" />
          </a>
          <Button size="sm" variant="ghost" onClick={markSent} disabled={busy}>
            {busy ? <LoaderCircle className="animate-spin" /> : <Check />} Mark sent
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Post({ post, reload }) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      await api('/api/autopilot/posts', { method: 'PATCH', body: { id: post.id, used: !post.used } });
      await reload();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className={cn(post.used && 'opacity-60')}>
      <CardContent className="space-y-3 p-4">
        <p className="whitespace-pre-line text-sm">{post.text}</p>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton value={post.text} label="Copy post" />
          <Button size="sm" variant="ghost" onClick={toggle} disabled={busy}>
            <Check /> {post.used ? 'Posted' : 'Mark posted'}
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">{relativeTime(post.at)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LinkedinQueue({ view, reload }) {
  return (
    <div className="space-y-8">
      <section>
        <SectionTitle>Connection notes to send</SectionTitle>
        {view.linkedin.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {view.linkedin.map((p) => (
              <Note key={p.id} p={p} reload={reload} />
            ))}
          </div>
        ) : (
          <Empty title="No notes waiting">Approved prospects with a LinkedIn page show up here with a note ready to paste.</Empty>
        )}
      </section>
      <section>
        <SectionTitle>
          <span className="inline-flex items-center gap-2">
            <Megaphone className="size-4" /> Post drafts for your profile
          </span>
        </SectionTitle>
        {view.posts.length ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {view.posts.map((post) => (
              <Post key={post.id} post={post} reload={reload} />
            ))}
          </div>
        ) : (
          <Empty title="No post drafts yet">Each weekly review writes three, built on what the outreach learned that week.</Empty>
        )}
      </section>
    </div>
  );
}
