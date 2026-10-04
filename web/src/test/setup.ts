import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom lacks these browser APIs that Mantine uses.
const mediaQueries = new Map<string, boolean>();
export const setPrefersDark = (dark: boolean) => mediaQueries.set('(prefers-color-scheme: dark)', dark);
window.matchMedia = (query: string) =>
  ({
    matches: mediaQueries.get(query) ?? false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.scrollTo = () => {};

afterEach(() => {
  cleanup();
  localStorage.clear();
  mediaQueries.clear();
});
