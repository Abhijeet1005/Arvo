import { unsubscribe, UNSUB_TOKEN_RE } from '@/lib/autopilot/unsubscribe';

export const dynamic = 'force-dynamic';

// The unsubscribe link in outreach emails. Public (no login).
//   GET   a page with one button. Opening the link doesn't unsubscribe by
//         itself, because mail scanners open every link in an email.
//   POST  unsubscribes: the button, or a mail app's one-click unsubscribe
//         (List-Unsubscribe-Post).

const page = (title, body, form = '') => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${title}</title>
<style>
  body { margin: 0; font: 16px/1.5 system-ui, -apple-system, Segoe UI, sans-serif; background: #f7f7f5; color: #1f2328; }
  main { max-width: 420px; margin: 18vh auto 0; padding: 32px 24px; background: #fff; border: 1px solid #e5e5e0; border-radius: 12px; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { margin: 0 0 20px; color: #57606a; }
  button { font: inherit; padding: 10px 18px; border: 0; border-radius: 8px; background: #1f2328; color: #fff; cursor: pointer; }
  @media (prefers-color-scheme: dark) {
    body { background: #111; color: #e6e6e6; } main { background: #1a1a1a; border-color: #2a2a2a; } p { color: #a0a0a0; } button { background: #e6e6e6; color: #111; }
  }
</style></head><body><main><h1>${title}</h1><p>${body}</p>${form}</main></body></html>`;

const html = (text, status = 200) =>
  new Response(text, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });

export async function GET(_req, { params }) {
  const { token } = await params;
  if (!UNSUB_TOKEN_RE.test(String(token))) return html(page('Link not recognised', 'This unsubscribe link is not valid.'), 404);
  return html(
    page(
      'Unsubscribe',
      'Stop all further emails from us to your company?',
      `<form method="post"><button type="submit">Unsubscribe</button></form>`
    )
  );
}

export async function POST(_req, { params }) {
  const { token } = await params;
  const { ok } = await unsubscribe(token);
  if (!ok) return html(page('Link not recognised', 'This unsubscribe link is not valid.'), 404);
  return html(page('You’re unsubscribed', 'You won’t hear from us again. Sorry for the interruption.'));
}
