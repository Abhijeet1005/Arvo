'use client';

// The call room a company opens from a demo link: its own name, logo and
// colour, a live checklist of the conversation, and, once the call ends, the
// details the agent captured for the team. Public page, no login, no
// dashboard chrome.
import { useEffect, useState } from 'react';
import { ConversationProvider } from '@elevenlabs/react';
import {
  ArrowRight,
  AudioLines,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mic,
  PhoneOff,
  RotateCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { useLoanCall } from '@/lib/loan/useLoanCall';
import ProgressChecklist from './ProgressChecklist';
import { brand } from '@/lib/demos/color';
import { outcomeOf, TONE_CLASSES } from '@/lib/demos/ui';
import { cn } from '@/lib/utils';

const WAVEFORM_BARS = ['h-3', 'h-6', 'h-9', 'h-5', 'h-11', 'h-7', 'h-10', 'h-4', 'h-8', 'h-5', 'h-3'];
const CARD = 'rounded-[28px] border border-[#dedbd3] bg-white shadow-[0_24px_80px_-38px_rgba(26,35,55,0.35)]';
const RESULT_POLL_MS = 4000;
const RESULT_POLL_TRIES = 24;

const accentText = { color: 'var(--accent-text)' };
const accentFill = { backgroundColor: 'var(--accent)', color: 'var(--accent-ink)' };

// ----------------------------------------------------------------- copy

function copyFor(demo) {
  const business = demo.businessName;
  const agent = demo.agentName;
  if (demo.templateId === 'lending') {
    return {
      title: `Experience ${business}’s AI loan advisor`,
      body: `${agent} will speak to you the way it would to someone who enquired about a loan. Play the customer: answer in Hindi, English or both, then see the profile it hands to your team.`,
      start: 'Start the demo call',
      how: [
        ['Talk', 'You are the customer who asked about a loan. Reply naturally.'],
        ['Watch', 'The checklist follows the conversation as it happens.'],
        ['See', 'The profile the agent would pass to your executives.'],
      ],
      captured: 'The profile your executives would receive',
    };
  }
  return {
    title: `Talk to ${agent}, ${business}’s AI assistant`,
    body: `This is a real conversation with an AI voice assistant set up for ${business}. Ask what your customers would ask, then see the details it captures for your team.`,
    start: 'Start talking',
    how: [
      ['Talk', `Ask ${agent} what a caller would ask. It answers from what it knows about ${business}.`],
      ['Watch', 'The checklist follows the conversation as it happens.'],
      ['See', 'The details your team would get after every call.'],
    ],
    captured: `What ${business}’s team would receive`,
  };
}

// ------------------------------------------------------------- pieces

function BrandTile({ name, logoUrl, className }) {
  const [broken, setBroken] = useState(false);
  const initial = (String(name || '?').trim()[0] || '?').toUpperCase();
  if (logoUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        // The page address holds the link's token: never send it to the logo's host.
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={cn('shrink-0 rounded-xl border border-black/5 bg-white object-contain p-1', className)}
      />
    );
  }
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-xl font-semibold', className)} style={accentFill} aria-hidden="true">
      {initial}
    </span>
  );
}

function Shell({ demo, children }) {
  const colours = brand(demo?.accent);
  return (
    <main
      className="flex min-h-[100svh] min-w-0 flex-col overflow-x-hidden bg-[#f7f5ef] text-[#151b2a]"
      style={{
        '--accent': colours.accent,
        '--accent-ink': colours.ink,
        '--accent-text': colours.text,
        // This page keeps its light look whatever the visitor's system theme is.
        '--foreground': '222 34% 12%',
        '--muted-foreground': '218 12% 43%',
        '--border': '216 20% 86%',
        '--card': '0 0% 100%',
      }}
    >
      <header className="border-b border-[#dedbd3] bg-white/90">
        <div className="mx-auto flex h-[72px] w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {demo ? <BrandTile name={demo.businessName} logoUrl={demo.logoUrl} className="size-10 text-base" /> : null}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight text-[#151b2a]">{demo?.businessName || 'Voice demo'}</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#697386]">AI voice assistant</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#dce3ef] bg-[#f7f9fd] px-2.5 py-1.5 text-[11px] font-semibold sm:px-3 sm:text-xs" style={accentText}>
            <Sparkles className="size-3.5" aria-hidden="true" />
            Live demo
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 items-center px-4 py-6 sm:px-6 sm:py-10 lg:px-8">{children}</div>
      <footer className="px-4 pb-6 text-center text-[11px] leading-5 text-[#697386]">
        A demonstration built with Arvo. The voice is AI-generated and the call is recorded to produce the summary shown afterwards.
      </footer>
    </main>
  );
}

