import { Alert, Box, Button, Grid, NavLink, Stack, Text, Title } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api.ts';
import { ChatView } from './assistant/ChatView.tsx';

type ChatSummary = { id: number; title: string; updatedAt: string };

/** AST-1: saved chats, newest first, beside the open chat. On a phone the list and the chat take turns. */
export function Assistant() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadChats = useCallback(() => api<ChatSummary[]>('/api/chats').then(setChats, (e: Error) => setError(e.message)), []);
  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  const newChat = async () => {
    setCreating(true);
    setError(null);
    try {
      const chat = await api<ChatSummary>('/api/chats', { method: 'POST' });
      await loadChats();
      navigate(`/assistant/${chat.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Stack gap="md">
      <Title order={1} size="h2">Pay assistant</Title>
      {error && <Alert color="red" role="alert">{error}</Alert>}
      <Grid gap="lg">
        <Grid.Col span={{ base: 12, md: 3 }} visibleFrom={id ? 'md' : undefined}>
          <Stack gap="xs">
            <Button leftSection={<IconPlus size={16} />} onClick={newChat} loading={creating}>New chat</Button>
            <Box component="nav" aria-label="Chats">
              {chats?.length === 0 && <Text size="sm" c="dimmed">No chats yet.</Text>}
              {chats?.map((c) => {
                const active = String(c.id) === id;
                return (
                  <NavLink key={c.id} component={Link} to={`/assistant/${c.id}`} label={c.title} active={active}
                    aria-current={active ? 'page' : undefined} />
                );
              })}
            </Box>
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 9 }} visibleFrom={id ? undefined : 'md'}>
          {id ? (
            <ChatView key={id} id={Number(id)} onChanged={() => void loadChats()} onDeleted={() => {
              void loadChats();
              navigate('/assistant');
            }} />
          ) : (
            <Text size="sm" c="dimmed" maw={560}>
              Start a new chat or open one. The assistant answers questions about pay, people and changes using ACME's data
              through read-only lookups, and every answer says what it's based on.
            </Text>
          )}
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
