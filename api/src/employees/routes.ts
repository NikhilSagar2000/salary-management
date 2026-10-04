import { employeeCreateSchema } from '@acme/shared';
import { Router } from 'express';
import type pg from 'pg';
import { fieldErrors } from '../http.ts';
import { createEmployee, nextCode } from './create.ts';

export function employeeRoutes({ db }: { db: pg.Pool }) {
  const router = Router();

  router.get('/api/employees/next-code', async (_req, res) => {
    res.json({ code: await nextCode(db) });
  });

  router.post('/api/employees', async (req, res) => {
    const parsed = employeeCreateSchema.safeParse(req.body);
    if (!parsed.success) return fieldErrors(res, parsed.error.issues);
    res.status(201).json(await createEmployee(db, parsed.data));
  });

  return router;
}
