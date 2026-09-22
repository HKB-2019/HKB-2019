import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/* SQLite, via Node's built-in driver — no native build, and its serialised
 * writes make overselling during a drop harder rather than easier. The schema
 * is plain SQL so moving to Postgres later is a change of driver, not of
 * design. WAL lets reads continue while a checkout writes. */

export const db = new DatabaseSync(process.env.DATABASE_PATH || join(here, 'masq.db'));

db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'));

export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
