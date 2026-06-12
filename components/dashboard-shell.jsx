'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Bot, BookOpen, Plug, PhoneCall, Settings, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { label: 'Overview', icon: LayoutDashboard, href: '/' },
  { label: 'Agent', icon: Bot, href: '/agent' },
  { label: 'Knowledge base', icon: BookOpen, href: '/knowledge' },
  { label: 'Connectors', icon: Plug, href: '/connectors' },
  { label: 'Test call', icon: PhoneCall, href: '/test' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

const TITLES = {
  '/': ['Overview', 'Your agent at a glance'],
  '/agent': ['Agent', 'Voice, language & behaviour'],
  '/knowledge': ['Knowledge base', 'Docs the agent answers from'],
  '/connectors': ['Connectors', 'Live data the agent can read'],
  '/test': ['Test call', 'Talk to your agent live'],
  '/settings': ['Settings', 'Workspace & account'],
};

function Logo() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-gradient-to-br from-indigo-500 to-violet-500 shadow-md shadow-indigo-500/40">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4.5" y="9" width="2.6" height="6" rx="1.3" fill="#fff" />
        <rect x="10.7" y="4.5" width="2.6" height="15" rx="1.3" fill="#fff" />
        <rect x="16.9" y="8" width="2.6" height="8" rx="1.3" fill="#fff" />
      </svg>
    </span>
  );
}

export function DashboardShell({ children }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || '/';
  const [title, subtitle] = TITLES[pathname] || ['Dashboard', ''];

  return (
    <div className="min-h-screen">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-white/85 backdrop-blur-xl transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between gap-2 px-5 py-4">
          <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <Logo />
            <div className="leading-tight">
              <div className="text-[15px] font-bold tracking-tight">Arvo</div>
              <div className="text-[11px] text-muted-foreground">AI voice support</div>
            </div>
          </Link>
          <button
            type="button"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-700 ring-1 ring-indigo-100'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <Icon className="size-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="m-3 rounded-xl border border-border bg-secondary/50 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <span className="size-2 rounded-full bg-emerald-500" />
            Agent live
          </div>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Web voice ready. Connect a phone number to go fully live.
          </p>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-white/70 px-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            className="rounded-md p-2 text-muted-foreground hover:bg-secondary lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold leading-tight">{title}</h1>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 sm:inline-flex">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Live
            </span>
            <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white">
              SA
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
