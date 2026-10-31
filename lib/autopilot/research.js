// Market research: for one market, a short brief on who buys and why, and a
// list of real companies to approach. Two calls: one searches the web and
// writes its findings, a second turns those findings into structured data
// (keeps the search free to cite and wander; keeps the data exact).
// Server-only.
import { ask } from './claude';
import { cleanLinkedin, countryOf } from './model';

const RESEARCH_SYSTEM = `You research B2B sales prospects for Arvo, an Indian company that sells AI voice agents that answer a business's phone and website calls, capture enquiries and book the next step.

The best prospects are funded startups and growing small or mid-sized companies that get a steady flow of inbound calls or enquiries and lose some of them (missed calls, after-hours, busy lines). Avoid one-person shops, directories, franchise listing pages and large enterprises with long procurement.

Only list companies you actually found on the web, each with its own official website. Never invent a company, a website or a contact detail. Skip a company when you can't find its own site, and skip any company based outside the country asked for.`;

export async function researchMarket(market, { exclude = [], count = 12 } = {}) {
  const avoid = exclude.slice(0, 150).join('; ');
  const country = countryOf(market);
  const { text: findings, usd: searchUsd } = await ask({
    label: 'research',
    system: RESEARCH_SYSTEM,
    webSearch: 8,
    effort: 'medium',
    prompt: [
      `Market: ${market.vertical} in ${market.city}, ${country.name}. Only companies based in ${country.name}.`,
      country.rule ? `Every company you list must meet this: ${country.rule}` : '',
      market.brief ? `What we learned about this market before:\n${market.brief}` : '',
      '',
      'Do two things.',
      '1. Write a short brief (under 120 words): who in this market gets the most inbound calls or enquiries, what they lose when calls go unanswered, and the angle most likely to make them want an AI voice agent.',
      `2. Find ${count} companies in this market that fit, with for each: name, official website, city or area, one sentence on why it fits (something specific you saw), and its LinkedIn company page if you came across it.`,
      avoid ? `\nAlready known, don't list these again: ${avoid}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  });

  const { data, usd: extractUsd } = await ask({
    label: 'research',
    effort: 'low',
    maxTokens: 8000,
    system: 'You copy research findings into structured data exactly as written. Leave a field empty when the findings don\'t give it; never fill a gap with a guess.',
    prompt: `Findings:\n\n${findings}`,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['brief', 'companies'],
      properties: {
        brief: { type: 'string' },
        companies: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'website', 'city', 'why', 'linkedin'],
            properties: {
              name: { type: 'string' },
              website: { type: 'string' },
              city: { type: 'string' },
              why: { type: 'string' },
              linkedin: { type: 'string' },
            },
          },
        },
      },
    },
  });

  const companies = (data.companies || [])
    .map((c) => ({
      name: String(c.name || '').trim().slice(0, 80),
      website: String(c.website || '').trim().slice(0, 200),
      city: String(c.city || '').trim().slice(0, 80) || market.city,
      why: String(c.why || '').trim().slice(0, 300),
      linkedin: cleanLinkedin(c.linkedin),
    }))
    .filter((c) => c.name && c.website);

  return { brief: String(data.brief || '').trim().slice(0, 1200), companies, usd: searchUsd + extractUsd };
}
