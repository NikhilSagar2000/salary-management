import { COUNTRIES, COUNTRY_NAMES, DEPARTMENTS, formatMoney, LEVELS, type Country, type Currency } from '@acme/shared';
import { Alert, Anchor, Box, Paper, Select, SimpleGrid, Skeleton, Stack, Table, Text, Title } from '@mantine/core';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api.ts';
import { COUNTRY_OPTIONS } from './employee/choices.ts';

type Cell = { department: string; level: number; median: number; min: number; max: number; headcount: number };
type Overview = { country: Country; currency: Currency; cells: Cell[] };

const grouped = (n: number) => n.toLocaleString('en-US');
const people = (n: number) => `${grouped(n)} ${n === 1 ? 'person' : 'people'}`;
const listLink = (country: Country, c: Cell) => `/employees?${new URLSearchParams({ country, department: c.department, level: String(c.level) })}`;

/** STATS-3: one country at a time, departments × levels; each cell opens the matching list. */
export function PayOverview() {
  const [params, setParams] = useSearchParams();
  const asked = params.get('country') as Country;
  const country = COUNTRIES.includes(asked) ? asked : 'US';
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    api<Overview>(`/api/pay-overview?country=${country}`).then(
      (d) => live && setData(d),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [country]);

  const cell = new Map(data?.cells.map((c) => [`${c.department}|${c.level}`, c]));
  const name = (c: Cell) => `${c.department}, L${c.level}: median ${formatMoney(c.median, data!.currency)}, ${people(c.headcount)}`;

  return (
    <Stack gap="md">
      <Title order={1} size="h2">Pay overview</Title>
      <Select label="Country" data={COUNTRY_OPTIONS} value={country} allowDeselect={false} maw={280}
        onChange={(c) => c && setParams({ country: c })} />
      <Text size="sm" c="dimmed">
        Annual base pay of people employed today, by department and level. Open a cell to see those people.
      </Text>
      {error && <Alert color="red" role="alert">{error}</Alert>}
      {!data && !error && <Skeleton h={360} aria-label="Loading pay overview" />}
      {data && (
        <>
          {/* Seven level columns need room; narrower screens get one block per department instead. */}
          <Paper withBorder visibleFrom="lg">
            <Table aria-label={`Pay in ${COUNTRY_NAMES[country]} by department and level`} withColumnBorders layout="fixed">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th scope="col" w={150}>Department</Table.Th>
                  {LEVELS.map((l) => <Table.Th key={l} scope="col">L{l}</Table.Th>)}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {DEPARTMENTS.map((d) => (
                  <Table.Tr key={d}>
                    <Table.Th scope="row">{d}</Table.Th>
                    {LEVELS.map((l) => {
                      const c = cell.get(`${d}|${l}`);
                      return (
                        <Table.Td key={l}>
                          {c ? (
                            <>
                              <Anchor component={Link} to={listLink(country, c)} aria-label={name(c)} fw={600} size="sm">
                                {formatMoney(c.median, data.currency)}
                              </Anchor>
                              <Text size="xs" c="dimmed">{grouped(c.min)} to {grouped(c.max)}</Text>
                              <Text size="xs" c="dimmed">{people(c.headcount)}</Text>
                            </>
                          ) : <Text span c="dimmed">—</Text>}
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
          <SimpleGrid cols={{ base: 1, sm: 2 }} hiddenFrom="lg">
            {DEPARTMENTS.map((d) => {
              const rows = data.cells.filter((c) => c.department === d);
              return (
                <Paper key={d} withBorder p="sm" component="section" aria-label={d}>
                  <Title order={2} size="h5" mb="xs">{d}</Title>
                  {rows.length ? (
                    <Stack gap={6}>
                      {rows.map((c) => (
                        <Box key={c.level}>
                          <Anchor component={Link} to={listLink(country, c)} aria-label={name(c)} size="sm">
                            <Text span fw={600}>L{c.level}</Text> median {formatMoney(c.median, data.currency)}
                          </Anchor>
                          <Text size="xs" c="dimmed">{grouped(c.min)} to {grouped(c.max)}, {people(c.headcount)}</Text>
                        </Box>
                      ))}
                    </Stack>
                  ) : <Text size="sm" c="dimmed">No one here today.</Text>}
                </Paper>
              );
            })}
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
}