function ErrorMessage({ error }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-[#e8c7c3] bg-[#fff7f5] px-3.5 py-3 text-left text-sm leading-5 text-[#9d3128]">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{error}</span>
    </div>
  );
}

function VoiceWaveform({ active, muted }) {
  return (
    <div className="flex h-12 items-center justify-center gap-1.5" aria-hidden="true">
      {WAVEFORM_BARS.map((height, index) => (
        <span
          key={`${height}-${index}`}
          className={cn('w-1 rounded-full bg-white/70 transition-opacity duration-500', height, active && 'motion-safe:animate-pulse', muted && 'opacity-25', !active && !muted && 'opacity-50')}
          style={{ animationDelay: `${index * 85}ms` }}
        />
      ))}
    </div>
  );
}

// ------------------------------------------------------------- before

function BeforeCall({ demo, copy, full, callerName, onCallerName, error, onStart }) {
  const needsName = demo.needsCallerName;
  const canStart = !full && (!needsName || callerName.trim().length > 0);
  return (
    <section className={cn('grid w-full min-w-0 animate-fade-up grid-cols-[minmax(0,1fr)] overflow-hidden lg:grid-cols-[1.08fr_0.92fr]', CARD)}>
      <div className="min-w-0 p-6 sm:p-9 lg:p-12">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#f2f0ea] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em]" style={accentText}>
          <Sparkles className="size-3.5" aria-hidden="true" />
          Live AI voice demo
        </div>

        <h1 className="max-w-xl text-balance text-[2rem] font-semibold leading-[1.12] tracking-[-0.035em] text-[#121827] sm:text-[2.65rem]">{copy.title}</h1>
        <p className="mt-4 max-w-lg text-[15px] leading-6 text-[#5f6878] sm:text-base sm:leading-7">{copy.body}</p>

        {needsName && !full && (
          <label className="mt-6 block max-w-sm">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#697386]">Your name</span>
            <input
              value={callerName}
              onChange={(event) => onCallerName(event.target.value)}
              maxLength={40}
              autoComplete="given-name"
              placeholder="So the agent can address you"
              className="mt-1.5 h-11 w-full rounded-xl border border-[#d8d5ce] bg-white px-3.5 text-sm text-[#151b2a] outline-none placeholder:text-[#9aa1ad] focus:border-slate-500 focus:ring-4 focus:ring-slate-500/15"
            />
          </label>
        )}

        {demo.tryPhrases?.length > 0 && !full && (
          <div className="mt-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#697386]">Try saying</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {demo.tryPhrases.map((phrase) => (
                <li key={phrase} className="rounded-full border border-[#e1ded6] bg-[#faf9f6] px-3 py-1.5 text-xs leading-4 text-[#394254]">
                  “{phrase}”
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-7 space-y-3">
          {full ? (
            <div className="flex items-start gap-3 rounded-2xl border border-[#e8dcc6] bg-[#fbf6ec] p-4 text-sm text-[#7a5520]">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>This demo link has reached its limit of calls. Ask the person who sent it for a new one.</span>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={onStart}
                disabled={!canStart}
                style={accentFill}
                className="group flex w-full items-center justify-center gap-2.5 rounded-xl px-5 py-4 text-[15px] font-semibold shadow-[0_12px_24px_-14px_rgba(15,23,42,0.6)] transition-[filter,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:brightness-95 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:w-auto sm:min-w-60"
              >
                <Mic className="size-5" aria-hidden="true" />
                {copy.start}
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
              <p className="flex items-center gap-1.5 text-xs leading-5 text-[#697386]">
                <Mic className="size-3.5 shrink-0" aria-hidden="true" />
                Your browser will ask before using your microphone.
              </p>
            </>
          )}
        </div>

        <div className="mt-4">
          <ErrorMessage error={error} />
        </div>
      </div>

      <aside className="min-w-0 border-t border-[#dedbd3] bg-[#f0eee8] p-6 sm:p-9 lg:border-l lg:border-t-0 lg:p-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={accentText}>How it works</p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[#151b2a]">Three minutes, start to finish</h2>
        <div className="mt-6 space-y-1">
          {copy.how.map(([title, body], index) => (
            <div key={title} className="grid grid-cols-[2rem_1fr] gap-3 border-b border-[#ddd9d0] py-4 first:pt-1 last:border-b-0">
              <span className="pt-0.5 text-xs font-bold tabular-nums" style={accentText}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <p className="text-sm font-semibold text-[#20283a]">{title}</p>
                <p className="mt-1 text-xs leading-5 text-[#697386]">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#d4d9e2] bg-white/75 p-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#f2f0ea]" style={accentText}>
            <ShieldCheck className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold text-[#20283a]">You are talking to an AI</p>
            <p className="mt-1 text-xs leading-5 text-[#697386]">
              {demo.agentName} is an AI voice assistant. Please don’t share real card numbers, passwords or one-time codes. The call is recorded to prepare the summary you’ll see afterwards.
            </p>
          </div>
        </div>
      </aside>
    </section>
  );
}

// --------------------------------------------------------------- live

function LiveCall({ demo, status, isSpeaking, progress, error, onStop }) {
  const connecting = status === 'connecting';
  const ending = status === 'ending';
  const agent = demo.agentName;
  const title = connecting ? 'Opening the call' : ending ? 'Ending the call' : isSpeaking ? `${agent} is speaking` : 'You can speak now';
  const detail = connecting ? `Connecting you with ${agent}.` : ending ? 'This will only take a moment.' : isSpeaking ? 'Take your time and respond when you are ready.' : `${agent} is listening.`;

  return (
    <section className={cn('w-full animate-fade-up overflow-hidden', CARD)}>
      <div className="flex flex-col gap-2 border-b border-[#e4e1da] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={accentText}>Call in progress</p>
          <p className="mt-1 text-sm font-medium text-[#384154]">
            {agent} · {demo.businessName}
          </p>
        </div>
        <p className="text-xs text-[#697386]">Ask anything a real caller would ask</p>
      </div>

      <div className="grid lg:grid-cols-[1.02fr_0.98fr]">
        <div className="p-5 sm:p-8 lg:p-10">
          <div className="overflow-hidden rounded-3xl bg-[#111a2d] px-5 py-7 text-center text-white sm:px-8 sm:py-9">
            <div className="mx-auto mb-7 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[11px] font-semibold text-white/80">
              <span className={cn('size-1.5 rounded-full', connecting || ending ? 'bg-[#d7e4ff] motion-safe:animate-pulse' : 'bg-[#72d6a0]')} aria-hidden="true" />
              {connecting ? 'Connecting' : ending ? 'Closing call' : 'Call live'}
            </div>

            <div className="mx-auto grid size-16 place-items-center rounded-full border border-white/10 text-white shadow-[0_12px_40px_-15px_rgba(255,255,255,0.35)]" style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 70%, #111a2d)' }}>
              {connecting || ending ? <Loader2 className="size-6 animate-spin" aria-hidden="true" /> : <AudioLines className="size-6" aria-hidden="true" />}
            </div>

            <div className="my-5">
              <VoiceWaveform active={!connecting && !ending && isSpeaking} muted={connecting || ending} />
            </div>

            <div aria-live="polite">
              <h1 className="text-xl font-semibold tracking-[-0.02em] sm:text-2xl">{title}</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/60">{detail}</p>
            </div>
          </div>

          <div className="mt-4">
            <ErrorMessage error={error} />
          </div>

          <button
            type="button"
            onClick={onStop}
            disabled={ending}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-[#d8d5ce] bg-white px-5 py-3.5 text-sm font-semibold text-[#394254] transition-colors hover:border-[#c9c5bc] hover:bg-[#faf9f6] disabled:cursor-wait disabled:opacity-60"
          >
            {ending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <PhoneOff className="size-4" aria-hidden="true" />}
            {ending ? 'Ending call…' : 'End call'}
          </button>
        </div>

        <aside className="border-t border-[#e4e1da] bg-[#faf9f6] p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em]" style={accentText}>The conversation</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#151b2a]">Following along</h2>
          <p className="mt-1 text-xs leading-5 text-[#697386]">This updates as the call moves forward.</p>
          <ProgressChecklist progress={progress} steps={demo.steps} className="mt-5" />
        </aside>
      </div>
    </section>
  );
}

// -------------------------------------------------------------- after

// The agent's write-up appears a little after the call ends: poll for it.
function useCallResult(token, callId) {
  const [state, setState] = useState({ status: 'pending', result: null });

  useEffect(() => {
    if (!callId) return undefined;
    let cancelled = false;
    let timer;
    let tries = 0;

    const tick = async () => {
      if (cancelled) return;
      tries += 1;
      try {
        const response = await fetch(`/api/loan/links/${token}/result?call=${encodeURIComponent(callId)}`, { cache: 'no-store' });
        if (response.ok) {
          const body = await response.json();
          if (cancelled) return;
          setState({ status: body.status, result: body.result || null });
          if (body.status !== 'pending') return;
        }
      } catch {
        // Keep trying until the time is up.
      }
      if (tries >= RESULT_POLL_TRIES) {
        if (!cancelled) setState((s) => (s.status === 'pending' ? { ...s, status: 'timeout' } : s));
        return;
      }
      timer = setTimeout(tick, RESULT_POLL_MS);
    };

    setState({ status: 'pending', result: null });
    timer = setTimeout(tick, 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [token, callId]);

  return state;
}

function ResultCard({ copy, result }) {
  const outcome = outcomeOf(result.outcome);
  const rows = [];
  const has = (key) => result.fields.some((f) => f.key === key);
  if (result.callerName && !has('caller_name')) rows.push(['Name', result.callerName]);
  if (result.callerPhone && !has('caller_phone')) rows.push(['Phone', result.callerPhone]);
  for (const f of result.fields) rows.push([f.label, f.value]);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#dedbd3] bg-white text-left">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#ebe8e1] bg-[#faf9f6] px-5 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={accentText}>{copy.captured}</p>
          <h3 className="mt-1 truncate text-base font-semibold tracking-[-0.02em] text-[#151b2a]">{result.title || 'New enquiry'}</h3>
        </div>
        <span className={cn('inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset', TONE_CLASSES[outcome.tone])}>
          {outcome.label}
          {result.urgency && result.urgency !== 'normal' ? ` · ${result.urgency}` : ''}
        </span>
      </div>

      {rows.length > 0 && (
        <dl className="grid gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={`${label}-${value}`} className="min-w-0">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a92a0]">{label}</dt>
              <dd className="mt-0.5 break-words text-sm font-medium text-[#20283a]">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {result.summary && <p className="border-t border-[#ebe8e1] px-5 py-4 text-sm leading-6 text-[#4a5365]">{result.summary}</p>}
      {result.notes && (
        <p className="border-t border-[#ebe8e1] bg-[#faf9f6] px-5 py-3 text-xs leading-5 text-[#697386]">
          <span className="font-semibold text-[#394254]">Note for the team: </span>
          {result.notes}
        </p>
      )}
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="rounded-2xl border border-[#dedbd3] bg-white p-5 text-left" aria-live="polite">
      <div className="flex items-center gap-2.5 text-sm font-medium text-[#394254]">
        <Loader2 className="size-4 animate-spin" style={accentText} aria-hidden="true" />
        Preparing the summary. This takes up to a minute.
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2" aria-hidden="true">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="space-y-1.5">
            <div className="h-2 w-16 animate-pulse rounded bg-[#ece9e2]" />
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-[#f1efe9]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CallEnded({ demo, copy, token, callId, progress, canAgain, onAgain }) {
  const { status, result } = useCallResult(token, callId);
  const hasProgress = progress?.currentStepIndex >= 0 || progress?.completedStepIds?.length > 0;
  const finalProgress = progress?.currentStepId
    ? { ...progress, completedStepIds: [...new Set([...(progress.completedStepIds || []), progress.currentStepId])] }
    : progress;

  return (
    <section className={cn('w-full animate-fade-up overflow-hidden', CARD)}>
      <div className={cn('grid', hasProgress && 'lg:grid-cols-[1.12fr_0.88fr]')}>
        <div className="p-6 sm:p-9 lg:p-11">
          <span className="grid size-14 place-items-center rounded-2xl bg-[#eaf5ef] text-[#24714a]">
            <CheckCircle2 className="size-7" aria-hidden="true" />
          </span>
          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-[#24714a]">Call complete</p>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.035em] text-[#121827] sm:text-4xl">That’s what your callers would experience.</h1>
          <p className="mt-3 max-w-lg text-[15px] leading-7 text-[#5f6878]">
            Every call ends with a record like this for {demo.businessName}’s team, with no one having to take notes.
          </p>

          <div className="mt-6">
            {status === 'done' && result ? <ResultCard copy={copy} result={result} /> : null}
            {status === 'done' && !result ? (
              <p className="rounded-2xl border border-[#dedbd3] bg-[#faf9f6] p-4 text-sm leading-6 text-[#5f6878]">
                The call was too short to capture details. Try again and say a little more.
              </p>
            ) : null}
            {status === 'pending' ? <ResultSkeleton /> : null}
            {status === 'failed' || status === 'timeout' ? (
              <p className="rounded-2xl border border-[#dedbd3] bg-[#faf9f6] p-4 text-sm leading-6 text-[#5f6878]">
                The summary is taking longer than usual. It will be in the dashboard {demo.businessName}’s team would use.
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {demo.cta ? (
              <a
                href={demo.cta.url}
                target="_blank"
                rel="noopener noreferrer"
                style={accentFill}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold shadow-[0_12px_24px_-14px_rgba(15,23,42,0.6)] transition hover:brightness-95"
              >
                {demo.cta.label}
                <ExternalLink className="size-4" aria-hidden="true" />
              </a>
            ) : null}
            {canAgain ? (
              <button
                type="button"
                onClick={onAgain}
                className="inline-flex items-center gap-2 rounded-xl border border-[#d8d5ce] bg-white px-5 py-3.5 text-sm font-semibold text-[#394254] transition-colors hover:border-[#c9c5bc] hover:bg-[#faf9f6]"
              >
                <RotateCw className="size-4" aria-hidden="true" />
                Talk again
              </button>
            ) : null}
          </div>
        </div>

        {hasProgress && (
          <aside className="border-t border-[#e4e1da] bg-[#faf9f6] p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em]" style={accentText}>The call</p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#151b2a]">What was covered</h2>
            <ProgressChecklist progress={finalProgress} steps={demo.steps} className="mt-5" />
          </aside>
        )}
      </div>
    </section>
  );
}

// --------------------------------------------------------------- page

function CallInner({ token, demo, full }) {
  const copy = copyFor(demo);
  const [callerName, setCallerName] = useState('');
  const [callId, setCallId] = useState(null);
  const [ended, setEnded] = useState(false);
  const [sessionsUsed, setSessionsUsed] = useState(0);

  const name = callerName.trim();
  const { status, isSpeaking, progress, error, start, stop } = useLoanCall({
    sessionUrl: `/api/loan/links/${token}/session`,
    dynamicVariables: demo.needsCallerName ? { customer_name: name || 'there', customer_phone: 'not on file' } : undefined,
    onCallStarted: (conversationId) => {
      setCallId(conversationId);
      setSessionsUsed((n) => n + 1);
      // Register the call so the operator sees it, without delaying the conversation.
      fetch('/api/loan/calls', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId, customerName: name, linkToken: token }),
      }).catch(() => {});
    },
    onCallEnded: () => setEnded(true),
  });

  const live = status === 'connecting' || status === 'connected' || status === 'ending';

  function begin() {
    setEnded(false);
    setCallId(null);
    start();
  }

  if (live) {
    return <LiveCall demo={demo} status={status} isSpeaking={isSpeaking} progress={progress} error={error} onStop={stop} />;
  }

  if (ended && callId) {
    return <CallEnded demo={demo} copy={copy} token={token} callId={callId} progress={progress} canAgain={!full} onAgain={begin} />;
  }

  return (
    <BeforeCall
      demo={demo}
      copy={copy}
      full={full && sessionsUsed === 0}
      callerName={callerName}
      onCallerName={setCallerName}
      error={error}
      onStart={begin}
    />
  );
}

export default function DemoCallPage({ token, demo, full = false }) {
  return (
    <Shell demo={demo}>
      <ConversationProvider>
        <CallInner token={token} demo={demo} full={full} />
      </ConversationProvider>
    </Shell>
  );
}

// A demo link that cannot be opened, in plain words.
export function DemoUnavailable({ reason }) {
  const copy =
    reason === 'expired'
      ? { label: 'Link expired', title: 'This demo link has expired.', body: 'It is past its available date, so it can no longer open a call.', action: 'Ask the person who sent it for a new link.' }
      : reason === 'revoked'
        ? { label: 'Link closed', title: 'This demo is no longer available.', body: 'The sender has closed this demo.', action: 'Contact the person who sent it if you would still like to try it.' }
        : reason === 'unavailable'
          ? { label: 'Temporarily unavailable', title: 'We could not open the demo just now.', body: 'The service may be briefly unavailable. The link has not been marked invalid.', action: 'Wait a moment and reload this page.' }
          : { label: 'Link not recognised', title: 'We could not open this demo.', body: 'The address may be incomplete or may not belong to an active demo.', action: 'Check that you opened the full link, or ask the sender for a new one.' };

  return (
    <Shell demo={null}>
      <section className={cn('mx-auto w-full max-w-xl animate-fade-up overflow-hidden', CARD)}>
        <div className="p-7 text-center sm:p-10">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f4eee3] text-[#9a6425]">
            <TriangleAlert className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-[#9a6425]">{copy.label}</p>
          <h1 className="mx-auto mt-2 max-w-md text-balance text-2xl font-semibold tracking-[-0.03em] text-[#121827] sm:text-3xl">{copy.title}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#5f6878]">{copy.body}</p>
          <p className="mx-auto mt-5 max-w-md rounded-2xl border border-[#dce3ef] bg-[#f7f9fd] p-4 text-xs leading-5 text-[#697386]">{copy.action}</p>
        </div>
      </section>
    </Shell>
  );
}
