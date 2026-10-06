'use client';

import { AlertTriangle, ArrowRight, Bot, CheckCircle2, Cpu, Languages, Settings2, Volume2 } from 'lucide-react';
import { LANGUAGES, providerOf } from '@/lib/loan/options';
import { PreviewButton } from './controls';

export default function LoanSetupSummary({ settings, options, onEdit }) {
  const voice = (options?.voices || []).find((item) => item.id === settings.voiceId);
  const voiceMissing = Array.isArray(options?.voices) && !voice;
  const language = LANGUAGES.find((item) => item.id === settings.language)?.label || settings.language;

  const rows = [
    { icon: Cpu, label: 'Intelligence', value: `${providerOf(settings.llm)} · ${settings.llm}` },
    { icon: Languages, label: 'Language', value: settings.language === 'hi' && settings.hinglishMode ? 'Hinglish' : language },
    { icon: Volume2, label: 'Delivery', value: `${Number(settings.speed).toFixed(2)}× pace · ${settings.ttsModel.replace(/^eleven_/, '').replaceAll('_', ' ')}` },
  ];

  return (
    <aside className="h-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_40px_-34px_rgba(15,23,42,.5)]">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-teal-500" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Agent under test</p>
            </div>
            <h3 className="mt-2 text-base font-semibold tracking-[-0.02em] text-slate-950">{settings.agentName}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{settings.companyName}</p>
          </div>
          <span className="grid size-10 place-items-center rounded-xl bg-slate-950 text-blue-300"><Bot className="size-[18px]" /></span>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-100">
          <PreviewButton url={voice?.previewUrl} name={voice?.name || 'voice'} className="bg-white" />
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">Production voice</p>
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-800">{voice?.name || settings.voiceId}</p>
          </div>
          {!voiceMissing && <CheckCircle2 className="size-4 shrink-0 text-teal-600" />}
        </div>

        {voiceMissing && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-4 text-amber-800">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> This voice is not available in the connected account.
          </div>
        )}

        <dl className="mt-4 divide-y divide-slate-100 border-y border-slate-100">
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <div key={row.label} className="flex items-center gap-3 py-3">
                <Icon className="size-3.5 shrink-0 text-slate-400" />
                <dt className="text-[11px] text-slate-500">{row.label}</dt>
                <dd className="ml-auto min-w-0 max-w-[60%] truncate text-right text-[11px] font-semibold text-slate-700">{row.value}</dd>
              </div>
            );
          })}
        </dl>

        <button type="button" onClick={onEdit} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700">
          <Settings2 className="size-3.5" /> Open Agent Studio <ArrowRight className="size-3.5" />
        </button>
      </div>
    </aside>
  );
}
