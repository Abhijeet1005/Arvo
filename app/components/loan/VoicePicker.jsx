'use client';

// Pick the agent's voice: from the account's own voices, by pasting an id, or
// from the public library.
import { useMemo, useState } from 'react';
import { LibraryBig, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Input, Pill, PreviewButton, voiceMeta } from './controls';
import VoiceLibrary from './VoiceLibrary';

const VOICE_ID_RE = /^[A-Za-z0-9]{10,40}$/;

export default function VoicePicker({ value, onChange, voices, voicesError, tier, language, onVoicesChanged }) {
  const [showAll, setShowAll] = useState(false);
  const [customId, setCustomId] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);

  const accountIds = useMemo(() => new Set((voices || []).map((v) => v.id)), [voices]);
  const hindi = (voices || []).filter((v) => v.hindi);
  const filtered = showAll || hindi.length === 0 ? voices || [] : hindi;
  const selected = (voices || []).find((v) => v.id === value);
  const list = selected && !filtered.includes(selected) ? [selected, ...filtered] : filtered;
  const missing = Array.isArray(voices) && !selected;
  const customValid = VOICE_ID_RE.test(customId.trim());

  return (
    <div className="space-y-4">
      {voicesError && (
        <p role="alert" className="text-sm text-destructive">
          {voicesError}
        </p>
      )}

      {missing && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            The selected voice <span className="font-mono text-xs">{value}</span> isn’t in this ElevenLabs account.
            Pick one below or add it from the library.
          </span>
        </div>
      )}

      {Array.isArray(voices) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p id="voice-list-label" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Your voices ({list.length})
            </p>
            {hindi.length > 0 && hindi.length < voices.length && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
              >
                {showAll ? 'Show Hindi & Indian voices only' : `Show all ${voices.length} voices`}
              </button>
            )}
          </div>
          <div
            role="radiogroup"
            aria-labelledby="voice-list-label"
            className="max-h-80 divide-y divide-border overflow-y-auto rounded-lg border border-border"
          >
            {list.map((v) => {
              const active = v.id === value;
              return (
                <div
                  key={v.id}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 transition-colors',
                    active ? 'bg-blue-50/70 dark:bg-blue-500/10' : 'hover:bg-secondary/50'
                  )}
                >
                  <input
                    type="radio"
                    id={`voice-${v.id}`}
                    name="loan-voice"
                    value={v.id}
                    checked={active}
                    onChange={() => onChange(v.id)}
                    className="size-4 shrink-0 cursor-pointer accent-blue-600"
                  />
                  <label htmlFor={`voice-${v.id}`} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block truncate text-sm font-medium">{v.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{voiceMeta(v) || v.category}</span>
                  </label>
                  {v.hindi && (
                    <Pill className="border-blue-100 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
                      Hindi
                    </Pill>
                  )}
                  <PreviewButton url={v.previewUrl} name={v.name} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="custom-voice" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Or paste a voice ID
        </label>
        <div className="flex gap-2">
          <Input
            id="custom-voice"
            value={customId}
            onChange={(e) => setCustomId(e.target.value)}
            placeholder="e.g. zT03pEAEi0VHKciJODfn"
            maxLength={40}
            autoComplete="off"
            className="font-mono"
          />
          <Button
            variant="outline"
            disabled={!customValid}
            onClick={() => {
              onChange(customId.trim());
              setCustomId('');
            }}
          >
            Use
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <Button variant="secondary" onClick={() => setLibraryOpen((o) => !o)} aria-expanded={libraryOpen}>
          <LibraryBig /> {libraryOpen ? 'Hide voice library' : 'Find more voices in the ElevenLabs library'}
        </Button>
        {libraryOpen && (
          <VoiceLibrary
            accountIds={accountIds}
            selectedId={value}
            tier={tier}
            defaultLanguage={language === 'en' ? 'en-in' : 'hi'}
            onUse={onChange}
            onAdded={async (id) => {
              await onVoicesChanged?.();
              onChange(id);
            }}
          />
        )}
      </div>
    </div>
  );
}
