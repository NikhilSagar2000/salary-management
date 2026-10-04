import { COUNTRIES, COUNTRY_NAMES, GENDERS, LEVELS, ROLES, type Role } from '@acme/shared';

/** Choice lists for the employee forms; roles follow the department and levels follow the role (EMP-2). */
export const COUNTRY_OPTIONS = COUNTRIES.map((c) => ({ value: c, label: COUNTRY_NAMES[c] }));
export const GENDER_OPTIONS = GENDERS.map((g) => ({ value: g, label: g === 'non_binary' ? 'Non-binary' : g[0]!.toUpperCase() + g.slice(1) }));

export const roleChoices = (department: string) =>
  Object.entries(ROLES).filter(([, r]) => !department || r.department === department).map(([name]) => name);

export const levelChoices = (role: string) => {
  const rule = ROLES[role as Role];
  return LEVELS.filter((l) => !rule || (l >= rule.minLevel && l <= rule.maxLevel)).map((l) => ({ value: String(l), label: `L${l}` }));
};
