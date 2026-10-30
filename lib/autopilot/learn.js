// The weekly review: judge each market on its results (pause the ones that
// don't respond, promote the ones that do), write a short report, propose one
// new market to test, and draft LinkedIn posts for the operator's own profile.
// Server-only.
import { ask } from './claude';
import { marketStats, reviewMarkets, winRate, DEMO_INDUSTRIES, nameKey, COUNTRIES, countryOf, marketBlock } from './model';
import { mutate, logEvent, newId } from './store';

const WEEK = 7 * 86_400_000;
const MAX_LIVE_MARKETS = 6;

export const reviewDue = (state, now = Date.now()) => !state.meta.lastLearnAt || now - Date.parse(state.meta.lastLearnAt) >= WEEK;

export async function weeklyReview(state) {
  const since = Date.now() - WEEK;
  const recentSends = state.prospects.filter((p) => (p.emails || []).some((e) => !e.sandbox && Date.parse(e.at) >= since)).length;
  const stats = marketStats(state.prospects);
  const changes = reviewMarkets(state.markets, stats);

  // A report needs something to report on; the market review still runs.
  // Countries a new market may be in: those that can be emailed right now.
  const countries = Object.entries(COUNTRIES)
    .filter(([code]) => !marketBlock({ country: code }, state.settings))
    .map(([code, c]) => `${code} = ${c.name}`)
    .join(', ');

  let report = null;
  if (recentSends > 0) {
    const lines = state.markets.map((m) => {
      const s = stats[m.id] || {};
      return `- ${m.vertical}, ${m.city}, ${countryOf(m).name} [${m.status}]: ${s.found || 0} found, ${s.rejected || 0} not a fit, ${s.sent || 0} emailed, ${s.replied || 0} replied (${s.interested || 0} interested), ${s.engaged || 0} tried the demo, ${s.unsubscribed || 0} unsubscribed, ${s.bounced || 0} bounced. Win rate ${(winRate(s) * 100).toFixed(1)}%.`;
    });
    const replies = state.prospects
      .filter((p) => p.reply && Date.parse(p.reply.at) >= since)
      .slice(0, 15)
      .map((p) => `- ${p.name} (${p.reply.label}): ${p.reply.summary}`);
    const { data, usd } = await ask({
      label: 'weekly review',
      effort: 'medium',
      maxTokens: 6000,
      system:
        'You are the growth analyst for Arvo, a small Indian company selling AI voice agents to businesses in several countries through cold email with a personalised demo. Be concrete and brief. Never invent numbers; use only the figures given.',
      prompt: [
        `Results so far by market (${recentSends} prospects emailed this week):`,
        ...lines,
        replies.length ? `\nReplies this week:\n${replies.join('\n')}` : '',
        '',
        'Write:',
        '- summary: what worked, what didn\'t and what to change, in under 120 words.',
        `- new_market: one market worth testing next (a kind of business, a city or region, and its country, one of: ${countries}) that is different from those above, the demo preset that suits it (realestate, homeservices or generic), and why in one sentence. Leave vertical empty if none of the evidence points anywhere new.`,
        '- posts: three LinkedIn posts for the founder\'s own profile, each under 120 words, built on what was learned this week (no client names, no invented numbers, no hashtags walls; at most two hashtags).',
      ]
        .filter((l) => l !== '')
        .join('\n'),
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['summary', 'new_market', 'posts'],
        properties: {
          summary: { type: 'string' },
          new_market: {
            type: 'object',
            additionalProperties: false,
            required: ['vertical', 'city', 'country', 'industry', 'why'],
            properties: {
              vertical: { type: 'string' },
              city: { type: 'string' },
              country: { type: 'string', enum: Object.keys(COUNTRIES) },
              industry: { type: 'string', enum: DEMO_INDUSTRIES },
              why: { type: 'string' },
            },
          },
          posts: { type: 'array', items: { type: 'string' } },
        },
      },
    });
    report = { data, usd };
  }

  await mutate((s) => {
    const now = new Date().toISOString();
    s.meta.lastLearnAt = now;
    for (const c of changes) {
      const m = s.markets.find((x) => x.id === c.id);
      if (!m || m.status === c.status) continue;
      m.status = c.status;
      logEvent(s, `Market “${m.vertical}, ${m.city}” is now ${c.status}: ${c.why}`, { kind: c.status === 'paused' ? 'warning' : 'win' });
    }
    if (!report) return;
    const { data } = report;
    const nm = data.new_market || {};
    let added = '';
    const live = s.markets.filter((m) => m.status !== 'paused').length;
    const key = nameKey(`${nm.vertical} ${nm.city}`);
    const country = COUNTRIES[nm.country] ? nm.country : 'IN';
    const allowed = !marketBlock({ country }, s.settings);
    if (nm.vertical && nm.city && allowed && live < MAX_LIVE_MARKETS && !s.markets.some((m) => nameKey(`${m.vertical} ${m.city}`) === key)) {
      s.markets.push({
        id: newId('mkt'),
        vertical: String(nm.vertical).slice(0, 120),
        city: String(nm.city).slice(0, 80),
        country,
        industry: DEMO_INDUSTRIES.includes(nm.industry) ? nm.industry : 'generic',
        status: 'testing',
        brief: '',
        note: String(nm.why || '').slice(0, 300),
        createdAt: now,
      });
      added = `${nm.vertical}, ${nm.city}, ${COUNTRIES[country].name}`;
      logEvent(s, `Started testing a new market: ${added}. ${nm.why || ''}`.trim(), { kind: 'info' });
    }
    s.reports.unshift({ at: now, summary: String(data.summary || '').slice(0, 2000), addedMarket: added, changes });
    for (const text of (data.posts || []).slice(0, 3).reverse()) {
      s.posts.unshift({ id: newId('pst'), at: now, text: String(text).slice(0, 3000), used: false });
    }
    logEvent(s, 'The weekly report and new LinkedIn post drafts are ready.', { kind: 'info' });
  });
}
