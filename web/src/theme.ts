import { createTheme, darken, Drawer, Modal, Pagination, type CSSVariablesResolver } from '@mantine/core';

const PAGE_CONTROLS = { first: 'First page', previous: 'Previous page', next: 'Next page', last: 'Last page' } as const;

/** D65: calm and data-dense; one accent (teal), one corner radius, system fonts. */
export const theme = createTheme({
  primaryColor: 'teal',
  // A11Y-1: the darkest teal keeps white button text and teal links at 4.5:1 or more.
  primaryShade: 9,
  defaultRadius: 'sm',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  headings: { fontWeight: '600' },
  components: {
    // A11Y-1: icon-only buttons need a name.
    Modal: Modal.extend({ defaultProps: { closeButtonProps: { 'aria-label': 'Close' } } }),
    Drawer: Drawer.extend({ defaultProps: { closeButtonProps: { 'aria-label': 'Close' } } }),
    Pagination: Pagination.extend({ defaultProps: { getControlProps: (control) => ({ 'aria-label': PAGE_CONTROLS[control] }) } }),
  },
});

/** A11Y-1: dimmed text, and text on tinted ("light") badges, alerts and nav links, reach 4.5:1 in both themes. */
export const cssVariablesResolver: CSSVariablesResolver = (t) => ({
  variables: {},
  light: {
    '--mantine-color-dimmed': t.colors.gray[7]!,
    ...Object.fromEntries(['teal', 'blue', 'yellow', 'orange', 'red', 'gray'].map((c) => [`--mantine-color-${c}-light-color`, darken(t.colors[c]![9]!, 0.35)])),
  },
  dark: { '--mantine-color-dimmed': t.colors.dark[1]! },
});
