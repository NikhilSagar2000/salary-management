export type Clock = { now(): Date };

export const systemClock: Clock = { now: () => new Date() };
export const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso) });

/** The request's IANA timezone (X-Timezone header), or UTC when missing or unknown. */
export function requestTimezone(header: string | undefined): string {
  if (!header) return 'UTC';
  try {
    new Intl.DateTimeFormat('en', { timeZone: header });
    return header;
  } catch {
    return 'UTC';
  }
}

/** An instant's date as 'YYYY-MM-DD' in the given timezone. */
export function dateIn(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

/** Today's date as 'YYYY-MM-DD' in the given timezone. */
export function todayIn(clock: Clock, tz: string): string {
  return dateIn(clock.now(), tz);
}
