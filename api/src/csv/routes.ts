import express, { Router } from 'express';
import type pg from 'pg';
import { checkImport } from './import.ts';

export function importRoutes({ db }: { db: pg.Pool }) {
  const router = Router();
  const csvBody = express.text({ type: () => true, limit: '5mb' });

  router.post('/api/imports/preview', csvBody, async (req, res) => {
    res.json(await checkImport(db, typeof req.body === 'string' ? req.body : ''));
  });

  return router;
}
