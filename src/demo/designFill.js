/* Preview only: fills every piece's product page to the Face Tee's standard
 * (design/product-page.webp is the benchmark for all of them) — two close-up
 * photos cut from its own picture, its words, a SKU, sample stars and the
 * See-it-closer film. The live shop shows only what the owner enters in the
 * admin; nothing here reaches it. */

const CODE = { tshirts: 'TS', headwear: 'HW', bags: 'BG', outerwear: 'OW', accessories: 'AC' };

const WORDS = {
  tshirts: {
    lede: (n) => `A bold expression of identity and culture. ${n} carries MASQ. artwork for those who wear their story with pride.`,
    more: 'Made from heavyweight cotton for all-day comfort, it’s designed to be worn, not just seen.',
    details: 'Premium 100% cotton\nSignature MASQ. artwork\nRelaxed, modern fit\nDesigned in Nigeria, for a global generation',
    materials: 'Premium 100% heavyweight cotton\nScreen-printed MASQ. artwork',
    fit: 'Relaxed, modern fit. Take your usual size; size up for a looser look.'
  },
  headwear: {
    lede: (n) => `Headwear that speaks without words. ${n} carries the MASQ. mark, made to be worn every day.`,
    more: 'Structured where it should be, soft where it counts, with a shape that holds wash after wash.',
    details: 'Embroidered MASQ. mark\nAdjustable fit\nBreathable lining\nDesigned in Nigeria, for a global generation',
    materials: 'Cotton twill outer\nCotton lining, embroidered detail',
    fit: 'One size, adjustable at the back to fit most heads.'
  },
  bags: {
    lede: (n) => `Made for journeys that mean something. ${n} carries what matters, marked with MASQ. identity.`,
    more: 'Strong materials, clean lines and room for the everyday — built to move with you.',
    details: 'Embossed MASQ. mark\nDurable, water-resistant finish\nInner pockets for the essentials\nDesigned in Nigeria, for a global generation',
    materials: 'Water-resistant outer\nLined interior, metal zips',
    fit: 'Adjustable strap; sized to carry the everyday essentials.'
  },
  outerwear: {
    lede: (n) => `Layer your identity. ${n} brings MASQ. artwork to the outside, made for every journey.`,
    more: 'A considered cut with room to layer, finished with details that last season after season.',
    details: 'Signature MASQ. artwork\nRelaxed, layerable fit\nQuality zips and trims\nDesigned in Nigeria, for a global generation',
    materials: 'Durable woven outer\nSoft lining, quality zips and trims',
    fit: 'Relaxed fit with room to layer. Take your usual size.'
  },
  accessories: {
    lede: (n) => `The details that complete the look. ${n} carries the MASQ. mark into the everyday.`,
    more: 'Small pieces with meaning, made to be used and carried every day.',
    details: 'MASQ. artwork\nMade to last\nEveryday essential\nDesigned in Nigeria, for a global generation',
    materials: 'Quality materials chosen for everyday use',
    fit: 'One size.'
  }
};

const titled = (name) => name.split(' ').map(w => (w.includes('.') || w.length < 2 ? w : w[0] + w.slice(1).toLowerCase())).join(' ');
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** What the preview adds to a piece's page; the owner's own entries always win. */
export function designFill(p, seed, index) {
  const cat = p.category ?? seed.category;
  const w = WORDS[cat] ?? WORDS.accessories;
  const h = hash(p.id);
  return {
    description: `${w.lede(titled(p.name))}\n\n${w.more}`,
    details: w.details, materials: w.materials, fit: w.fit,
    sku: `MSQ-${CODE[cat] ?? 'AC'}-${String(index + 2).padStart(3, '0')}`,
    rating: [4.6, 4.7, 4.8, 4.9][h % 4], reviews: 18 + (h % 147),
    closer: p.img || null,
    extras: p.img ? [1, 2].map(i => ({ id: -(i), img: `assets/img/z-${p.id}-${i}.webp`, img2x: `assets/img/z-${p.id}-${i}.webp` })) : []
  };
}
