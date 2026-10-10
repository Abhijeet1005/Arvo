// Reading a company's website into a demo profile: HTML in, plain facts out.
//
// Pure module (no network, no server imports): ./fetchSite.js does the
// fetching, this does the reading. It is a small tolerant tokenizer rather than
// a full HTML parser, because it only needs the visible text, the page's own
// description of the business (title, meta tags, JSON-LD) and a few links. It
// never throws on bad markup and its work is bounded by the input size.

const MAX_HTML = 1_200_000;
const MAX_STACK = 400;
const MAX_LINES = 5000;
const MAX_LINE = 2000;

// ------------------------------------------------------------ entities

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', ndash: '–', mdash: '—', hellip: '…', bull: '•', middot: '·',
  copy: '©', reg: '®', trade: '™', laquo: '«', raquo: '»', euro: '€', pound: '£', yen: '¥', deg: '°', times: '×',
};

export function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]{1,8});/gi, (match, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!Number.isFinite(code) || code > 0x10ffff || (code < 32 && code !== 9 && code !== 10) || (code >= 0xd800 && code <= 0xdfff)) return ' ';
      try {
        return String.fromCodePoint(code);
      } catch {
        return ' ';
      }
    }
    const value = ENTITIES[e.toLowerCase()];
    return value === undefined ? match : value;
  });
}

// ----------------------------------------------------------- tokenizer

const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
// Whole subtrees that never hold readable text.
const SKIP = new Set(['script', 'style', 'noscript', 'template', 'svg', 'iframe', 'canvas', 'object', 'nav', 'form', 'select', 'option', 'button', 'textarea', 'dialog', 'audio', 'video', 'map']);
const BLOCK = new Set([
  'p', 'div', 'section', 'article', 'main', 'header', 'footer', 'aside', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'br', 'hr', 'tr', 'table', 'dl', 'dt', 'dd', 'blockquote', 'pre', 'address', 'fieldset', 'figure', 'figcaption', 'details', 'summary', 'caption',
]);
const RAW_TEXT = new Set(['script', 'style', 'textarea']);

const isNameChar = (c) => (c >= 48 && c <= 58) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 45 || c === 95;
const isLetter = (c) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);

// Read the tag that starts at src[start] === '<'. Returns null when it is not
// really a tag (a stray '<' in text, or one that never closes), so the caller
// keeps it as text. `budget` bounds the characters scanned for tag ends over
// the whole document: real pages have tags tens of kilobytes long (inline JSON
// in data attributes), so no single tag is limited, but a page made of
// unterminated quotes can't make the scan quadratic.
function readTag(src, start, budget) {
  const n = src.length;
  let i = start + 1;
  if (i >= n) return null;
  if (src.startsWith('!--', i)) {
    const end = src.indexOf('-->', i + 3);
    return { kind: 'skip', end: end === -1 ? n : end + 3 };
  }
  const first = src.charCodeAt(i);
  if (first === 33 /* ! */ || first === 63 /* ? */) {
    const end = src.indexOf('>', i);
    return { kind: 'skip', end: end === -1 ? n : end + 1 };
  }
  const closing = first === 47; /* / */
  if (closing) i++;
  if (!isLetter(src.charCodeAt(i))) return null;
  let j = i;
  while (j < n && isNameChar(src.charCodeAt(j))) j++;
  const name = src.slice(i, j).toLowerCase();

  // The attributes run to the next '>' that is not inside quotes.
  let quote = 0;
  let k = j;
  for (; k < n; k++) {
    if (--budget.left < 0) return null;
    const c = src.charCodeAt(k);
    if (quote) {
      if (c === quote) quote = 0;
    } else if (c === 34 || c === 39) {
      quote = c;
    } else if (c === 62) {
      break;
    }
  }
  if (k >= n || src.charCodeAt(k) !== 62) return null;
  return { kind: 'tag', closing, name, attrs: src.slice(j, k), end: k + 1 };
}

