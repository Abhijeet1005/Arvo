'use client';

import { useState } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { cn } from '@/lib/utils';

function Inner() {
  const [turns, setTurns] = useState([]);
  const [err, setErr] = useState('');

  const conversation = useConversation({
    onConnect: () => console.log('connected'),
    onDisconnect: () => console.log('disconnected'),
    onError: (e) => console.error('convai error', e),
    onMessage: (m) => {
      const text = m?.message ?? m?.text ?? '';
      if (!text) return;
      const who = m?.source === 'user' || m?.role === 'user' ? 'you' : 'agent';
      setTurns((t) => [...t, { who, text }]);
    },
  });
  const { status, isSpeaking } = conversation;

  const connected = status === 'connected';
  const connecting = status === 'connecting';

  async function start() {
    setErr('');
    setTurns([]);
    try {
      // Ask for mic permission with our own copy (no third-party UI).
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const res = await fetch('/api/webrtc-token');
      const data = await res.json();
      if (!res.ok || !data.token) throw new Error(data.error || 'Could not start the session');
      await conversation.startSession({ conversationToken: data.token });
    } catch (e) {
      setErr(e.message || String(e));
    }
  }

  async function stop() {
    await conversation.endSession();
  }

  const label = connecting
    ? 'Connecting…'
    : connected
      ? (isSpeaking ? 'Agent speaking…' : 'Listening…')
      : 'Tap to talk';

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <button
        type="button"
        className={`orb${connected ? ' connected' : ''}${isSpeaking ? ' speaking' : ''}`}
        onClick={connected ? stop : start}
        disabled={connecting}
        aria-label={connected ? 'Stop conversation' : 'Talk to agent'}
      >
        {connected ? (
          <svg width="26" height="26" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2.5" fill="#fff" />
          </svg>
        ) : (
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="3" width="6" height="11" rx="3" fill="#fff" />
            <path d="M6 11a6 6 0 0 0 12 0" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="17" x2="12" y2="21" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            <line x1="9" y1="21" x2="15" y2="21" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}
      </button>

      <div className="flex items-center gap-2 text-sm font-semibold">
        {connected && <span className={`live-dot${isSpeaking ? ' speaking' : ''}`} aria-hidden="true" />}
        {label}
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}

      {turns.length > 0 ? (
        <div
          className="flex max-h-72 w-full max-w-xl flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-card p-3.5 shadow-sm"
          aria-live="polite"
        >
          {turns.map((t, i) => (
            <div
              key={i}
              className={cn(
                'flex max-w-[82%] flex-col gap-0.5 rounded-xl px-3 py-2 text-sm leading-snug animate-fade-up',
                t.who === 'you'
                  ? 'self-end rounded-br-sm bg-emerald-600 text-white'
                  : 'self-start rounded-bl-sm bg-secondary text-foreground'
              )}
            >
              <span
                className={cn(
                  'text-[10px] font-bold uppercase tracking-wide',
                  t.who === 'you' ? 'text-white/85' : 'text-muted-foreground'
                )}
              >
                {t.who === 'you' ? 'You' : 'Agent'}
              </span>
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Tap, allow your mic, and start speaking — the live transcript appears here.
        </p>
      )}
    </div>
  );
}

export default function VoiceAgent() {
  return (
    <ConversationProvider>
      <Inner />
    </ConversationProvider>
  );
}
