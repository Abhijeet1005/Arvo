'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AudioLines,
  Brain,
  Building2,
  CheckCircle2,
  ChevronRight,
  FileText,
  KeyRound,
  LoaderCircle,
  RotateCcw,
  Save,
  ShieldCheck,
  Timer,
  TriangleAlert,
  Undo2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LANGUAGES,
  TTS_MODELS,
  TURN_EAGERNESS,
  SILENCE_HANGUP,
  MAX_CALL_MINUTES,
  SPEED,
  TURN_TIMEOUT,
  PROVIDER_ORDER,
  AGENT_GENDERS,
  settingsEqual,
  ttsModelFor,
  unknownPlaceholders,
} from '@/lib/loan/options';
import { defaultPrompt, defaultFirstMessage } from '@/lib/loan/prompt';
import { Button, Input, Textarea, Section, Control, SelectBox, Slider, Toggle } from './controls';
import VoicePicker from './VoicePicker';
import AccountPanel from './AccountPanel';

const PROVIDER_LABELS = {
  OpenAI: 'OpenAI · GPT',
  Google: 'Google · Gemini',
  Anthropic: 'Anthropic · Claude',
  Other: 'Other',
};

const STUDIO_SECTIONS = [
  { id: 'identity', label: 'Identity', description: 'Company, role, and lending context', icon: Building2 },
  { id: 'intelligence', label: 'Intelligence', description: 'Language model and reasoning', icon: Brain },
  { id: 'voice', label: 'Voice', description: 'Voice, delivery, and audio model', icon: AudioLines },
  { id: 'conversation', label: 'Conversation', description: 'Opening, language, and call policy', icon: FileText },
  { id: 'behavior', label: 'Call behavior', description: 'Timing, turns, and safety limits', icon: Timer },
  { id: 'account', label: 'Voice account', description: 'Provider key and available credits', icon: KeyRound },
];

function effortLabel(effort, index) {
  const name = effort.charAt(0).toUpperCase() + effort.slice(1);
  return index === 0 ? `${name} · fastest` : name;
}

function secondsLabel(seconds) {
  if (!seconds) return 'Never';
  return seconds < 60 ? `After ${seconds} seconds` : `After ${seconds / 60} minute${seconds === 60 ? '' : 's'}`;
}

function PlaceholderWarning({ text }) {
  const unknown = unknownPlaceholders(text);
  if (!unknown.length) return null;
  return (
    <p role="alert" className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
      <TriangleAlert className="size-3.5" aria-hidden="true" />
      Unknown placeholder {`{{${unknown[0]}}}`} — only {'{{customer_name}}'} and {'{{customer_phone}}'} are filled in.
    </p>
  );
}

function StudioNavigation({ active, onChange, dirty }) {
  return (
    <aside className="lg:sticky lg:top-[96px] lg:self-start">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_8px_30px_-28px_rgba(15,23,42,.5)] lg:overflow-visible lg:p-3">
        <div className="flex min-w-max gap-1 lg:min-w-0 lg:flex-col">
          {STUDIO_SECTIONS.map((item) => {
            const Icon = item.icon;
            const selected = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'group flex min-w-[148px] items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/15 lg:min-w-0',
                  selected ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                )}
              >
                <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', selected ? 'bg-white/10 text-blue-300' : 'bg-slate-100 text-slate-500 group-hover:text-blue-600')}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold">{item.label}</span>
                  <span className={cn('mt-0.5 hidden truncate text-[9px] lg:block', selected ? 'text-slate-400' : 'text-slate-400')}>{item.description}</span>
                </span>
                <ChevronRight className={cn('hidden size-3.5 lg:block', selected ? 'text-slate-500' : 'text-slate-300')} />
              </button>
            );
          })}
        </div>
        {dirty && (
          <div className="mx-1 mt-2 hidden items-center gap-2 border-t border-slate-100 px-2 pt-3 text-[10px] font-medium text-amber-700 lg:flex">
            <span className="size-1.5 rounded-full bg-amber-500" /> Unsaved changes
          </div>
        )}
      </div>
    </aside>
  );
}

