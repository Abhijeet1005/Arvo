// Reading a list of companies from a spreadsheet export (CSV, or text pasted
// from a spreadsheet), and writing a list of links back out. Pure module.

// Rows of cells. Handles quotes, doubled quotes, line breaks inside quotes,
// a byte-order mark, and comma- or tab-separated text.
export function parseCsv(text) {
  const src = String(text ?? '').replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const delimiter = (firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length ? '\t' : ',';

  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const endRow = () => {
    row.push(cell);
    cell = '';
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"' && cell === '') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      endRow();
    } else {
      cell += c;
    }
  }
  if (cell !== '' || row.length > 0) endRow();
  return rows;
}

const COLUMNS = {
  name: /^(business|business name|company|company name|organi[sz]ation|firm|name)$/i,
  website: /^(website|web ?site|url|site|web|link|domain)$/i,
  location: /^(location|address|city|area|region)\b/i,
  phone: /^(phone|phone number|mobile|mobile number|tel|telephone|contact|contact number)$/i,
  about: /^(what they do|description|about|business type|category|industry)$/i,
  notes: /^(notes|remarks)$/i,
  fit: /^why a fit$/i, // used as the private note when there is no Notes column
};

const EMPTY = /^(n\/?a|na|none|null|-+|—|not (available|found|listed))$/i;
const clean = (v) => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  return EMPTY.test(s) ? '' : s;
};
const looksLikeSite = (v) => /^(https?:\/\/)?[^\s/@]+\.[a-z]{2,}([/?#].*)?$/i.test(v);

// -> { leads: [{ name, website, location, phone, about, notes }], columns, hadHeader }
// The first row is a header when any cell names a company; otherwise the
// columns are taken to be company, website, location, phone in that order.
export function leadsFromRows(rows, { max = 200 } = {}) {
  if (!rows.length) return { leads: [], columns: {}, hadHeader: false };
  const header = rows[0].map((c) => c.trim());
  const found = {};
  header.forEach((cell, index) => {
    for (const [key, pattern] of Object.entries(COLUMNS)) {
      if (!(key in found) && pattern.test(cell)) found[key] = index;
    }
  });
  const hadHeader = 'name' in found;
  const columns = hadHeader ? found : { name: 0, website: 1, location: 2, phone: 3 };
  const body = hadHeader ? rows.slice(1) : rows;

  const seen = new Set();
  const leads = [];
  for (const row of body) {
    const get = (key) => (key in columns ? clean(row[columns[key]]) : '');
    const name = get('name').slice(0, 80);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    const website = get('website');
    leads.push({
      name,
      website: looksLikeSite(website) ? website : '',
      location: get('location').slice(0, 200),
      phone: get('phone').slice(0, 40),
      about: get('about').slice(0, 300),
      notes: (get('notes') || get('fit')).slice(0, 300),
    });
    if (leads.length >= max) break;
  }
  return { leads, columns: hadHeader ? Object.fromEntries(Object.entries(columns).map(([k, i]) => [k, header[i]])) : {}, hadHeader };
}

// Cells that a spreadsheet would run as a formula are prefixed, so a company
// called "=HYPERLINK(...)" cannot do anything when the file is opened.
function safeCell(value) {
  const s = String(value ?? '');
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function toCsv(rows) {
  return rows.map((row) => row.map(safeCell).join(',')).join('\r\n');
}
