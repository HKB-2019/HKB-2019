import { Router } from 'express';
import { one, query, transaction } from '../db.js';
import { requireAdmin } from '../lib/auth.js';
import { photoUrls } from '../lib/catalogue.js';
import { bothSizes, uploadBody } from './admin-products.js';
import { TOPIC_KEYS, STARTER_STORIES, readMinutes } from '../../src/data/journal.js';

/* The Journal: /api/journal for the shop, /api/admin/journal for the owner.
 *
 * The stories in src/data/journal.js are put in once, the first time the
 * Journal is asked for (marked in settings, so a story the owner deletes
 * stays deleted). After that the database is the Journal. */

export const journalRouter = Router();
export const adminJournalRouter = Router();
export const journalUploadRouter = Router();

const fail = (status, message, field) => Object.assign(new Error(message), { status, field });

export async function ensureStarterStories() {
  const first = await one(`INSERT INTO settings (key, value) VALUES ('journal_seeded', 'yes')
                           ON CONFLICT (key) DO NOTHING RETURNING key`);
  if (!first) return;
  for (const s of STARTER_STORIES) {
    await query(`INSERT INTO journal_stories (slug, topic, title, dek, body, quote, img, featured, pick, published_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (slug) DO NOTHING`,
      [s.slug, s.topic, s.title, s.dek, s.body, s.quote ?? '', s.img ?? '', Boolean(s.featured), Boolean(s.pick),
        `${s.date}T09:00:00+01:00`]);
  }
}

/** A story as the shop sees it; `full` adds the text. */
function shape(r, full = false) {
  const { img, img2x } = photoUrls(r);
  return {
    slug: r.slug, topic: r.topic, title: r.title, dek: r.dek, author: r.author,
    img: img || null, img2x: img2x || null, publishedAt: r.published_at,
    readMinutes: readMinutes(r.body), featured: r.featured, pick: r.pick,
    ...(full ? { body: r.body, quote: r.quote } : {})
  };
}

const LIVE = 'hidden = FALSE AND published_at <= now()';

/* ------------------------------------------------------------- the shop */

journalRouter.get('/journal', async (_req, res) => {
  await ensureStarterStories();
  const rows = await query(`SELECT * FROM journal_stories WHERE ${LIVE} ORDER BY published_at DESC, slug LIMIT 300`);
  res.set('Cache-Control', 'public, max-age=60');
  res.json(rows.map(r => shape(r)));
});

journalRouter.get('/journal/:slug', async (req, res) => {
  await ensureStarterStories();
  const r = await one(`SELECT * FROM journal_stories WHERE slug = $1 AND ${LIVE}`, [req.params.slug]);
  if (!r) return res.status(404).json({ error: 'That story isn’t here. It may have moved.' });
  // Three more from the same topic, then from anywhere, newest first.
  const related = await query(`SELECT * FROM journal_stories WHERE ${LIVE} AND slug <> $1
                                ORDER BY (topic = $2) DESC, published_at DESC LIMIT 3`, [r.slug, r.topic]);
  res.set('Cache-Control', 'public, max-age=60');
  res.json({ ...shape(r, true), related: related.map(x => shape(x)) });
});

/* ------------------------------------------------------------ the admin */

adminJournalRouter.use('/admin/journal', requireAdmin);

const text = (v, { label, field, min = 0, max }) => {
  const s = String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (s.length < min) throw fail(400, min > 1 ? `${label}: write at least ${min} characters.` : `${label} is missing.`, field);
  if (s.length > max) throw fail(400, `${label}: keep it under ${max.toLocaleString('en-GB')} characters.`, field);
  return s;
};

function storyBody(b = {}) {
  const topic = String(b.topic ?? '');
  if (!TOPIC_KEYS.includes(topic)) throw fail(400, 'Choose a topic.', 'topic');
  let published = new Date();
  if (b.publishedAt) {
    published = new Date(b.publishedAt);
    if (Number.isNaN(published.getTime())) throw fail(400, 'That publish date is not a real date.', 'publishedAt');
  }
  return {
    topic,
    title: text(b.title, { label: 'Title', field: 'title', min: 3, max: 120 }).replace(/\s+/g, ' '),
    dek: text(b.dek, { label: 'Summary', field: 'dek', max: 300 }).replace(/\s+/g, ' '),
    body: text(b.body, { label: 'Story', field: 'body', min: 20, max: 30_000 }),
    quote: text(b.quote, { label: 'Pull quote', field: 'quote', max: 240 }).replace(/\s+/g, ' '),
    author: text(b.author || 'MASQ. Editorial Team', { label: 'Author', field: 'author', min: 2, max: 60 }).replace(/\s+/g, ' '),
    featured: b.featured === true, pick: b.pick === true, hidden: b.hidden === true,
    published
  };
}

