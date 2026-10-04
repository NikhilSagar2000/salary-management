export type Clock = { now(): Date };
export const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso) });
