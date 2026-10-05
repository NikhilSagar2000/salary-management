import {
  COUNTRIES, COUNTRY_NAMES, DEFAULT_STATUSES, DEPARTMENTS, formatDate, formatMoney, GENDERS, LEVELS, MSG, ROLE_NAMES, STATUSES,
  type Currency,
} from '@acme/shared';
import {
  Alert, Anchor, Badge, Button, Drawer, Group, MultiSelect, NumberInput, Pagination, Paper, Select, SimpleGrid, Skeleton, Stack, Table, Text,
  TextInput, Title, UnstyledButton,
} from '@mantine/core';
import { useDebouncedCallback, useDisclosure, useMediaQuery } from '@mantine/hooks';
import { IconArrowDown, IconArrowUp, IconDownload, IconPlus } from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api.ts';

type Row = {
  code: string; firstName: string; lastName: string; country: string; currency: Currency; department: string; role: string;
  level: number; salary: number; hireDate: string; leaveDate: string | null; status: string;
};
type ListData = { rows: Row[]; total: number; page: number; pageSize: number };

const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace('_', '-');
const STATUS_COLOR: Record<string, string> = { starting: 'blue', active: 'teal', leaving: 'yellow', left: 'gray' };
const COLUMNS: { key: string; label: string }[] = [
  { key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'country', label: 'Country' },
  { key: 'department', label: 'Department' }, { key: 'role', label: 'Role' }, { key: 'level', label: 'Level' },
  { key: 'salary', label: 'Salary' }, { key: 'hireDate', label: 'Hired' },
];

