import { CURRENCY, DEPARTMENTS, jobChangeSchema, type Country } from '@acme/shared';
import { Alert, Button, Group, NumberInput, Select, SimpleGrid, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { api } from '../../api.ts';
import { issuesToFields, useFormErrors } from '../../forms.ts';
import { COUNTRY_OPTIONS, levelChoices, roleChoices } from './choices.ts';
import { FormAlert } from './DetailsForm.tsx';
import type { Detail } from './types.ts';

/** EMP-7…10: a dated change to job, pay or manager. Starts from the current job; only what changed is sent. */
export function JobChangeForm({ detail, onSaved, onReload }: { detail: Detail; onSaved: () => void; onReload: () => void }) {
  const now = detail.current;
  const [v, setV] = useState({
    effectiveDate: '', country: now.country, department: now.department, role: now.role, level: String(now.level),
    salary: now.salary as number | string, managerCode: now.manager?.code ?? '', note: '',
  });
  const form = useFormErrors();
  const set = (key: keyof typeof v) => (value: string | number | null) => {
    form.clearField(key);
    setV((s) => ({ ...s, [key]: value ?? '' }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = { version: detail.version, effectiveDate: v.effectiveDate };
    if (v.country !== now.country) body.country = v.country;
    if (v.department !== now.department) body.department = v.department;
    if (v.role !== now.role) body.role = v.role;
    if (Number(v.level) !== now.level) body.level = Number(v.level);
    if (v.salary !== now.salary) body.salary = v.salary === '' ? '' : v.salary;
    if (v.managerCode.trim() !== (now.manager?.code ?? '')) body.managerCode = v.managerCode.trim() || null;
    if (v.note.trim()) body.note = v.note.trim();
    const parsed = jobChangeSchema.safeParse(body);
    if (!parsed.success) return form.setFields(issuesToFields(parsed.error.issues));
    form.setFields({});
    if (await form.save(() => api(`/api/employees/${detail.code}/changes`, { method: 'POST', body }))) onSaved();
  };

  return (
    <form ref={form.ref} onSubmit={submit} noValidate>
      <Stack>
        <FormAlert error={form.formError} onReload={() => { form.clearFormError(); onReload(); }} />
        {form.fields.form && <Alert color="red" role="alert">{form.fields.form}</Alert>}
        <TextInput type="date" label="Effective date" description="Today, a past date, or a future date for a scheduled change"
          value={v.effectiveDate} onChange={(e) => set('effectiveDate')(e.currentTarget.value)} error={form.fields.effectiveDate} />
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Select label="Country" data={COUNTRY_OPTIONS} value={v.country}
            onChange={set('country')} error={form.fields.country} allowDeselect={false} />
          <Select label="Department" data={[...DEPARTMENTS]} value={v.department} allowDeselect={false} error={form.fields.department}
            onChange={(d) => {
              form.clearField('department');
              setV((s) => ({ ...s, department: d ?? s.department, role: '' }));
            }} />
          <Select label="Role" data={roleChoices(v.department)} value={v.role || null} error={form.fields.role} allowDeselect={false}
            onChange={(r) => {
              form.clearField('role');
              setV((s) => ({ ...s, role: r ?? '', level: levelChoices(r ?? '').some((l) => l.value === s.level) ? s.level : '' }));
            }} />
          <Select label="Level" data={levelChoices(v.role)} value={v.level || null}
            onChange={set('level')} error={form.fields.level} allowDeselect={false} />
          <NumberInput label="Salary" description={`Annual base, in ${CURRENCY[v.country as Country]}`} thousandSeparator="," allowDecimal={false}
            min={1} value={v.salary} onChange={set('salary')} error={form.fields.salary} />
          <TextInput label="Manager code" description="Empty for no manager" value={v.managerCode}
            onChange={(e) => set('managerCode')(e.currentTarget.value)} error={form.fields.managerCode} />
        </SimpleGrid>
        <Textarea label="Note" rows={2} maxLength={500} value={v.note} onChange={(e) => set('note')(e.currentTarget.value)} error={form.fields.note} />
        <Group justify="space-between">
          <Text size="xs" c="dimmed">History entries can't be edited later; a scheduled change can be cancelled.</Text>
          <Button type="submit" loading={form.saving}>Save change</Button>
        </Group>
      </Stack>
    </form>
  );
}
