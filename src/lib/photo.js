/* Getting a photo ready in the browser, before it is uploaded.
 *
 * A phone photo is several megabytes and a different shape from the shop's
 * frames. Here it is turned the right way up, cropped from the centre to the
 * frame it will fill — 5:6 for every product — and made twice, for ordinary
 * and for sharp screens, as WebP, or JPEG where the browser cannot write WebP
 * (Safari). What reaches the server is a few hundred KB, which matters on
 * mobile data and in a free database. */

/** A customer's profile photo: square, small. */
export const AVATAR = { ratio: 1, widths: [256, 512] };

/** Product photos: the 5:6 portrait frame, 700 and 1,400 px wide. */
export const PRODUCT = { ratio: 5 / 6, widths: [700, 1400] };

/**
 * The home page's wide photos. The hero keeps the photo's own shape, since
 * its frame is portrait on a computer and landscape on a phone. The two bands
 * are cut to 3:1 — the page shows them wider still, so anything taller would
 * only be uploaded to be cropped away.
 */
export const HOME = {
  hero: { ratio: null, widths: [900, 1800] },
  hero2: { ratio: null, widths: [900, 1800] },
  band: { ratio: 3, widths: [1600, 3000] },
  countdown: { ratio: 2.3, widths: [1600, 3000] },
  film: { ratio: 3, widths: [1600, 3000] }
};

/** Under the server's 2.5 MB limit per copy, with room to spare. */
const MAX_BYTES = 2_300_000;

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
export async function preparePhoto(file, { ratio, widths } = PRODUCT) {
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

  // Centre crop to the frame, if it has a fixed shape.
  let sw = bitmap.width, sh = bitmap.height, sx = 0, sy = 0;
  if (ratio) {
    if (sw / sh > ratio) { sw = Math.round(sh * ratio); sx = Math.round((bitmap.width - sw) / 2); }
    else                 { sh = Math.round(sw / ratio); sy = Math.round((bitmap.height - sh) / 2); }
  }

  let type = 'image/webp';
  const out = [];
  for (const target of widths) {
    const width = Math.min(target, sw);          // never enlarge
    const height = Math.round(width * sh / sw);
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
    // A very detailed photo can still come out large; squeeze it once more.
    if (blob && blob.size > MAX_BYTES) blob = await toBlob(canvas, type, 0.7);
    if (!blob || blob.size > MAX_BYTES) throw new Error('That photo is too detailed to upload. Try a different one.');
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
    small: sw < widths[0]
  };
}
