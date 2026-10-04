// Every plain-word message the app shows, in one place.
export const MSG = {
  code: 'Employee code must be E followed by 6 digits, like E000123.',
  firstName: 'Enter a first name.',
  lastName: 'Enter a last name.',
  gender: 'Choose a gender.',
  workEmail: 'Enter a work email, like name@acme.example.',
  date: (field: string) => `Enter the ${field} as YYYY-MM-DD.`,
  country: 'Choose a country.',
  department: 'Choose a department.',
  role: 'Choose a role.',
  level: 'Choose a level from L1 to L7.',
  salary: 'Enter the salary as a whole number, like 95000.',
} as const;