function parseAttrs(raw) {
  const attrs = {};
  let m;
  ATTR_RE.lastIndex = 0;
  let guard = 0;
  while ((m = ATTR_RE.exec(raw)) && guard++ < 60) {
    const key = m[1].toLowerCase();
    if (!(key in attrs)) attrs[key] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return attrs;
}

function resolveUrl(href, base) {
  try {
    const url = new URL(String(href).trim(), base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.href;
  } catch {
    return '';
  }
}

const squash = (s) => String(s).replace(/[\s\u00a0]+/g, ' ').trim();

// Everything the extractors need, in one pass.
export function parseHtml(html, baseUrl = 'https://example.invalid/') {
  const src = String(html || '').slice(0, MAX_HTML);
  const page = {
    lang: '',
    title: '',
    meta: {},
    jsonld: [],
    links: [], // { href, text }
    images: [], // { src, alt, hint, inHeader }
    icons: [], // { href, size, rel }
    headings: [], // { level, text }
    lines: [], // { text, kind: 'h' | 'li' | 'p', level, footer }
    addresses: [], // text of <address> elements
  };

  const stack = []; // names of the open elements
  let buf = '';
  let headingLevel = 0;
  let headingText = '';
  let inTitle = false;
  let anchor = null; // the open <a>
  let addressOpen = false;
  let addressText = '';

  const count = (name) => stack.reduce((n, s) => n + (s === name ? 1 : 0), 0);
  const skipping = () => stack.some((s) => SKIP.has(s));
  const inHead = () => stack.includes('head');

  const flush = () => {
    const text = squash(buf).slice(0, MAX_LINE);
    buf = '';
    if (!text || page.lines.length >= MAX_LINES) return;
    page.lines.push({ text, kind: headingLevel ? 'h' : count('li') > 0 ? 'li' : 'p', level: headingLevel, footer: count('footer') > 0 });
  };

  const addText = (raw) => {
    if (!raw) return;
    const text = decodeEntities(raw);
    if (inTitle && page.title.length < 1000) page.title += text;
    if (anchor) anchor.text += text;
    if (skipping() || inHead()) return;
    buf += text;
    if (headingLevel) headingText += text;
    if (addressOpen) addressText += `${text} `;
  };

  const budget = { left: Math.max(2_000_000, src.length * 6) };
  let pos = 0; // start of the text not yet handled
  let i = 0;
  let steps = 0;
  while (i < src.length && steps++ < 300_000) {
    const lt = src.indexOf('<', i);
    if (lt === -1) break;
    const tag = readTag(src, lt, budget);
    if (!tag) {
      i = lt + 1; // a bare '<': it stays part of the text
      continue;
    }
    addText(src.slice(pos, lt));
    i = pos = tag.end;
    if (tag.kind === 'skip') continue;

    const { name, closing } = tag;

    if (closing) {
      if (name === 'title') inTitle = false;
      if (name === 'a' && anchor) {
        const raw = anchor.href.trim();
        const href = resolveUrl(raw, baseUrl);
        if (href || /^(tel|mailto):/i.test(raw)) page.links.push({ href: href || raw, text: squash(anchor.text).slice(0, 120) });
        anchor = null;
      }
      const at = stack.lastIndexOf(name);
      if (at !== -1) {
        // Text is classified while its element is still open.
        if (BLOCK.has(name) || stack.slice(at).some((s) => BLOCK.has(s))) flush();
        if (/^h[1-6]$/.test(name)) {
          const label = squash(headingText);
          if (label) page.headings.push({ level: Number(name[1]), text: label.slice(0, 160) });
          headingLevel = 0;
          headingText = '';
        } else if (name === 'address' && addressOpen) {
          const label = squash(addressText).replace(/\s*,(\s*,)+/g, ',').replace(/\s+,/g, ',').replace(/^,\s*|,\s*$/g, '');
          if (label) page.addresses.push(label.slice(0, 300));
          addressOpen = false;
          addressText = '';
        }
        stack.splice(at); // also drops unclosed <li>, <p> and friends above it
      } else if (BLOCK.has(name)) {
        flush();
      }
      continue;
    }

    const attrs = parseAttrs(tag.attrs);
    const selfClosing = VOID.has(name) || /\/\s*$/.test(tag.attrs);

    // Raw-text elements hold no markup, so jump straight past their content.
    if (RAW_TEXT.has(name) && !selfClosing) {
      const re = new RegExp(`</${name}\\b`, 'ig');
      re.lastIndex = pos;
      const found = re.exec(src);
      const body = src.slice(pos, found ? found.index : src.length);
      if (name === 'script' && /ld\+json/i.test(attrs.type || '') && body.length < 200_000) {
        try {
          page.jsonld.push(JSON.parse(body.trim()));
        } catch {
          // Malformed JSON-LD is common; ignore it.
        }
      }
      if (!found) {
        i = pos = src.length;
      } else {
        const close = src.indexOf('>', found.index);
        i = pos = close === -1 ? src.length : close + 1;
      }
      continue;
    }

    if (name === 'html') page.lang = (attrs.lang || '').toLowerCase().slice(0, 12);
    if (name === 'body') {
      const head = stack.lastIndexOf('head');
      if (head !== -1) stack.splice(head); // <head> often has no end tag
    }

    if (name === 'title') {
      inTitle = true;
    } else if (name === 'meta') {
      const key = (attrs.property || attrs.name || attrs['http-equiv'] || '').toLowerCase();
      if (key && attrs.content !== undefined && !(key in page.meta)) page.meta[key] = squash(attrs.content);
      if (attrs.charset && !('charset' in page.meta)) page.meta.charset = attrs.charset.toLowerCase();
    } else if (name === 'link') {
      const rel = (attrs.rel || '').toLowerCase();
      if (/\bicon\b|apple-touch-icon/.test(rel) && attrs.href) {
        const href = resolveUrl(attrs.href, baseUrl);
        const size = Math.max(0, ...String(attrs.sizes || '').split(/\s+/).map((s) => parseInt(s, 10) || 0));
        if (href) page.icons.push({ href, size, rel });
      }
    } else if (name === 'img') {
      const hint = `${attrs.class || ''} ${attrs.id || ''} ${attrs.alt || ''} ${attrs.src || ''}`;
      const url = resolveUrl(attrs.src || attrs['data-src'] || '', baseUrl);
      if (url && page.images.length < 60) {
        page.images.push({ src: url, alt: squash(attrs.alt || '').slice(0, 120), hint, inHeader: stack.includes('header') || stack.includes('nav') });
      }
    } else if (name === 'a' && attrs.href !== undefined && !anchor) {
      anchor = { href: attrs.href, text: '' };
    }

    if (BLOCK.has(name)) {
      flush();
      if (/^h[1-6]$/.test(name)) {
        headingLevel = Number(name[1]);
        headingText = '';
      }
    }
    if (name === 'address' && !skipping() && !addressOpen) {
      addressOpen = true;
      addressText = '';
    }
    if ((name === 'td' || name === 'th') && !skipping()) buf += ' ';
    if (name === 'br' && addressOpen) addressText += ', '; // line breaks in an address are commas

    if (!selfClosing && stack.length < MAX_STACK) stack.push(name);
  }

  addText(src.slice(pos)); // text after the last tag
  flush();
  page.title = squash(page.title).slice(0, 300);
  return page;
}

// ---------------------------------------------------------- text lines

const UI_LINES = /^(home|menu|search|login|log in|sign in|sign up|register|cart|my account|account|contact|contact us|about|about us|services|overview|resources|blog|news|faq|faqs|skip to (main )?content|read more|learn more|view more|view all|see more|see all|more|next|previous|back|close|open|share|follow us|subscribe|submit|send|get started|book now|call now|click here|privacy( policy)?|terms( (of|&) (service|use|conditions))?|terms and conditions|cookie(s)?( policy| settings| preferences)?|all rights reserved|sitemap|accessibility|powered by .*|designed by .*|copyright .*|©.*)$/i;

// Icon fonts put their glyph names in the text ("local_phone", "arrow_forward").
const ICON_NAMES = /[a-z]{3,}(?:_[a-z]+)+/g;
const COOKIE_NOISE = /\b(we use cookies|this (web)?site uses cookies|accept (all )?cookies|cookie consent|manage (your )?(cookie|consent))\b/i;
const SKIP_LINK_LINE = /^skip to\b/i;

// Markup, JSON or script that ended up as text (for example from a page that
// pastes it into a visible element). Real sentences have few of these marks.
function looksLikeCode(text) {
  if (/^[[{]\s*"/.test(text) || /<[a-z][^>]*=/i.test(text)) return true;
  const odd = (text.match(/[{}[\]<>=;"\\|]/g) || []).length;
  return text.length >= 40 && odd / text.length > 0.12;
}

function cut(text, max) {
  const s = squash(text);
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const end = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  return end > max * 0.5 ? slice.slice(0, end + 1) : `${slice.slice(0, max - 1).trimEnd()}…`;
}

// The readable text of a page: de-duplicated, without menus, banners and
// one-word labels, but keeping anything that looks like a fact (a number,
// an e-mail address, a heading).
export function pageText(page, { max = 3000 } = {}) {
  const seen = new Set();
  const kept = [];
  let total = 0;
  for (const line of page.lines) {
    const shown = line.text.replace(ICON_NAMES, ' ').replace(/\s{2,}/g, ' ').trim();
    const text = shown.length > 700 ? cut(shown, 700) : shown;
    if (text.length < 3 || UI_LINES.test(text) || COOKIE_NOISE.test(text) || SKIP_LINK_LINE.test(text) || looksLikeCode(text)) continue;
    const words = text.split(/\s+/).length;
    // Menu-like scraps are noise, but a two-word list item is usually a real
    // service ("Drain cleaning") and a number or address is always a fact.
    const needed = line.kind === 'h' ? 1 : line.kind === 'li' ? 2 : 3;
    if (words < needed && !/\d|@/.test(text)) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const out = line.kind === 'li' ? `- ${text}` : text;
    if (total + out.length + 1 > max) break;
    kept.push(out);
    total += out.length + 1;
  }
  return kept.join('\n');
}

// ------------------------------------------------------------- JSON-LD

function flattenLd(node, out = [], depth = 0) {
  if (!node || depth > 6 || out.length > 200) return out;
  if (Array.isArray(node)) {
    for (const n of node) flattenLd(n, out, depth + 1);
  } else if (typeof node === 'object') {
    out.push(node);
    if (node['@graph']) flattenLd(node['@graph'], out, depth + 1);
  }
  return out;
}

const typeOf = (o) => [].concat(o?.['@type'] || []).map(String);

function orgScore(o) {
  const types = typeOf(o).join(' ');
  if (!o?.name || typeof o.name !== 'string') return 0;
  if (/LocalBusiness|Store|Restaurant|Dentist|Physician|Clinic|Plumber|Electrician|RealEstateAgent|Contractor|HomeAndConstruction|ProfessionalService|LegalService|AutomotiveBusiness|HealthAndBeauty|Salon|Gym/i.test(types)) return 3;
  if (/Organization|Corporation/i.test(types)) return 2;
  if (/WebSite|WebPage|Breadcrumb|Person|ImageObject|SearchAction|Product|Article|Offer|Review|Rating/i.test(types)) return 0;
  return o.telephone || o.address ? 1 : 0;
}

export function organizationFrom(page) {
  let best = null;
  let bestScore = 0;
  for (const o of flattenLd(page.jsonld)) {
    const score = orgScore(o);
    if (score > bestScore) {
      best = o;
      bestScore = score;
    }
  }
  return best;
}

const DAY_SHORT = { mo: 'Mon', tu: 'Tue', we: 'Wed', th: 'Thu', fr: 'Fri', sa: 'Sat', su: 'Sun' };
const shortDay = (d) => {
  const s = String(d).replace(/^.*\//, '');
  return s.length >= 3 ? s[0].toUpperCase() + s.slice(1, 3).toLowerCase() : DAY_SHORT[s.slice(0, 2).toLowerCase()] || s;
};

function hoursFromLd(org) {
  const parts = [];
  for (const h of [].concat(org?.openingHours || [])) {
    const t = String(h).trim();
    if (t) parts.push(t.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, (d) => DAY_SHORT[d.toLowerCase()]));
  }
  for (const spec of [].concat(org?.openingHoursSpecification || [])) {
    if (!spec || typeof spec !== 'object') continue;
    const days = [].concat(spec.dayOfWeek || []).map(shortDay);
    if (days.length && spec.opens && spec.closes) parts.push(`${days.join(', ')} ${spec.opens}-${spec.closes}`);
  }
  return parts.slice(0, 7).join('; ');
}

function addressFromLd(org) {
  const a = org?.address;
  if (!a) return '';
  if (typeof a === 'string') return squash(a);
  if (typeof a !== 'object') return '';
  return [a.streetAddress, a.addressLocality, [a.addressRegion, a.postalCode].filter(Boolean).join(' '), typeof a.addressCountry === 'string' ? a.addressCountry : '']
    .map((p) => squash(p || ''))
    .filter(Boolean)
    .join(', ');
}

function logoFromLd(org) {
  const l = org?.logo;
  if (!l) return '';
  if (typeof l === 'string') return l;
  if (typeof l === 'object') return typeof l.url === 'string' ? l.url : typeof l.contentUrl === 'string' ? l.contentUrl : '';
  return '';
}

// ----------------------------------------------------------- extractors

const DAYS = '(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)';
const TIME = '\\d{1,2}(?::\\d{2})?\\s?(?:am|pm|a\\.m\\.|p\\.m\\.)?';
const HOURS_LINE = new RegExp(`\\b${DAYS}\\b[^\\n]{0,40}?${TIME}\\s*(?:-|–|—|to|till|until)\\s*${TIME}`, 'i');
const HOURS_24 = /\b(?:24\s*(?:\/|x)\s*7|24 hours|round the clock)\b/i;

function titleName(title, domain) {
  const parts = String(title)
    .split(/\s+[|\-–—·:»]\s+|\s*[|·»]\s*/)
    .map((p) => squash(p))
    .filter(Boolean);
  if (parts.length === 0) return '';
  const key = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const dk = key(domain);
  const generic = /^(home|homepage|welcome|index|official (web)?site|main)$/i;
  const match = dk.length >= 3 ? parts.find((p) => key(p).length >= 3 && (key(p).includes(dk) || dk.includes(key(p)))) : null;
  if (match) return match;
  return parts.filter((p) => !generic.test(p))[0] || parts[0];
}

export function nameFromDomain(host) {
  const label = String(host || '').replace(/^www\./i, '').split('.')[0] || '';
  return label
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

// All the page's lines as one bounded block of text, for the searches below.
const joinedText = (page) => page.lines.map((l) => l.text).join('\n').slice(0, 200_000);

const safeDecode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

function firstPhone(page, org) {
  const valid = (v) => {
    const digits = String(v).replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15;
  };
  const tel = page.links.map((l) => l.href).find((h) => /^tel:/i.test(h));
  if (tel) {
    const value = squash(safeDecode(tel.replace(/^tel:/i, '').replace(/[?;].*$/, '')));
    if (valid(value)) return value;
  }
  if (org?.telephone && valid(org.telephone)) return squash(org.telephone);
  const text = joinedText(page);
  const near = text.match(/(?:call|phone|tel|mobile|whatsapp|contact)[^\n\d+]{0,20}(\+?\d[\d\s().-]{7,18}\d)/i);
  return near && valid(near[1]) ? squash(near[1]) : '';
}

const EMAIL_LOCAL = /[A-Za-z0-9._%+-]/;
const EMAIL_DOMAIN = /[A-Za-z0-9.-]/;

// E-mail addresses in running text. Walks outward from each '@' instead of
// using one big regex, which would be quadratic on a long run of letters.
function emailsIn(text) {
  const found = [];
  let at = text.indexOf('@');
  while (at !== -1 && found.length < 20) {
    let start = at;
    while (start > 0 && at - start < 64 && EMAIL_LOCAL.test(text[start - 1])) start--;
    let end = at + 1;
    while (end < text.length && end - at < 255 && EMAIL_DOMAIN.test(text[end])) end++;
    const candidate = text.slice(start, end).replace(/[.-]+$/, '');
    if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(candidate)) found.push(candidate);
    at = text.indexOf('@', at + 1);
  }
  return found;
}

function firstEmail(page, org) {
  const looksOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const bad = /(example|sentry|wixpress|yourname|email@|name@|user@|test@|noreply|no-reply|@2x|\.png|\.jpe?g|\.webp|\.gif)/i;
  const mail = page.links.map((l) => l.href).find((h) => /^mailto:/i.test(h));
  if (mail) {
    const addr = safeDecode(mail.replace(/^mailto:/i, '').split('?')[0]).trim();
    if (looksOk(addr) && !bad.test(addr)) return addr;
  }
  const ld = String(org?.email || '').replace(/^mailto:/i, '').trim();
  if (ld && looksOk(ld)) return ld;
  return emailsIn(joinedText(page)).find((e) => !bad.test(e)) || '';
}

function findHours(page, org) {
  const fromLd = hoursFromLd(org);
  if (fromLd) return fromLd;
  const found = [];
  for (const { text } of page.lines) {
    if (found.length >= 3) break;
    // Day-and-time ranges can sit in a longer line, but a bare "24/7" only
    // counts in a short one: otherwise every marketing sentence about
    // round-the-clock service would be taken for the opening hours.
    if ((text.length <= 160 && HOURS_LINE.test(text)) || (text.length <= 50 && HOURS_24.test(text))) found.push(text.replace(/^[-•'"‘’“”\s]+/, ''));
  }
  return [...new Set(found)].join('; ').slice(0, 200);
}

function findLocation(page, org) {
  const fromLd = addressFromLd(org);
  if (fromLd) return fromLd;
  const tag = page.addresses.find((a) => a.length >= 10);
  if (tag) return tag;
  for (const { text } of page.lines) {
    const m = text.match(/^(?:our\s+)?(?:address|location|visit us|find us)\s*[:\-–]\s*(.{8,200})$/i);
    if (m) return squash(m[1]);
  }
  return '';
}

const SERVICES_HEADING = /\b(services?|what we (?:do|offer)|we offer|our (?:work|specialt(?:y|ies)|treatments?|solutions|products)|specialt(?:y|ies)|treatments?|solutions)\b/i;

// Buttons and slogans that sit in the same lists as the services.
const CALL_TO_ACTION = /^(click|call|book|schedule|request|get (a|your|started)|contact|visit|find out|sign up|subscribe)\b/i;

function findServices(page) {
  const out = [];
  let level = 0;
  const add = (t) => {
    const s = squash(t.replace(ICON_NAMES, ' '))
      .replace(/^[-•'"‘’“”\s]+/, '')
      .replace(/^(learn more|read more|view more|view|explore|see)\s+/i, '');
    // A service is a short noun phrase: not a sentence, a slogan, a button or a figure.
    if (s.length < 3 || s.length > 50 || s.split(/\s+/).length > 6) return;
    if (/[!?]/.test(s) || /^\d/.test(s) || CALL_TO_ACTION.test(s) || UI_LINES.test(s)) return;
    if (out.some((x) => x.toLowerCase() === s.toLowerCase())) return;
    out.push(s);
  };
  for (const line of page.lines) {
    if (out.length >= 12) break;
    if (line.kind === 'h') {
      if (SERVICES_HEADING.test(line.text) && line.text.length <= 60) {
        level = line.level;
      } else if (level && line.level <= level) {
        level = 0;
      } else if (level) {
        add(line.text);
      }
    } else if (level && line.kind === 'li') {
      add(line.text);
    }
  }
  return out;
}

function pickLogo(page, org, base) {
  const secure = (u) => {
    const abs = u ? resolveUrl(u, base) : '';
    if (!abs) return '';
    try {
      const url = new URL(abs);
      // An http logo would be blocked on an https page.
      if (url.protocol === 'http:' && new URL(base).protocol === 'https:') url.protocol = 'https:';
      return url.href;
    } catch {
      return '';
    }
  };
  const ld = secure(logoFromLd(org));
  if (ld) return ld;
  const img = page.images.find((x) => /logo/i.test(x.hint) && !/sprite|placeholder|1x1|pixel/i.test(x.src));
  if (img) return secure(img.src);
  const icons = [...page.icons].sort((a, b) => b.size - a.size);
  const touch = icons.find((x) => /apple-touch-icon/.test(x.rel));
  if (touch) return secure(touch.href);
  const any = icons.find((x) => !/\.ico(\?|$)/i.test(x.href)) || icons[0];
  return any ? secure(any.href) : '';
}

function pickAccent(meta) {
  for (const key of ['theme-color', 'msapplication-tilecolor']) {
    let c = String(meta[key] || '').trim().toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(c)) c = `#${c[1]}${c[1]}${c[2]}${c[2]}${c[3]}${c[3]}`;
    if (!/^#[0-9a-f]{6}$/.test(c)) continue;
    const [r, g, b] = [1, 3, 5].map((n) => parseInt(c.slice(n, n + 2), 16));
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (luminance > 0.85 || luminance < 0.06) continue; // white or black tells us nothing
    return c;
  }
  return '';
}

// A guess at the demo's industry preset from the words a site uses.
export function guessIndustry(text) {
  const t = String(text).toLowerCase();
  const score = (re) => (t.match(re) || []).length;
  const home = score(/\b(plumb\w*|hvac|electrician|electrical|roof\w*|landscap\w*|pest control|handyman|air conditioning|heating|garage door|remodel\w*|contractor|drain|water heater|appliance repair|home services?)\b/g);
  const estate = score(/\b(real estate|realty|propert(?:y|ies)|apartments?|bhk|realtor|brokers?|listings?|homes for sale|flats?|builders?|plots?|rera)\b/g);
  if (estate >= 3 && estate >= home) return 'realestate';
  if (home >= 3) return 'homeservices';
  return 'generic';
}

// What one page says about the business.
export function profileFromPage(page, baseUrl) {
  const org = organizationFrom(page);
  let host = '';
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    // keep ''
  }
  const domain = nameFromDomain(host);
  const meta = page.meta;
  // JSON-LD is JSON, so a site that escaped "&" for HTML leaves "&amp;" in it.
  const ld = (v) => (typeof v === 'string' ? squash(decodeEntities(v)) : '');
  // Some sites put their slogan in the name ("Acme | Top plumbers in Dallas").
  const tidy = (v) => (/\s[|–—·»]\s|\s-\s/.test(v) ? titleName(v, domain) || v : v);
  const name = tidy(ld(org?.name) || squash(meta['og:site_name'] || meta['application-name'] || '')) || titleName(page.title, domain) || domain;
  const description = squash(meta['og:description'] || meta.description || '') || ld(org?.description);

  return {
    name: name.slice(0, 80),
    tagline: cut(description, 200),
    phone: firstPhone(page, org),
    email: firstEmail(page, org),
    hours: findHours(page, org),
    location: findLocation(page, org),
    services: findServices(page),
    logoUrl: pickLogo(page, org, baseUrl),
    accent: pickAccent(meta),
    lang: page.lang,
  };
}

// ------------------------------------------------------- other pages

const SKIP_PATH = /\.(?:pdf|docx?|xlsx?|pptx?|zip|rar|jpe?g|png|gif|webp|svg|ico|mp3|mp4|mov|avi|css|js|xml|json)(?:$|\?)|\/(?:wp-admin|wp-login|login|signin|sign-in|register|cart|checkout|account|my-account|privacy|terms|cookie|careers|jobs|blog|news|press|tag|category|author|feed|cdn-cgi)(?:\/|$|\?)/i;
const PAGE_HINTS = [
  [/service|what-we-do|treatment|solution|practice|specialt|offer|menu/i, 5],
  [/about|our-story|who-we-are|company|why-us|why-choose|team/i, 4],
  [/contact|location|find-us|visit|hours|reach/i, 3],
  [/pricing|price|rates|cost|plans|packages|fees/i, 2],
  [/faq|questions|help/i, 1],
  [/project|propert|listing|portfolio/i, 1],
];

const sameSite = (a, b) => a.replace(/^www\./i, '').toLowerCase() === b.replace(/^www\./i, '').toLowerCase();

// The most useful other pages on the same site, best first.
export function pickPages(page, baseUrl, limit = 3) {
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return [];
  }
  const seen = new Set([base.pathname.replace(/\/+$/, '') || '/']);
  const ranked = [];
  for (const { href, text } of page.links) {
    let url;
    try {
      url = new URL(href);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol) || !sameSite(url.hostname, base.hostname) || SKIP_PATH.test(url.pathname + url.search)) continue;
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (seen.has(path) || path.split('/').length > 4) continue;
    const haystack = `${path} ${text}`;
    const weight = PAGE_HINTS.reduce((best, [re, w]) => (re.test(haystack) ? Math.max(best, w) : best), 0);
    if (!weight) continue;
    seen.add(path);
    ranked.push({ href: `${url.origin}${url.pathname}`, weight, depth: path.length });
  }
  ranked.sort((a, b) => b.weight - a.weight || a.depth - b.depth);
  return ranked.slice(0, limit).map((r) => r.href);
}

// ------------------------------------------------------------- merge

function pageLabel(url) {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '');
    return path ? path.split('/').pop().replace(/[-_]+/g, ' ') : 'home';
  } catch {
    return 'page';
  }
}

// Combine the home page and the extra pages into one business profile.
// `pages` is [{ url, page }] with the home page first.
export function mergeProfiles(pages) {
  const profiles = pages.map(({ url, page }) => ({ url, page, p: profileFromPage(page, url) }));
  const first = (key) => profiles.map((x) => x.p[key]).find(Boolean) || '';
  const services = [];
  for (const x of profiles) {
    for (const s of x.p.services) if (!services.some((e) => e.toLowerCase() === s.toLowerCase())) services.push(s);
  }

  const sections = [];
  let budget = 6000;
  for (const { url, page } of profiles) {
    const label = pageLabel(url);
    const text = pageText(page, { max: Math.min(2600, budget - label.length - 4) });
    if (!text) continue;
    sections.push(`[${label}]\n${text}`);
    budget -= text.length + label.length + 4;
    if (budget < 300) break;
  }
  const about = sections.join('\n\n');

  const home = profiles[0];
  return {
    business: {
      name: home?.p.name || '',
      tagline: first('tagline'),
      phone: first('phone'),
      email: first('email'),
      hours: first('hours'),
      location: first('location'),
      services: services.slice(0, 12),
      logoUrl: home?.p.logoUrl || first('logoUrl'),
      accent: first('accent'),
      about,
    },
    industry: guessIndustry(`${home?.p.name || ''} ${home?.p.tagline || ''} ${services.join(' ')} ${about}`),
    lang: home?.p.lang || '',
  };
}
