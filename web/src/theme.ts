import { createTheme } from '@mantine/core';

/** D65: calm and data-dense; one accent (teal), one corner radius, system fonts. */
export const theme = createTheme({
  primaryColor: 'teal',
  defaultRadius: 'sm',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  headings: { fontWeight: '600' },
});
