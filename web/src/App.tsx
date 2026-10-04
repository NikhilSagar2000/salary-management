import { MantineProvider, Title } from '@mantine/core';
import { Navigate, Route, Routes } from 'react-router';
import { EmployeeList } from './pages/EmployeeList.tsx';
import { Layout } from './shell/Layout.tsx';
import { RequireSession } from './shell/RequireSession.tsx';
import { SignIn } from './shell/SignIn.tsx';
import { theme } from './theme.ts';

const Page = ({ title }: { title: string }) => <Title order={1} size="h2">{title}</Title>;

/** Providers and routes; main.tsx adds the browser router, tests add an in-memory one. */
export function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route element={<RequireSession><Layout /></RequireSession>}>
          <Route index element={<Navigate replace to="/employees" />} />
          <Route path="/employees" element={<EmployeeList />} />
          <Route path="/pay" element={<Page title="Pay overview" />} />
          <Route path="/assistant" element={<Page title="Assistant" />} />
          <Route path="/import" element={<Page title="Import" />} />
        </Route>
      </Routes>
    </MantineProvider>
  );
}
