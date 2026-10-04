import { employeeCreateSchema, employeeDetailsSchema, MSG } from '@acme/shared';
import { Router } from 'express';
import type pg from 'pg';
import { fieldErrors, sendFieldErrors, sendStaleOrMissing } from '../http.ts';
import { createEmployee, duplicateField, nextCode } from './create.ts';
import { updateDetails } from './details.ts';

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

  return router;
}
