import { chatTitleSchema, MSG, questionSchema } from '@acme/shared';
import { Alert, Anchor, Box, Button, Group, Modal, Paper, Skeleton, Stack, Text, Textarea, TextInput, Title, VisuallyHidden } from '@mantine/core';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { api, ApiError, apiStream } from '../../api.ts';
import { issuesToFields, useFormErrors } from '../../forms.ts';
import { Answer, Question, type Message, type Sources } from './Answer.tsx';

type Chat = { id: number; title: string; updatedAt: string; messages: Message[] };

/**
 * One chat: its questions and answers, the composer, rename and delete (AST-1, AST-3, AST-12). `listTitle` is the
 * title in the chat list, which follows the server when the first question names the chat.
 */
export function ChatView({ id, listTitle, onChanged, onDeleted }: { id: number; listTitle?: string; onChanged: () => void; onDeleted: () => void }) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null);
  const stop = useRef<AbortController | null>(null);
  const tempId = useRef(0);
  const streaming = chat?.messages.some((m) => m.status === 'streaming') ?? false;
  const end = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const count = chat?.messages.length ?? 0;
  const last = chat?.messages.at(-1);
  // A new question (or opening the chat) scrolls to the newest message.
  // Braces matter: Chromium's scrollIntoView returns a promise, which React would call as a clean-up.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [count]);
  // A growing answer stays in view, unless HR has scrolled up to read something else.
  useEffect(() => {
    const el = scroller.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 400) end.current?.scrollIntoView({ block: 'end' });
  }, [last?.content.length, last?.status, last?.steps?.length]);

  useEffect(() => {
    api<Chat>(`/api/chats/${id}`).then(setChat, (e: Error) => setError(e.message));
  }, [id]);
  // Leaving the chat closes the stream, which stops the answer on the server too.
  useEffect(() => () => stop.current?.abort(), []);

  const patch = (messageId: number, change: (m: Message) => Partial<Message>) =>
    setChat((c) => c && { ...c, messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...change(m) } : m)) });

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    if (streaming) return;
    const parsed = questionSchema.safeParse({ question });
    if (!parsed.success) return setQuestionError(parsed.error.issues[0]!.message);
    setQuestionError(null);
    setAnnounce('');
    const asked = question;
    const qid = --tempId.current;
    const aid = --tempId.current;
    const blank = { sources: null, basedOnData: null };
    setQuestion('');
    setChat((c) => c && {
      ...c,
      messages: [...c.messages, { id: qid, role: 'user', content: asked, status: 'complete', ...blank }, { id: aid, role: 'assistant', content: '', status: 'streaming', steps: [], ...blank }],
    });

    const ctl = new AbortController();
    stop.current = ctl;
    let end: Partial<Message> = { status: 'complete' };
    try {
      await apiStream(`/api/chats/${id}/messages`, { question: asked }, ctl.signal, (type, data) => {
        const d = data as { text: string; sources: Sources; basedOnData: boolean; message: string };
        if (type === 'step') patch(aid, (m) => ({ steps: [...(m.steps ?? []), d.text] }));
        if (type === 'token') patch(aid, (m) => ({ content: m.content + d.text }));
        if (type === 'reset') patch(aid, () => ({ content: '' })); // narration before a lookup; it comes back as a step
        if (type === 'sources') end = { ...end, sources: d.sources, basedOnData: d.basedOnData };
        if (type === 'error') end = { status: 'error', content: d.message };
      });
    } catch (err) {
      if (ctl.signal.aborted) end = { status: 'stopped' };
      else if (err instanceof ApiError) {
        // Refused before answering (offline, another answer running, bad question): nothing was saved, so take it back.
        setChat((c) => c && { ...c, messages: c.messages.filter((m) => m.id !== qid && m.id !== aid) });
        setQuestion(asked);
        setQuestionError(err.message);
        stop.current = null;
        return;
      } else end = { status: 'error', content: MSG.assistantUnavailable };
    }
    stop.current = null;
    patch(aid, () => end);
    setAnnounce(end.status === 'complete' ? 'Answer finished.' : end.status === 'stopped' ? 'Answer stopped.' : end.content!);
    onChanged(); // the first question names the chat, and the list is newest first
  };

  if (error) return <Alert color="red" role="alert">{error}</Alert>;
  if (!chat) return <Skeleton h={240} aria-label="Loading chat" />;
  const title = listTitle ?? chat.title;
  return (
    <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
      <Anchor component={Link} to="/assistant" size="sm" hiddenFrom="md">All chats</Anchor>
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Title order={2} size="h3" style={{ overflowWrap: 'anywhere' }}>{title}</Title>
        <Group gap="xs" wrap="nowrap">
          <Button size="xs" variant="default" onClick={() => setDialog('rename')}>Rename</Button>
          <Button size="xs" variant="default" color="red" onClick={() => setDialog('delete')}>Delete</Button>
        </Group>
      </Group>

      {/*
        AST-19: the messages scroll on their own; focusable so the keyboard can scroll them too. Relative, so the hidden
        status below stays inside this box instead of stretching the page.
      */}
      <Box ref={scroller} role="region" aria-label="Messages" tabIndex={0} pos="relative" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {chat.messages.length === 0 && (
          <Text size="sm" c="dimmed">
            Ask about pay, people or changes, for example "What is the median salary for L4 engineers in Germany?" or "Who
            changed department this year?". Answers come from ACME's data through read-only lookups and say what they're based on.
          </Text>
        )}
        <Stack gap="md">
          {chat.messages.map((m) => (m.role === 'user' ? <Question key={m.id} text={m.content} /> : <Answer key={m.id} message={m} />))}
        </Stack>
        <div ref={end} />
        <VisuallyHidden role="status">{announce}</VisuallyHidden>
      </Box>

      <Paper component="form" onSubmit={send} withBorder p="sm">
        <Stack gap="xs">
          <Textarea label="Your question" rows={3} maxLength={2000} value={question} error={questionError}
            description="Enter sends; Shift+Enter starts a new line."
            onChange={(e) => setQuestion(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }} />
          <Group justify="flex-end">
            {/* Separate keyed buttons: reusing one element would turn Stop into a submit mid-click and send the waiting question. */}
            {streaming
              ? <Button key="stop" type="button" variant="light" color="red" onClick={() => stop.current?.abort()}>Stop</Button>
              : <Button key="send" type="submit" disabled={!question.trim()}>Send</Button>}
          </Group>
        </Stack>
      </Paper>

      <Modal opened={dialog === 'rename'} onClose={() => setDialog(null)} title="Rename chat">
        <RenameForm id={id} title={title} onCancel={() => setDialog(null)} onSaved={(title) => {
          setChat((c) => c && { ...c, title });
          setDialog(null);
          onChanged();
        }} />
      </Modal>
      <Modal opened={dialog === 'delete'} onClose={() => setDialog(null)} title="Delete this chat?">
        <DeleteConfirm id={id} title={title} onCancel={() => setDialog(null)} onDeleted={onDeleted} />
      </Modal>
    </Stack>
  );
}

