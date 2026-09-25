/* Getting a product photo ready in the browser, before it is uploaded.
 *
 * A phone photo is several megabytes and a different shape from the shop's
 * frames. Here it is turned the right way up, cropped to the 5:6 frame every
 * product uses, and made twice — 700 px wide for ordinary screens, 1,400 for
 * sharp ones — as WebP, or JPEG where the browser cannot write WebP (Safari).
 * What reaches the server is a few hundred KB, which matters on mobile data
 * and in a free database. */

const RATIO = 5 / 6;
const WIDTHS = [700, 1400];

function toBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

function toDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Returns { image, image2x, width, small } or throws with a plain message. */
export async function preparePhoto(file) {
  if (!file) throw new Error('Choose a photo first.');
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) && !/\.(jpe?g|png|webp|heic)$/i.test(file.name)) {
    throw new Error('Choose a JPEG, PNG or WebP photo.');
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('That photo could not be opened. Try saving it as a JPEG first.');
  }

  // Centre crop to the 5:6 frame.
  let sw = bitmap.width, sh = bitmap.height, sx = 0, sy = 0;
  if (sw / sh > RATIO) { sw = Math.round(sh * RATIO); sx = Math.round((bitmap.width - sw) / 2); }
  else                 { sh = Math.round(sw / RATIO); sy = Math.round((bitmap.height - sh) / 2); }

  let type = 'image/webp';
  const out = [];
  for (const target of WIDTHS) {
    const width = Math.min(target, sw);          // never enlarge
    const height = Math.round(width / RATIO);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height);

    let blob = await toBlob(canvas, type, 0.86);
    if (!blob || blob.type !== type) {           // Safari writes PNG when asked for WebP
      type = 'image/jpeg';
      blob = await toBlob(canvas, type, 0.88);
    }
    out.push(blob);
  }
  bitmap.close?.();

  // Both sizes must be the same kind of file.
  if (out[0].type !== out[1].type) {
    throw new Error('That photo could not be prepared. Try a different one.');
  }

  return {
    image: await toDataUrl(out[0]),
    image2x: await toDataUrl(out[1]),
    width: sw,
    small: sw < WIDTHS[0]
  };
}
