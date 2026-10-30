// Sending outreach email from the outreach mailbox.
//
// Configured with one server setting, kept apart from the lead-email
// ARVO_SMTP_URL so cold outreach never touches the main domain's reputation:
//   ARVO_OUTREACH_SMTP_URL   smtps://you%40tryarvo.in:password@smtp.zoho.in:465
// The sender address is the user in that URL.
//
// Every email carries the operator's name and postal address, an unsubscribe
// link, and List-Unsubscribe headers (one-click unsubscribe in Gmail/Yahoo).
// Server-only.
import { randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';
import { sequenceKinds } from '../model';

const g = globalThis;

function smtpUrl() {
  const url = String(process.env.ARVO_OUTREACH_SMTP_URL || '').trim();
  return /^smtps?:\/\/\S+$/i.test(url) ? url : '';
}

export const outreachMailEnabled = () => Boolean(smtpUrl());

export function senderAddress() {
  try {
    return decodeURIComponent(new URL(smtpUrl()).username).toLowerCase();
  } catch {
    return '';
  }
}

function transport() {
  const url = smtpUrl();
  if (!url) return null;
  if (g.__arvoOutreachMail?.url !== url) {
    g.__arvoOutreachMail?.transport?.close?.();
    let local = false;
    try {
      local = /^(127\.0\.0\.1|localhost|\[::1\])$/i.test(new URL(url).hostname);
    } catch {}
    g.__arvoOutreachMail = {
      url,
      // Settings go in one object with the url (see lib/demos/mail.js).
      transport: nodemailer.createTransport({
        url,
        requireTLS: !local,
        pool: true,
        maxConnections: 1,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 30000,
      }),
    };
  }
  return g.__arvoOutreachMail.transport;
}

export const unsubscribeUrl = (publicUrl, token) => `${publicUrl}/u/${token}`;

// A notification to the operator (not outreach): from the outreach mailbox,
// no unsubscribe footer. Returns { ok } or { ok: false, error }.
export async function sendNotice({ to, subject, text }) {
  const t = transport();
  if (!t) return { ok: false, error: 'The outreach mailbox is not set up (ARVO_OUTREACH_SMTP_URL).' };
  try {
    await t.sendMail({
      from: { name: 'Arvo Autopilot', address: senderAddress() },
      to,
      subject: String(subject).replace(/[\r\n]+/g, ' ').slice(0, 200),
      text,
    });
    return { ok: true };
  } catch (e) {
    console.error('[autopilot] notification email failed:', e?.code || '', e?.responseCode || '', e?.message || e);
    return { ok: false, error: 'The notification could not be sent. Check the server log.' };
  }
}

// The email of `kind` ('first', 'followup_1', ...) for a prospect, ready to
// send. Follow-ups go as replies in the same thread.
export function composeEmail(p, kind, settings) {
  const s = settings.sender;
  const unsub = unsubscribeUrl(settings.publicUrl, p.unsubToken);
  const index = sequenceKinds(settings).indexOf(kind);
  const body = index <= 0 ? p.draft.body : p.draft.followups[index - 1].body;
  const signature = [s.name, [s.title, s.company].filter(Boolean).join(', ')].filter(Boolean).join('\n');
  const footer = [s.address, `Not interested? One click and you won't hear from us again: ${unsub}`].filter(Boolean).join('\n');
  const first = (p.emails || []).find((e) => e.kind === 'first');
  return {
    subject: index <= 0 ? p.draft.subject : `Re: ${p.draft.subject}`,
    text: `${body}\n\n${signature}\n\n--\n${footer}\n`,
    inReplyTo: index > 0 ? first?.messageId : undefined,
    unsub,
  };
}

// Send one outreach email to the prospect. Returns { ok: true, messageId, to }
// or { ok: false, error, rejected?, spam? }:
//   rejected  the recipient address was refused (a bounce)
//   spam      the mail server refused this message's content as spam; sending
//             it again unchanged only hurts the mailbox's standing
export async function sendOutreach(p, kind, settings) {
  const t = transport();
  if (!t) return { ok: false, error: 'The outreach mailbox is not set up (ARVO_OUTREACH_SMTP_URL).' };
  const from = senderAddress();
  const mail = composeEmail(p, kind, settings);
  // While on hold (sandbox) nothing is sent; the scheduler doesn't call this then.
  if (settings.sandbox) return { ok: false, error: 'Sending is on hold (sandbox).' };
  const to = p.contact.email;
  if (!to) return { ok: false, error: 'No address to send to.' };
  const messageId = `<${randomBytes(12).toString('hex')}@${from.split('@')[1] || 'arvo.local'}>`;
  const replyTo = settings.sender.replyTo || from;
  try {
    await t.sendMail({
      from: settings.sender.name ? { name: settings.sender.name, address: from } : from,
      to,
      replyTo,
      subject: mail.subject,
      text: mail.text,
      messageId,
      ...(mail.inReplyTo ? { inReplyTo: mail.inReplyTo, references: [mail.inReplyTo] } : {}),
      headers: {
        'List-Unsubscribe': `<${mail.unsub}>, <mailto:${replyTo}?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
    return { ok: true, messageId, to };
  } catch (e) {
    console.error('[autopilot] email failed:', e?.code || '', e?.responseCode || '', e?.message || e);
    const auth = e?.code === 'EAUTH' || e?.responseCode === 535;
    // A permanent refusal of this one recipient is a bounce, not a server problem.
    const rejected = e?.responseCode >= 550 && e?.responseCode < 560 && e?.command === 'RCPT TO';
    const spam = !rejected && e?.responseCode >= 550 && e?.responseCode < 560 && (e?.code === 'EMESSAGE' || /spam|virus|content/i.test(String(e?.response || e?.message)));
    return {
      ok: false,
      rejected,
      spam,
      error: auth
        ? 'The outreach mail server refused the login. Check ARVO_OUTREACH_SMTP_URL.'
        : rejected
          ? 'The recipient address was refused.'
          : spam
            ? 'The mail server refused this email as spam.'
            : 'The email could not be sent. Check the server log.',
    };
  }
}
