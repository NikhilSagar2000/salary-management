import { MantineProvider } from '@mantine/core';
import { Navigate, Route, Routes } from 'react-router';
import { AddEmployee } from './pages/AddEmployee.tsx';
import { Assistant } from './pages/Assistant.tsx';
import { EmployeeDetail } from './pages/EmployeeDetail.tsx';
import { EmployeeList } from './pages/EmployeeList.tsx';
import { Import } from './pages/Import.tsx';
import { PayOverview } from './pages/PayOverview.tsx';
import { Layout } from './shell/Layout.tsx';
import { RequireSession } from './shell/RequireSession.tsx';
import { SignIn } from './shell/SignIn.tsx';
import { theme } from './theme.ts';

/** Providers and routes; main.tsx adds the browser router, tests add an in-memory one. */
/** `env="test"` turns off Mantine transitions and portals for tests. */
export function App({ env }: { env?: 'default' | 'test' }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto" env={env}>
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route element={<RequireSession><Layout /></RequireSession>}>
          <Route index element={<Navigate replace to="/employees" />} />
          <Route path="/employees" element={<EmployeeList />} />
          <Route path="/employees/new" element={<AddEmployee />} />
          <Route path="/employees/:code" element={<EmployeeDetail />} />
          <Route path="/pay" element={<PayOverview />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/assistant/:id" element={<Assistant />} />
          <Route path="/import" element={<Import />} />
        </Route>
      </Routes>
    </MantineProvider>
  );
}
