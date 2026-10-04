import { formatDate } from '@acme/shared';
import { Alert, Badge, Group, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { api } from '../api.ts';
import type { Detail } from './employee/types.ts';

const STATUS_COLOR: Record<string, string> = { starting: 'blue', active: 'teal', leaving: 'yellow', left: 'gray' };
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace('_', '-');

/** EMP-14: everything about one employee, and the ways to change it. */
export function EmployeeDetail() {
  const { code } = useParams();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      <Group gap="sm">
        <Title order={1} size="h2">{d.firstName} {d.lastName}</Title>
        <Badge variant="light" color={STATUS_COLOR[d.status]}>{capital(d.status)}</Badge>
      </Group>
      {/* EMP-5: code and hire date are facts, never inputs. */}
      <SimpleGrid component="ul" aria-label="Employee facts" cols={{ base: 2, sm: 4 }} p={0} m={0} style={{ listStyle: 'none' }}>
        <Fact label="Employee code" value={d.code} />
        <Fact label="Hired" value={formatDate(d.hireDate)} />
        <Fact label="Work email" value={d.workEmail} />
        <Fact label="Gender" value={capital(d.gender)} />
        {d.leaveDate && <Fact label={d.status === 'left' ? 'Left' : 'Leaving'} value={formatDate(d.leaveDate)} />}
      </SimpleGrid>
    </Stack>
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
