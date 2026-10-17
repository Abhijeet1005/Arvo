// Sends a client their leads by email.
//
// Configured with two server settings:
//   ARVO_SMTP_URL   smtps://user:app-password@smtp.gmail.com:465   (percent-encode
//                   special characters in the password)
//   ARVO_MAIL_FROM  optional sender, e.g. Arvo <you@gmail.com>. Defaults to the
//                   user in the SMTP URL.
// Unset means no email. Nothing here throws: a mail that fails must never
// affect a call, so callers get a boolean (and a reason when it matters).
import nodemailer from 'nodemailer';

const g = globalThis;

function smtpUrl() {
  const url = String(process.env.ARVO_SMTP_URL || '').trim();
  return /^smtps?:\/\/\S+$/i.test(url) ? url : '';
}

export const mailEnabled = () => Boolean(smtpUrl());

function sender() {
  const from = String(process.env.ARVO_MAIL_FROM || '').replace(/[\r\n]/g, ' ').trim();
  if (from) return from;
  try {
    return decodeURIComponent(new URL(smtpUrl()).username);
  } catch {
    return '';
  }
}

// One pooled connection for the life of the server.
function transport() {
  const url = smtpUrl();
  if (!url) return null;
  if (g.__arvoMail?.url !== url) {
    g.__arvoMail?.transport?.close?.();
    g.__arvoMail = {
      url,
      transport: nodemailer.createTransport(url, {
        pool: true,
        maxConnections: 2,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
      }),
    };
  }
  return g.__arvoMail.transport;
}

// Returns { ok: true } or { ok: false, error } with a message safe to show.
export async function sendMail({ to, subject, text }) {
  const t = transport();
  if (!t) return { ok: false, error: 'Email is not set up on this server (ARVO_SMTP_URL).' };
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (recipients.length === 0) return { ok: false, error: 'No recipient.' };
  try {
    await t.sendMail({
      from: sender(),
      to: recipients,
      subject: String(subject || '').replace(/[\r\n]+/g, ' ').slice(0, 200),
      text: String(text || ''),
    });
    return { ok: true };
  } catch (e) {
    // Log the reason; show only a generic line (it can contain server details).
    console.error('[demos] email failed:', e?.code || '', e?.responseCode || '', e?.message || e);
    const auth = e?.code === 'EAUTH' || e?.responseCode === 535;
    return { ok: false, error: auth ? 'The mail server refused the login. Check ARVO_SMTP_URL.' : 'The email could not be sent. Check the server log.' };
  }
}
