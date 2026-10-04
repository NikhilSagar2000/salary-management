type Cell = string | number | null | undefined;

/** One CSV cell: quoted when it holds a comma, quote or line break. */
function cell(value: Cell): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV text for Excel: UTF-8 byte-order mark, comma-separated, CRLF line ends. */
export function toCsv(rows: Cell[][]): string {
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
