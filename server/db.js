import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/* Postgres, from one of two places:
 *
 *   DATABASE_URL set   → a real Postgres server (Neon, Supabase, anything),
 *                        through `pg`. This is production.
 *   DATABASE_URL unset → PGlite, a complete Postgres compiled to WebAssembly,
 *                        running inside this process and keeping its files in
 *                        server/data/. Nothing to install; `npm start` works.
 *
 * Same SQL either way, so what passes locally is what runs in production.
 *
 * Why not a SQLite file any more: free hosts wipe the app's disk on every
 * restart, and every order would go with it. The database has to live
 * somewhere that outlasts the app.
 *
 * COUNT and SUM return Postgres int8, which both drivers would otherwise hand
 * back as a string ("2", not 2). They are parsed to Number here: safe, since
 * no count or kobo total in this shop comes near 2^53. */

const INT8 = 20;
const toNumber = (v) => (v === null ? null : Number(v));

async function connect() {
  const url = process.env.DATABASE_URL;

  if (url) {
    const pg = (await import('pg')).default;
    pg.types.setTypeParser(INT8, toNumber);
    const pool = new pg.Pool({ connectionString: url, max: Number(process.env.DATABASE_POOL || 5) });
    pool.on('error', (err) => console.error('[db] idle client error:', err.message));

    return {
      kind: 'postgres',
      exec: (sql) => pool.query(sql),
      query: (sql, params) => pool.query(sql, params),
      async transaction(fn) {
        // A transaction must stay on one connection; a pool would otherwise
        // hand each statement to whichever client is free.
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await fn({ query: (sql, params) => client.query(sql, params) });
          await client.query('COMMIT');
          return result;
        } catch (err) {
          await client.query('ROLLBACK').catch(() => {});
          throw err;
        } finally {
          client.release();
        }
      },
      close: () => pool.end()
    };
  }

  // On a host, the built-in database is the wrong choice twice over: its files
  // sit on a disk that free hosts wipe on every restart, and it needs about
  // 580 MB of memory against the 512 MB a free plan gives. Better to stop
  // here with a reason than to crash for lack of memory, or run and lose orders.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'DATABASE_URL is not set. In production the shop needs a hosted Postgres ' +
      '(see DEPLOY.md, step 1): the built-in database would be wiped on every ' +
      'restart and needs more memory than a free plan has.');
  }

  const { PGlite } = await import('@electric-sql/pglite');
  const dir = process.env.PGLITE_DIR || join(here, 'data');
  const lite = await PGlite.create(dir, { parsers: { [INT8]: toNumber } });

  return {
    kind: 'pglite',
    exec: (sql) => lite.exec(sql),
    query: (sql, params) => lite.query(sql, params),
    // PGlite runs one transaction at a time, so these are serialised for free.
    transaction: (fn) => lite.transaction((tx) => fn({ query: (sql, params) => tx.query(sql, params) })),
    close: () => lite.close()
  };
}

async function init() {
  const conn = await connect();
  await conn.exec(readFileSync(join(here, 'schema.sql'), 'utf8'));
  return conn;
}

/** Resolves once the schema exists. Every query below waits on it. */
export const ready = init();

/** All rows. */
export async function query(sql, params = []) {
  return (await (await ready).query(sql, params)).rows;
}

/** The first row, or undefined. */
export async function one(sql, params = []) {
  return (await query(sql, params))[0];
}

/**
 * Run `fn` inside a transaction. It receives `tx` with its own `query` and
 * `one`, which must be used instead of the module-level ones — those run
 * outside the transaction and would not see its uncommitted writes.
 */
export async function transaction(fn) {
  const conn = await ready;
  return conn.transaction((raw) => fn({
    query: async (sql, params = []) => (await raw.query(sql, params)).rows,
    one: async (sql, params = []) => (await raw.query(sql, params)).rows[0]
  }));
}

export async function close() {
  await (await ready).close();
}

export const driver = async () => (await ready).kind;
