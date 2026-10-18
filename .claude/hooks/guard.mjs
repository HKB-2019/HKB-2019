/* Claude Code hooks for MASQ. (wired up in .claude/settings.json).
 *
 *   node .claude/hooks/guard.mjs before   PreToolUse: refuse edits to secrets and the lockfile
 *   node .claude/hooks/guard.mjs after    PostToolUse: after a payment file changes, say which tests prove it
 *
 * The tool call arrives as JSON on stdin. Node, not jq or bash, because the
 * project already needs Node everywhere it runs. */
import { basename, relative } from 'node:path';

const PAYMENTS = [
  'server/lib/paystack.js', 'server/lib/orders.js', 'server/lib/giftcards.js',
  'server/lib/discounts.js', 'server/lib/money.js', 'server/lib/auth.js',
  'server/routes/checkout.js', 'server/routes/webhook.js', 'server/routes/giftcards.js',
  'server/routes/orders.js', 'server/routes/admin-giftcards.js'
];

let input = '';
for await (const chunk of process.stdin) input += chunk;

let call;
try { call = JSON.parse(input); } catch { process.exit(0); }   // nothing to judge

const file = call?.tool_input?.file_path ?? call?.tool_input?.notebook_path;
if (typeof file !== 'string') process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? call.cwd ?? process.cwd();
const rel = relative(root, file).split('\\').join('/');
const name = basename(file);

if (process.argv[2] === 'before') {
  if (name.startsWith('.env') && name !== '.env.example') {
    console.error(`${rel} holds real keys and passwords, which never pass through an editor or a commit. Change .env.example for new names, and set real values on the host (see DEPLOY.md).`);
    process.exit(2);
  }
  if (name === 'package-lock.json') {
    console.error('package-lock.json is written by npm, never by hand. Change package.json and run npm install.');
    process.exit(2);
  }
  process.exit(0);
}

if (process.argv[2] === 'after' && PAYMENTS.includes(rel)) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext:
        `${rel} handles money or the admin door. Before pushing: run npm test (shop, giftcards, sales and admin tests ` +
        'cover it) and the e2e checkout and gift card specs, and consider asking the payments-reviewer agent to read the diff.'
    }
  }));
}
