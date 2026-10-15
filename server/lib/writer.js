import Anthropic from '@anthropic-ai/sdk';

/* "Write it for me" in the admin: the owner types a few notes about a piece
 * and Claude drafts its description and "details and care" in the MASQ.
 * voice. A draft only fills the boxes in the admin; nothing reaches the shop
 * until the owner has read it and pressed SAVE.
 *
 * Off unless ANTHROPIC_API_KEY is set, and then the admin simply has no
 * button. */

export const WRITER_MODEL = 'claude-opus-5-5';

/** A real Anthropic key, not a placeholder from .env.example. */
export function writerConfigured() {
  const key = process.env.ANTHROPIC_API_KEY ?? '';
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key) && !/x{8}/i.test(key);
}

const SYSTEM = `You write product copy for MASQ., a Nigerian fashion label: modern identity wear rooted in culture, presented like artefacts in a dark gallery. The voice is quiet, confident and ceremonial; never playful, never loud, never salesy.

From the owner's notes about one piece, write:
- description: two to four short sentences, about 40 to 90 words, for the product page. What the piece is, how it wears, and the idea or heritage behind it, if the notes give one.
- details: the practical facts from the notes (material, weight, fit, origin, care), one short line each with no bullets or dashes, separated by newlines. Use an empty string if the notes give no such facts.

Rules:
- Use only facts found in the notes or the product information. Never invent a material, a weight, a place of making, a fit, a care instruction, a cultural reference, stock levels, delivery times or a price.
- No exclamation marks, emojis, hashtags, questions to the reader, or words like "must-have", "elevate", "vibe" or "perfect for".
- British spelling (colour, centre). Write the label's name as MASQ. with its full stop, and the product's name exactly as given.
- If the notes are thin, write less rather than pad.`;

const FORMAT = {
  type: 'json_schema',
  schema: {
    type: 'object',
    properties: {
      description: { type: 'string' },
      details: { type: 'string' }
    },
    required: ['description', 'details'],
    additionalProperties: false
  }
};

/** A failure the admin can show as it is (`expose`: see server/index.js). */
function fail(status, message) {
  return Object.assign(new Error(message), { status, expose: true });
}

/**
 * Draft a description for one product.
 *   product: { name, sizes: ['S', ...], colours: ['Black', ...], description, details }
 *   notes:   what the owner typed
 * Resolves to { description, details }.
 */
export async function draftDescription(product, notes) {
  if (!writerConfigured()) throw fail(503, 'The writing helper is not set up on this server.');

  const brief = [
    `Product name: ${product.name}`,
    product.colours.length ? `Colours: ${product.colours.join(', ')}` : null,
    `Sizes: ${product.sizes.join(', ')}`,
    product.description ? `Current description (may be improved or replaced):\n${product.description}` : null,
    product.details ? `Current details and care:\n${product.details}` : null,
    `Owner's notes:\n${notes}`
  ].filter(Boolean).join('\n\n');

  // Made per request, so it picks up whatever `fetch` is in place (the tests
  // stand in for Anthropic's API that way, as they do for Paystack's).
  const client = new Anthropic({ maxRetries: 1, timeout: 90_000 });
  let response;
  try {
    response = await client.beta.messages.create({
      model: WRITER_MODEL,
      max_tokens: 16000,
      // A request the model declines is tried once more on Anthropic's
      // recommended stand-in model instead of failing outright.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: FORMAT },
      system: SYSTEM,
      messages: [{ role: 'user', content: brief }]
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error('[writer] key refused:', err.status);
      throw fail(503, 'The writing helper’s key was not accepted. Check ANTHROPIC_API_KEY.');
    }
    if (err instanceof Anthropic.RateLimitError) throw fail(503, 'The writing helper is busy. Try again in a minute.');
    if (err instanceof Anthropic.APIConnectionError) throw fail(503, 'Could not reach the writing helper. Try again.');
    if (err instanceof Anthropic.APIError) {
      console.error('[writer] API error', err.status, err.message);
      throw fail(502, 'The writing helper could not write this one. Try again.');
    }
    throw err;
  }

  if (response.stop_reason === 'refusal') throw fail(422, 'The writing helper would not write this one. Try different notes.');
  const text = response.content.find(b => b.type === 'text')?.text;
  if (response.stop_reason === 'max_tokens' || !text) throw fail(502, 'The draft came back unfinished. Try again.');

  let draft;
  try { draft = JSON.parse(text); } catch { throw fail(502, 'The draft came back unreadable. Try again.'); }
  const clean = (v, max) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim().slice(0, max) : '');
  const out = { description: clean(draft.description, 2000), details: clean(draft.details, 1000) };
  if (!out.description) throw fail(502, 'The draft came back empty. Try again.');

  const u = response.usage;
  console.log(`[writer] drafted ${product.name}: ${u.input_tokens} in, ${u.output_tokens} out`);
  return out;
}
