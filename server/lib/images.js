/* Checking an uploaded photo is what it says it is.
 *
 * The browser's label ("image/png") is just text the uploader chose. What a
 * file is comes from its first bytes, so that is what is checked. Only three
 * formats are accepted, and SVG is not one of them: an SVG is a document
 * that can carry script, and serving one from the shop's own address would
 * let it run with the shop's cookies. */

export const MAX_IMAGE_BYTES = 2_500_000;   // per size; the admin sends ~100–300 KB

export function sniffImage(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'image/png';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/**
 * Decode one base64 photo from the admin and check it. Returns
 * { bytes, mime } or throws an error with a status and a plain message.
 */
export function decodePhoto(b64, label) {
  if (typeof b64 !== 'string' || !b64) throw fail(400, `The ${label} photo is missing.`);
  // Allow a data: URL prefix, since that is what a browser naturally produces.
  const body = b64.replace(/^data:[^,]*,/, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(body)) throw fail(400, `The ${label} photo did not arrive intact.`);
  const bytes = Buffer.from(body, 'base64');
  if (bytes.length > MAX_IMAGE_BYTES) throw fail(413, `The ${label} photo is too large.`);
  const mime = sniffImage(bytes);
  if (!mime) throw fail(415, 'That file is not a JPEG, PNG or WebP photo.');
  return { bytes, mime };
}

function fail(status, message) {
  return Object.assign(new Error(message), { status });
}