// Shown when the chosen voice is labelled with the other gender from "Speaks
// as". In Hindi the agent's words follow that setting, so a mismatch would have
// a woman's voice saying masculine verb forms (or the reverse). One click fixes
// it; nothing is changed silently.
function VoiceGenderNotice({ voice, speaksAs, onFix }) {
  const voiceGender = voice.gender === 'female' ? 'female' : 'male';
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900">
      <TriangleAlert className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">{voice.name}</span> is a {voiceGender} voice, but the agent speaks as {speaksAs}. In Hindi the
        words would not match the voice.
      </p>
      <button
        type="button"
        onClick={onFix}
        className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold text-amber-900 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-500/20"
      >
        Set to {voiceGender === 'female' ? 'Female' : 'Male'}
      </button>
    </div>
  );
}

export default function LoanConfig({ saved, defaults, options, onSaved, onOptionsReload, onKeyChanged }) {
  const [form, setForm] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [activeSection, setActiveSection] = useState('identity');

  useEffect(() => setForm(saved), [saved]);

  const dirty = !settingsEqual(form, saved);
  const llms = options?.llms;
  const model = useMemo(() => (llms || []).find((item) => item.id === form.llm), [llms, form.llm]);
  const speaksAs = form.agentGender || 'male';
  const selectedVoice = useMemo(() => (options?.voices || []).find((item) => item.id === form.voiceId), [options?.voices, form.voiceId]);
  // Only matters in Hindi/Hinglish, where the wording changes with gender.
  const voiceGenderMismatch =
    form.language === 'hi' &&
    selectedVoice &&
    (selectedVoice.gender === 'male' || selectedVoice.gender === 'female') &&
    selectedVoice.gender !== speaksAs
      ? selectedVoice
      : null;
  const groups = useMemo(() => {
    const byProvider = {};
    for (const item of llms || []) (byProvider[item.provider] ||= []).push(item);
    return PROVIDER_ORDER.filter((provider) => byProvider[provider]).map((provider) => [provider, byProvider[provider]]);
  }, [llms]);
  const currentSection = STUDIO_SECTIONS.find((item) => item.id === activeSection) || STUDIO_SECTIONS[0];
  const ActiveIcon = currentSection.icon;
  const generatedPrompt = defaultPrompt(form);
  const customPrompt = form.prompt.trim().length > 0;

  function update(key, value) {
    setStatus(null);
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'llm') {
        const nextModel = (llms || []).find((item) => item.id === value);
        next.reasoningEffort = nextModel?.efforts?.[0] || '';
      }
      if (key === 'language') next.ttsModel = ttsModelFor(value, current.ttsModel);
      return next;
    });
  }

  const bind = (key) => (value) => update(key, value);

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch('/api/loan', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not save the agent.');
      onSaved(data.settings);
      setForm(data.settings);
      setStatus(data.warning ? { kind: 'warn', text: data.warning } : { kind: 'ok', text: 'Agent saved and synced. The next conversation uses this version.' });
    } catch (error) {
      setStatus({ kind: 'error', text: error.message || String(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_35px_-30px_rgba(15,23,42,.5)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-950 text-blue-300"><ActiveIcon className="size-5" /></span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-600">Agent Studio</p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em] text-slate-950">{currentSection.label}</h2>
              <p className="mt-1 text-xs text-slate-500">{currentSection.description}. Changes stay in draft until you save.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setForm({ ...defaults })} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
              <RotateCcw className="size-3.5" /> Restore defaults
            </button>
            <span className={cn('hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset sm:inline-flex', dirty ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-teal-50 text-teal-700 ring-teal-200')}>
              {dirty ? <span className="size-1.5 rounded-full bg-amber-500" /> : <CheckCircle2 className="size-3" />}
              {dirty ? 'Draft changes' : 'Live version'}
            </span>
          </div>
        </div>
        <div className="mt-5 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-50 px-3 py-2.5"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">Agent</p><p className="mt-1 truncate text-xs font-semibold text-slate-800">{form.agentName}</p></div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">Language</p><p className="mt-1 truncate text-xs font-semibold text-slate-800">{form.language === 'hi' && form.hinglishMode ? 'Hindi · Hinglish' : LANGUAGES.find((item) => item.id === form.language)?.label}</p></div>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">Model</p><p className="mt-1 truncate text-xs font-semibold text-slate-800">{form.llm}</p></div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <StudioNavigation active={activeSection} onChange={setActiveSection} dirty={dirty} />

        <div className="min-w-0">
          {activeSection === 'identity' && (
            <Section icon={Building2} title="Company & persona" description="The identity customers hear and the lending context the agent can truthfully reference.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Control id="cfg-company" label="Company name"><Input id="cfg-company" value={form.companyName} onChange={(event) => update('companyName', event.target.value)} maxLength={80} /></Control>
                <Control id="cfg-banks" label="Partner banks"><Input id="cfg-banks" value={form.partnerBanks} onChange={(event) => update('partnerBanks', event.target.value)} maxLength={80} /></Control>
                <Control id="cfg-agent" label="Agent name"><Input id="cfg-agent" value={form.agentName} onChange={(event) => update('agentName', event.target.value)} maxLength={80} /></Control>
                <Control id="cfg-gender" label="Speaks as" hint="Hindi changes with the speaker's gender (बोल रहा हूँ or बोल रही हूँ). This sets the generated opening line and script to match your voice.">
                  <SelectBox id="cfg-gender" value={speaksAs} onChange={bind('agentGender')} described>
                    {AGENT_GENDERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </SelectBox>
                </Control>
                <Control id="cfg-regulator" label="Regulatory line" className="sm:col-span-2" hint="Only state what is true. Leave blank to make no regulatory claim.">
                  <Input id="cfg-regulator" value={form.regulatorLine} onChange={(event) => update('regulatorLine', event.target.value)} maxLength={80} placeholder="No regulatory claim" aria-describedby="cfg-regulator-hint" />
                </Control>
              </div>
              {voiceGenderMismatch && (
                <VoiceGenderNotice voice={voiceGenderMismatch} speaksAs={speaksAs} onFix={() => update('agentGender', voiceGenderMismatch.gender)} />
              )}
              {(customPrompt || form.firstMessage.trim()) && (
                <p className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-600">
                  <FileText className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
                  Your opening line or call policy is customised, so &quot;Speaks as&quot; cannot rewrite it. Edit those by hand, or return to the generated version under Conversation.
                </p>
              )}
              <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3.5 text-xs leading-5 text-blue-900">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-blue-600" />
                These fields are inserted into the generated call policy. If you switch to a custom script, edit the identity there too.
              </div>
            </Section>
          )}

          {activeSection === 'intelligence' && (
            <Section icon={Brain} title="Conversation intelligence" description="Choose how the agent reasons and how quickly it responds in a live call.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Control id="cfg-llm" label="Language model" hint={options?.llmsError || 'Smaller flash and mini models usually respond fastest on a voice call.'}>
                  {llms ? (
                    <SelectBox id="cfg-llm" value={form.llm} onChange={bind('llm')} described>
                      {!model && <option value={form.llm}>{form.llm} (not available)</option>}
                      {groups.map(([provider, items]) => (
                        <optgroup key={provider} label={PROVIDER_LABELS[provider]}>
                          {items.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}
                        </optgroup>
                      ))}
                    </SelectBox>
                  ) : (
                    <Input id="cfg-llm" value={form.llm} onChange={(event) => update('llm', event.target.value.trim())} className="font-mono" />
                  )}
                </Control>
                {model && model.efforts.length > 0 ? (
                  <Control id="cfg-effort" label="Reasoning" hint="Keep this low for a responsive phone conversation.">
                    <SelectBox id="cfg-effort" value={form.reasoningEffort} onChange={bind('reasoningEffort')} described>
                      {model.efforts.map((effort, index) => <option key={effort} value={effort}>{effortLabel(effort, index)}</option>)}
                    </SelectBox>
                  </Control>
                ) : (
                  <div className="flex flex-col gap-1.5"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reasoning</span><p className="flex h-10 items-center text-sm text-muted-foreground">{model ? 'This model answers directly.' : '—'}</p></div>
                )}
              </div>
              <Slider id="cfg-temperature" label="Response flexibility" value={form.temperature} onChange={bind('temperature')} min={0} max={1} step={0.05} format={(value) => value.toFixed(2)} left="Strict" right="Flexible" hint="Lower values stay closer to the qualification policy; higher values vary wording more." />
            </Section>
          )}

          {activeSection === 'voice' && (
            <Section icon={AudioLines} title="Voice & delivery" description="Select the voice customers hear, then tune pace and consistency.">
              {voiceGenderMismatch && (
                <VoiceGenderNotice voice={voiceGenderMismatch} speaksAs={speaksAs} onFix={() => update('agentGender', voiceGenderMismatch.gender)} />
              )}
              <VoicePicker value={form.voiceId} onChange={bind('voiceId')} voices={options?.voices} voicesError={options?.voicesError} tier={options?.subscription?.tier} language={form.language} onVoicesChanged={onOptionsReload} />
              <div className="grid gap-5 border-t border-border pt-5 sm:grid-cols-2">
                <Control id="cfg-tts" label="Voice model" hint="Flash is the fastest (about 75 ms). v4 Turbo is more expressive at a similar speed (about 100 ms). v4, v3 and Multilingual are richer but add delay. Switching applies to the next call after you save.">
                  <SelectBox id="cfg-tts" value={form.ttsModel} onChange={bind('ttsModel')} described>{TTS_MODELS[form.language].map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectBox>
                </Control>
                <Slider id="cfg-speed" label="Speaking pace" value={form.speed} onChange={bind('speed')} min={SPEED.min} max={SPEED.max} step={SPEED.step} format={(value) => `${value.toFixed(2)}×`} left="Slower" right="Faster" />
                <Slider id="cfg-stability" label="Stability" value={form.stability} onChange={bind('stability')} min={0} max={1} step={0.05} format={(value) => value.toFixed(2)} left="Expressive" right="Steady" />
                <Slider id="cfg-similarity" label="Voice similarity" value={form.similarityBoost} onChange={bind('similarityBoost')} min={0} max={1} step={0.05} format={(value) => value.toFixed(2)} left="Flexible" right="Closer" />
              </div>
            </Section>
          )}

          {activeSection === 'conversation' && (
            <Section icon={FileText} title="Conversation policy" description="Control language, opening, qualification flow, objections, and compliance instructions.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Control id="cfg-language" label="Primary language"><SelectBox id="cfg-language" value={form.language} onChange={bind('language')}>{LANGUAGES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectBox></Control>
                {form.language === 'hi' && <div className="flex items-end"><Toggle id="cfg-hinglish" label="Hinglish mode" description="Use a natural Hindi-English mix instead of formal Hindi." checked={form.hinglishMode} onChange={bind('hinglishMode')} /></div>}
              </div>
              <Control id="cfg-first" label="Opening line" hint="Leave blank to use the generated opening. {{customer_name}} is filled for each call.">
                <Input id="cfg-first" value={form.firstMessage} onChange={(event) => update('firstMessage', event.target.value)} placeholder={defaultFirstMessage(form)} maxLength={500} aria-describedby="cfg-first-hint" />
              </Control>
              <PlaceholderWarning text={form.firstMessage} />

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label htmlFor="cfg-prompt" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Call policy</label>
                    <p className="mt-0.5 text-[10px] text-slate-400">{customPrompt ? 'Custom version' : 'Generated from identity and lending safeguards'}</p>
                  </div>
                  {customPrompt ? (
                    <Button variant="ghost" size="sm" onClick={() => update('prompt', '')}><Undo2 /> Use generated policy</Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => update('prompt', generatedPrompt)}><FileText /> Edit policy</Button>
                  )}
                </div>
                <Textarea id="cfg-prompt" value={customPrompt ? form.prompt : generatedPrompt} onChange={(event) => update('prompt', event.target.value)} readOnly={!customPrompt} rows={22} spellCheck={false} aria-describedby="cfg-prompt-hint" className={cn('font-mono text-xs leading-relaxed', !customPrompt && 'bg-secondary/40 text-muted-foreground')} />
                <p id="cfg-prompt-hint" className="text-[11px] leading-5 text-muted-foreground">
                  {customPrompt ? 'Identity fields no longer modify a custom policy automatically.' : 'Edit only when you need to own the complete script. Compliance evaluation remains enabled.'} {(customPrompt ? form.prompt : generatedPrompt).length.toLocaleString('en-IN')} characters.
                </p>
                <PlaceholderWarning text={form.prompt} />
              </div>
            </Section>
          )}

          {activeSection === 'behavior' && (
            <Section icon={Timer} title="Call behavior" description="Tune turn-taking and hard limits so the agent feels patient without leaving calls open indefinitely.">
              <div className="grid gap-6 sm:grid-cols-2">
                <Slider id="cfg-turn-timeout" label="Check in after silence" value={form.turnTimeout} onChange={bind('turnTimeout')} min={TURN_TIMEOUT.min} max={TURN_TIMEOUT.max} step={1} format={(value) => `${value}s`} hint="How long the customer can stay quiet before the agent checks whether they are still there." />
                <Control id="cfg-eagerness" label="Turn-taking"><SelectBox id="cfg-eagerness" value={form.turnEagerness} onChange={bind('turnEagerness')}>{TURN_EAGERNESS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</SelectBox></Control>
                <Control id="cfg-silence" label="Hang up after silence"><SelectBox id="cfg-silence" value={String(form.silenceHangup)} onChange={(value) => update('silenceHangup', Number(value))}>{SILENCE_HANGUP.map((seconds) => <option key={seconds} value={String(seconds)}>{secondsLabel(seconds)}</option>)}</SelectBox></Control>
                <Control id="cfg-max" label="Maximum call length" hint="A hard safety cap for forgotten or stalled conversations."><SelectBox id="cfg-max" value={String(form.maxCallMinutes)} onChange={(value) => update('maxCallMinutes', Number(value))} described>{MAX_CALL_MINUTES.map((minutes) => <option key={minutes} value={String(minutes)}>{minutes} minutes</option>)}</SelectBox></Control>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {['One question per turn', 'Customer interruption respected', 'Hard duration cap active'].map((label) => (
                  <div key={label} className="flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2.5 text-[11px] font-medium text-teal-800 ring-1 ring-inset ring-teal-100"><CheckCircle2 className="size-3.5 text-teal-600" /> {label}</div>
                ))}
              </div>
            </Section>
          )}

          {activeSection === 'account' && (
            <Section icon={KeyRound} title="ElevenLabs account" description="Connect the voice provider account used to sync the agent and mint secure conversation sessions.">
              <AccountPanel keyInfo={options?.key} subscription={options?.subscription} onChanged={onKeyChanged} />
            </Section>
          )}
        </div>
      </div>

      {(dirty || status) && (
        <div className="sticky bottom-4 z-10 ml-auto flex max-w-[calc(100%-0px)] flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_20px_55px_-22px_rgba(15,23,42,.35)] backdrop-blur-xl lg:max-w-[calc(100%-250px)]">
          <p role={status?.kind === 'error' || status?.kind === 'warn' ? 'alert' : 'status'} className={cn('flex min-w-0 items-center gap-2 text-xs font-medium', status?.kind === 'error' && 'text-red-700', status?.kind === 'warn' && 'text-amber-700', status?.kind === 'ok' && 'text-teal-700', !status && 'text-slate-500')}>
            {status?.kind === 'ok' ? <CheckCircle2 className="size-4 shrink-0" /> : status?.kind === 'warn' || status?.kind === 'error' ? <TriangleAlert className="size-4 shrink-0" /> : <span className="size-2 shrink-0 rounded-full bg-amber-500" />}
            <span className="truncate">{status?.text || 'This draft has unsaved changes.'}</span>
          </p>
          {dirty && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => { setForm(saved); setStatus(null); }} disabled={saving}>Discard</Button>
              <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving ? <LoaderCircle className="animate-spin" /> : <Save />} Save & sync</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
