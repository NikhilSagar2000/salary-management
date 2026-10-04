import { employeeCreateSchema, employeeDetailsSchema, jobChangeSchema, leaveSchema, listQuerySchema, MSG } from '@acme/shared';
import { Router, type RequestHandler } from 'express';
import type pg from 'pg';
import type { Clock } from '../clock.ts';
import { fieldErrors, sendFieldErrors, sendStaleOrMissing } from '../http.ts';
import { createEmployee, duplicateField, nextCode } from './create.ts';
import { addChange, cancelChange } from './changes.ts';
import { employeeDetail } from './detail.ts';
import { updateDetails } from './details.ts';
import { markLeaving, undoLeaving } from './leave.ts';
import { exportCsv } from '../csv/export.ts';
import { listEmployees } from './list.ts';

export function employeeRoutes({ db, clock }: { db: pg.Pool; clock: Clock }) {
  const router = Router();

  /** LEAVE-3: once someone has left (leave date on or before today), only "undo leaving" may change them. */
  const refuseIfLeft: RequestHandler<{ code: string; id?: string }> = async (req, res, next) => {
    const { rows } = await db.query('SELECT leave_date FROM employees WHERE code = $1', [req.params.code]);
    const leave = rows[0]?.leave_date;
    if (leave && leave <= res.locals.today) {
      res.status(409).json({ error: MSG.hasLeft });
      return;
    }
    next();
  };

  router.get('/api/employees', async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) return fieldErrors(res, parsed.error.issues);
    res.json(await listEmployees(db, parsed.data, res.locals.today));
  });

  router.get('/api/employees.csv', async (req, res) => {
    const parsed = listQuerySchema.safeParse({ ...req.query, page: undefined, pageSize: undefined });
    if (!parsed.success) return fieldErrors(res, parsed.error.issues);
    res
      .type('text/csv; charset=utf-8')
      .attachment(`employees-${res.locals.today}.csv`)
      .send(await exportCsv(db, parsed.data, res.locals.today));
  });

  router.get('/api/employees/next-code', async (_req, res) => {
    res.json({ code: await nextCode(db) });
  });

  router.get('/api/employees/:code', async (req, res) => {
    const detail = await employeeDetail(db, req.params.code, res.locals.today, res.locals.timezone);
    if (!detail) {
      res.status(404).json({ error: MSG.noEmployee(req.params.code) });
      return;
    }
    res.json(detail);
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

  router.patch('/api/employees/:code', refuseIfLeft, async (req, res) => {
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

  router.post('/api/employees/:code/changes', refuseIfLeft, async (req, res) => {
    const parsed = jobChangeSchema.safeParse(req.body);
    if (!parsed.success) return fieldErrors(res, parsed.error.issues);
    const version = await addChange(db, req.params.code, parsed.data);
    if (version === null) return sendStaleOrMissing(res, db, req.params.code);
    res.status(201).json({ code: req.params.code, version });
  });

  router.post('/api/employees/:code/changes/:id/cancel', refuseIfLeft, async (req, res) => {
    const version = Number(req.body?.version);
    const changeId = Number(req.params.id);
    if (!Number.isInteger(version) || !Number.isInteger(changeId)) return sendFieldErrors(res, { form: MSG.noChange });
    const next = await cancelChange(db, req.params.code, changeId, version, res.locals.today, clock.now());
    if (next === null) return sendStaleOrMissing(res, db, req.params.code);
    res.json({ code: req.params.code, version: next });
  });

  router.post('/api/employees/:code/leave', refuseIfLeft, async (req, res) => {
    const parsed = leaveSchema.safeParse(req.body);
    if (!parsed.success) return fieldErrors(res, parsed.error.issues);
    const version = await markLeaving(db, req.params.code, parsed.data);
    if (version === null) return sendStaleOrMissing(res, db, req.params.code);
    res.json({ code: req.params.code, version });
  });

  router.post('/api/employees/:code/undo-leave', async (req, res) => {
    const version = Number(req.body?.version);
    if (!Number.isInteger(version)) return sendFieldErrors(res, { version: MSG.stale });
    const next = await undoLeaving(db, req.params.code, version, clock.now());
    if (next === null) return sendStaleOrMissing(res, db, req.params.code);
    res.json({ code: req.params.code, version: next });
  });

  return router;
}
