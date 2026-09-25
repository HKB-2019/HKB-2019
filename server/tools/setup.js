/* One command to get the shop running for the first time.
 *
 *   npm run setup
 *
 * Creates .env if it is missing, asks for an admin password, writes the hash
 * and a session secret into .env, and loads the catalogue. Safe to run again:
 * it never overwrites a value that is already set unless you ask it to.
 */
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';
import { hashPassword } from '../lib/auth.js';

const ENV = '.env';
const MIN = 12;

/* ------------------------------------------------------------ prompting */

const rl = createInterface({
  input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY)
});

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

function ask(question, { secret = false } = {}) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const done = (line) => { muted = false; process.stdout.write('\n'); resolve(line ?? ''); };
    muted = secret;
    if (lines.length) done(lines.shift()); else waiting.push(done);
  });
}

/* ----------------------------------------------------------------- .env */

if (!existsSync(ENV)) {
  copyFileSync('.env.example', ENV);
  console.log(`Created ${ENV} from .env.example.`);
}

let env = readFileSync(ENV, 'utf8');

/** Reads a key out of the .env text. Blank counts as unset. */
const get = (key) => (env.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1] ?? '').trim();

/** Writes a key into the .env text, replacing the line if it is already there. */
const set = (key, value) => {
  const line = `${key}=${value}`;
  env = new RegExp(`^${key}=.*$`, 'm').test(env)
    ? env.replace(new RegExp(`^${key}=.*$`, 'm'), line)
    : env.trimEnd() + `\n${line}\n`;
};

console.log('\nMASQ. setup\n');

/* --------------------------------------------------------- the password */

if (get('ADMIN_PASSWORD_HASH')) {
  console.log('Admin password: already set. Delete ADMIN_PASSWORD_HASH from .env to change it.\n');
} else {
  console.log('Pick an admin password. It is never stored — only a scrambled form of it.');
  const password = await ask(`Admin password (at least ${MIN} characters): `, { secret: true });

  if (!password || password.length < MIN) {
    rl.close();
    console.error(`\nThat is shorter than ${MIN} characters. Nothing was changed.`);
    process.exit(1);
  }

  const again = await ask('Type it again: ', { secret: true });
  if (again !== password) {
    rl.close();
    console.error('\nThose did not match. Nothing was changed.');
    process.exit(1);
  }

  set('ADMIN_PASSWORD_HASH', hashPassword(password));
  console.log('Admin password: set.');
}

if (!get('SESSION_SECRET')) {
  set('SESSION_SECRET', randomBytes(48).toString('base64url'));
  console.log('Session secret: generated.');
}

rl.close();
writeFileSync(ENV, env);

/* ------------------------------------------------------------ catalogue */

// Imported here, after .env is written, so the database is whichever one
// .env names: DATABASE_URL if set, otherwise the built-in one in server/data/.
if (get('DATABASE_URL')) process.env.DATABASE_URL ||= get('DATABASE_URL');
const { seed } = await import('../seed.js');
const { one, close } = await import('../db.js');
const existing = (await one('SELECT COUNT(*) AS n FROM products')).n;
if (existing) {
  // Seeding resets every stock count, so never over a catalogue already there.
  console.log(`Catalogue: already loaded (${existing} pieces). Left as it is.`);
} else {
  console.log(`Catalogue: ${await seed()} pieces loaded.`);
}
await close();

process.env.PAYSTACK_SECRET_KEY = get('PAYSTACK_SECRET_KEY');
const { paystackConfigured } = await import('../lib/paystack.js');
const paystack = paystackConfigured();
console.log(`Paystack keys: ${paystack ? 'set.' : 'not set yet — checkout stays switched off until they are.'}`);

console.log(`
Done. Now run:

  npm start

Then open http://localhost:3001 for the shop, or http://localhost:3001/admin
for the back room.
`);
