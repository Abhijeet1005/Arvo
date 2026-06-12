'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { cn } from '@/lib/utils';
import { Upload, Loader2 } from 'lucide-react';

export default function KnowledgeUpload() {
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function addText() {
    if (!text.trim()) return;
    setBusy(true);
    setMsg('');
    try {
      const r = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text, name }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setMsg('Added: ' + d.name);
      setText('');
      setName('');
    } catch (e) {
      setMsg('Error: ' + (e.message || e));
    } finally {
      setBusy(false);
    }
  }

  async function addFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBusy(true);
    setMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', file.name);
      const r = await fetch('/api/knowledge', { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed');
      setMsg('Added: ' + d.name);
    } catch (err) {
      setMsg('Error: ' + (err.message || err));
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Document name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Return Policy" />
      </Field>
      <Field label="Paste text">
        <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste FAQ / policy text…" />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={addText} disabled={busy}>
          {busy ? <><Loader2 className="animate-spin" /> Uploading…</> : 'Add text'}
        </Button>
        <label className={cn(buttonVariants({ variant: 'outline' }), 'cursor-pointer')}>
          <Upload /> Upload file
          <input type="file" hidden onChange={addFile} accept=".pdf,.txt,.md,.docx,.html" />
        </label>
        {msg && (
          <span className={`text-sm font-medium ${msg.startsWith('Error') ? 'text-destructive' : 'text-emerald-600'}`}>{msg}</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Try the included <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">sample-company-faq.md</code>.
      </p>
    </div>
  );
}
