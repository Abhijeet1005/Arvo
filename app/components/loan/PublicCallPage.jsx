'use client';

// The customer-facing consultation opened from a link shared by an operator.
// It deliberately keeps the conversation simple: status and progress only,
// with no transcript, implementation detail, or dashboard UI.
import { useState } from 'react';
import { ConversationProvider } from '@elevenlabs/react';
import {
  ArrowRight,
  AudioLines,
  Building2,
  CheckCircle2,
  Clock3,
  KeyRound,
  Loader2,
  Mic,
  PhoneOff,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { useLoanCall } from '@/lib/loan/useLoanCall';
import ProgressChecklist from './ProgressChecklist';
import { cn } from '@/lib/utils';

const WAVEFORM_BARS = ['h-3', 'h-6', 'h-9', 'h-5', 'h-11', 'h-7', 'h-10', 'h-4', 'h-8', 'h-5', 'h-3'];

function CompanyHeader({ companyName }) {
  return (
    <header className="border-b border-[#dedbd3] bg-white/90">
      <div className="mx-auto flex h-[72px] w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#174ea6] text-white shadow-sm">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight text-[#151b2a]">
              {companyName || 'Loan consultation'}
            </p>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#697386]">Automated voice assistant</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#dce3ef] bg-[#f7f9fd] px-2.5 py-1.5 text-[11px] font-semibold text-[#315b96] sm:px-3 sm:text-xs">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Secure consultation</span>
          <span className="sm:hidden">Secure</span>
        </div>
      </div>
    </header>
  );
}

function Shell({ children, companyName }) {
  return (
    <main
      className="flex min-h-[100svh] min-w-0 flex-col overflow-x-hidden bg-[#f7f5ef] text-[#151b2a]"
      style={{
        '--foreground': '222 34% 12%',
        '--muted-foreground': '218 12% 43%',
        '--border': '216 20% 86%',
      }}
    >
      <CompanyHeader companyName={companyName} />
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-1 items-center px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        {children}
      </div>
    </main>
  );
}

function DetailCue({ icon: Icon, label, detail }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#edf2fb] text-[#174ea6]">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs font-semibold text-[#20283a]">{label}</p>
        <p className="text-[11px] leading-4 text-[#697386]">{detail}</p>
      </div>
    </div>
  );
}

function ErrorMessage({ error }) {
  if (!error) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-[#e8c7c3] bg-[#fff7f5] px-3.5 py-3 text-left text-sm leading-5 text-[#9d3128]"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{error}</span>
    </div>
  );
}

function BeforeCall({ customerName, companyName, agentName, error, onStart }) {
  return (
    <section className="grid w-full min-w-0 animate-fade-up grid-cols-[minmax(0,1fr)] overflow-hidden rounded-[28px] border border-[#dedbd3] bg-white shadow-[0_24px_80px_-38px_rgba(26,35,55,0.35)] lg:grid-cols-[1.08fr_0.92fr]">
      <div className="min-w-0 p-6 sm:p-9 lg:p-12">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#edf2fb] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#174ea6]">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Automated voice consultation
        </div>

        <h1 className="max-w-xl text-balance text-[2rem] font-semibold leading-[1.12] tracking-[-0.035em] text-[#121827] sm:text-[2.65rem]">
          Hi {customerName}, let&apos;s make your loan enquiry feel simpler.
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-6 text-[#5f6878] sm:text-base sm:leading-7">
          {agentName} from {companyName} will guide you through a short conversation and explain what comes next.
        </p>

        <div className="mt-7 grid grid-cols-1 gap-4 border-y border-[#e8e5de] py-5 sm:grid-cols-2">
          <DetailCue icon={Clock3} label="A few minutes" detail="Take it at your pace" />
          <DetailCue icon={KeyRound} label="Your privacy" detail="Choose a quiet place" />
        </div>

        <div className="mt-7 space-y-3">
          <button
            type="button"
            onClick={onStart}
            className="group flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#174ea6] px-5 py-4 text-[15px] font-semibold text-white shadow-[0_12px_24px_-12px_rgba(23,78,166,0.7)] transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-[#123f89] hover:shadow-[0_16px_28px_-12px_rgba(23,78,166,0.65)] active:translate-y-0 active:scale-[0.99] sm:w-auto sm:min-w-60"
          >
            <Mic className="size-4.5" aria-hidden="true" />
            Start consultation
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
          <p className="flex items-center gap-1.5 text-xs leading-5 text-[#697386]">
            <Mic className="size-3.5 shrink-0" aria-hidden="true" />
            Your browser will ask before using your microphone.
          </p>
        </div>

        <div className="mt-4">
          <ErrorMessage error={error} />
        </div>
      </div>

      <aside className="min-w-0 border-t border-[#dedbd3] bg-[#f0eee8] p-6 sm:p-9 lg:border-l lg:border-t-0 lg:p-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#174ea6]">What to expect</p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[#151b2a]">A simple, guided conversation</h2>
        <div className="mt-6 space-y-1">
          {[
            ['01', 'Tell us what you need', 'Share your goal in your own words.'],
            ['02', 'Answer a few questions', 'We will keep each step clear and focused.'],
            ['03', 'Understand the next step', 'Finish knowing what happens from here.'],
          ].map(([number, title, body]) => (
            <div key={number} className="grid grid-cols-[2rem_1fr] gap-3 border-b border-[#ddd9d0] py-4 first:pt-1 last:border-b-0">
              <span className="pt-0.5 text-xs font-bold tabular-nums text-[#174ea6]">{number}</span>
              <div>
                <p className="text-sm font-semibold text-[#20283a]">{title}</p>
                <p className="mt-1 text-xs leading-5 text-[#697386]">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 space-y-3 rounded-2xl border border-[#d4d9e2] bg-white/75 p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#edf2fb] text-[#174ea6]">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold text-[#20283a]">For your security</p>
              <p className="mt-1 text-xs leading-5 text-[#697386]">
                {agentName} will never ask for an OTP, PIN, password, CVV, bank login, Aadhaar number, or full card number.
              </p>
            </div>
          </div>
          <p className="border-t border-[#e1e4e9] pt-3 text-[11px] leading-5 text-[#697386]">
            This automated voice conversation may be recorded and analysed by {companyName} to follow up on your enquiry.
          </p>
        </div>
      </aside>
    </section>
  );
}

function VoiceWaveform({ active, muted }) {
  return (
    <div className="flex h-12 items-center justify-center gap-1.5" aria-hidden="true">
      {WAVEFORM_BARS.map((height, index) => (
        <span
          key={`${height}-${index}`}
          className={cn(
            'w-1 rounded-full bg-[#8fb4ff] transition-opacity duration-500',
            height,
            active && 'motion-safe:animate-pulse',
            muted && 'opacity-25',
            !active && !muted && 'opacity-55'
          )}
          style={{ animationDelay: `${index * 85}ms` }}
        />
      ))}
    </div>
  );
}

function LiveCall({ status, isSpeaking, progress, error, agentName, companyName, onStop }) {
  const connecting = status === 'connecting';
  const ending = status === 'ending';
  const statusTitle = connecting
    ? 'Opening your consultation'
    : ending
      ? 'Ending your consultation'
      : isSpeaking
        ? `${agentName} is speaking`
        : 'You can speak now';
  const statusDetail = connecting
    ? `Connecting you with ${agentName}.`
    : ending
      ? 'This will only take a moment.'
      : isSpeaking
        ? 'Take your time and respond when you are ready.'
        : `${agentName} is listening.`;

  return (
    <section className="w-full animate-fade-up overflow-hidden rounded-[28px] border border-[#dedbd3] bg-white shadow-[0_24px_80px_-38px_rgba(26,35,55,0.35)]">
      <div className="flex flex-col gap-2 border-b border-[#e4e1da] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#174ea6]">Consultation in progress</p>
          <p className="mt-1 text-sm font-medium text-[#384154]">{agentName} · {companyName}</p>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-[#697386]">
          <KeyRound className="size-3.5 text-[#315b96]" aria-hidden="true" />
          Only share what you are comfortable discussing
        </p>
      </div>

      <div className="grid lg:grid-cols-[1.02fr_0.98fr]">
        <div className="p-5 sm:p-8 lg:p-10">
          <div className="overflow-hidden rounded-3xl bg-[#111a2d] px-5 py-7 text-center text-white sm:px-8 sm:py-9">
            <div className="mx-auto mb-7 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-[11px] font-semibold text-white/80">
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  connecting || ending ? 'bg-[#d7e4ff] motion-safe:animate-pulse' : 'bg-[#72d6a0]'
                )}
                aria-hidden="true"
              />
              {connecting ? 'Connecting' : ending ? 'Closing call' : 'Call live'}
            </div>

            <div className="mx-auto grid size-16 place-items-center rounded-full border border-white/10 bg-white/[0.08] text-[#a9c5ff] shadow-[0_12px_40px_-15px_rgba(77,130,220,0.8)]">
              {connecting || ending ? (
                <Loader2 className="size-6 animate-spin" aria-hidden="true" />
              ) : (
                <AudioLines className="size-6" aria-hidden="true" />
              )}
            </div>

            <div className="my-5">
              <VoiceWaveform active={!connecting && !ending && isSpeaking} muted={connecting || ending} />
            </div>

            <div aria-live="polite">
              <h1 className="text-xl font-semibold tracking-[-0.02em] sm:text-2xl">{statusTitle}</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/60">{statusDetail}</p>
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
            {ending ? 'Ending call…' : 'End consultation'}
          </button>
        </div>

        <aside className="border-t border-[#e4e1da] bg-[#faf9f6] p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#edf2fb] text-[#174ea6]">
              <AudioLines className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#174ea6]">Your conversation</p>
              <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#151b2a]">One clear step at a time</h2>
              <p className="mt-1 text-xs leading-5 text-[#697386]">This updates as your consultation moves forward.</p>
            </div>
          </div>
          <ProgressChecklist progress={progress} className="mt-6" />
        </aside>
      </div>
    </section>
  );
}

function CallEnded({ customerName, companyName, agentName, progress }) {
  const hasProgress = progress?.currentStepIndex >= 0 || progress?.completedStepIds?.length > 0;
  const finalProgress = progress?.currentStepId
    ? {
        ...progress,
        completedStepIds: [...new Set([...(progress.completedStepIds || []), progress.currentStepId])],
      }
    : progress;

  return (
    <section className="w-full animate-fade-up overflow-hidden rounded-[28px] border border-[#dedbd3] bg-white shadow-[0_24px_80px_-38px_rgba(26,35,55,0.35)]">
      <div className={cn('grid', hasProgress && 'lg:grid-cols-[1.02fr_0.98fr]')}>
        <div className="p-7 text-center sm:p-10 lg:p-12 lg:text-left">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#eaf5ef] text-[#24714a] lg:mx-0">
            <CheckCircle2 className="size-7" aria-hidden="true" />
          </span>
          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-[#24714a]">Consultation complete</p>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.035em] text-[#121827] sm:text-4xl">
            Thank you, {customerName}.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-7 text-[#5f6878] lg:mx-0">
            Your conversation with {agentName} has ended. A member of the {companyName} team may follow up after reviewing what you shared.
          </p>

          <div className="mt-7 rounded-2xl border border-[#dce3ef] bg-[#f7f9fd] p-4 text-left">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#174ea6]" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-[#20283a]">You are all set for now</p>
                <p className="mt-1 text-xs leading-5 text-[#697386]">There is nothing else you need to do on this page. You can close it when you are ready.</p>
              </div>
            </div>
          </div>
        </div>

        {hasProgress && (
          <aside className="border-t border-[#e4e1da] bg-[#faf9f6] p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#174ea6]">Your call journey</p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#151b2a]">What you covered together</h2>
            <ProgressChecklist progress={finalProgress} className="mt-5" />
          </aside>
        )}
      </div>
    </section>
  );
}

function CallInner({ token, customerName, customerPhone, companyName, agentName }) {
  const [ended, setEnded] = useState(false);
  const displayCustomerName = customerName || 'there';
  const displayCompanyName = companyName || 'your loan team';
  const displayAgentName = agentName || 'your advisor';

  const { status, isSpeaking, progress, error, start, stop } = useLoanCall({
    sessionUrl: `/api/loan/links/${token}/session`,
    dynamicVariables: {
      customer_name: customerName || 'there',
      customer_phone: customerPhone || 'not on file',
    },
    onCallStarted: (conversationId) => {
      // Register the call for the operator without delaying the conversation.
      fetch('/api/loan/calls', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId, customerName, linkToken: token }),
      }).catch(() => {});
    },
    onCallEnded: () => setEnded(true),
  });

  const idle = status === 'idle' && !ended;
  const live = status === 'connecting' || status === 'connected' || status === 'ending';

  if (idle) {
    return (
      <BeforeCall
        customerName={displayCustomerName}
        companyName={displayCompanyName}
        agentName={displayAgentName}
        error={error}
        onStart={start}
      />
    );
  }

  if (live) {
    return (
      <LiveCall
        status={status}
        isSpeaking={isSpeaking}
        progress={progress}
        error={error}
        agentName={displayAgentName}
        companyName={displayCompanyName}
        onStop={stop}
      />
    );
  }

  return (
    <CallEnded
      customerName={displayCustomerName}
      companyName={displayCompanyName}
      agentName={displayAgentName}
      progress={progress}
    />
  );
}

export default function PublicCallPage({ token, customerName, customerPhone, companyName, agentName }) {
  return (
    <Shell companyName={companyName}>
      <ConversationProvider>
        <CallInner
          token={token}
          customerName={customerName}
          customerPhone={customerPhone}
          companyName={companyName}
          agentName={agentName}
        />
      </ConversationProvider>
    </Shell>
  );
}

// Friendly, non-technical states for a link that cannot be used.
export function LinkUnavailable({ reason }) {
  const copy =
    reason === 'expired'
      ? {
          label: 'Link expired',
          title: 'This consultation link has expired.',
          body: 'The link is past its available date, so it can no longer open a call.',
          action: 'Ask the person who shared it to send you a new consultation link.',
        }
      : reason === 'revoked'
        ? {
            label: 'Link unavailable',
            title: 'This consultation link is no longer active.',
            body: 'The sender has closed this link and it cannot be used again.',
            action: 'Contact the person who shared it if you still need to continue.',
          }
        : reason === 'unavailable'
          ? {
              label: 'Temporarily unavailable',
              title: 'We could not open the consultation just now.',
              body: 'The service may be briefly unavailable. Your link has not been marked invalid.',
              action: 'Wait a moment and reload this page. If it continues, contact the person who shared the link.',
            }
          : {
            label: 'Link not recognised',
            title: 'We could not open this consultation.',
            body: 'The address may be incomplete or may not belong to an active consultation.',
            action: 'Check that you opened the full link, or ask the sender for a new one.',
          };

  return (
    <Shell>
      <section className="mx-auto w-full max-w-xl animate-fade-up overflow-hidden rounded-[28px] border border-[#dedbd3] bg-white shadow-[0_24px_80px_-38px_rgba(26,35,55,0.35)]">
        <div className="p-7 text-center sm:p-10">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#f4eee3] text-[#9a6425]">
            <TriangleAlert className="size-6" aria-hidden="true" />
          </span>
          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-[#9a6425]">{copy.label}</p>
          <h1 className="mx-auto mt-2 max-w-md text-balance text-2xl font-semibold tracking-[-0.03em] text-[#121827] sm:text-3xl">
            {copy.title}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#5f6878]">{copy.body}</p>

          <div className="mt-7 rounded-2xl border border-[#dce3ef] bg-[#f7f9fd] p-4 text-left">
            <div className="flex items-start gap-3">
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-[#174ea6]" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold text-[#20283a]">What to do next</p>
                <p className="mt-1 text-xs leading-5 text-[#697386]">{copy.action}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-[#e8e5de] bg-[#faf9f6] px-6 py-4 text-center text-[11px] leading-5 text-[#697386]">
          Keep personal and banking details private until you have an active consultation.
        </div>
      </section>
    </Shell>
  );
}