function RenameForm({ id, title: current, onCancel, onSaved }: { id: number; title: string; onCancel: () => void; onSaved: (title: string) => void }) {
  const [title, setTitle] = useState(current);
  const form = useFormErrors();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = chatTitleSchema.safeParse({ title });
    if (!parsed.success) return form.setFields(issuesToFields(parsed.error.issues));
    form.setFields({});
    if (await form.save(() => api(`/api/chats/${id}`, { method: 'PATCH', body: parsed.data }))) onSaved(parsed.data.title);
  };
  return (
    <form ref={form.ref} onSubmit={submit} noValidate>
      <Stack>
        {form.formError && <Alert color="red" role="alert">{form.formError.message}</Alert>}
        <TextInput label="Chat name" data-autofocus value={title} onChange={(e) => {
          form.clearField('title');
          setTitle(e.currentTarget.value);
        }} error={form.fields.title} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onCancel}>Cancel</Button>
          <Button type="submit" loading={form.saving}>Save</Button>
        </Group>
      </Stack>
    </form>
  );
}

function DeleteConfirm({ id, title, onCancel, onDeleted }: { id: number; title: string; onCancel: () => void; onDeleted: () => void }) {
  const form = useFormErrors();
  return (
    <Stack>
      <Text size="sm">"{title}" and all its questions and answers will be deleted. This can't be undone.</Text>
      {form.formError && <Alert color="red" role="alert">{form.formError.message}</Alert>}
      <Group justify="flex-end">
        <Button variant="default" onClick={onCancel} data-autofocus>Cancel</Button>
        <Button color="red" loading={form.saving}
          onClick={async () => (await form.save(() => api(`/api/chats/${id}`, { method: 'DELETE' }))) && onDeleted()}>
          Delete chat
        </Button>
      </Group>
    </Stack>
  );
}
