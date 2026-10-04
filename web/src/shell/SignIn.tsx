import { Alert, Button, Container, PasswordInput, Stack, Title } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api, ApiError } from '../api.ts';

export function SignIn() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/session', { method: 'POST', body: { password } });
      // Only a path on this site: "//host" and "/\host" would leave it.
      const next = params.get('next');
      navigate(next && /^\/(?![/\\])/.test(next) ? next : '/employees', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container size={360} py={80}>
      <form onSubmit={submit}>
        <Stack>
          <Title order={1} size="h2">Sign in</Title>
          {error && <Alert color="red" role="alert">{error}</Alert>}
          <PasswordInput label="Password" value={password} onChange={(e) => setPassword(e.currentTarget.value)} required withAsterisk={false} autoFocus />
          <Button type="submit" loading={busy}>Sign in</Button>
        </Stack>
      </form>
    </Container>
  );
}
