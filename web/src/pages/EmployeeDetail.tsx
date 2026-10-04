import { COUNTRY_NAMES, formatDate, formatMoney, MSG, type Country } from '@acme/shared';
import { Alert, Anchor, Badge, Button, Group, Modal, Paper, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../api.ts';
import { DetailsForm } from './employee/DetailsForm.tsx';
import { JobChangeForm } from './employee/JobChangeForm.tsx';
import { LeaveForm } from './employee/LeaveForm.tsx';
import { Timeline } from './employee/Timeline.tsx';
import type { Detail } from './employee/types.ts';

const STATUS_COLOR: Record<string, string> = { starting: 'blue', active: 'teal', leaving: 'yellow', left: 'gray' };
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace('_', '-');

/** EMP-14: everything about one employee, and the ways to change it. */
export function EmployeeDetail() {
  const { code } = useParams();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<'details' | 'job' | 'leave' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  /** One-click writes (cancel, undo): send the loaded version, then reload; a failure is shown above the history. */
  const run = async (path: string) => {
    setActionError(null);
    try {
      await api(path, { method: 'POST', body: { version: detail!.version } });
      load();
    } catch (e) {
      setActionError((e as Error).message);
    }
  };
  const load = useCallback(() => {
    setError(null);
    api<Detail>(`/api/employees/${code}`).then(setDetail, (e: Error) => setError(e.message));
  }, [code]);
  useEffect(load, [load]);

  if (error) return <Alert color="red" role="alert">{error}</Alert>;
  if (!detail) return <Skeleton h={400} aria-label="Loading employee" />;
  const d = detail;
  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group gap="sm">
          <Title order={1} size="h2">{d.firstName} {d.lastName}</Title>
          <Badge variant="light" color={STATUS_COLOR[d.status]}>{capital(d.status)}</Badge>
        </Group>
        {/* LEAVE-3: once someone has left, the only change is undoing it. */}
        {d.status === 'left' ? (
          <Button onClick={() => run(`/api/employees/${d.code}/undo-leave`)}>Undo leaving</Button>
        ) : (
          <Group gap="xs">
            <Button variant="default" onClick={() => setForm('details')}>Edit details</Button>
            {d.status === 'leaving' ? (
              <Button variant="default" onClick={() => run(`/api/employees/${d.code}/undo-leave`)}>Undo leaving</Button>
            ) : (
              <Button variant="default" onClick={() => setForm('leave')}>Mark as leaving</Button>
            )}
            <Button onClick={() => setForm('job')}>Change job or pay</Button>
          </Group>
        )}
      </Group>
      <Modal opened={form === 'details'} onClose={() => setForm(null)} title="Edit details">
        {/* EMP-13: Reload refreshes the page behind the form; what was typed stays, now on the latest version. */}
        <DetailsForm detail={d} onSaved={() => { setForm(null); load(); }} onReload={load} />
      </Modal>
      {d.status === 'left' && <Alert color="gray">{MSG.hasLeft}</Alert>}
      {actionError && <Alert color="red" role="alert">{actionError}</Alert>}
      <Modal opened={form === 'leave'} onClose={() => setForm(null)} title="Mark as leaving">
        <LeaveForm detail={d} onSaved={() => { setForm(null); load(); }} onReload={load} />
      </Modal>
      <Modal opened={form === 'job'} onClose={() => setForm(null)} title="Change job or pay" size="lg">
        <JobChangeForm detail={d} onSaved={() => { setForm(null); load(); }} onReload={load} />
      </Modal>
      {/* EMP-5: code and hire date are facts, never inputs. */}
      <SimpleGrid component="ul" aria-label="Employee facts" cols={{ base: 2, sm: 4 }} p={0} m={0} style={{ listStyle: 'none' }}>
        <Fact label="Employee code" value={d.code} />
        <Fact label="Hired" value={formatDate(d.hireDate)} />
        <Fact label="Work email" value={d.workEmail} />
        <Fact label="Gender" value={capital(d.gender)} />
        {d.leaveDate && <Fact label={d.status === 'left' ? 'Left' : 'Leaving'} value={formatDate(d.leaveDate)} />}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <Section title={d.status === 'left' ? 'Last job' : 'Current job'}>
          <Text>{d.current.role}, L{d.current.level}</Text>
          <Text size="sm" c="dimmed">{d.current.department}, {COUNTRY_NAMES[d.current.country as Country]}</Text>
          <Text fw={600}>{formatMoney(d.current.salary, d.current.currency)}</Text>
          <Text size="sm">
            Manager:{' '}
            {d.current.manager ? (
              <>
                <Anchor component={Link} to={`/employees/${d.current.manager.code}`}>{d.current.manager.name}</Anchor>
                {d.current.manager.hasLeft && ' (has left)'}
              </>
            ) : 'none'}
          </Text>
        </Section>
        <Section title="Pay against peers">
          {d.peers ? (
            <>
              <Text>{peerPosition(d.peers.position, d.peers.headcount)}</Text>
              <Text size="sm" c="dimmed">
                Same country, role and level. {d.peers.currency}: median {grouped(d.peers.median)}, min {grouped(d.peers.min)}, max {grouped(d.peers.max)}
              </Text>
            </>
          ) : (
            <Text size="sm" c="dimmed">
              {d.status === 'left' ? 'Not compared: peers are counted as of today, after this person left.' : 'No one else has this country, role and level today.'}
            </Text>
          )}
        </Section>
        <Section title="Direct reports">
          {d.reports.length ? (
            <Stack gap={2}>
              {d.reports.map((r) => <Anchor key={r.code} component={Link} to={`/employees/${r.code}`} size="sm">{r.name}</Anchor>)}
            </Stack>
          ) : <Text size="sm" c="dimmed">None</Text>}
        </Section>
      </SimpleGrid>

      <Stack gap="xs">
        <Title order={2} size="h4">History</Title>
        <Timeline
          entries={d.timeline}
          action={(c) =>
            c.scheduled && !c.cancelled && !c.hire && d.status !== 'left' ? (
              <Button size="xs" variant="default" aria-label={`Cancel the change on ${formatDate(c.date)}`} onClick={() => run(`/api/employees/${d.code}/changes/${c.id}/cancel`)}>
                Cancel
              </Button>
            ) : null
          }
        />
      </Stack>
    </Stack>
  );
}

const grouped = (n: number) => n.toLocaleString('en-US');

function peerPosition(position: number, headcount: number) {
  const of = `the median of ${grouped(headcount)} ${headcount === 1 ? 'peer' : 'peers'}`;
  if (position === 0) return `At ${of}`;
  return `${Math.abs(position)}% ${position > 0 ? 'above' : 'below'} ${of}`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = `section-${title.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <Paper component="section" aria-labelledby={id} withBorder p="md">
      <Stack gap={6}>
        <Title order={2} size="h5" id={id}>{title}</Title>
        {children}
      </Stack>
    </Paper>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <li>
      <Text size="xs" c="dimmed">{label}</Text>
      <Text size="sm">{value}</Text>
    </li>
  );
}
