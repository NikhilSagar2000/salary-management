import { MSG } from '@acme/shared';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { expect, test } from 'vitest';
import { fakeApi, gate, sse, sseEvent } from '../test/fakeApi.ts';
import { renderApp } from '../test/render.tsx';

const CHATS = [
  { id: 2, title: 'Median pay in Brazil', updatedAt: '2026-10-03T10:00:00Z' },
  { id: 1, title: 'Engineering raises in 2025', updatedAt: '2026-10-01T10:00:00Z' },
];
let nextId = 1;
const message = (role: 'user' | 'assistant', content: string, extra: object = {}) => ({
  id: nextId++, role, content, sources: null, basedOnData: null, status: 'complete', errorKind: null, createdAt: '2026-10-03T10:00:00Z', ...extra,
});
const noSources = { groups: [], people: [], morePeople: 0 };

const start = (at: string, routes: Parameters<typeof fakeApi>[0] = {}) => {
  const calls = fakeApi({
    'GET /api/session': () => ({ status: 200, body: { signedIn: true } }),
    'GET /api/chats': () => ({ status: 200, body: CHATS }),
    'GET /api/chats/2': () => ({ status: 200, body: { ...CHATS[0], messages: [] } }),
    'GET /api/assistant/status': () => ({ status: 200, body: { freeRequestsLeft: null } }),
    ...routes,
  });
  renderApp(at);
  return calls;
};
const ask = async (question: string) => {
  await userEvent.type(await screen.findByLabelText('Your question'), question);
  await userEvent.click(screen.getByRole('button', { name: 'Send' }));
};

