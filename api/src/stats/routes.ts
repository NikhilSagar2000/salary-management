import { overviewQuerySchema } from '@acme/shared';
import { Router } from 'express';
import type pg from 'pg';
import { queryErrors } from '../http.ts';
import { payOverview } from './overview.ts';

export function statsRoutes({ db }: { db: pg.Pool }) {
  const router = Router();
  router.get('/api/pay-overview', async (req, res) => {
    const parsed = overviewQuerySchema.safeParse(req.query);
    if (!parsed.success) return queryErrors(res, parsed.error.issues);
    res.json(await payOverview(db, parsed.data.country, res.locals.today));
  });
  return router;
}
