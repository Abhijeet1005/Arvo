'use client';

// Create or edit one demo: the company's details, the persona, and how the
// call room looks. "Read website" fills most of it in from the company's own
// site so a demo takes a couple of minutes, not an afternoon.
import { useState } from 'react';
import { ArrowLeft, Check, Globe, Loader2, Palette, Save, Sparkles, TriangleAlert, X } from 'lucide-react';
import { Button, Input, Textarea, Control, SelectBox, Section } from './controls';
import { brand } from '@/lib/demos/color';
import { DEFAULT_NAMES, MAX_ABOUT } from '@/lib/demos/model';
import { cn } from '@/lib/utils';

const DEFAULT_PERSONA_NAMES = new Set([...Object.values(DEFAULT_NAMES.en), ...Object.values(DEFAULT_NAMES.hi)]);

const defaultName = (language, gender) => (DEFAULT_NAMES[language] || DEFAULT_NAMES.en)[gender] || 'Emma';

function emptyForm(settings) {
  return {
    templateId: 'assistant',
    industry: 'generic',
    business: { name: '', website: '', tagline: '', services: '', hours: '', location: '', phone: '', email: '', about: '', logoUrl: '', accent: '' },
    agent: { name: '', gender: 'female', language: 'en', voiceId: '' },
    cta: { url: '', label: '' },
    lending: { partnerBanks: settings?.partnerBanks || '', regulatorLine: settings?.regulatorLine ?? '' },
    notes: '',
  };
}

// A saved demo -> the form's text fields. A persona name that is just the
// default is shown as empty, so changing the language or gender renames it.
function fromDemo(demo, settings) {
  const base = emptyForm(settings);
  return {
    templateId: demo.templateId,
    industry: demo.industry,
    business: { ...base.business, ...demo.business, services: (demo.business.services || []).join('\n') },
    agent: {
      name: DEFAULT_PERSONA_NAMES.has(demo.agent.name) ? '' : demo.agent.name,
      gender: demo.agent.gender,
      language: demo.agent.language,
      voiceId: demo.agent.voiceId || '',
    },
    cta: { url: demo.cta?.url || '', label: demo.cta?.label || '' },
    lending: { ...base.lending, ...(demo.lending || {}) },
    notes: demo.notes || '',
  };
}

function toBody(form) {
  const body = {
    templateId: form.templateId,
    industry: form.industry,
    business: { ...form.business, services: form.business.services.split('\n') },
    agent: { ...form.agent },
    cta: { ...form.cta },
    notes: form.notes,
  };
  if (form.templateId === 'lending') body.lending = { ...form.lending };
  return body;
}

function RoomPreview({ form }) {
  const colours = brand(form.business.accent);
  const [broken, setBroken] = useState('');
  const business = form.business.name.trim() || 'Your prospect';
  const agent = form.agent.name.trim() || defaultName(form.agent.language, form.agent.gender);
  const logo = form.business.logoUrl && broken !== form.business.logoUrl ? form.business.logoUrl : '';
  return (
    <div className="rounded-2xl border border-slate-200 bg-[#f7f5ef] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Room preview</p>
      <div className="mt-3 flex items-center gap-2.5">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" referrerPolicy="no-referrer" onError={() => setBroken(logo)} className="size-9 shrink-0 rounded-lg border border-black/5 bg-white object-contain p-1" />
        ) : (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg text-sm font-semibold" style={{ backgroundColor: colours.accent, color: colours.ink }}>
            {business[0].toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-slate-900">{business}</p>
          <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-slate-500">AI voice assistant</p>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-white p-4 shadow-sm">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em]" style={{ color: colours.text }}>Live AI voice demo</p>
        <p className="mt-1.5 text-[15px] font-semibold leading-snug tracking-[-0.02em] text-slate-900">
          {form.templateId === 'lending' ? `Experience ${business}’s AI loan advisor` : `Talk to ${agent}, ${business}’s AI assistant`}
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold" style={{ backgroundColor: colours.accent, color: colours.ink }}>
          Start talking
        </span>
      </div>
    </div>
  );
}

