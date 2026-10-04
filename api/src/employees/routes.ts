import { employeeCreateSchema, employeeDetailsSchema, jobChangeSchema, leaveSchema, MSG } from '@acme/shared';
import { Router } from 'express';
import type pg from 'pg';
import { fieldErrors, sendFieldErrors, sendStaleOrMissing } from '../http.ts';
import { createEmployee, duplicateField, nextCode } from './create.ts';
import { addChange, cancelChange } from './changes.ts';
import { updateDetails } from './details.ts';
import { markLeaving, undoLeaving } from './leave.ts';

export function employeeRoutes({ db }: { db: pg.Pool }) {
  const router = Router();

  router.get('/api/employees/next-code', async (_req, res) => {
    res.json({ code: await nextCode(db) });
  });

  router.post('/api/employees', async (req, res) => {
    const parsed = employeeCreateSchema.safeParse(req.body);
    if (!parsed.success) return fieldErrors(res, parsed.error.issues);
    try {
      res.status(201).json(await createEmployee(db, parsed.data));
    } catch (err) {
      const fields = duplicateField(err, parsed.data);
      if (!fields) throw err;
      sendFieldErrors(res, fields);
    }
  });

  router.patch('/api/employees/:code', async (req, res) => {
    if (req.body && ('code' in req.body || 'hireDate' in req.body)) {
      res.status(400).json({ error: MSG.identityFixed });
      return;
    }
    const parsed = employeeDetailsSchema.safeParse(req.body);
    if (!parsed.success) return fieldErrors(res, parsed.error.issues);
    try {
      const version = await updateDetails(db, req.params.code, parsed.data);
      if (version === null) return sendStaleOrMissing(res, db, req.params.code);
      res.json({ code: req.params.code, version });
    } catch (err) {
      const fields = duplicateField(err, { code: req.params.code });
      if (!fields) throw err;
      sendFieldErrors(res, fields);
    }
  });

  router.post('/api/employees/:code/changes', async (req, res) => {
    const parsed = jobChangeSchema.safeParse(req.body);
    if (!parsed.success) return fieldErrors(res, parsed.error.issues);
    const version = await addChange(db, req.params.code, parsed.data);
    if (version === null) return sendStaleOrMissing(res, db, req.params.code);
    res.status(201).json({ code: req.params.code, version });
  });

  router.post('/api/employees/:code/changes/:id/cancel', async (req, res) => {
    const version = Number(req.body?.version);
    const changeId = Number(req.params.id);
    if (!Number.isInteger(version) || !Number.isInteger(changeId)) return sendFieldErrors(res, { form: MSG.noChange });
    const next = await cancelChange(db, req.params.code, changeId, version, res.locals.today);
    if (next === null) return sendStaleOrMissing(res, db, req.params.code);
    res.json({ code: req.params.code, version: next });
  });

  router.post('/api/employees/:code/leave', async (req, res) => {
    const parsed = leaveSchema.safeParse(req.body);
    if (!parsed.success) return fieldErrors(res, parsed.error.issues);
    const version = await markLeaving(db, req.params.code, parsed.data);
    if (version === null) return sendStaleOrMissing(res, db, req.params.code);
    res.json({ code: req.params.code, version });
  });

  router.post('/api/employees/:code/undo-leave', async (req, res) => {
    const version = Number(req.body?.version);
    if (!Number.isInteger(version)) return sendFieldErrors(res, { version: MSG.stale });
    const next = await undoLeaving(db, req.params.code, version);
    if (next === null) return sendStaleOrMissing(res, db, req.params.code);
    res.json({ code: req.params.code, version: next });
  });

  return router;
}
