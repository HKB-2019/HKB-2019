/* Sending email: the codes that prove an email address and the links that set
 * a new password.
 *
 * Which way, from MAIL_DRIVER (or worked out from what is set):
 *
 *   brevo   Brevo's transactional email API. Needs BREVO_API_KEY and
 *           MAIL_FROM ("MASQ. <hello@yourshop.com>", an address Brevo has
 *           verified). The default whenever BREVO_API_KEY is set.
 *   log     printed to the server's log, for a developer's own computer.
 *           The default outside production when there is no key.
 *   memory  kept in `outbox` for the tests to read.
 *   none    no way to send. The default in production without a key.
 *
 * Customer accounts need a way to send (a code nobody receives is a locked
 * door), so with `none` the shop does not offer accounts at all. */

export const outbox = [];

export function mailDriver() {
  const set = process.env.MAIL_DRIVER;
  if (['brevo', 'log', 'memory', 'none'].includes(set)) return set;
  if (process.env.BREVO_API_KEY) return 'brevo';
  return process.env.NODE_ENV === 'production' ? 'none' : 'log';
}

export const canSendMail = () => {
  const d = mailDriver();
  return d === 'brevo' ? Boolean(process.env.BREVO_API_KEY && process.env.MAIL_FROM) : d !== 'none';
};

/* "MASQ. <hello@x.com>" → { name, email } */
function sender() {
  const raw = process.env.MAIL_FROM ?? '';
  const m = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1] || 'MASQ.', email: m[2] } : { name: 'MASQ.', email: raw.trim() };
}

const escapeHtml = (v) => String(v).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* One plain, dark message in the shop's look. Lines are text; `big` is shown
 * large (a code); `button` is a link. Nothing here comes from a customer's
 * typing except their name, which is escaped. */
function render({ heading, lines = [], big, button }) {
  const p = (t) => `<p style="margin:0 0 14px;font:15px/1.6 Helvetica,Arial,sans-serif;color:#c2c0bc">${escapeHtml(t)}</p>`;
  return `<!doctype html><html><body style="margin:0;background:#050407;padding:32px 16px">
<div style="max-width:480px;margin:0 auto;background:#0f0e14;border:1px solid #2a2833;border-radius:14px;padding:32px 28px">
<p style="margin:0 0 24px;font:700 22px Helvetica,Arial,sans-serif;color:#f4f1eb;letter-spacing:-.02em">MASQ.</p>
<h1 style="margin:0 0 16px;font:700 22px/1.25 Helvetica,Arial,sans-serif;color:#f4f1eb">${escapeHtml(heading)}</h1>
${lines.map(p).join('\n')}
${big ? `<p style="margin:8px 0 22px;font:700 34px/1 Helvetica,Arial,sans-serif;letter-spacing:.3em;color:#f4f1eb">${escapeHtml(big)}</p>` : ''}
${button ? `<p style="margin:8px 0 22px"><a href="${escapeHtml(button.href)}" style="display:inline-block;background:#5a2be0;color:#fff;font:600 14px Helvetica,Arial,sans-serif;letter-spacing:.08em;text-decoration:none;padding:14px 26px;border-radius:10px">${escapeHtml(button.label)}</a></p>` : ''}
<p style="margin:24px 0 0;font:12px/1.6 Helvetica,Arial,sans-serif;color:#8a8790">If this wasn't you, you can ignore this email.</p>
</div></body></html>`;
}

const textOf = ({ heading, lines = [], big, button }) =>
  [heading, '', ...lines, ...(big ? ['', big] : []), ...(button ? ['', `${button.label}: ${button.href}`] : [])].join('\n');

/**
 * Send one message. `message` is { heading, lines, big?, button? }. Resolves
 * when it has gone (or been kept); rejects with a plain message if it could not.
 */
export async function sendMail({ to, subject, message, kind }) {
  const driver = mailDriver();
  if (driver === 'memory') { outbox.push({ to, subject, kind, ...message, text: textOf(message) }); return; }
  if (driver === 'log') { console.log(`[mail] to ${to} · ${subject}\n${textOf(message)}\n`); return; }
  if (driver !== 'brevo' || !canSendMail()) {
    throw Object.assign(new Error('Email is not set up on this shop yet.'), { status: 503, expose: true });
  }
  const res = await fetch(process.env.BREVO_API_BASE || 'https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: sender(), to: [{ email: to }], subject, htmlContent: render(message), textContent: textOf(message) }),
    signal: AbortSignal.timeout(10_000)
  }).catch(() => null);
  if (!res?.ok) {
    console.error('[mail] Brevo refused or could not be reached:', res?.status);
    throw Object.assign(new Error('We couldn’t send the email just now. Please try again in a minute.'), { status: 502, expose: true });
  }
}
