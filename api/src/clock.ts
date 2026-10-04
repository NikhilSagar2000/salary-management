export type Clock = { now(): Date };
export const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso) });

export function requestTimezone(_header: string | undefined): string {
  throw new Error('not implemented');
}

export function todayIn(_clock: Clock, _tz: string): string {
  throw new Error('not implemented');
}
