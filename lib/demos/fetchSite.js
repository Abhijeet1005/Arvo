// Fetching a company's website for a demo profile.
//
// The address comes from the operator's browser, so this is a server-side
// request on behalf of a user and is treated as hostile input:
//   - only http(s) on the ordinary ports, no credentials in the URL
//   - the hostname is resolved here, every address must be a public one, and
//     the connection is made to that exact address (a second DNS lookup could
//     return a different answer)
//   - redirects are followed by hand and every hop is checked again
//   - robots.txt is honoured
//   - bounded in time, in size (decompressed) and in concurrent reads
// Server-only.
import dns from 'node:dns/promises';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import zlib from 'node:zlib';
import { cleanUrl } from './model';
import { parseHtml, pickPages, mergeProfiles } from './site';

const USER_AGENT = 'ArvoDemoBot/1.0';
const PAGE_BYTES = 1_200_000;
const ROBOTS_BYTES = 100_000;
const MAX_REDIRECTS = 5;
const REQUEST_MS = 10_000;
const TOTAL_MS = 25_000;
const MAX_READS = 3;
const EXTRA_PAGES = 3;

export class SiteError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SiteError';
    this.code = code;
  }
}

// ---------------------------------------------------------- addresses

function isPublicV4([a, b, c]) {
  if (a === 0 || a === 10 || a === 127) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 169 && b === 254) return false; // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  if (a >= 224) return false; // multicast and reserved
  return true;
}

