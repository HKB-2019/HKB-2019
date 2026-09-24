/* Generates the values for ADMIN_PASSWORD_HASH and SESSION_SECRET.
 * The password itself is never stored anywhere.
 *
 *   npm run admin:password
 *
 * It asks for the password rather than taking it as an argument on purpose: an
 * argument is written to your shell history and is visible in `ps` to every
 * other user on the machine while the command runs.
 */
import { hashPassword } from '../lib/auth.js';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';

const MIN = 12;
const tty = Boolean(process.stdin.isTTY);

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: tty });

/* Lines are collected as they arrive rather than one question at a time.
 * Piped input delivers every line in a single chunk, and a reader that only
 * listens while a question is open would throw the rest away. */
const lines = [];
const waiting = [];
rl.on('line', (line) => {
  const next = waiting.shift();
  if (next) next(line); else lines.push(line);
});
rl.on('close', () => { while (waiting.length) waiting.shift()(null); });

let muted = false;
const write = rl._writeToOutput?.bind(rl);
if (write) rl._writeToOutput = (s) => { if (!muted) write(s); };

const ask = (question) => new Promise((resolve) => {
  process.stdout.write(question);
  const done = (line) => { muted = false; process.stdout.write('\n'); resolve(line); };
  muted = true;
  if (lines.length) done(lines.shift()); else waiting.push(done);
});

const fail = (message) => { rl.close(); console.error(message); process.exit(1); };

const password = await ask(`Admin password (at least ${MIN} characters): `);
if (!password || password.length < MIN) fail(`That is shorter than ${MIN} characters. Nothing was generated.`);

const again = await ask('Type it again: ');
if (again !== password) fail('Those did not match. Nothing was generated.');

rl.close();

console.log('\nAdd these two lines to your .env — and never commit that file:\n');
console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`);
console.log(`SESSION_SECRET=${randomBytes(48).toString('base64url')}\n`);
