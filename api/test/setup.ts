// Runs before every test file.
import { assertFakeModel } from './guard.ts';

assertFakeModel(process.env);
