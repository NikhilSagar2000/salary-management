import { AppShell, Burger, Group, NavLink, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { NavLink as RouterLink, Outlet } from 'react-router';
import { ThemeToggle } from './ThemeToggle.tsx';

const LINKS = [
  { to: '/employees', label: 'Employees' },
  { to: '/pay', label: 'Pay overview' },
  { to: '/assistant', label: 'Assistant' },
  { to: '/import', label: 'Import' },
];

export function Layout() {
  const [opened, { toggle, close }] = useDisclosure();
  return (
    <AppShell header={{ height: 56 }} navbar={{ width: 200, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding="md">
      <a className="skip-link" href="#main">Skip to main content</a>
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Menu" />
            <Text fw={600}>ACME Pay</Text>
          </Group>
          <ThemeToggle />
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="xs" aria-label="Main">
        {LINKS.map((l) => (
          <NavLink key={l.to} component={RouterLink} to={l.to} label={l.label} onClick={close} />
        ))}
      </AppShell.Navbar>
      <AppShell.Main id="main" tabIndex={-1}>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
