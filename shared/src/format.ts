import type { Currency } from './reference.ts';

const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "USD 128,000": currency code, thousands separators, never converted. */
export function formatMoney(amount: number, currency: Currency): string {
  return `${currency} ${grouped.format(amount)}`;
}

/** "4 Oct 2026" from "2026-10-04", read as a calendar date so no timezone can shift it. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m! - 1]} ${y}`;
}
