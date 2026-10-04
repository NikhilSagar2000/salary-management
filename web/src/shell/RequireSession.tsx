import { Alert, Button, Center, Loader, Stack } from '@mantine/core';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { api, ApiError } from '../api.ts';

type State = { kind: 'checking' | 'in' | 'out' } | { kind: 'error'; message: string };

/** Shows the page only when signed in; otherwise sends the user to sign-in and back here afterwards (AUTH-5). */
export function RequireSession({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<State>({ kind: 'checking' });
  const check = useCallback(() => {
    setState({ kind: 'checking' });
    api('/api/session').then(
      () => setState({ kind: 'in' }),
      (err) => setState(err instanceof ApiError && err.status === 401 ? { kind: 'out' } : { kind: 'error', message: (err as Error).message }),
    );
  }, []);
  useEffect(check, [check]);

  if (state.kind === 'checking') return <Center h="50vh"><Loader aria-label="Loading" /></Center>;
  if (state.kind === 'out') return <Navigate replace to={`/signin?next=${encodeURIComponent(location.pathname + location.search)}`} />;
  if (state.kind === 'error') {
    // UI-4: say what went wrong in plain words and offer a retry, never a blank page.
    return (
      <Center h="50vh" px="md">
        <Stack maw={420}>
          <Alert color="red" role="alert">{state.message}</Alert>
          <Button variant="default" onClick={check}>Try again</Button>
        </Stack>
      </Center>
    );
  }
  return children;
}
