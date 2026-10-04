import { CURRENCY, DEPARTMENTS, employeeCreateSchema, type Country } from '@acme/shared';
import { Alert, Button, Group, NumberInput, Paper, Select, SimpleGrid, Stack, Text, TextInput, Title } from '@mantine/core';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../api.ts';
import { issuesToFields, useFormErrors } from '../forms.ts';
import { COUNTRY_OPTIONS, GENDER_OPTIONS, levelChoices, roleChoices } from './employee/choices.ts';

/** EMP-1…4: add an employee. The code is pre-filled with the next free one and can be changed. */
export function AddEmployee() {
  const navigate = useNavigate();
  const form = useFormErrors();
  const [v, setV] = useState({
    code: '', firstName: '', lastName: '', gender: '', workEmail: '', hireDate: '',
    country: '', department: '', role: '', level: '', salary: '' as number | string, managerCode: '',
  });
  const set = (key: keyof typeof v) => (value: string | number | null) => setV((s) => ({ ...s, [key]: value ?? '' }));

  useEffect(() => {
    // Keep anything HR typed before the suggestion arrives.
    api<{ code: string }>('/api/employees/next-code').then(({ code }) => setV((s) => (s.code ? s : { ...s, code })), () => {});
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = {
      code: v.code.trim(), firstName: v.firstName, lastName: v.lastName, gender: v.gender || undefined, workEmail: v.workEmail.trim(),
      hireDate: v.hireDate, country: v.country || undefined, department: v.department || undefined, role: v.role || undefined,
      level: v.level ? Number(v.level) : undefined, salary: v.salary, managerCode: v.managerCode.trim() || null,
    };
    const parsed = employeeCreateSchema.safeParse(body);
    if (!parsed.success) return form.setFields(issuesToFields(parsed.error.issues));
    form.setFields({});
    if (await form.save(() => api('/api/employees', { method: 'POST', body }))) navigate(`/employees/${body.code}`);
  };

  return (
    <Stack gap="md" maw={880}>
      <Title order={1} size="h2">Add employee</Title>
      <Paper withBorder p="md">
        <form ref={form.ref} onSubmit={submit} noValidate>
          <Stack>
            {form.formError && <Alert color="red" role="alert">{form.formError.message}</Alert>}
            {form.fields.form && <Alert color="red" role="alert">{form.fields.form}</Alert>}
            <Title order={2} size="h4">Person</Title>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="First name" value={v.firstName} onChange={(e) => set('firstName')(e.currentTarget.value)} error={form.fields.firstName} />
              <TextInput label="Last name" value={v.lastName} onChange={(e) => set('lastName')(e.currentTarget.value)} error={form.fields.lastName} />
              <Select label="Gender" data={GENDER_OPTIONS} value={v.gender || null} onChange={set('gender')} error={form.fields.gender} allowDeselect={false} />
              <TextInput label="Work email" type="email" value={v.workEmail} onChange={(e) => set('workEmail')(e.currentTarget.value)} error={form.fields.workEmail} />
              <TextInput label="Employee code" description="The next free code; you can change it. It can't change later."
                value={v.code} onChange={(e) => set('code')(e.currentTarget.value)} error={form.fields.code} />
              <TextInput type="date" label="Hire date" description="It can't change later."
                value={v.hireDate} onChange={(e) => set('hireDate')(e.currentTarget.value)} error={form.fields.hireDate} />
            </SimpleGrid>
            <Title order={2} size="h4" mt="sm">Job and pay</Title>
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <Select label="Country" data={COUNTRY_OPTIONS} value={v.country || null} onChange={set('country')} error={form.fields.country} allowDeselect={false} />
              <Select label="Department" data={[...DEPARTMENTS]} value={v.department || null} error={form.fields.department} allowDeselect={false}
                onChange={(d) => setV((s) => ({ ...s, department: d ?? '', role: roleChoices(d ?? '').includes(s.role) ? s.role : '' }))} />
              <Select label="Role" data={roleChoices(v.department)} value={v.role || null} error={form.fields.role} allowDeselect={false} searchable
                onChange={(r) => setV((s) => ({ ...s, role: r ?? '', level: levelChoices(r ?? '').some((l) => l.value === s.level) ? s.level : '' }))} />
              <Select label="Level" data={levelChoices(v.role)} value={v.level || null} onChange={set('level')} error={form.fields.level} allowDeselect={false} />
              <NumberInput label="Salary" description={`Annual base, in ${v.country ? CURRENCY[v.country as Country] : "the country's currency"}`}
                thousandSeparator="," allowDecimal={false} min={1} value={v.salary} onChange={set('salary')} error={form.fields.salary} />
              <TextInput label="Manager code" description="Optional, like E000123" value={v.managerCode}
                onChange={(e) => set('managerCode')(e.currentTarget.value)} error={form.fields.managerCode} />
            </SimpleGrid>
            <Group justify="space-between" mt="sm">
              <Text size="xs" c="dimmed">The hire is saved as the first entry in the history.</Text>
              <Group gap="xs">
                <Button component={Link} to="/employees" variant="default">Cancel</Button>
                <Button type="submit" loading={form.saving}>Add employee</Button>
              </Group>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
