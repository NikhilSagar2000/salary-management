import { formatDate, formatMoney, MSG, type Currency } from '@acme/shared';
import { Alert, Anchor, Button, Code, Group, Input, Paper, Stack, Table, Text, Title } from '@mantine/core';
import { useId, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import { api, ApiError } from '../api.ts';

type Problem = { line: number; column: string; message: string };
type Row = {
  line: number; code: string; firstName: string; lastName: string; workEmail: string; currency: Currency;
  department: string; role: string; level: number; salary: number; hireDate: string; managerCode: string | null;
};
type Preview = { file: string; text: string; rows: Row[]; problems: Problem[] };

const MAX_BYTES = 5 * 1024 * 1024;
const PREVIEW_LIMIT = 100;
const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** CSV-3…8: add new employees from a CSV file, all or nothing, after a preview that saves nothing. */
export function Import() {
  const id = useId();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = ''; // choosing the same file again re-checks it
    setPreview(null);
    setError(null);
    setImported(null);
    if (!file) return;
    if (file.size > MAX_BYTES) return setError(MSG.importTooLarge);
    setBusy(true);
    try {
      const text = await file.text();
      const checked = await api<Pick<Preview, 'rows' | 'problems'>>('/api/imports/preview', { method: 'POST', csv: text });
      setPreview({ file: file.name, text, ...checked });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const { imported: n } = await api<{ imported: number }>('/api/imports', { method: 'POST', csv: preview.text });
      setPreview(null);
      setImported(n);
    } catch (err) {
      setError((err as Error).message);
      // CSV-7: a problem found while importing (such as a code taken since the preview) saves nothing and is listed.
      const problems = err instanceof ApiError ? (err.data as { problems?: Problem[] } | null)?.problems : undefined;
      if (problems) setPreview({ ...preview, rows: [], problems });
    } finally {
      setBusy(false);
    }
  };

  const ready = preview && preview.problems.length === 0 && preview.rows.length > 0;
  return (
    <Stack gap="md" maw={1100}>
      <Title order={1} size="h2">Import employees</Title>
      <Text size="sm" maw={720}>
        Adds new employees from a CSV file. Every row must be valid, or nothing is imported. Required columns:{' '}
        <Code>code, first_name, last_name, gender, work_email, country, department, role, level, salary, hire_date</Code>.
        Optional: <Code>manager_code</Code> and <Code>currency</Code>. A file exported from the employee list has the right columns.
      </Text>
      <Input.Wrapper id={id} label="CSV file" description="UTF-8, comma or semicolon separated, up to 5 MB and 10,000 rows" maw={480}>
        <input id={id} aria-describedby={`${id}-description`} type="file" accept=".csv,text/csv" onChange={choose} disabled={busy} className="file-input" />
      </Input.Wrapper>

      {error && <Alert color="red" role="alert">{error}</Alert>}
      {imported !== null && (
        <Alert color="teal" role="status">
          <Stack gap={4} align="flex-start">
            Imported {plural(imported, 'employee', 'employees')}.
            <Anchor component={Link} to="/employees?sort=code&dir=desc">See them in the employee list</Anchor>
          </Stack>
        </Alert>
      )}

      {preview && (
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <Stack gap={0}>
              <Text size="xs" c="dimmed">Checked {preview.file}</Text>
              <Text fw={600} aria-live="polite">
                {plural(preview.rows.length, 'row', 'rows')} ready to import,{' '}
                {preview.problems.length ? `${plural(preview.problems.length, 'problem', 'problems')} to fix first. Nothing has been saved.` : 'no problems.'}
              </Text>
            </Stack>
            <Button onClick={runImport} disabled={!ready} loading={busy}>
              Import {plural(preview.rows.length, 'employee', 'employees')}
            </Button>
          </Group>
          {preview.problems.length > 0 && <Problems problems={preview.problems} />}
          {preview.rows.length > 0 && <Rows rows={preview.rows} />}
        </Stack>
      )}
    </Stack>
  );
}

function Problems({ problems }: { problems: Problem[] }) {
  return (
    <Paper withBorder>
      <Table aria-label="Problems" striped>
        <Table.Thead>
          <Table.Tr><Table.Th w={110}>Row</Table.Th><Table.Th w={140}>Column</Table.Th><Table.Th>Problem</Table.Th></Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {problems.map((p, i) => (
            <Table.Tr key={i}>
              <Table.Td>{p.line ? `Row ${p.line}` : 'Whole file'}</Table.Td>
              <Table.Td>{p.column}</Table.Td>
              <Table.Td>{p.message}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

function Rows({ rows }: { rows: Row[] }) {
  return (
    <Stack gap="xs">
      <Title order={2} size="h4">Rows to import</Title>
      {rows.length > PREVIEW_LIMIT && <Text size="sm" c="dimmed">Showing the first {PREVIEW_LIMIT} of {plural(rows.length, 'row', 'rows')}.</Text>}
      <Paper withBorder>
        <Table.ScrollContainer minWidth={760}>
          <Table aria-label="Rows to import" striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Row</Table.Th><Table.Th>Employee</Table.Th><Table.Th>Job</Table.Th><Table.Th>Salary</Table.Th>
                <Table.Th>Hired</Table.Th><Table.Th>Manager</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.slice(0, PREVIEW_LIMIT).map((r) => (
                <Table.Tr key={r.line}>
                  <Table.Td>Row {r.line}</Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={600}>{r.firstName} {r.lastName}</Text>
                    <Text size="xs" c="dimmed">{r.code} · {r.workEmail}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{r.role}, L{r.level}</Text>
                    <Text size="xs" c="dimmed">{r.department}</Text>
                  </Table.Td>
                  <Table.Td>{formatMoney(r.salary, r.currency)}</Table.Td>
                  <Table.Td>{formatDate(r.hireDate)}</Table.Td>
                  <Table.Td>{r.managerCode ?? ''}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
    </Stack>
  );
}
