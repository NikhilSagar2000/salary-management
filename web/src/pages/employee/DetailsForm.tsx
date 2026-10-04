import { employeeDetailsSchema, GENDERS } from '@acme/shared';
import { Alert, Button, Group, Select, Stack, TextInput } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { api } from '../../api.ts';
import { issuesToFields, useFormErrors } from '../../forms.ts';
import type { Detail } from './types.ts';

/** EMP-6: name, gender and work email are edited in place. */
export function DetailsForm({ detail, onSaved, onReload }: { detail: Detail; onSaved: () => void; onReload: () => void }) {
  const [values, setValues] = useState({
    firstName: detail.firstName, lastName: detail.lastName, gender: detail.gender, workEmail: detail.workEmail,
  });
  const form = useFormErrors();
  const set = (key: keyof typeof values) => (value: string) => setValues((v) => ({ ...v, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = { version: detail.version, ...values };
    const parsed = employeeDetailsSchema.safeParse(body);
    if (!parsed.success) return form.setFields(issuesToFields(parsed.error.issues));
    form.setFields({});
    if (await form.save(() => api(`/api/employees/${detail.code}`, { method: 'PATCH', body }))) onSaved();
  };

  return (
    <form ref={form.ref} onSubmit={submit} noValidate>
      <Stack>
        <FormAlert error={form.formError} onReload={() => { form.clearFormError(); onReload(); }} />
        <TextInput label="First name" value={values.firstName} onChange={(e) => set('firstName')(e.currentTarget.value)} error={form.fields.firstName} />
        <TextInput label="Last name" value={values.lastName} onChange={(e) => set('lastName')(e.currentTarget.value)} error={form.fields.lastName} />
        <Select label="Gender" data={GENDERS.map((g) => ({ value: g, label: g === 'non_binary' ? 'Non-binary' : g[0]!.toUpperCase() + g.slice(1) }))}
          value={values.gender} onChange={(v) => set('gender')(v ?? '')} error={form.fields.gender} allowDeselect={false} />
        <TextInput label="Work email" type="email" value={values.workEmail} onChange={(e) => set('workEmail')(e.currentTarget.value)} error={form.fields.workEmail} />
        <Group justify="flex-end">
          <Button type="submit" loading={form.saving}>Save</Button>
        </Group>
      </Stack>
    </form>
  );
}

/** A form-level problem; for an out-of-date page (409) it offers Reload and keeps what was typed (EMP-13). */
export function FormAlert({ error, onReload }: { error: { message: string; stale: boolean } | null; onReload: () => void }) {
  if (!error) return null;
  return (
    <Alert color="red" role="alert">
      <Stack gap="xs" align="flex-start">
        {error.message}
        {error.stale && <Button size="xs" variant="default" onClick={onReload}>Reload</Button>}
      </Stack>
    </Alert>
  );
}
