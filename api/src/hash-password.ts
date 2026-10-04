// Prints the APP_PASSWORD_HASH value for a password read from stdin:
//   npm run hash-password   (then type the password and press Enter)
import { createInterface } from 'node:readline/promises';
import { hashPassword } from './auth/password.ts';

const rl = createInterface({ input: process.stdin });
const [password] = await rl[Symbol.asyncIterator]().next().then((r) => [r.value as string | undefined]);
rl.close();
if (!password) {
  console.error('Type the password, then press Enter.');
  process.exit(1);
}
console.log(await hashPassword(password));