// Eight 16-bit groups, or null if the text is not a valid IPv6 address.
function expandV6(ip) {
  let s = String(ip).toLowerCase();
  const zone = s.indexOf('%');
  if (zone !== -1) s = s.slice(0, zone);
  const dot = s.lastIndexOf('.');
  if (dot !== -1) {
    // Embedded IPv4 in the last 32 bits, e.g. ::ffff:10.0.0.1
    const colon = s.lastIndexOf(':', dot);
    const v4 = s.slice(colon + 1).split('.').map(Number);
    if (v4.length !== 4 || v4.some((n) => !(n >= 0 && n <= 255))) return null;
    s = `${s.slice(0, colon + 1)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  let groups;
  if (halves.length === 1) {
    groups = head;
  } else {
    const tail = halves[1] ? halves[1].split(':') : [];
    const fill = 8 - head.length - tail.length;
    if (fill < 0) return null;
    groups = [...head, ...Array(fill).fill('0'), ...tail];
  }
  if (groups.length !== 8) return null;
  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  return nums.some(Number.isNaN) ? null : nums;
}

function isPublicV6(ip) {
  const g = expandV6(ip);
  if (!g) return false;
  const [g0, g1, g2, g3, g4, g5, g6, g7] = g;
  const embedded = [g6 >> 8, g6 & 255, g7 >> 8, g7 & 255];
  if (g.slice(0, 6).every((n) => n === 0)) return false; // ::, ::1 and the old IPv4-compatible range
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) return isPublicV4(embedded); // IPv4-mapped
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return isPublicV4(embedded); // NAT64
  if (g0 === 0x2002) return isPublicV4([g1 >> 8, g1 & 255, g2 >> 8, g2 & 255]); // 6to4
  if (g0 === 0x2001 && (g1 === 0 || g1 === 0x0db8)) return false; // Teredo, documentation
  // Only global unicast (2000::/3) counts as public; that leaves out unique
  // local (fc00::/7), link-local (fe80::/10), multicast and the rest.
  return (g0 & 0xe000) === 0x2000;
}

// True only for an address on the public internet.
export function isPublicIp(ip) {
  const version = net.isIP(String(ip));
  if (version === 4) return isPublicV4(String(ip).split('.').map(Number));
  if (version === 6) return isPublicV6(String(ip));
  return false;
}

const bareHost = (host) => String(host).replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();

function blockedName(host) {
  const h = bareHost(host);
  if (net.isIP(h)) return false;
  return !h.includes('.') || /\.(localhost|local|internal|lan|home|corp|intranet|localdomain)$/.test(h) || h === 'localhost';
}

// ------------------------------------------------------------ robots.txt

export function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const at = line.indexOf(':');
    if (!line || at === -1) continue;
    const key = line.slice(0, at).trim().toLowerCase();
    const value = line.slice(at + 1).trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if ((key === 'allow' || key === 'disallow') && current) current.rules.push({ allow: key === 'allow', pattern: value });
    }
  }
  return groups;
}

function patternToRegex(pattern) {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern).split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

// May `agent` fetch `path` (with its query)? The most specific matching
// group wins; inside it the longest matching rule wins and Allow beats
// Disallow on a tie.
export function robotsAllows(groups, path, agent = USER_AGENT.split('/')[0]) {
  const token = agent.toLowerCase();
  let chosen = [];
  let chosenLength = -1;
  for (const group of groups) {
    for (const a of group.agents) {
      if (a !== '*' && token.includes(a) && a.length > chosenLength) {
        chosen = [];
        chosenLength = a.length;
      }
      if (a !== '*' && token.includes(a) && a.length === chosenLength) chosen.push(group);
    }
  }
  if (chosenLength < 0) chosen = groups.filter((g) => g.agents.includes('*'));

  let best = null;
  for (const group of chosen) {
    for (const rule of group.rules) {
      if (!rule.pattern) continue; // an empty Disallow allows everything
      let matches = false;
      try {
        matches = patternToRegex(rule.pattern).test(path);
      } catch {
        matches = false;
      }
      if (!matches) continue;
      if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow)) best = rule;
    }
  }
  return !best || best.allow;
}

// -------------------------------------------------------------- transport

function decodeBody(buffer, contentType, htmlSniff) {
  const header = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType || '')?.[1];
  const meta = htmlSniff ? /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(buffer.subarray(0, 3000).toString('latin1'))?.[1] : '';
  for (const label of [header, meta, 'utf-8']) {
    if (!label) continue;
    try {
      return new TextDecoder(label).decode(buffer);
    } catch {
      // Unknown label: try the next.
    }
  }
  return buffer.toString('utf8');
}

// One GET to an address we already checked. Resolves with the status, headers
// and the (decompressed, size-capped) body. Never follows redirects.
function request(url, target, { timeoutMs, maxBytes, accept }) {
  const secure = url.protocol === 'https:';
  const lib = secure ? https : http;
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const req = lib.request(
      {
        host: bareHost(url.hostname),
        port: url.port || (secure ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: {
          host: url.host,
          'user-agent': USER_AGENT,
          accept,
          'accept-language': 'en;q=0.9,hi;q=0.5',
          'accept-encoding': 'gzip, deflate, br',
        },
        // Connect to the address we validated, whatever DNS says now.
        lookup: (_host, opts, cb) => (opts && opts.all ? cb(null, [{ address: target.address, family: target.family }]) : cb(null, target.address, target.family)),
        servername: net.isIP(bareHost(url.hostname)) ? undefined : bareHost(url.hostname),
      },
      (res) => {
        const status = res.statusCode || 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return done(resolve, { status, headers: res.headers, body: Buffer.alloc(0) });
        }
        let stream = res;
        const encoding = String(res.headers['content-encoding'] || '').toLowerCase();
        if (encoding === 'gzip' || encoding === 'x-gzip') stream = res.pipe(zlib.createGunzip());
        else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());
        else if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress());

        const chunks = [];
        let size = 0;
        stream.on('data', (chunk) => {
          size += chunk.length;
          if (size > maxBytes) {
            chunks.push(chunk.subarray(0, chunk.length - (size - maxBytes)));
            req.destroy();
            return done(resolve, { status, headers: res.headers, body: Buffer.concat(chunks), truncated: true });
          }
          chunks.push(chunk);
        });
        stream.on('end', () => done(resolve, { status, headers: res.headers, body: Buffer.concat(chunks) }));
        stream.on('error', (e) => done(reject, e));
        res.on('error', (e) => done(reject, e));
      }
    );
    const timer = setTimeout(() => {
      req.destroy();
      done(reject, new SiteError('timeout', 'The website took too long to respond.'));
    }, timeoutMs);
    req.on('error', (e) => done(reject, e));
    req.end();
  });
}

// --------------------------------------------------------------- context

const defaultDeps = {
  lookup: (host) => dns.lookup(host, { all: true, verbatim: true }),
  isPublic: isPublicIp,
  request,
  ports: new Set(['', '80', '443']),
};

function createContext(deps = defaultDeps) {
  const robotsByOrigin = new Map();
  const deadline = Date.now() + TOTAL_MS;
  const ctx = { deps, deadline, robotsByOrigin };

  // The URL must be safe to even look up.
  ctx.checkUrl = (url) => {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new SiteError('scheme', 'Only web addresses (http or https) can be read.');
    if (url.username || url.password) throw new SiteError('invalid', 'Web addresses with a username or password are not supported.');
    if (!deps.ports.has(url.port)) throw new SiteError('port', 'Only ordinary web ports can be read.');
    if (blockedName(url.hostname)) throw new SiteError('private', 'That address is on a private network, so it can’t be read.');
  };

  // Resolve the host and insist that every address is public.
  ctx.resolve = async (url) => {
    const host = bareHost(url.hostname);
    if (net.isIP(host)) {
      if (!deps.isPublic(host)) throw new SiteError('private', 'That address is on a private network, so it can’t be read.');
      return { address: host, family: net.isIP(host) };
    }
    let records;
    try {
      records = await deps.lookup(host);
    } catch {
      throw new SiteError('dns', `We could not find ${host}. Check the address.`);
    }
    if (!records?.length) throw new SiteError('dns', `We could not find ${host}. Check the address.`);
    if (records.some((r) => !deps.isPublic(r.address))) throw new SiteError('private', 'That address is on a private network, so it can’t be read.');
    return records.find((r) => r.family === 4) || records[0];
  };

  // GET with manual redirects; every hop is checked again.
  ctx.get = async (startUrl, { accept, maxBytes, robots }) => {
    let url = startUrl;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      ctx.checkUrl(url);
      const target = await ctx.resolve(url);
      if (robots && !(await ctx.robotsAllow(url, target))) {
        throw new SiteError('robots', 'This website asks automated readers to stay away, so it was not read. Paste the details in by hand instead.');
      }
      const left = ctx.deadline - Date.now();
      if (left < 500) throw new SiteError('timeout', 'The website took too long to respond.');
      const res = await deps.request(url, target, { accept, maxBytes, timeoutMs: Math.min(REQUEST_MS, left) });
      if (res.status >= 300 && res.status < 400 && res.headers.location) {
        try {
          url = new URL(res.headers.location, url);
        } catch {
          throw new SiteError('redirect', 'The website redirected somewhere that could not be read.');
        }
        continue;
      }
      return { url, res };
    }
    throw new SiteError('redirects', 'The website redirected too many times.');
  };

  // robots.txt for the page's origin, fetched once per read.
  ctx.robotsAllow = async (url, target) => {
    const key = url.origin;
    if (!robotsByOrigin.has(key)) {
      robotsByOrigin.set(
        key,
        (async () => {
          try {
            const robotsUrl = new URL('/robots.txt', url);
            // Same origin as a host we already resolved, so the address is reused.
            const left = ctx.deadline - Date.now();
            const res = await deps.request(robotsUrl, target, { accept: 'text/plain,*/*;q=0.5', maxBytes: ROBOTS_BYTES, timeoutMs: Math.min(5000, Math.max(500, left)) });
            if (res.status !== 200) return [];
            return parseRobots(decodeBody(res.body, res.headers['content-type'], false));
          } catch {
            return []; // unreachable robots.txt: nothing forbids us
          }
        })()
      );
    }
    return robotsAllows(await robotsByOrigin.get(key), `${url.pathname}${url.search}`);
  };

  return ctx;
}

// ------------------------------------------------------------------ pages

async function fetchHtml(ctx, startUrl) {
  const { url, res } = await ctx.get(startUrl, { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1', maxBytes: PAGE_BYTES, robots: true });
  if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 503) {
    throw new SiteError('blocked', 'That website blocks automatic readers. Paste the details in by hand instead.');
  }
  if (res.status === 404 || res.status === 410) throw new SiteError('notfound', 'That page was not found. Check the address.');
  if (res.status < 200 || res.status >= 300) throw new SiteError('http', `The website answered with an error (${res.status}).`);
  const type = String(res.headers['content-type'] || '').toLowerCase();
  if (type && !/text\/html|application\/xhtml|text\/plain/.test(type)) throw new SiteError('type', 'That address is not a web page.');
  const html = decodeBody(res.body, type, true);
  return { url, html };
}

// The real network pieces, so a test can swap just one of them.
export const _testDeps = defaultDeps;

// Read a website into the fields of a demo. Throws SiteError with a
// display-ready message. `deps` is only for tests (see createContext).
export async function readWebsite(input, deps) {
  const cleaned = cleanUrl(input);
  if (!cleaned) throw new SiteError('invalid', 'That does not look like a web address. Try something like acmeplumbing.com.');

  const gate = (globalThis.__arvoSiteReads ||= { active: 0 });
  if (gate.active >= MAX_READS) throw new SiteError('busy', 'Another website is being read right now. Try again in a moment.');
  gate.active++;
  try {
    const ctx = createContext(deps);
    const home = await fetchHtml(ctx, new URL(cleaned));
    const homePage = parseHtml(home.html, home.url.href);

    const notes = [];
    const pages = [{ url: home.url.href, page: homePage }];
    const wanted = pickPages(homePage, home.url.href, EXTRA_PAGES);
    const settled = await Promise.allSettled(
      wanted.map(async (href) => {
        const got = await fetchHtml(ctx, new URL(href));
        return { url: got.url.href, page: parseHtml(got.html, got.url.href) };
      })
    );
    let failed = 0;
    for (const r of settled) {
      if (r.status === 'fulfilled') pages.push(r.value);
      else failed++;
    }
    if (failed) notes.push(`${failed} other page${failed === 1 ? '' : 's'} on the site could not be read.`);

    const merged = mergeProfiles(pages);
    if (merged.business.about.length < 250) {
      notes.push('Very little text could be read. The site may build its pages with JavaScript, so paste the key details in by hand.');
    }
    const website = `${home.url.origin}/`;
    return {
      business: { ...merged.business, website },
      industry: merged.industry,
      language: /^hi\b/.test(merged.lang) ? 'hi' : 'en',
      pages: pages.map((p) => ({ url: p.url, title: p.page.title.slice(0, 120) })),
      notes,
    };
  } finally {
    gate.active--;
  }
}