/** LIST-1…10: the employee list. Its URL query is the API query, so every view can be reloaded and shared. */
export function EmployeeList() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<ListData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = params.toString();

  useEffect(() => {
    let live = true;
    setError(null);
    api<ListData>(`/api/employees${query ? `?${query}` : ''}`).then(
      (d) => live && setData(d),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [query]);

  // The address as last written. The router hands this render the new params only after it re-renders, so a second
  // change before then (the search's delayed write) builds on this, not on `params`, and keeps the first.
  const latest = useRef(params);
  useEffect(() => {
    latest.current = params;
  }, [params]);
  const write = (next: URLSearchParams) => {
    latest.current = next;
    setParams(next);
  };
  /** Changes some parameters; any filter change goes back to page 1. */
  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(latest.current);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in changes)) next.delete('page');
    write(next);
  };
  const list = (key: string) => params.get(key)?.split(',').filter(Boolean) ?? [];
  const setList = (key: string) => (values: string[]) => update({ [key]: values.join(',') || null });
  const oneCountry = list('country').length === 1;
  const [search, setSearch] = useState(params.get('q') ?? '');
  const pushed = useRef(params.get('q') ?? '');
  const pushSearch = useDebouncedCallback((q: string) => {
    pushed.current = q.trim();
    update({ q: q.trim() || null });
  }, 300);
  // Follow the URL when it changes elsewhere (Clear filters, back/forward), never while typing.
  const urlQ = params.get('q') ?? '';
  useEffect(() => {
    if (urlQ !== pushed.current) {
      pushed.current = urlQ;
      setSearch(urlQ);
    }
  }, [urlQ]);
  const sort = params.get('sort') ?? 'name';
  const phone = useMediaQuery('(max-width: 47.99em)');
  const [filtersOpen, { open: openFilters, close: closeFilters }] = useDisclosure();
  const activeFilters = ['country', 'department', 'role', 'level', 'gender', 'status', 'salaryMin', 'salaryMax'].filter((k) => params.get(k)).length;
  const dir = params.get('dir') ?? 'asc';

  const searchField = (
    <TextInput
      label="Search"
      placeholder="Name, email or code"
      maxLength={100}
      value={search}
      onChange={(e) => {
        setSearch(e.currentTarget.value);
        pushSearch(e.currentTarget.value);
      }}
    />
  );
  const filterFields = (
    <>
      <MultiSelect label="Country" data={COUNTRIES.map((c) => ({ value: c, label: COUNTRY_NAMES[c] }))} value={list('country')} onChange={setList('country')} clearable />
      <MultiSelect label="Department" data={[...DEPARTMENTS]} value={list('department')} onChange={setList('department')} clearable searchable />
      <MultiSelect label="Role" data={[...ROLE_NAMES]} value={list('role')} onChange={setList('role')} clearable searchable />
      <MultiSelect label="Level" data={LEVELS.map((l) => ({ value: String(l), label: `L${l}` }))} value={list('level')} onChange={setList('level')} clearable />
      <MultiSelect label="Gender" data={GENDERS.map((g) => ({ value: g, label: label(g) }))} value={list('gender')} onChange={setList('gender')} clearable />
      <MultiSelect
        label="Status"
        data={STATUSES.map((s) => ({ value: s, label: label(s) }))}
        placeholder="All statuses"
        // No status in the address means the default three; emptying the box means everyone (D76).
        value={params.get('status') === 'all' ? [] : params.get('status') ? list('status') : [...DEFAULT_STATUSES]}
        onChange={(values) => update({ status: values.join(',') || 'all' })}
      />
      <Group grow align="flex-start" gap="xs">
        <NumberInput label="Salary from" disabled={!oneCountry} min={1} thousandSeparator="," allowDecimal={false}
          value={params.get('salaryMin') ?? ''} onChange={(v) => update({ salaryMin: v === '' ? null : String(v) })} />
        <NumberInput label="Salary to" disabled={!oneCountry} min={1} thousandSeparator="," allowDecimal={false}
          value={params.get('salaryMax') ?? ''} onChange={(v) => update({ salaryMax: v === '' ? null : String(v) })} />
      </Group>
    </>
  );
  const salaryNote = !oneCountry && <Text size="sm" c="dimmed">{MSG.salaryNeedsOneCountry}</Text>;

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={1} size="h2">Employees</Title>
        <Group gap="xs">
          <Button component="a" href={`/api/employees.csv${exportQuery(params)}`} variant="default" leftSection={<IconDownload size={16} />}>
            Export CSV
          </Button>
          <Button component={Link} to="/employees/new" leftSection={<IconPlus size={16} />}>Add employee</Button>
        </Group>
      </Group>

      {phone ? (
        <>
          <Group align="flex-end" gap="xs" wrap="nowrap">
            <div style={{ flex: 1 }}>{searchField}</div>
            <Button variant="default" onClick={openFilters}>{activeFilters ? `Filters (${activeFilters})` : 'Filters'}</Button>
          </Group>
          {/* LIST-10: on a phone the filters live in a drawer, so results start on the first screen. */}
          <Drawer opened={filtersOpen} onClose={closeFilters} title="Filters" position="bottom" size="85%">
            <Stack gap="sm">
              {filterFields}
              {salaryNote}
              <Button onClick={closeFilters}>Show results</Button>
            </Stack>
          </Drawer>
        </>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="sm">
            {searchField}
            {filterFields}
          </SimpleGrid>
          {salaryNote}
        </>
      )}

      {error && <Alert color="red" role="alert">{error}</Alert>}
      {!data && !error && <Skeleton h={320} aria-label="Loading employees" />}
      {data && data.total === 0 && (
        <Stack align="flex-start" gap="xs" py="xl">
          <Text fw={600}>No employees match these filters.</Text>
          <Text size="sm" c="dimmed">Try a shorter search, fewer filters, or include people who have left.</Text>
          <Button variant="default" onClick={() => write(new URLSearchParams())}>Clear filters</Button>
        </Stack>
      )}
      {data && data.total > 0 && (
        <>
          <EmployeeCards rows={data.rows} />
          <EmployeeTable
            rows={data.rows}
            sort={sort}
            dir={dir}
            canSortSalary={oneCountry}
            onSort={(key) => update({ sort: key, dir: sort === key && dir === 'asc' ? 'desc' : 'asc' })}
          />
          <Group justify="space-between">
            <Text size="sm" c="dimmed">{data.total.toLocaleString('en-US')} employees</Text>
            <Group gap="sm">
              <Select aria-label="Rows per page" w={110} data={['25', '50', '100']} value={String(data.pageSize)} allowDeselect={false}
                onChange={(v) => update({ pageSize: v === '25' ? null : v })} />
              {/* Fewer page buttons on a phone, so they stay on one line. */}
              <Pagination total={Math.max(1, Math.ceil(data.total / data.pageSize))} value={data.page} siblings={phone ? 0 : 1}
                onChange={(p) => update({ page: p === 1 ? null : String(p) })} />
            </Group>
          </Group>
        </>
      )}
    </Stack>
  );
}