/** "Symbols That Speak!" → "symbols-that-speak" */
const slugOf = (title) => title.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'story';

const adminShape = (r) => ({ ...shape(r, true), hidden: r.hidden, live: !r.hidden && new Date(r.published_at) <= new Date(), hasUpload: Boolean(r.image_id) });

async function adminList() {
  return (await query('SELECT * FROM journal_stories ORDER BY published_at DESC, slug')).map(adminShape);
}

adminJournalRouter.get('/admin/journal', async (_req, res) => {
  await ensureStarterStories();
  res.json(await adminList());
});

adminJournalRouter.post('/admin/journal', async (req, res) => {
  const s = storyBody(req.body);
  // A short, readable address from the title; a number on the end if taken.
  const base = slugOf(s.title);
  let slug = base;
  for (let n = 2; await one('SELECT 1 FROM journal_stories WHERE slug = $1', [slug]); n++) slug = `${base}-${n}`;
  await query(`INSERT INTO journal_stories (slug, topic, title, dek, body, quote, author, featured, pick, hidden, published_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [slug, s.topic, s.title, s.dek, s.body, s.quote, s.author, s.featured, s.pick, s.hidden, s.published]);
  res.status(201).json({ slug, stories: await adminList() });
});

adminJournalRouter.put('/admin/journal/:slug', async (req, res) => {
  const s = storyBody(req.body);
  const row = await one(`UPDATE journal_stories SET topic = $2, title = $3, dek = $4, body = $5, quote = $6, author = $7,
                           featured = $8, pick = $9, hidden = $10, published_at = $11, updated_at = now()
                          WHERE slug = $1 RETURNING slug`,
    [req.params.slug, s.topic, s.title, s.dek, s.body, s.quote, s.author, s.featured, s.pick, s.hidden, s.published]);
  if (!row) throw fail(404, 'That story has gone. Refresh the list.');
  res.json(await adminList());
});

adminJournalRouter.delete('/admin/journal/:slug', async (req, res) => {
  await transaction(async (tx) => {
    const gone = await tx.one('DELETE FROM journal_stories WHERE slug = $1 RETURNING image_id', [req.params.slug]);
    if (gone?.image_id) await tx.query('DELETE FROM images WHERE id = $1', [gone.image_id]);
  });
  res.json(await adminList());
});

/** Back to the photo the story started with (or none). */
adminJournalRouter.delete('/admin/journal/:slug/image', async (req, res) => {
  await transaction(async (tx) => {
    const r = await tx.one('SELECT image_id FROM journal_stories WHERE slug = $1 FOR UPDATE', [req.params.slug]);
    if (!r) throw fail(404, 'That story has gone. Refresh the list.');
    await tx.query('UPDATE journal_stories SET image_id = NULL, updated_at = now() WHERE slug = $1', [req.params.slug]);
    if (r.image_id) await tx.query('DELETE FROM images WHERE id = $1', [r.image_id]);
  });
  res.json(await adminList());
});

/* A cover photo: the same two sizes as a product's, checked the same way. */
journalUploadRouter.post('/admin/journal/:slug/image', requireAdmin, uploadBody, async (req, res) => {
  const { small, large } = bothSizes(req.body);
  await transaction(async (tx) => {
    const r = await tx.one('SELECT image_id FROM journal_stories WHERE slug = $1 FOR UPDATE', [req.params.slug]);
    if (!r) throw fail(404, 'That story has gone. Refresh the list.');
    const { id } = await tx.one('INSERT INTO images (mime, data, data_2x) VALUES ($1, $2, $3) RETURNING id',
      [small.mime, small.bytes, large.bytes]);
    await tx.query('UPDATE journal_stories SET image_id = $1, updated_at = now() WHERE slug = $2', [id, req.params.slug]);
    if (r.image_id) await tx.query('DELETE FROM images WHERE id = $1', [r.image_id]);
  });
  res.json(await adminList());
});
