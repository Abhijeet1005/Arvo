'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Loader2 } from 'lucide-react';

const DEFAULT_PROMPT = [
  'You are a friendly voice support agent. At the start of the call, greet the caller.',
  '',
  'LANGUAGE STEP: Right after greeting, ask whether the caller would like to continue in English or in Hinglish. Once they answer, use ONLY that choice for the rest of the conversation — clear, simple English if they choose English, or natural Hinglish (a casual mix of Hindi and English, the way people speak in urban India) if they choose Hinglish. Keep the same language for the entire call; do not switch unless the caller explicitly asks. If their choice is unclear, ask once more.',
  '',
  'Answer questions using your knowledge base. Keep replies short and conversational — one or two sentences. Never invent order details, prices, or dates. If you cannot help, offer to take a message or transfer to a human.',
].join('\n');

const selectCls =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:border-emerald-500 focus-visible:ring-4 focus-visible:ring-emerald-500/20';

export default function AgentConfig() {
  const [form, setForm] = useState({
    name: 'Support Agent',
    firstMessage: 'Namaste! This is the AI support assistant. Would you like to continue in English, or in Hinglish?',
    language: 'hi',
    voiceId: 'UksqaCE9jifDW7sC50OM',
    llm: 'gemini-2.5-flash',
    prompt: DEFAULT_PROMPT,
  });
  const [agentId, setAgentId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch('/api/agent')
      .then((r) => r.json())
      .then((d) => {
        if (d.agentId) setAgentId(d.agentId);
        if (d.config) setForm((f) => ({ ...f, ...Object.fromEntries(Object.entries(d.config).filter(([, v]) => v != null)) }));
      })
      .catch(() => {});
  }, []);

  const up = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    setMsg('');
    try {
      const r = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to save');
      setAgentId(d.agentId);
      setMsg('Saved ✓');
    } catch (e) {
      setMsg('Error: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Agent name">
        <Input value={form.name} onChange={up('name')} />
      </Field>
      <Field label="First message (spoken on pickup)">
        <Input value={form.firstMessage} onChange={up('firstMessage')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Language">
          <select className={selectCls} value={form.language} onChange={up('language')}>
            <option value="en">English</option>
            <option value="hi">Hindi</option>
          </select>
        </Field>
        <Field label="LLM">
          <select className={selectCls} value={form.llm} onChange={up('llm')}>
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="gpt-4o-mini">GPT-4o mini</option>
            <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
          </select>
        </Field>
        <Field label="Voice ID">
          <Input value={form.voiceId} onChange={up('voiceId')} />
        </Field>
      </div>

      <Field label="System prompt">
        <Textarea rows={6} value={form.prompt} onChange={up('prompt')} />
      </Field>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button onClick={save} disabled={saving}>
          {saving ? <><Loader2 className="animate-spin" /> Saving…</> : agentId ? 'Update agent' : 'Create agent'}
        </Button>
        {msg && (
          <span className={`text-sm font-medium ${msg.startsWith('Error') ? 'text-destructive' : 'text-emerald-600'}`}>{msg}</span>
        )}
      </div>
      {agentId && (
        <p className="text-xs text-muted-foreground">
          Agent id: <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">{agentId}</code>
        </p>
      )}
    </div>
  );
}
