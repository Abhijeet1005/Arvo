'use client';

import { useEffect, useState } from 'react';
import { ConversationProvider } from '@elevenlabs/react';
import {
  ArrowRight,
  AudioLines,
  CircleStop,
  Headphones,
  Loader2,
  Mic2,
  PhoneCall,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLoanCall } from '@/lib/loan/useLoanCall';
import ProgressChecklist from './ProgressChecklist';
import { Input } from './controls';

function clean(value, max) {
  return String(value || '')
    .replace(/[{}<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function timeLabel(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
        {hint && <span className="normal-case tracking-normal text-slate-400">{hint}</span>}
      </span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function VoiceBars({ active, speaking }) {
  const heights = [11, 20, 30, 17, 36, 24, 14, 29, 38, 21, 31, 17, 25, 12];
  return (
    <div className="flex h-14 items-center justify-center gap-1" aria-hidden="true">
      {heights.map((height, index) => (
        <span
          key={index}
          className={cn(
            'w-1 rounded-full bg-blue-500 transition-all duration-300',
            active ? 'opacity-100 motion-safe:animate-pulse' : 'opacity-25',
            active && speaking ? 'bg-blue-400' : 'bg-slate-500'
          )}
          style={{ height, animationDelay: `${index * 75}ms`, animationDuration: `${850 + (index % 4) * 170}ms` }}
        />
      ))}
    </div>
  );
}

function Transcript({ turns, agentName }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <AudioLines className="size-3.5 text-slate-400" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Operator transcript</span>
        </div>
        <span className="text-[10px] text-slate-400">Visible only here</span>
      </div>
      <div className="max-h-64 space-y-3 overflow-y-auto p-3.5" aria-live="polite" aria-label="Live transcript">
        {turns.length > 0 ? (
          turns.map((turn, index) => (
            <div key={index} className={cn('flex gap-2.5', turn.who === 'customer' && 'justify-end')}>
              {turn.who !== 'customer' && (
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-blue-600 text-[9px] font-bold text-white">AI</span>
              )}
              <div className={cn('max-w-[82%] rounded-xl px-3 py-2 text-xs leading-5', turn.who === 'customer' ? 'rounded-tr-sm bg-slate-900 text-white' : 'rounded-tl-sm bg-slate-100 text-slate-700')}>
                <p className={cn('mb-0.5 text-[9px] font-semibold uppercase tracking-[0.1em]', turn.who === 'customer' ? 'text-slate-400' : 'text-blue-600')}>
                  {turn.who === 'customer' ? 'Customer' : agentName}
                </p>
                {turn.text}
              </div>
              {turn.who === 'customer' && (
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-200 text-slate-600"><UserRound className="size-3.5" /></span>
              )}
            </div>
          ))
        ) : (
          <div className="grid min-h-24 place-items-center text-center">
            <p className="max-w-xs text-[11px] leading-5 text-slate-400">The private operator transcript appears after the first spoken turn. Customers never see this panel.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CallInner({ agentName, disabled, onCallStarted, onCallEnded }) {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [nameError, setNameError] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const { status, isSpeaking, turns, progress, error, start, stop } = useLoanCall({
    sessionUrl: '/api/loan/session',
    dynamicVariables: {
      customer_name: clean(customerName, 40) || 'there',
      customer_phone: clean(phone, 20) || 'not on file',
    },
    onCallStarted: (id) => onCallStarted?.(id, clean(customerName, 40)),
    onCallEnded,
  });

  const connected = status === 'connected';
  const connecting = status === 'connecting';
  const ending = status === 'ending';
  const busy = connecting || ending;
  const hasSession = connected || busy || turns.length > 0;

  useEffect(() => {
    if (!connected) return;
    const startedAt = Date.now() - elapsed * 1000;
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [connected]);

  async function handleStart() {
    const name = clean(customerName, 40);
    if (!name) {
      setNameError('Add a customer name before starting the rehearsal.');
      return;
    }
    setNameError('');
    setElapsed(0);
    await start();
  }

  const displayError = nameError || error;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(220px,.72fr)_minmax(320px,1.28fr)]">
        <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100 sm:p-5">
          <div className="flex items-center gap-2.5 border-b border-slate-200 pb-4">
            <span className="grid size-8 place-items-center rounded-lg bg-white text-slate-600 shadow-sm ring-1 ring-slate-200"><UserRound className="size-4" /></span>
            <div>
              <p className="text-xs font-semibold text-slate-800">Lead context</p>
              <p className="mt-0.5 text-[10px] text-slate-400">Injected when the call starts</p>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <Field label="Customer name" hint="Required">
              <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="e.g. Rohit Sharma" maxLength={40} autoComplete="off" disabled={connected || busy} className="bg-white" />
            </Field>
            <Field label="Phone on file" hint="Optional">
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="e.g. 98765 43210" inputMode="tel" maxLength={20} autoComplete="off" disabled={connected || busy} className="bg-white" />
            </Field>
          </div>

          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
            <p className="flex items-center gap-2 text-[11px] font-semibold text-blue-900"><ShieldCheck className="size-3.5 text-blue-600" /> Production-safe rehearsal</p>
            <p className="mt-1.5 text-[10px] leading-4 text-blue-800/70">Uses the live prompt, voice, guardrails, and post-call analysis configured in Agent Studio.</p>
          </div>
        </div>

        <div className="relative min-h-[315px] overflow-hidden rounded-2xl bg-[#0b1220] p-5 text-white sm:p-6">
          <div className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_50%_0%,rgba(37,99,235,.26),transparent_42%)]" />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className={cn('size-2 rounded-full', connected ? 'bg-teal-400 shadow-[0_0_0_5px_rgba(45,212,191,.1)]' : busy ? 'bg-blue-400 motion-safe:animate-pulse' : 'bg-slate-600')} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">
                  {connected ? 'Conversation live' : busy ? 'Opening secure channel' : 'Ready for rehearsal'}
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-500">{timeLabel(elapsed)}</span>
            </div>

            <div className="my-auto py-5 text-center">
              <span className={cn('mx-auto grid size-14 place-items-center rounded-2xl border', connected ? 'border-blue-400/30 bg-blue-500/15 text-blue-300' : 'border-white/10 bg-white/[0.05] text-slate-300')}>
                {busy ? <Loader2 className="size-5 animate-spin" /> : connected ? <Mic2 className="size-5" /> : <Headphones className="size-5" />}
              </span>
              <VoiceBars active={connected} speaking={isSpeaking} />
              <p className="text-base font-semibold tracking-[-0.02em]">
                {connecting ? 'Connecting to the agent…' : ending ? 'Closing the conversation…' : connected ? (isSpeaking ? `${agentName} is speaking` : 'Listening to the customer') : `Talk with ${agentName}`}
              </p>
              <p className="mx-auto mt-2 max-w-sm text-[11px] leading-5 text-slate-400">
                {connected ? 'Speak naturally. Progress and operator-only context update as the call moves forward.' : 'Enter lead context, allow microphone access, and play the borrower in a real web conversation.'}
              </p>
            </div>

            <button
              type="button"
              onClick={connected ? stop : handleStart}
              disabled={busy || (disabled && !connected)}
              className={cn(
                'flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-45',
                connected ? 'bg-white text-slate-950 hover:bg-slate-100 focus-visible:ring-white/20' : 'bg-blue-600 text-white hover:bg-blue-500 focus-visible:ring-blue-400/25'
              )}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : connected ? <CircleStop className="size-4" /> : <PhoneCall className="size-4" />}
              {busy ? (ending ? 'Ending call' : 'Connecting') : connected ? 'End rehearsal' : 'Start live rehearsal'}
              {!busy && !connected && <ArrowRight className="size-4" />}
            </button>
          </div>
        </div>
      </div>

      {displayError && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">{displayError}</p>
      )}

      {hasSession && (
        <div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Qualification journey</span>
              <span className="text-[10px] text-slate-400">Live</span>
            </div>
            <ProgressChecklist progress={progress} />
          </div>
          <Transcript turns={turns} agentName={agentName} />
        </div>
      )}
    </div>
  );
}

export default function LoanCall(props) {
  return (
    <ConversationProvider>
      <CallInner {...props} />
    </ConversationProvider>
  );
}
