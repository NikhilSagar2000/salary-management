import { Center, Loader } from '@mantine/core';
import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { api, ApiError } from '../api.ts';

/** Shows the page only when signed in; otherwise sends the user to sign-in and back here afterwards (AUTH-5). */
export function RequireSession({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<'checking' | 'in' | 'out'>('checking');
  useEffect(() => {
    api('/api/session').then(
      () => setState('in'),
      (err) => setState(err instanceof ApiError && err.status === 401 ? 'out' : 'in'),
    );
  }, []);
  if (state === 'checking') return <Center h="50vh"><Loader aria-label="Loading" /></Center>;
  if (state === 'out') return <Navigate replace to={`/signin?next=${encodeURIComponent(location.pathname + location.search)}`} />;
  return children;
}
