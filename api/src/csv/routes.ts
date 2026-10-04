import express, { Router } from 'express';
import type pg from 'pg';
import { MSG } from '@acme/shared';
import { checkImport, runImport } from './import.ts';

export function importRoutes({ db }: { db: pg.Pool }) {
  const router = Router();
  const csvBody = express.text({ type: () => true, limit: '5mb' });

  router.post('/api/imports/preview', csvBody, async (req, res) => {
    res.json(await checkImport(db, typeof req.body === 'string' ? req.body : ''));
  });

  router.post('/api/imports', csvBody, async (req, res) => {
    const result = await runImport(db, typeof req.body === 'string' ? req.body : '');
    if ('problems' in result) {
      res.status(400).json({ error: MSG.importNothingSaved, problems: result.problems });
      return;
    }
    res.status(201).json(result);
  });

  return router;
}
