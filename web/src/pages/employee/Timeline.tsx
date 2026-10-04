import { COUNTRY_NAMES, formatDate, formatMoney, type Country } from '@acme/shared';
import { Badge, Group, Paper, Stack, Text } from '@mantine/core';
import type { ReactNode } from 'react';
import type { Change, Detail, Money, Person } from './types.ts';

const FIELD: Record<string, string> = { country: 'Country', department: 'Department', role: 'Role', level: 'Level', manager: 'Manager', salary: 'Salary' };

function show(field: string, value: unknown): string {
  if (value === null || value === undefined) return field === 'manager' ? 'none' : 'not set';
  if (field === 'country') return COUNTRY_NAMES[value as Country];
  if (field === 'level') return `L${value}`;
  if (field === 'salary') return formatMoney((value as Money).amount, (value as Money).currency);
  if (field === 'manager') return (value as Person).name;
  return String(value);
}

/** EMP-14: changes, scheduled and cancelled ones, and leaving, newest first. */
export function Timeline({ entries, action }: { entries: Detail['timeline']; action?: (c: Change) => ReactNode }) {
  return (
    <Stack component="ol" aria-label="History" gap="xs" p={0} m={0} style={{ listStyle: 'none' }}>
      {[...entries].reverse().map((e, i) => (
        <Paper component="li" key={i} withBorder p="sm">
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Stack gap={4}>
              <Group gap="xs">
                <Text size="sm" fw={600}>{formatDate(e.date)}</Text>
                {e.type === 'change' && e.hire && <Badge variant="light">Hired</Badge>}
                {e.type === 'change' && e.scheduled && !e.cancelled && <Badge variant="light" color="blue">Scheduled</Badge>}
                {e.type === 'change' && e.cancelled && <Badge variant="light" color="gray">Cancelled</Badge>}
                {e.type === 'change' && e.wontApply && <Badge variant="light" color="yellow">Won't apply (after leave date)</Badge>}
                {e.type === 'left' && <Badge variant="light" color="gray">Leaves</Badge>}
                {e.type === 'undone' && <Badge variant="light">Leaving undone</Badge>}
              </Group>
              {e.type === 'change' &&
                e.changes.map((c) => (
                  <Text key={c.field} size="sm" td={e.cancelled ? 'line-through' : undefined}>
                    {FIELD[c.field]}: {e.hire ? show(c.field, c.to) : `${show(c.field, c.from)} → ${show(c.field, c.to)}`}
                  </Text>
                ))}
              {e.type === 'change' && e.note && <Text size="sm" c="dimmed">{e.note}</Text>}
              {e.type === 'left' && e.reason && <Text size="sm" c="dimmed">{e.reason}</Text>}
            </Stack>
            {e.type === 'change' && action?.(e)}
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}
