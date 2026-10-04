import { MantineProvider } from '@mantine/core';
import { theme } from './theme.ts';

export function App() {
  return <MantineProvider theme={theme} defaultColorScheme="auto">ACME Pay</MantineProvider>;
}
