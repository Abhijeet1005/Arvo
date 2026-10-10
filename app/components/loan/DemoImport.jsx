'use client';

// Make a demo for every company in a list: a CSV export or text pasted from a
// spreadsheet. One agent and one link per company, created one after another
// (each can read its website first), with a CSV of the links at the end.
import { useRef, useState } from 'react';
import { ArrowLeft, Download, FileUp, Loader2, Play, Square, TriangleAlert } from 'lucide-react';
import { Button, Control, SelectBox, Section } from './controls';
import { parseCsv, leadsFromRows } from '@/lib/demos/csv';
import { downloadCsv } from '@/lib/demos/download';
import { cn } from '@/lib/utils';

const MAX_ROWS = 200;

function post(url, body) {
  return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

export default function DemoImport({ meta, existingNames, origin, onClose, onFinished }) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [options, setOptions] = useState({ templateId: 'assistant', industry: 'generic', language: 'en', gender: 'female', readSites: true, skipExisting: true, ctaUrl: '', ctaLabel: '' });
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [current, setCurrent] = useState('');
  const [log, setLog] = useState([]);
  const cancel = useRef(false);

  const parsed = leadsFromRows(parseCsv(text), { max: MAX_ROWS });
  const known = new Set(existingNames.map((n) => n.toLowerCase()));
  const todo = parsed.leads.filter((lead) => !(options.skipExisting && known.has(lead.name.toLowerCase())));
  const withSites = todo.filter((lead) => lead.website).length;
  const set = (key, value) => setOptions((o) => ({ ...o, [key]: value }));

  async function pickFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setText(await file.text());
    setFinished(false);
    event.target.value = '';
  }

  async function run() {
    setRunning(true);
    setFinished(false);
    setLog([]);
    cancel.current = false;
    const lending = options.templateId === 'lending';

    for (const lead of todo) {
      if (cancel.current) break;
      setCurrent(lead.name);
      const entry = { name: lead.name, status: 'failed', note: '', link: '' };
      try {
        let site = null;
        if (options.readSites && lead.website) {
          // Reading the website is a bonus: if it fails the demo is still made.
          const read = await post('/api/demos/profile', { url: lead.website }).catch(() => null);
          if (read?.ok) site = await read.json().catch(() => null);
          else if (read) entry.note = (await read.json().catch(() => ({}))).error || '';
        }
        const found = site?.business || {};
        const about = [lead.about && `What they do: ${lead.about}`, found.about].filter(Boolean).join('\n\n');
        const response = await post('/api/demos', {
          templateId: options.templateId,
          industry: options.industry,
          business: {
            name: lead.name,
            website: lead.website || found.website || '',
            tagline: lead.about || found.tagline || '',
            phone: lead.phone || found.phone || '',
            location: lead.location || found.location || '',
            email: found.email || '',
            hours: found.hours || '',
            services: found.services || [],
            about,
            logoUrl: found.logoUrl || '',
            accent: found.accent || '',
          },
          agent: { language: lending ? 'hi' : options.language, gender: options.gender },
          cta: { url: options.ctaUrl, label: options.ctaLabel },
          notes: lead.notes,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Could not create the demo.');
        const link = data.demo?.links?.[data.demo.links.length - 1]?.url || '';
        entry.status = data.warning ? 'warn' : 'created';
        entry.note = data.warning || (site ? '' : entry.note);
        entry.link = link ? `${origin}${link}` : '';
      } catch (e) {
        entry.note = e.message || String(e);
      }
      setLog((rows) => [...rows, entry]);
    }
    setRunning(false);
    setFinished(true);
    setCurrent('');
    onFinished();
  }

  const created = log.filter((r) => r.status === 'created' || r.status === 'warn');
  const failed = log.filter((r) => r.status === 'failed');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onClose} disabled={running} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 disabled:opacity-50">
          <ArrowLeft className="size-3.5" /> All demos
        </button>
        <p className="text-xs text-slate-500">Import a list</p>
      </div>

      <Section
        title="Your list of companies"
        description="Upload a CSV, or paste rows from a spreadsheet. A header row is detected (Business or Company, Website, Location, Phone, What they do, Notes). Without one, the columns are taken as company, website, location, phone."
        icon={FileUp}
      >
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-4 text-sm font-semibold transition hover:border-blue-400">
            <FileUp className="size-4" /> Choose a CSV file
            <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" onChange={pickFile} disabled={running} />
          </label>
          {fileName && <span className="text-xs text-slate-500">{fileName}</span>}
        </div>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setFileName(''); setFinished(false); }}
          disabled={running}
          rows={6}
          placeholder={'Business,Website,Location,Phone\nAcme Plumbing,acmeplumbing.com,Dallas,(214) 555-0187'}
          aria-label="List of companies"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 disabled:opacity-60"
        />
        {text.trim() && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">
              {parsed.leads.length} {parsed.leads.length === 1 ? 'company' : 'companies'} found{parsed.leads.length >= MAX_ROWS ? ` (the first ${MAX_ROWS})` : ''}
              {parsed.hadHeader ? '' : ', no header row detected'}
            </p>
            {parsed.hadHeader && <p className="mt-1">Columns used: {Object.entries(parsed.columns).map(([k, v]) => `${k} = ${v}`).join(', ')}</p>}
            {parsed.leads.length > 0 && (
              <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {parsed.leads.slice(0, 6).map((lead) => (
                  <li key={lead.name} className="truncate">{lead.name}<span className="text-slate-400">{lead.website ? ` · ${lead.website}` : ''}</span></li>
                ))}
                {parsed.leads.length > 6 && <li className="text-slate-400">and {parsed.leads.length - 6} more</li>}
              </ul>
            )}
          </div>
        )}
      </Section>

      <Section title="How each demo should be set up" description="Applies to every company in the list. You can edit any demo afterwards.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Control id="imp-template" label="Template">
            <SelectBox id="imp-template" value={options.templateId} onChange={(v) => set('templateId', v)} disabled={running}>
              {meta.templates.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </SelectBox>
          </Control>
          {options.templateId === 'assistant' && (
            <Control id="imp-industry" label="Industry preset">
              <SelectBox id="imp-industry" value={options.industry} onChange={(v) => set('industry', v)} disabled={running}>
                {meta.industries.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
              </SelectBox>
            </Control>
          )}
          <Control id="imp-language" label="Language" hint={options.templateId === 'lending' ? 'The loan qualifier speaks Hinglish.' : undefined}>
            <SelectBox id="imp-language" value={options.templateId === 'lending' ? 'hi' : options.language} onChange={(v) => set('language', v)} disabled={running || options.templateId === 'lending'} described={options.templateId === 'lending'}>
              {meta.languages.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </SelectBox>
          </Control>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Persona</span>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Persona gender">
              {['female', 'male'].map((g) => (
                <button key={g} type="button" disabled={running} aria-pressed={options.gender === g} onClick={() => set('gender', g)} className={cn('h-8 flex-1 rounded-md text-xs font-semibold capitalize transition', options.gender === g ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <Control id="imp-cta-url" label="Button link after the call" hint="Optional. For example a link to book time with you.">
            <input id="imp-cta-url" value={options.ctaUrl} onChange={(e) => set('ctaUrl', e.target.value)} disabled={running} placeholder="https://cal.com/you/15min" className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 disabled:opacity-60" />
          </Control>
          <Control id="imp-cta-label" label="Button text">
            <input id="imp-cta-label" value={options.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} disabled={running} placeholder="Book a call" maxLength={40} className="flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15 disabled:opacity-60" />
          </Control>
        </div>
        <label className="flex items-start gap-2.5 text-sm text-slate-700">
          <input type="checkbox" checked={options.readSites} onChange={(e) => set('readSites', e.target.checked)} disabled={running} className="mt-1 size-4 accent-blue-600" />
          <span>
            <span className="font-medium">Read each company&apos;s website first</span>
            <span className="block text-xs text-slate-500">Fills in services, hours, logo and colour, and what the agent knows. Slower: up to half a minute for each company with a website ({withSites} here).</span>
          </span>
        </label>
        <label className="flex items-start gap-2.5 text-sm text-slate-700">
          <input type="checkbox" checked={options.skipExisting} onChange={(e) => set('skipExisting', e.target.checked)} disabled={running} className="mt-1 size-4 accent-blue-600" />
          <span>
            <span className="font-medium">Skip companies that already have a demo</span>
            <span className="block text-xs text-slate-500">Matched by name, so running the list again won&apos;t make duplicates.</span>
          </span>
        </label>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        {running ? (
          <Button variant="outline" onClick={() => { cancel.current = true; }}><Square /> Stop after this one</Button>
        ) : finished ? (
          <Button onClick={onClose}><ArrowLeft /> Back to demos</Button>
        ) : (
          <Button onClick={run} disabled={todo.length === 0}><Play /> Create {todo.length} {todo.length === 1 ? 'demo' : 'demos'}</Button>
        )}
        {running && (
          <p className="inline-flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="size-4 animate-spin" /> {log.length + 1} of {todo.length}: {current}
          </p>
        )}
        {!running && !finished && todo.length < parsed.leads.length && <p className="text-xs text-slate-500">{parsed.leads.length - todo.length} already have a demo and will be skipped.</p>}
      </div>

      {log.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">
              {finished ? 'Done' : 'Working'}: {created.length} created{failed.length ? `, ${failed.length} failed` : ''}
            </p>
            {created.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => downloadCsv('demo-links.csv', [['Company', 'Link', 'Note'], ...created.map((r) => [r.name, r.link, r.note])])}>
                <Download /> Download the links
              </Button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-slate-100 overflow-auto">
            {log.map((row) => (
              <li key={row.name} className="flex items-start justify-between gap-3 px-4 py-2.5 text-xs">
                <span className="min-w-0">
                  <span className="font-semibold text-slate-800">{row.name}</span>
                  {row.note && <span className={cn('block', row.status === 'failed' ? 'text-red-700' : 'text-slate-500')}>{row.note}</span>}
                </span>
                <span className={cn('inline-flex shrink-0 items-center gap-1 font-semibold', row.status === 'failed' ? 'text-red-700' : row.status === 'warn' ? 'text-amber-700' : 'text-teal-700')}>
                  {row.status === 'failed' && <TriangleAlert className="size-3" />}
                  {row.status === 'failed' ? 'Failed' : row.status === 'warn' ? 'Created, check it' : 'Created'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
