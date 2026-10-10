'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyRound, LoaderCircle, TriangleAlert } from 'lucide-react';
import LoanCall from './LoanCall';
import LoanResults from './LoanResults';
import LoanConfig from './LoanConfig';
import LoanLinks from './LoanLinks';
import LoanOverview from './LoanOverview';
import LoanProductShell, { LOAN_VIEWS, DEFAULT_VIEW } from './LoanProductShell';
import LoanSetupSummary from './LoanSetupSummary';
import DemoStudio from './DemoStudio';
import { PreviewProvider } from './controls';

const POLL_EVERY_MS = 3000;
const POLL_FOR_MS = 3 * 60 * 1000;
const FINAL = new Set(['done', 'failed']);
const VIEW_IDS = new Set(LOAN_VIEWS.map((view) => view.id));
const LEGACY_TAB_TO_VIEW = { call: 'conversations', links: 'experiences', config: 'agent' };

function viewFromLocation() {
  if (typeof window === 'undefined') return DEFAULT_VIEW;
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('view');
  if (VIEW_IDS.has(requested)) return requested;
  return LEGACY_TAB_TO_VIEW[params.get('tab')] || DEFAULT_VIEW;
}

function LoadingState({ activeView, onNavigate }) {
  return (
    <LoanProductShell activeView={activeView} onNavigate={onNavigate} settings={null} keyConfigured={false}>
      <div className="space-y-5 animate-pulse">
        <div className="h-[360px] rounded-[28px] bg-slate-200" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-32 rounded-2xl bg-slate-200/80" />)}
        </div>
        <div className="h-64 rounded-2xl bg-slate-200/70" />
      </div>
    </LoanProductShell>
  );
}

function ErrorState({ activeView, onNavigate, message, onRetry }) {
  return (
    <LoanProductShell activeView={activeView} onNavigate={onNavigate} settings={null} keyConfigured={false}>
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-red-50 text-red-600">
          <TriangleAlert className="size-5" />
        </span>
        <h2 className="mt-4 text-base font-semibold text-slate-950">Could not open the lending workspace</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
        <button type="button" onClick={onRetry} className="mt-5 h-10 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
          Try again
        </button>
      </div>
    </LoanProductShell>
  );
}

