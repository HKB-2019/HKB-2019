/* Builds the two preview pages — the shop, and the same thing opened at the
 * admin — and readies each index.html for a host that supplies its own
 * <html>, <head> and <body> around the page (claude.ai artifacts do). */

import { build } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';

const TITLES = { shop: 'MASQ. Shop', admin: 'MASQ. Admin' };

for (const mode of ['shop', 'admin']) {
  await build({ configFile: 'vite.demo.config.js', mode, logLevel: 'warn' });
  const file = `dist-preview/${mode}/index.html`;
  const html = readFileSync(file, 'utf8')
    .replace(/<!DOCTYPE html>\s*/i, '')
    .replace(/<\/?(html|head|body)\b[^>]*>\s*/gi, '')
    .replace(/<meta charset[^>]*>\s*/i, '')
    .replace(/<meta name="viewport"[^>]*>\s*/i, '')
    // Link previews only mean something on the live shop's own address.
    .replace(/\s*<!-- Link previews[\s\S]*?<meta name="twitter:card"[^>]*>/, '')
    .replace(/<title>[^<]*<\/title>/, `<title>${TITLES[mode]}</title>`);
  writeFileSync(file, html.trim() + '\n');
  console.log(`dist-preview/${mode} ready`);
}
