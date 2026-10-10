'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Bot,
  ExternalLink,
  LayoutDashboard,
  Link2,
  Menu,
  MessageSquareText,
  Rocket,
  ShieldCheck,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const DEFAULT_VIEW = 'demos';

export const LOAN_VIEWS = [
  { id: 'demos', label: 'Demo factory', icon: Rocket },
  { id: 'overview', label: 'Loan overview', icon: LayoutDashboard },
  { id: 'conversations', label: 'Conversations', icon: MessageSquareText },
  { id: 'experiences', label: 'Share experiences', icon: Link2 },
  { id: 'agent', label: 'Agent Studio', icon: Bot },
];

const VIEW_META = {
  demos: {
    eyebrow: 'Demo factory',
    title: 'Demos',
    description: 'A branded AI voice agent and a link for every company you pitch.',
  },
  overview: {
    eyebrow: 'Workspace overview',
    title: 'Loan qualification',
    description: 'Performance, readiness, and the customer journey in one place.',
  },
  conversations: {
    eyebrow: 'Conversation operations',
    title: 'Calls & outcomes',
    description: 'Rehearse the agent, inspect conversations, and review qualified borrowers.',
  },
  experiences: {
    eyebrow: 'Customer experience',
    title: 'Share experiences',
    description: 'Create a private call room for a lead or a prospective client to try.',
  },
  agent: {
    eyebrow: 'Agent configuration',
    title: 'Agent Studio',
    description: 'Shape the voice, conversation policy, qualification flow, and safeguards.',
  },
};

function BrandMark({ compact = false }) {
  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden bg-blue-600 shadow-[0_8px_24px_-8px_rgba(37,99,235,.75)]',
        compact ? 'size-8 rounded-[10px]' : 'size-9 rounded-xl'
      )}
      aria-hidden="true"
    >
      <span className="flex h-4 items-end gap-[3px]">
        <span className="h-2 w-[3px] rounded-full bg-white/80" />
        <span className="h-4 w-[3px] rounded-full bg-white" />
        <span className="h-3 w-[3px] rounded-full bg-white/90" />
        <span className="h-1.5 w-[3px] rounded-full bg-white/75" />
      </span>
    </span>
  );
}

function Navigation({ activeView, onNavigate, onDone }) {
  return (
    <nav className="space-y-1" aria-label="Workspace">
      {LOAN_VIEWS.map((item) => {
        const Icon = item.icon;
        const active = activeView === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              onNavigate(item.id);
              onDone?.();
            }}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70',
              active
                ? 'bg-white/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)]'
                : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'
            )}
          >
            <Icon className={cn('size-[18px]', active ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300')} />
            <span>{item.label}</span>
            {active && <span className="ml-auto size-1.5 rounded-full bg-blue-400" aria-hidden="true" />}
          </button>
        );
      })}
    </nav>
  );
}

function ProductIdentity({ settings }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark />
      <div className="min-w-0 leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-white">Arvo</span>
          <span className="text-slate-600">/</span>
          <span className="text-[13px] font-medium text-slate-300">Studio</span>
        </div>
        <p className="mt-1 truncate text-[11px] text-slate-500">{settings?.companyName || 'Loan workspace'}</p>
      </div>
    </div>
  );
}

function SidebarStatus({ settings, keyConfigured }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3.5">
      <div className="flex items-start gap-3">
        <span className="relative mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-blue-500/15 text-blue-300">
          <Bot className="size-4" aria-hidden="true" />
          {keyConfigured && (
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-[#0b1220] bg-teal-400" />
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-100">{settings?.agentName || 'Loan advisor'}</p>
          <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
            {keyConfigured ? 'Ready for web conversations' : 'Connect an account to go live'}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-3 text-[10px] uppercase tracking-[0.14em] text-slate-500">
        <span>Deployment</span>
        <span className={cn('flex items-center gap-1.5 font-semibold', keyConfigured ? 'text-teal-300' : 'text-amber-300')}>
          <span className={cn('size-1.5 rounded-full', keyConfigured ? 'bg-teal-400' : 'bg-amber-400')} />
          {keyConfigured ? 'Live' : 'Setup'}
        </span>
      </div>
    </div>
  );
}

function MobileDrawer({ open, onClose, activeView, onNavigate, settings, keyConfigured }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button type="button" className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} aria-label="Close navigation" />
      <aside className="relative flex h-full w-[min(86vw,300px)] flex-col bg-[#0b1220] p-4 shadow-2xl">
        <div className="flex items-center justify-between px-1 pb-7 pt-1">
          <ProductIdentity settings={settings} />
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>
        <Navigation activeView={activeView} onNavigate={onNavigate} onDone={onClose} />
        <div className="mt-auto space-y-3">
          <SidebarStatus settings={settings} keyConfigured={keyConfigured} />
          <Link href="/" className="flex items-center gap-2 px-2 py-2 text-xs text-slate-500 hover:text-slate-300">
            <ExternalLink className="size-3.5" /> All Arvo products
          </Link>
        </div>
      </aside>
    </div>
  );
}

