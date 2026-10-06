'use client';

// Browse ElevenLabs' public voice library, preview voices, and add one to the
// account in a click — no trip to elevenlabs.io needed.
import { useCallback, useEffect, useState } from 'react';
import { LoaderCircle, Search, Plus, Check } from 'lucide-react';
import { Button, Input, Control, SelectBox, PreviewButton, voiceMeta } from './controls';

const LANGUAGES = [
  { id: 'hi', label: 'Hindi' },
  { id: 'en-in', label: 'English · Indian accent' },
  { id: 'en', label: 'English · any accent' },
  { id: 'all', label: 'All languages' },
];

export default function VoiceLibrary({ accountIds, selectedId, tier, defaultLanguage = 'hi', onUse, onAdded }) {
  const [filters, setFilters] = useState({ search: '', language: defaultLanguage, gender: '', useCase: 'conversational' });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [adding, setAdding] = useState(null);

  const load = useCallback(
    async (nextPage) => {
      setLoading(true);
      setErr('');
      try {
        const params = new URLSearchParams({ ...filters, page: String(nextPage) });
        const res = await fetch(`/api/loan/voices/library?${params}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not search the voice library.');
        setResults((r) => (nextPage === 0 ? data.voices : [...r, ...data.voices]));
        setHasMore(Boolean(data.hasMore));
        setTotal(data.total ?? null);
        setPage(nextPage);
      } catch (e) {
        setErr(e.message || String(e));
      } finally {
        setLoading(false);
      }
    },
    [filters]
  );

  useEffect(() => {
    load(0);
  }, [load]);

  async function add(v) {
    setAdding(v.id);
    setErr('');
    try {
      const res = await fetch('/api/loan/voices/add', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ publicOwnerId: v.publicOwnerId, voiceId: v.id, name: v.name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not add this voice.');
      onAdded?.(data.voiceId || v.id);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setAdding(null);
    }
  }

  const set = (k) => (value) => setFilters((f) => ({ ...f, [k]: value }));

  return (
    <div className="space-y-4 rounded-xl border border-border bg-secondary/30 p-4">
      <form
        className="grid gap-3 sm:grid-cols-[1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters((f) => ({ ...f, search: query.trim() }));
        }}
        role="search"
      >
        <label htmlFor="library-search" className="sr-only">
          Search the voice library
        </label>
        <Input
          id="library-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or style, e.g. “banking”, “calm”, “Raju”"
          maxLength={80}
        />
        <Button type="submit" variant="outline" disabled={loading}>
          <Search /> Search
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <Control id="library-language" label="Language">
          <SelectBox id="library-language" value={filters.language} onChange={set('language')}>
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </SelectBox>
        </Control>
        <Control id="library-gender" label="Gender">
          <SelectBox id="library-gender" value={filters.gender} onChange={set('gender')}>
            <option value="">Any</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </SelectBox>
        </Control>
        <Control id="library-usecase" label="Made for">
          <SelectBox id="library-usecase" value={filters.useCase} onChange={set('useCase')}>
            <option value="conversational">Conversations & agents</option>
            <option value="any">Anything</option>
          </SelectBox>
        </Control>
      </div>

      {err && (
        <p role="alert" className="text-sm text-destructive">
          {err}
        </p>
      )}

      {total !== null && !loading && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {total.toLocaleString('en-IN')} voices match{filters.search ? ` “${filters.search}”` : ''}.
        </p>
      )}

      <ul className="grid gap-2 sm:grid-cols-2">
        {results.map((v) => {
          const inAccount = accountIds.has(v.id);
          const selected = selectedId === v.id;
          const blocked = !v.freeUsersAllowed && tier === 'free';
          return (
            <li key={v.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
              <div className="flex items-start gap-2.5">
                <PreviewButton url={v.previewUrl} name={v.name} className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{v.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{voiceMeta(v)}</p>
                </div>
              </div>
              {v.description && <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">{v.description}</p>}
              <div className="mt-auto flex items-center justify-end gap-2">
                {blocked ? (
                  <span className="text-[11px] text-muted-foreground">Paid ElevenLabs plans only</span>
                ) : selected ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400">
                    <Check className="size-3.5" aria-hidden="true" /> Selected
                  </span>
                ) : inAccount ? (
                  <Button size="sm" variant="outline" onClick={() => onUse(v.id)}>
                    Use this voice
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => add(v)} disabled={adding !== null}>
                    {adding === v.id ? <LoaderCircle className="animate-spin" /> : <Plus />} Add & use
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex justify-center">
        {loading ? (
          <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> Loading voices…
          </span>
        ) : (
          hasMore && (
            <Button variant="ghost" size="sm" onClick={() => load(page + 1)}>
              Load more
            </Button>
          )
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        “Add & use” copies the voice into this ElevenLabs account’s My Voices. Remember to save.
      </p>
    </div>
  );
}