export default function DemoForm({ demo, meta, options, settings, onCancel, onSaved }) {
  const editing = Boolean(demo);
  const [form, setForm] = useState(() => (demo ? fromDemo(demo, settings) : emptyForm(settings)));
  const [touched, setTouched] = useState({ industry: Boolean(demo), language: Boolean(demo) });
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState('');
  const [readInfo, setReadInfo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const lending = form.templateId === 'lending';
  const voices = Array.isArray(options?.voices) ? options.voices : [];
  const set = (section, key, value) => setForm((f) => ({ ...f, [section]: { ...f[section], [key]: value } }));

  function chooseTemplate(id) {
    setForm((f) => ({
      ...f,
      templateId: id,
      // The loan qualifier speaks Hinglish; the assistant starts in English.
      agent: { ...f.agent, language: id === 'lending' ? 'hi' : touched.language ? f.agent.language : 'en' },
    }));
  }

  async function readWebsite() {
    setReading(true);
    setReadError('');
    setReadInfo(null);
    try {
      const response = await fetch('/api/demos/profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: form.business.website }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'That website could not be read.');
      setForm((f) => {
        const found = data.business || {};
        const business = { ...f.business };
        for (const [key, value] of Object.entries(found)) {
          if (key === 'services') business.services = (value || []).join('\n') || f.business.services;
          else if (value) business[key] = value;
        }
        return {
          ...f,
          industry: f.templateId === 'assistant' && !touched.industry ? data.industry || f.industry : f.industry,
          business,
          agent: { ...f.agent, language: f.templateId === 'lending' ? 'hi' : touched.language ? f.agent.language : data.language || f.agent.language },
        };
      });
      setReadInfo({ pages: data.pages || [], notes: data.notes || [] });
    } catch (e) {
      setReadError(e.message || String(e));
    } finally {
      setReading(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.business.name.trim()) {
      setError('Add the company name first.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await fetch(editing ? `/api/demos/${demo.id}` : '/api/demos', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(toBody(form)),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not save the demo.');
      onSaved(data.demo, { created: !editing, warning: data.warning || '' });
    } catch (e) {
      setError(e.message || String(e));
      setSaving(false);
    }
  }

  const aboutLength = form.business.about.length;
  const ready = form.business.name.trim().length > 0;

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onCancel} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900">
          <ArrowLeft className="size-3.5" /> All demos
        </button>
        <p className="text-xs text-slate-500">{editing ? `Editing ${demo.business.name}` : 'New demo'}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          {!editing && (
            <Section title="What should it do?" description="Pick the kind of agent. You can change everything else later.">
              <div className="grid gap-3 sm:grid-cols-2">
                {meta.templates.map((template) => {
                  const active = form.templateId === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => chooseTemplate(template.id)}
                      aria-pressed={active}
                      className={cn(
                        'rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20',
                        active ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500' : 'border-slate-200 bg-white hover:border-slate-300'
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900">{template.label}</span>
                        {active && <Check className="size-4 text-blue-600" aria-hidden="true" />}
                      </span>
                      <span className="mt-1.5 block text-xs leading-5 text-slate-500">{template.blurb}</span>
                    </button>
                  );
                })}
              </div>
            </Section>
          )}

          <Section
            title="The company"
            description="Paste their website and Arvo reads it for you: name, what they do, hours, contact details, logo and colour. Then check it over."
            icon={Globe}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Control id="demo-website" label="Website" className="flex-1">
                <Input
                  id="demo-website"
                  value={form.business.website}
                  onChange={(e) => set('business', 'website', e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (form.business.website.trim() && !reading) readWebsite();
                    }
                  }}
                  placeholder="acmeplumbing.com"
                  inputMode="url"
                  autoComplete="off"
                  maxLength={300}
                />
              </Control>
              <Button type="button" variant="outline" onClick={readWebsite} disabled={reading || !form.business.website.trim()} className="sm:w-44">
                {reading ? <Loader2 className="animate-spin" /> : <Sparkles />} {reading ? 'Reading…' : 'Read website'}
              </Button>
            </div>
            {readError && (
              <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {readError}
              </p>
            )}
            {readInfo && (
              <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-xs leading-5 text-teal-900">
                <p className="font-semibold">Filled in from {readInfo.pages.length} page{readInfo.pages.length === 1 ? '' : 's'}. Check the details below before you save.</p>
                {readInfo.notes.map((note) => (
                  <p key={note} className="mt-1 text-teal-800/80">{note}</p>
                ))}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Control id="demo-name" label="Company name">
                <Input id="demo-name" value={form.business.name} onChange={(e) => set('business', 'name', e.target.value)} placeholder="Acme Plumbing" maxLength={80} required />
              </Control>
              {!lending && (
                <Control id="demo-industry" label="Industry preset" hint="Changes the questions it asks and the details it captures.">
                  <SelectBox
                    id="demo-industry"
                    value={form.industry}
                    described
                    onChange={(value) => {
                      setTouched((t) => ({ ...t, industry: true }));
                      setForm((f) => ({ ...f, industry: value }));
                    }}
                  >
                    {meta.industries.map((industry) => (
                      <option key={industry.id} value={industry.id}>{industry.label}</option>
                    ))}
                  </SelectBox>
                </Control>
              )}
            </div>
            <Control id="demo-tagline" label="One line about them">
              <Input id="demo-tagline" value={form.business.tagline} onChange={(e) => set('business', 'tagline', e.target.value)} placeholder="Family-owned plumbers serving Dallas since 1998" maxLength={200} />
            </Control>
            {!lending && (
              <>
                <Control id="demo-services" label="Services" hint="One per line.">
                  <Textarea id="demo-services" value={form.business.services} onChange={(e) => set('business', 'services', e.target.value)} rows={4} placeholder={'Leak repair\nDrain cleaning\nWater heater installation'} />
                </Control>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Control id="demo-hours" label="Opening hours">
                    <Input id="demo-hours" value={form.business.hours} onChange={(e) => set('business', 'hours', e.target.value)} placeholder="Mon to Fri 8am to 5pm" maxLength={200} />
                  </Control>
                  <Control id="demo-location" label="Address or area">
                    <Input id="demo-location" value={form.business.location} onChange={(e) => set('business', 'location', e.target.value)} placeholder="500 Elm Street, Dallas" maxLength={200} />
                  </Control>
                  <Control id="demo-phone" label="Phone">
                    <Input id="demo-phone" value={form.business.phone} onChange={(e) => set('business', 'phone', e.target.value)} placeholder="(214) 555-0187" maxLength={40} inputMode="tel" />
                  </Control>
                  <Control id="demo-email" label="Email">
                    <Input id="demo-email" value={form.business.email} onChange={(e) => set('business', 'email', e.target.value)} placeholder="hello@acmeplumbing.com" maxLength={120} inputMode="email" />
                  </Control>
                </div>
              </>
            )}
          </Section>

          {!lending && (
            <Section
              title="What it knows"
              description="The assistant answers callers from this text and nothing else. Remove anything you don't want it to say, and add what the website leaves out (prices, areas served, policies)."
            >
              <Control
                id="demo-about"
                label="Knowledge"
                hint={`${aboutLength.toLocaleString()} of ${MAX_ABOUT.toLocaleString()} characters. If it isn't here, the assistant says the team will confirm.`}
              >
                <Textarea id="demo-about" value={form.business.about} onChange={(e) => set('business', 'about', e.target.value)} rows={10} maxLength={MAX_ABOUT} placeholder="Paste or write what callers might ask about: services, prices, areas served, policies, how booking works." />
              </Control>
            </Section>
          )}

          <Section title="The agent" description="Who answers, and how they sound." icon={Sparkles}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Control id="agent-language" label="Language" hint={lending ? 'The loan qualifier speaks Hinglish.' : undefined}>
                <SelectBox
                  id="agent-language"
                  value={form.agent.language}
                  described={lending}
                  disabled={lending}
                  onChange={(value) => {
                    setTouched((t) => ({ ...t, language: true }));
                    set('agent', 'language', value);
                  }}
                >
                  {meta.languages.map((language) => (
                    <option key={language.id} value={language.id}>{language.label}</option>
                  ))}
                </SelectBox>
              </Control>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Persona</span>
                <div className="flex gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label="Persona gender">
                  {['female', 'male'].map((gender) => (
                    <button
                      key={gender}
                      type="button"
                      aria-pressed={form.agent.gender === gender}
                      onClick={() => set('agent', 'gender', gender)}
                      className={cn('h-8 flex-1 rounded-md text-xs font-semibold capitalize transition', form.agent.gender === gender ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}
                    >
                      {gender}
                    </button>
                  ))}
                </div>
              </div>
              <Control id="agent-name" label="Name" hint="Leave empty to use the default for the language and gender.">
                <Input id="agent-name" value={form.agent.name} onChange={(e) => set('agent', 'name', e.target.value)} placeholder={defaultName(form.agent.language, form.agent.gender)} maxLength={40} />
              </Control>
              <Control id="agent-voice" label="Voice" hint="Auto picks a voice that matches the persona.">
                <SelectBox id="agent-voice" value={form.agent.voiceId} described onChange={(value) => set('agent', 'voiceId', value)}>
                  <option value="">Auto</option>
                  {voices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.name}
                      {voice.gender ? ` · ${voice.gender}` : ''}
                      {voice.hindi ? ' · Hindi' : ''}
                    </option>
                  ))}
                </SelectBox>
              </Control>
            </div>
            {lending && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Control id="lend-banks" label="Partner banks" hint="Named in the conversation.">
                  <Input id="lend-banks" value={form.lending.partnerBanks} onChange={(e) => set('lending', 'partnerBanks', e.target.value)} maxLength={80} placeholder="HDFC, SBI, Axis" />
                </Control>
                <Control id="lend-reg" label="Regulator line" hint="Spoken in the opening if you add one.">
                  <Input id="lend-reg" value={form.lending.regulatorLine} onChange={(e) => set('lending', 'regulatorLine', e.target.value)} maxLength={80} placeholder="RBI-registered NBFC" />
                </Control>
              </div>
            )}
          </Section>

          <Section title="Look and feel" description="Their logo and colour make the call room look like theirs." icon={Palette}>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Control id="demo-logo" label="Logo address" hint="A link to an image. Read website usually finds it.">
                <Input id="demo-logo" value={form.business.logoUrl} onChange={(e) => set('business', 'logoUrl', e.target.value)} placeholder="https://acmeplumbing.com/logo.png" inputMode="url" maxLength={400} />
              </Control>
              <Control id="demo-accent" label="Colour">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Brand colour"
                    value={brand(form.business.accent).accent}
                    onChange={(e) => set('business', 'accent', e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
                  />
                  <Input id="demo-accent" value={form.business.accent} onChange={(e) => set('business', 'accent', e.target.value.trim())} placeholder="#174ea6" maxLength={7} className="w-28 font-mono" />
                  {form.business.accent && (
                    <button type="button" onClick={() => set('business', 'accent', '')} className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Clear colour">
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              </Control>
            </div>
          </Section>

          <Section title="After the call" description="An optional button on the page they see when the demo ends, such as a link to book time with you.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Control id="cta-url" label="Button link">
                <Input id="cta-url" value={form.cta.url} onChange={(e) => set('cta', 'url', e.target.value)} placeholder="https://cal.com/you/15min" inputMode="url" maxLength={300} />
              </Control>
              <Control id="cta-label" label="Button text">
                <Input id="cta-label" value={form.cta.label} onChange={(e) => set('cta', 'label', e.target.value)} placeholder="Book a call" maxLength={40} />
              </Control>
            </div>
            <Control id="demo-notes" label="Private note" hint="Only you see this.">
              <Input id="demo-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="e.g. Spoke to the owner, wants a demo on Friday" maxLength={300} />
            </Control>
          </Section>
        </div>

        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <RoomPreview form={form} />
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <Button type="submit" disabled={saving || !ready} className="w-full justify-center">
              {saving ? <Loader2 className="animate-spin" /> : <Save />} {saving ? 'Saving…' : editing ? 'Save changes' : 'Create demo and link'}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel} disabled={saving} className="mt-2 w-full justify-center text-slate-600">
              Cancel
            </Button>
            {error && (
              <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {error}
              </p>
            )}
            <p className="mt-3 text-[11px] leading-4 text-slate-400">
              {editing ? 'The agent is updated to match when you save.' : 'Creating a demo sets up its own voice agent and a link you can send.'}
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
