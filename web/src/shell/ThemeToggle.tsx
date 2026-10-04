import { ActionIcon, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';

/** UI-1: starts from the device's setting; Mantine remembers the choice in localStorage. */
export function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const current = useComputedColorScheme('light');
  const other = current === 'dark' ? 'light' : 'dark';
  return (
    <ActionIcon variant="subtle" color="gray" size="lg" aria-label={`Switch to ${other} theme`} onClick={() => setColorScheme(other)}>
      {current === 'dark' ? <IconSun size={18} stroke={1.75} /> : <IconMoon size={18} stroke={1.75} />}
    </ActionIcon>
  );
}
