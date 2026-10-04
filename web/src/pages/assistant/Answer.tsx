import { Alert, Anchor, Badge, Box, Group, List, Loader, Paper, Text, Typography } from '@mantine/core';
import Markdown from 'react-markdown';
import { Link } from 'react-router';
import remarkGfm from 'remark-gfm';

export type Sources = {
  groups: { label: string; query: string | null; headcount: number }[];
  people: { code: string; name: string }[];
  morePeople: number;
};
export type Message = {
  id: number; role: 'user' | 'assistant'; content: string; sources: Sources | null; basedOnData: boolean | null;
  status: 'complete' | 'stopped' | 'error' | 'streaming'; steps?: string[];
};

const people = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'person' : 'people'}`;

export function Question({ text }: { text: string }) {
  return (
    <Paper component="article" aria-label="Question" p="sm" bg="var(--mantine-primary-color-light)" ml="auto" maw="85%">
      <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{text}</Text>
    </Paper>
  );
}

/**
 * One answer. It is not a live region: the page announces once when it finishes (A11Y-4). Lookup steps show only while it
 * is worked out (D73); saved answers never keep them.
 */
export function Answer({ message: m }: { message: Message }) {
  return (
    <Box component="article" aria-label="Answer">
      {m.status === 'streaming' && m.steps && m.steps.length > 0 && (
        <List size="xs" c="dimmed" mb="xs">{m.steps.map((s, i) => <List.Item key={i}>{s}</List.Item>)}</List>
      )}
      {m.status === 'error' ? <Alert color="red" variant="light">{m.content}</Alert> : <ModelText text={m.content} />}
      {m.status === 'streaming' && <Loader size="xs" type="dots" aria-hidden />}
      {m.status === 'stopped' && <Badge color="gray" variant="light">Stopped</Badge>}
      {m.status === 'complete' && m.basedOnData === false && <Text size="xs" c="dimmed" mt={4}>Not based on ACME data</Text>}
      {m.status === 'complete' && m.basedOnData && m.sources && <BasedOn sources={m.sources} />}
    </Box>
  );
}

/**
 * Bold, lists and tables from the model's markdown. react-markdown builds React elements and shows raw HTML as text (no
 * rehype-raw), so nothing the model writes runs (AST-11); images are dropped so the browser never fetches another host (AST-17).
 */
function ModelText({ text }: { text: string }) {
  return (
    <Typography fz="sm" style={{ overflowWrap: 'anywhere' }}>
      <Markdown remarkPlugins={[remarkGfm]} disallowedElements={['img']}>{text}</Markdown>
    </Typography>
  );
}

/** AST-8: built by the server from the lookups the model made. */
function BasedOn({ sources }: { sources: Sources }) {
  const list = sources.groups[0]?.query != null ? `/employees?${sources.groups[0].query}` : null;
  return (
    <Box component="section" aria-label="Based on" mt="xs">
      <Text size="xs" fw={600} c="dimmed">Based on</Text>
      <Group gap="xs" mt={2}>
        {sources.groups.map((g, i) => (g.query === null
          ? <Text key={i} span size="xs">{g.label} ({people(g.headcount)})</Text>
          : <Anchor key={i} component={Link} to={`/employees?${g.query}`} size="xs">{g.label} ({people(g.headcount)})</Anchor>))}
        {sources.people.map((p) => (
          <Anchor key={p.code} component={Link} to={`/employees/${p.code}`} size="xs">{p.name} ({p.code})</Anchor>
        ))}
        {sources.morePeople > 0 && (list
          ? <Anchor component={Link} to={list} size="xs">and {sources.morePeople} more</Anchor>
          : <Text span size="xs">and {sources.morePeople} more</Text>)}
      </Group>
    </Box>
  );
}