/** Same filters as the list, without paging: the export has every matching row (CSV-1). */
function exportQuery(params: URLSearchParams) {
  const q = new URLSearchParams(params);
  q.delete('page');
  q.delete('pageSize');
  // A download link can't send the X-Timezone header (TIME-1).
  q.set('tz', Intl.DateTimeFormat().resolvedOptions().timeZone);
  return `?${q}`;
}

function EmployeeTable(props: { rows: Row[]; sort: string; dir: string; canSortSalary: boolean; onSort: (key: string) => void }) {
  const { rows, sort, dir } = props;
  return (
    <Table.ScrollContainer minWidth={760} visibleFrom="sm">
      <Table striped highlightOnHover verticalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            {COLUMNS.map((c) => {
              const active = sort === c.key;
              const disabled = c.key === 'salary' && !props.canSortSalary;
              return (
                <Table.Th key={c.key} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  <UnstyledButton disabled={disabled} onClick={() => props.onSort(c.key)} fw={600} fz="sm">
                    <Group gap={4} wrap="nowrap">
                      {c.label}
                      {active && (dir === 'asc' ? <IconArrowUp size={14} aria-hidden /> : <IconArrowDown size={14} aria-hidden />)}
                    </Group>
                  </UnstyledButton>
                </Table.Th>
              );
            })}
            <Table.Th>Status</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r) => (
            <Table.Tr key={r.code}>
              <Table.Td>{r.code}</Table.Td>
              <Table.Td><Anchor component={Link} to={`/employees/${r.code}`}>{r.firstName} {r.lastName}</Anchor></Table.Td>
              <Table.Td>{COUNTRY_NAMES[r.country as keyof typeof COUNTRY_NAMES]}</Table.Td>
              <Table.Td>{r.department}</Table.Td>
              <Table.Td>{r.role}</Table.Td>
              <Table.Td>L{r.level}</Table.Td>
              <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatMoney(r.salary, r.currency)}</Table.Td>
              <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatDate(r.hireDate)}</Table.Td>
              <Table.Td><Badge variant="light" color={STATUS_COLOR[r.status]}>{label(r.status)}</Badge></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}


/** LIST-10: on a phone each employee is a card instead of a table row. */
function EmployeeCards({ rows }: { rows: Row[] }) {
  return (
    <Stack component="ul" aria-label="Employees" gap="xs" hiddenFrom="sm" p={0} m={0} style={{ listStyle: 'none' }}>
      {rows.map((r) => (
        <Paper component="li" key={r.code} withBorder p="sm">
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <Stack gap={2}>
              <Anchor component={Link} to={`/employees/${r.code}`} fw={600}>{r.firstName} {r.lastName}</Anchor>
              <Text size="sm">{r.role} · L{r.level}</Text>
              <Text size="sm" c="dimmed">{r.department}, {COUNTRY_NAMES[r.country as keyof typeof COUNTRY_NAMES]}</Text>
            </Stack>
            <Stack gap={4} align="flex-end">
              <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>{formatMoney(r.salary, r.currency)}</Text>
              <Badge variant="light" color={STATUS_COLOR[r.status]}>{label(r.status)}</Badge>
            </Stack>
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}