export default function LoanProductShell({ activeView, onNavigate, settings, keyConfigured, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // The lending console is a deliberately fixed light product surface. The
  // parent support app can be dark, so temporarily remove its root class and
  // restore the user's preference when this standalone shell unmounts.
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    root.classList.remove('dark');
    return () => {
      if (wasDark) root.classList.add('dark');
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  const meta = VIEW_META[activeView] || VIEW_META.overview;
  const companyInitials = String(settings?.companyName || 'Loan INC')
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <div className="loan-product min-h-screen overflow-x-hidden bg-[#f4f7fb] text-slate-950 selection:bg-blue-200/70">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col bg-[#0b1220] px-4 py-5 lg:flex">
        <div className="px-2 pb-8">
          <ProductIdentity settings={settings} />
        </div>
        <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">Workspace</div>
        <Navigation activeView={activeView} onNavigate={onNavigate} />

        <div className="mt-7 rounded-2xl border border-blue-400/10 bg-blue-500/[0.07] p-3.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-200">
            <ShieldCheck className="size-4 text-blue-400" /> {activeView === 'demos' ? 'Safeguards on every demo' : 'Conversation policy set'}
          </div>
          <p className="mt-2 text-[11px] leading-[1.55] text-slate-500">
            {activeView === 'demos'
              ? 'Each demo agent says it is an AI, answers only from what you gave it, never takes card details or OTPs, and has a cap on calls and minutes.'
              : 'The agent is instructed not to promise rates or approvals, and to stop customers from sharing sensitive credentials.'}
          </p>
        </div>

        <div className="mt-auto space-y-3">
          <SidebarStatus settings={settings} keyConfigured={keyConfigured} />
          <Link href="/" className="flex items-center gap-2 rounded-lg px-2 py-2 text-xs text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300">
            <ExternalLink className="size-3.5" /> All Arvo products
          </Link>
        </div>
      </aside>

      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        activeView={activeView}
        onNavigate={onNavigate}
        settings={settings}
        keyConfigured={keyConfigured}
      />

      <div className="min-h-screen min-w-0 lg:pl-[252px]">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
          <div className="flex h-[72px] items-center gap-4 px-4 sm:px-6 lg:px-8">
            <button type="button" onClick={() => setMobileOpen(true)} className="grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm lg:hidden" aria-label="Open navigation">
              <Menu className="size-5" />
            </button>
            <div className="flex items-center gap-3 lg:hidden">
              <BrandMark compact />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{meta.eyebrow}</p>
              <div className="flex items-baseline gap-3">
                <h1 className="truncate text-lg font-semibold tracking-[-0.025em] text-slate-950">{meta.title}</h1>
                <p className="hidden truncate text-xs text-slate-500 xl:block">{meta.description}</p>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2.5">
              <div className={cn('hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold sm:flex', keyConfigured ? 'border-teal-200 bg-teal-50 text-teal-700' : 'border-amber-200 bg-amber-50 text-amber-700')}>
                <Activity className="size-3.5" />
                {keyConfigured ? 'Agent online' : 'Setup required'}
              </div>
              <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-left shadow-sm sm:flex" aria-label="Current workspace">
                <span className="grid size-7 place-items-center rounded-lg bg-slate-900 text-[10px] font-bold text-white">{companyInitials}</span>
                <span className="max-w-32 truncate text-xs font-semibold text-slate-700">{settings?.companyName || 'Workspace'}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full min-w-0 max-w-[1480px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
