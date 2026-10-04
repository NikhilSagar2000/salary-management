import { leaveSchema } from '@acme/shared';
import { Button, Group, Stack, Textarea, TextInput } from '@mantine/core';
import { useState, type FormEvent } from 'react';
import { api } from '../../api.ts';
import { issuesToFields, useFormErrors } from '../../forms.ts';
import { FormAlert } from './DetailsForm.tsx';
import type { Detail } from './types.ts';

/** LEAVE-1: a leave date (today, past, or a future last day) and an optional reason. */
export function LeaveForm({ detail, onSaved, onReload }: { detail: Detail; onSaved: () => void; onReload: () => void }) {
  const [leaveDate, setLeaveDate] = useState('');
  const [reason, setReason] = useState('');
  const form = useFormErrors();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = { version: detail.version, leaveDate, ...(reason.trim() ? { reason: reason.trim() } : {}) };
    const parsed = leaveSchema.safeParse(body);
    if (!parsed.success) return form.setFields(issuesToFields(parsed.error.issues));
    form.setFields({});
    if (await form.save(() => api(`/api/employees/${detail.code}/leave`, { method: 'POST', body }))) onSaved();
  };

  return (
    <form ref={form.ref} onSubmit={submit} noValidate>
      <Stack>
        <FormAlert error={form.formError} onReload={() => { form.clearFormError(); onReload(); }} />
        <TextInput type="date" label="Leave date" description="Their last day; a future date while they work their notice"
          value={leaveDate} onChange={(e) => {
            form.clearField('leaveDate');
            setLeaveDate(e.currentTarget.value);
          }} error={form.fields.leaveDate} />
        <Textarea label="Reason (optional)" rows={2} maxLength={500} value={reason} onChange={(e) => {
          form.clearField('reason');
          setReason(e.currentTarget.value);
        }} error={form.fields.reason} />
        <Group justify="flex-end">
          <Button type="submit" loading={form.saving}>Save</Button>
        </Group>
      </Stack>
    </form>
  );
}
