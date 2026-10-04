import { useEffect, useRef, useState } from 'react';
import { ApiError } from './api.ts';

/** field → first message, from schema issues (paths like ["workEmail"]). */
export function issuesToFields(issues: readonly { path: readonly PropertyKey[]; message: string }[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) fields[String(issue.path[0] ?? 'form')] ??= issue.message;
  return fields;
}

/**
 * Form state for a modal form: field errors (client or server), a form-level error, saving flag, and focus on the
 * first invalid field whenever errors appear (EMP-3, A11Y-3). `ref` goes on the <form>.
 */
export function useFormErrors() {
  const ref = useRef<HTMLFormElement>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<{ message: string; stale: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (Object.keys(fields).length) ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [fields]);

  /** Runs a save once at a time; turns failures into field or form messages. Returns true when it saved. */
  const save = async (fn: () => Promise<unknown>) => {
    if (saving) return false;
    setSaving(true);
    setFormError(null);
    try {
      await fn();
      return true;
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).filter((f) => f !== 'form').length) setFields(err.fields);
      else setFormError({ message: err instanceof ApiError ? (err.fields.form ?? err.message) : String(err), stale: err instanceof ApiError && err.status === 409 });
      return false;
    } finally {
      setSaving(false);
    }
  };
  return { ref, fields, setFields, formError, clearFormError: () => setFormError(null), saving, save };
}
