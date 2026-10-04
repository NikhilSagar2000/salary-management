import express from 'express';
import type pg from 'pg';
import type { Clock } from './clock.ts';

export function createApp(_deps: { db: pg.Pool; clock: Clock }) {
  throw new Error('not implemented');
  return express();
}
