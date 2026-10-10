// Colour helpers for a demo's branded call room: whatever accent a company's
// website uses, buttons must stay readable and text must stay legible on white.
// Pure module, shared by the console preview and the public page.

export const DEFAULT_ACCENT = '#174ea6';

const HEX6 = /^#[0-9a-f]{6}$/i;

const channel = (v) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

const toHex = (parts) => `#${parts.map((p) => Math.round(Math.max(0, Math.min(255, p))).toString(16).padStart(2, '0')).join('')}`;

export function luminance(hex) {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Move `hex` towards `other` by `amount` (0 to 1).
function mix(hex, other, amount) {
  const [a, b] = [rgb(hex), rgb(other)];
  return toHex(a.map((v, i) => v + (b[i] - v) * amount));
}

// White or near-black, whichever reads better on top of `background`.
export const inkFor = (background) => (contrast(background, '#ffffff') >= contrast(background, '#111827') ? '#ffffff' : '#111827');

// `hex`, darkened until it reads as text on white.
export function textSafe(hex, minimum = 4.5) {
  let colour = hex;
  for (let i = 0; i < 24 && contrast(colour, '#ffffff') < minimum; i++) colour = mix(colour, '#000000', 0.1);
  return colour;
}

// Everything a page needs from one brand colour:
//   accent  the colour itself (buttons, progress)
//   ink     the text colour that reads on top of it
//   text    a version of it dark enough to use as text on white
export function brand(value) {
  const accent = HEX6.test(String(value || '').trim()) ? String(value).trim().toLowerCase() : DEFAULT_ACCENT;
  return { accent, ink: inkFor(accent), text: textSafe(accent) };
}