export default function LoanWorkspace() {
  const [data, setData] = useState(null);
  const [options, setOptions] = useState(null);
  const [activeLinkCount, setActiveLinkCount] = useState(null);
  const [loadErr, setLoadErr] = useState('');
  const [view, setView] = useState(DEFAULT_VIEW);
  const polling = useRef(new Set());
  const mounted = useRef(true);

  const mergeCall = useCallback((call) => {
    setData((current) => {
      if (!current) return current;
      const calls = [...current.calls];
      const index = calls.findIndex((item) => item.id === call.id);
      if (index === -1) calls.unshift(call);
      else calls[index] = { ...calls[index], ...call };
      return { ...current, calls };
    });
  }, []);

  const track = useCallback(
    async (id) => {
      if (polling.current.has(id)) return;
      polling.current.add(id);
      const until = Date.now() + POLL_FOR_MS;
      try {
        while (mounted.current && Date.now() < until) {
          await new Promise((resolve) => setTimeout(resolve, POLL_EVERY_MS));
          const response = await fetch(`/api/loan/calls/${id}`, { cache: 'no-store' }).catch(() => null);
          const body = response ? await response.json().catch(() => ({})) : {};
          if (response?.ok && body.call) {
            mergeCall(body.call);
            if (FINAL.has(body.call.status)) break;
          }
        }
      } finally {
        polling.current.delete(id);
      }
    },
    [mergeCall]
  );

  const loadData = useCallback(async () => {
    const response = await fetch('/api/loan', { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Could not load the loan advisor.');
    setData(body);
    return body;
  }, []);

  const loadOptions = useCallback(async () => {
    try {
      const response = await fetch('/api/loan/options', { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      setOptions(body);
    } catch {
      setOptions({ error: 'Could not reach ElevenLabs.' });
    }
  }, []);

  const loadLinkCount = useCallback(async (currentLinks) => {
    if (Array.isArray(currentLinks)) {
      setActiveLinkCount(currentLinks.filter((link) => link.status === 'active').length);
      return;
    }
    try {
      const response = await fetch('/api/loan/links', { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (response.ok) setActiveLinkCount((body.links || []).filter((link) => link.status === 'active').length);
    } catch {
      // The Share experiences view surfaces its own detailed error.
    }
  }, []);

  const selectView = useCallback((nextView) => {
    if (!VIEW_IDS.has(nextView)) return;
    setView(nextView);
    const url = new URL(window.location.href);
    url.searchParams.delete('tab');
    if (nextView === DEFAULT_VIEW) url.searchParams.delete('view');
    else url.searchParams.set('view', nextView);
    window.history.pushState(null, '', url);
  }, []);

  useEffect(() => {
    const syncView = () => setView(viewFromLocation());
    syncView();
    window.addEventListener('popstate', syncView);
    return () => window.removeEventListener('popstate', syncView);
  }, []);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      try {
        setLoadErr('');
        const body = await loadData();
        // Demo calls are followed by the Demos view itself.
        body.calls
          .filter((call) => !call.demoId && !FINAL.has(call.status))
          .slice(0, 5)
          .forEach((call) => track(call.id));
      } catch (error) {
        setLoadErr(error.message || String(error));
      }
    })();
    loadOptions();
    loadLinkCount();
    return () => {
      mounted.current = false;
    };
  }, [loadData, loadLinkCount, loadOptions, track]);

  async function onCallStarted(id, customerName) {
    try {
      const response = await fetch('/api/loan/calls', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId: id, customerName }),
      });
      const body = await response.json().catch(() => ({}));
      if (body.call) mergeCall(body.call);
    } catch {
      // The conversation still becomes visible through the polling path.
    }
  }

  function onCallEnded(id) {
    setData((current) =>
      current
        ? {
            ...current,
            calls: current.calls.map((call) =>
              call.id === id && !FINAL.has(call.status) ? { ...call, status: 'processing' } : call
            ),
          }
        : current
    );
    track(id);
    setTimeout(loadOptions, 5000);
  }

  async function removeCall(id) {
    await fetch(`/api/loan/calls/${id}`, { method: 'DELETE' }).catch(() => null);
    setData((current) => (current ? { ...current, calls: current.calls.filter((call) => call.id !== id) } : current));
  }

  if (loadErr) {
    return (
      <ErrorState
        activeView={view}
        onNavigate={selectView}
        message={loadErr}
        onRetry={() => {
          setData(null);
          setLoadErr('');
          loadData().catch((error) => setLoadErr(error.message || String(error)));
        }}
      />
    );
  }

  if (!data) return <LoadingState activeView={view} onNavigate={selectView} />;

  const { settings, agent } = data;
  // Calls made through demo links belong to the Demos view, not to the loan
  // advisor's own numbers.
  const calls = data.calls.filter((call) => !call.demoId);
  const keyConfigured = options?.key?.configured ?? agent.key?.configured;
  const voiceMissing = Array.isArray(options?.voices) && !options.voices.some((voice) => voice.id === settings.voiceId);

  return (
    <PreviewProvider>
      <LoanProductShell activeView={view} onNavigate={selectView} settings={settings} keyConfigured={keyConfigured}>
        {!keyConfigured && view !== 'agent' && (
          <button
            type="button"
            onClick={() => selectView('agent')}
            className="mb-5 flex w-full items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-950 transition hover:border-amber-300"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700"><KeyRound className="size-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Connect ElevenLabs to activate conversations</span>
              <span className="mt-0.5 block text-xs text-amber-800/80">Open Agent Studio and add an account key. The rest of your configuration is already saved.</span>
            </span>
            <span className="hidden self-center text-xs font-semibold sm:block">Open setup →</span>
          </button>
        )}

        {view === 'demos' && <DemoStudio options={options} settings={settings} />}

        {view === 'overview' && (
          <LoanOverview
            calls={calls}
            settings={settings}
            options={options}
            activeLinkCount={activeLinkCount}
            keyConfigured={Boolean(keyConfigured)}
            onNavigate={selectView}
          />
        )}

        {view === 'conversations' && (
          <div className="space-y-6">
            <section className="grid gap-5 xl:grid-cols-[1.4fr_.6fr]">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_14px_45px_-36px_rgba(15,23,42,.5)]">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-blue-600" />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Live rehearsal</p>
                    </div>
                    <h2 className="mt-1.5 text-base font-semibold tracking-[-0.02em] text-slate-950">Experience the borrower conversation</h2>
                    <p className="mt-1 text-xs text-slate-500">You play the customer. The same production agent, progress events, and policy are used.</p>
                  </div>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">WebRTC · private</span>
                </div>
                <div className="p-5 sm:p-6"><LoanCall agentName={settings.agentName} disabled={!keyConfigured} onCallStarted={onCallStarted} onCallEnded={onCallEnded} /></div>
              </div>
              <LoanSetupSummary settings={settings} options={options} onEdit={() => selectView('agent')} />
            </section>
            <LoanResults calls={calls} onRemove={removeCall} />
          </div>
        )}

        {view === 'experiences' && <LoanLinks onLinksChanged={loadLinkCount} />}

        {view === 'agent' && (
          <div className="mx-auto max-w-6xl">
            {voiceMissing && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" />
                The selected voice is not available on the current ElevenLabs account. Choose another voice before your next call.
              </div>
            )}
            {options ? (
              <LoanConfig
                saved={settings}
                defaults={data.defaults}
                options={options}
                onSaved={(next) => setData((current) => ({ ...current, settings: next }))}
                onOptionsReload={loadOptions}
                onKeyChanged={async () => {
                  await Promise.all([loadData(), loadOptions()]);
                }}
              />
            ) : (
              <div className="flex min-h-64 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
                <LoaderCircle className="size-4 animate-spin" /> Loading your voice account…
              </div>
            )}
          </div>
        )}
      </LoanProductShell>
    </PreviewProvider>
  );
}
