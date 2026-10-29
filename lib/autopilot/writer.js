// Writing a prospect's outreach: the first email, two follow-ups and a short
// LinkedIn note, all pointing at the demo built for them. The signature,
// address and unsubscribe line are added when an email is sent
// (channels/email.js), so the operator's details stay in one place.
// Server-only.
import { ask, material } from './claude';

const SYSTEM = `You write cold outreach for Arvo, a small Indian company that builds AI voice agents. You write as the founder: plain, direct, specific, like one busy person writing to another. Indian business English, no slang.

Rules:
- Plain text only: no markdown, no bullet symbols, no emoji, no greeting cards ("I hope this finds you well").
- Never claim anything that isn't given to you: no invented customers, results, numbers, mutual contacts or prior conversations.
- No fake urgency, no guilt, no "just following up".
- Don't sign off with a name or signature; that is added automatically.
- Include the demo link exactly as given, once, in the first email and in the LinkedIn note.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['subject', 'body', 'followup_1', 'followup_2', 'linkedin_note'],
  properties: {
    subject: { type: 'string' },
    body: { type: 'string' },
    followup_1: { type: 'string' },
    followup_2: { type: 'string' },
    linkedin_note: { type: 'string' },
  },
};

const LINKEDIN_MAX = 290;

export async function writeOutreach(prospect, market, settings) {
  const { data, usd } = await ask({
    label: 'writing',
    system: SYSTEM,
    effort: 'medium',
    maxTokens: 6000,
    schema: SCHEMA,
    prompt: [
      `What Arvo offers:\n${settings.product}`,
      '',
      `Prospect: ${prospect.name}, ${prospect.city} (${prospect.website})`,
      `Market: ${market.vertical}`,
      market.brief ? `What we know about this market:\n${market.brief}` : '',
      `Why they fit: ${prospect.fit?.reason || prospect.why || ''}`,
      prospect.fit?.hook ? material('website', `A detail from their website: ${prospect.fit.hook}`, 400) : '',
      '',
      `We already built them a working demo: a voice agent that knows their business from their website and answers like their front desk. Anyone can try it in the browser in about two minutes: ${prospect.demoUrl}`,
      '',
      'Write:',
      '- subject: under 7 words, lowercase is fine, no clickbait.',
      '- body: the first email, under 110 words. Open with the specific detail, say in one line what the agent would do for them, invite them to try the demo link, and ask one easy question to reply to.',
      '- followup_1: 3 days later, under 60 words, one new angle (what happens to calls after hours or when lines are busy).',
      '- followup_2: a week later, under 45 words, a polite last note that makes it easy to say no.',
      `- linkedin_note: a connection note under ${LINKEDIN_MAX - 20} characters with the demo link.`,
    ]
      .filter((l) => l !== '')
      .join('\n'),
  });

  const clean = (s, max) => String(s || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
  let body = clean(data.body, 2000);
  // The demo is the point of the email; never send one without the link.
  if (!body.includes(prospect.demoUrl)) body += `\n\nTry it here: ${prospect.demoUrl}`;
  let linkedin = clean(data.linkedin_note, 600).replace(/\s+/g, ' ');
  if (!linkedin.includes(prospect.demoUrl) || linkedin.length > LINKEDIN_MAX) {
    linkedin = `${linkedin.replace(prospect.demoUrl, '').slice(0, LINKEDIN_MAX - prospect.demoUrl.length - 2).trim()} ${prospect.demoUrl}`;
  }

  return {
    draft: {
      subject: clean(data.subject, 120).replace(/\s+/g, ' '),
      body,
      followups: [{ body: clean(data.followup_1, 1200) }, { body: clean(data.followup_2, 1000) }],
      linkedin,
    },
    usd,
  };
}