test.fails('chat list, rename, and delete after confirming', async () => {
  let list = [...CHATS];
  const calls = start('/assistant', {
    'GET /api/chats': () => ({ status: 200, body: list }),
    'POST /api/chats': () => {
      list = [{ id: 3, title: 'New chat', updatedAt: '2026-10-04T09:00:00Z' }, ...list];
      return { status: 201, body: list[0] };
    },
    'GET /api/chats/3': () => ({ status: 200, body: { ...list[0], messages: [] } }),
    'GET /api/chats/2': () => ({ status: 200, body: { ...list.find((c) => c.id === 2), messages: [] } }),
    'PATCH /api/chats/2': ({ body }) => {
      const { title } = body as { title: string };
      list = list.map((c) => (c.id === 2 ? { ...c, title } : c));
      return { status: 200, body: { id: 2, title } };
    },
    'DELETE /api/chats/2': () => {
      list = list.filter((c) => c.id !== 2);
      return { status: 204 };
    },
  });
  const nav = await screen.findByRole('navigation', { name: 'Chats' });
  await waitFor(() => expect(within(nav).getAllByRole('link').map((l) => l.textContent)).toEqual(['Median pay in Brazil', 'Engineering raises in 2025']));

  await userEvent.click(screen.getByRole('button', { name: 'New chat' }));
  await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/assistant/3'));
  await waitFor(() => expect(within(nav).getAllByRole('link')[0]).toHaveTextContent('New chat'));

  await userEvent.click(within(nav).getByRole('link', { name: 'Median pay in Brazil' }));
  expect(await screen.findByRole('heading', { name: 'Median pay in Brazil' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Rename' }));
  const rename = await screen.findByRole('dialog', { name: 'Rename chat' });
  const field = within(rename).getByLabelText('Chat name');
  expect(field).toHaveValue('Median pay in Brazil');
  await userEvent.clear(field);
  await userEvent.click(within(rename).getByRole('button', { name: 'Save' }));
  expect(within(rename).getByText(MSG.chatTitle)).toBeInTheDocument();
  await userEvent.type(field, 'Brazil pay');
  await userEvent.click(within(rename).getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('heading', { name: 'Brazil pay' })).toBeInTheDocument();
  await waitFor(() => expect(within(nav).getByRole('link', { name: 'Brazil pay' })).toBeInTheDocument());

  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await userEvent.click(within(await screen.findByRole('dialog', { name: 'Delete this chat?' })).getByRole('button', { name: 'Cancel' }));
  expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  await userEvent.click(within(await screen.findByRole('dialog', { name: 'Delete this chat?' })).getByRole('button', { name: 'Delete chat' }));
  await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/assistant'));
  await waitFor(() => expect(within(nav).queryByRole('link', { name: 'Brazil pay' })).not.toBeInTheDocument());
});

test.fails('sources link to people and filtered lists', async () => {
  start('/assistant/2', {
    'GET /api/chats/2': () => ({
      status: 200,
      body: {
        ...CHATS[0],
        messages: [
          message('user', 'Who are the best paid engineers in Brazil?'),
          message('assistant', 'Ana Silva is the best paid.', {
            basedOnData: true,
            sources: {
              groups: [{ kind: 'group', label: 'Brazil, Engineering', query: 'country=BR&department=Engineering', headcount: 412 }],
              people: [{ kind: 'person', code: 'E000123', name: 'Ana Silva' }],
              morePeople: 5,
            },
          }),
          message('user', 'What is a good salary?'),
          message('assistant', 'It depends on the market.', { basedOnData: false, sources: noSources }),
        ],
      },
    }),
  });
  const [first, second] = await screen.findAllByRole('article', { name: 'Answer' });
  const basedOn = within(first!).getByRole('region', { name: 'Based on' });
  expect(within(basedOn).getByRole('link', { name: 'Brazil, Engineering (412 people)' })).toHaveAttribute('href', '/employees?country=BR&department=Engineering');
  expect(within(basedOn).getByRole('link', { name: 'Ana Silva (E000123)' })).toHaveAttribute('href', '/employees/E000123');
  expect(within(basedOn).getByRole('link', { name: 'and 5 more' })).toHaveAttribute('href', '/employees?country=BR&department=Engineering');
  expect(second).toHaveTextContent('Not based on ACME data');
  expect(within(second!).queryByRole('region', { name: 'Based on' })).not.toBeInTheDocument();
});

test.fails('model HTML shows as text, never runs', async () => {
  const content = 'Pay is **higher** in Engineering.\n\n| Level | Median |\n|---|---|\n| L4 | BRL 145,000 |\n\n'
    + '<img src="x" onerror="window.hacked = true"> <script>window.hacked = true</script>\n\n![tracker](https://evil.example/pixel.png)';
  start('/assistant/2', {
    'GET /api/chats/2': () => ({ status: 200, body: { ...CHATS[0], messages: [message('user', 'Pay?'), message('assistant', content, { basedOnData: false, sources: noSources })] } }),
  });
  const answer = await screen.findByRole('article', { name: 'Answer' });
  expect(within(answer).getByText('higher').tagName).toBe('STRONG');
  expect(within(answer).getByRole('table')).toHaveTextContent('BRL 145,000');
  expect(answer).toHaveTextContent('<img src="x" onerror="window.hacked = true">');
  expect(answer.querySelector('img, script')).toBeNull(); // no tag runs, and no image makes the browser call another host (AST-17)
  expect((window as { hacked?: boolean }).hacked).toBeUndefined();
});

test.fails('Stop ends the stream and shows Stopped', async () => {
  const hold = gate();
  const calls = start('/assistant/2', {
    'POST /api/chats/2/messages': () => ({
      status: 200,
      events: sse(sseEvent('step', { text: 'Looking up pay in Brazil…' }), sseEvent('token', { text: 'The median is' }), hold.wait),
    }),
  });
  const box = await screen.findByLabelText('Your question');
  expect(box).toHaveAttribute('maxlength', '2000');
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled(); // nothing typed yet
  await ask('What is the median pay in Brazil?');

  expect(await screen.findByText('Looking up pay in Brazil…')).toBeInTheDocument();
  expect(await screen.findByText('The median is')).toBeInTheDocument();
  expect(screen.getByRole('article', { name: 'Question' })).toHaveTextContent('What is the median pay in Brazil?');
  expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument(); // one answer at a time
  await userEvent.click(screen.getByRole('button', { name: 'Stop' }));

  const answer = screen.getByRole('article', { name: 'Answer' });
  await waitFor(() => expect(answer).toHaveTextContent('Stopped'));
  expect(answer).toHaveTextContent('The median is');
  expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ question: 'What is the median pay in Brazil?' });
  hold.open();
});

test.fails('free requests left are shown when known', async () => {
  const calls = start('/assistant/2');
  await screen.findByRole('heading', { name: 'Median pay in Brazil' });
  await waitFor(() => expect(calls.some((c) => c.url.pathname === '/api/assistant/status')).toBe(true));
  expect(screen.queryByText(/free model requests left/)).not.toBeInTheDocument();
  cleanup();

  start('/assistant/2', { 'GET /api/assistant/status': () => ({ status: 200, body: { freeRequestsLeft: 37 } }) });
  expect(await screen.findByText('37 free model requests left today')).toBeInTheDocument();
});

test.fails('announces once when the answer finishes', async () => {
  const hold = gate();
  start('/assistant/2', {
    'POST /api/chats/2/messages': () => ({
      status: 200,
      events: sse(
        sseEvent('token', { text: 'The median ' }), hold.wait, sseEvent('token', { text: 'is BRL 129,000.' }),
        sseEvent('sources', { sources: noSources, basedOnData: false }), sseEvent('done', {}),
      ),
    }),
  });
  await ask('What is the median pay in Brazil?');
  expect(await screen.findByText('The median')).toBeInTheDocument();
  const status = screen.getByRole('status');
  expect(status).toBeEmptyDOMElement();
  for (const live of document.querySelectorAll('[aria-live], [role="status"], [role="alert"], [role="log"]')) {
    expect(live.textContent).not.toContain('The median'); // words are not read out as they arrive
  }

  hold.open();
  await waitFor(() => expect(status).toHaveTextContent('Answer finished.'));
  expect(screen.getByRole('article', { name: 'Answer' })).toHaveTextContent('The median is BRL 129,000.');
});
