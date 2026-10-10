'use client';

// Save rows as a CSV file from the browser (opens cleanly in Excel and Sheets).
import { toCsv } from './csv';

export function downloadCsv(filename, rows) {
  // The byte-order mark makes Excel read non-English names correctly.
  const blob = new Blob(['\uFEFF', toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
