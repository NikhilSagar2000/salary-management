import { employeeCreateSchema } from '@acme/shared';
import { Router } from 'express';
import type pg from 'pg';
import { fieldErrors } from '../http.ts';
import { createEmployee, duplicateField, nextCode } from './create.ts';

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
      res.status(400).json({ error: 'Some fields need fixing.', fields });
    }
  });

  return router;
}
