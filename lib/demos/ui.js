// Small display helpers shared by the Demos console and the public call room.
// Pure module (safe in client components).

export function relativeTime(iso) {
  const time = Date.parse(iso || '');
  if (!time) return '—';
  const seconds = Math.floor((Date.now() - time) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function expiryLabel(iso) {
  if (!iso) return 'no expiry';
  const seconds = Math.floor((Date.parse(iso) - Date.now()) / 1000);
  if (seconds <= 0) return 'expired';
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}m left`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h left`;
  return `${Math.floor(seconds / 86400)}d left`;
}

export function durationLabel(secs) {
  const total = Math.round(Number(secs) || 0);
  if (!total) return '';
  return total < 60 ? `${total}s` : `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, '0')}s`;
}

// How each call outcome is worded and coloured. tone: good | neutral | bad.
export const OUTCOMES = {
  lead_captured: { label: 'Lead captured', tone: 'good' },
  callback_requested: { label: 'Callback requested', tone: 'neutral' },
  info_only: { label: 'Information only', tone: 'neutral' },
  wrong_number: { label: 'Wrong number', tone: 'bad' },
  spam: { label: 'Spam call', tone: 'bad' },
  qualified: { label: 'Qualified', tone: 'good' },
  callback: { label: 'Callback requested', tone: 'neutral' },
  not_interested: { label: 'Not interested', tone: 'bad' },
  dnc: { label: 'Do not call', tone: 'bad' },
};

export const TONE_CLASSES = {
  good: 'bg-teal-50 text-teal-700 ring-teal-200',
  neutral: 'bg-blue-50 text-blue-700 ring-blue-200',
  bad: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export const outcomeOf = (id) => OUTCOMES[id] || { label: String(id || '').replace(/_/g, ' ') || 'Call', tone: 'neutral' };

// A short note to send with a demo link. Plain and honest about what it is;
// the operator edits it after pasting.
export function pitchMessage(business, url) {
  const name = String(business || '').trim() || 'your business';
  return `Hi! I set up a short demo of an AI voice assistant for ${name}. It answers calls the way your team would, takes the caller's details and sends over a summary. Try it here, it takes about 2 minutes (you'll need a microphone): ${url}`;
}

// WhatsApp link with the message ready. With a phone number that includes the
// country code (or a 10-digit Indian number on a Hindi demo) it opens a chat
// with that number; otherwise WhatsApp asks who to send it to.
export function whatsappUrl({ phone, language }, message) {
  const raw = String(phone || '').trim();
  let digits = raw.replace(/\D/g, '');
  if (!raw.startsWith('+')) {
    if (language === 'hi' && digits.length === 10) digits = `91${digits}`;
    else if (language === 'hi' && digits.length === 11 && digits.startsWith('0')) digits = `91${digits.slice(1)}`;
    else if (digits.length < 11) digits = '';
  }
  if (digits.length < 11 || digits.length > 15) digits = '';
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
