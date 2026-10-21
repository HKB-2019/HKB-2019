/* The Shop and Collections pages, as the owner's designs draw them
 * (design/shop-all.webp, design/category-*.webp, design/collection*.webp and
 * the two menus). The words are the designs'; the pieces on each page are the
 * shop's own, filled from what the owner sets on each product in the admin:
 * its category, its type within that category and its collections.
 *
 * Shared by the server (to check what the admin sends) and the shop. */

/* ------------------------------------------------------------ categories */

/** Each product's category, and the types within it (its sub-categories). */
export const CATEGORIES = [
  { key: 'tshirts', name: 'T-Shirts', line: 'Statement tees for everyday expression.', short: 'Make a statement',
    types: [['graphic', 'Graphic Tees', 'Bold expressions'], ['essential', 'Essential Tees', 'Clean. Timeless.'], ['limited', 'Limited Edition', 'Exclusive drops']] },
  { key: 'headwear', name: 'Headwear', line: 'Caps, bucket hats and beanies that carry culture.', short: 'Elevate the look',
    types: [['caps', 'Caps', 'Classic & statement'], ['bucket-hats', 'Bucket Hats', 'Bold expressions'], ['beanies', 'Beanies', 'Seasonal essentials']] },
  { key: 'bags', name: 'Bags', menuName: 'Bags & Accessories', line: 'Bags designed for movement, purpose and identity.', short: 'Carry the culture',
    types: [['backpacks', 'Backpacks', 'Everyday & travel'], ['crossbody', 'Crossbody Bags', 'Compact & versatile'], ['tote', 'Tote Bags', 'Bold essentials']] },
  { key: 'outerwear', name: 'Outerwear', line: 'Hoodies, jackets and layers beyond the basics.', short: 'Beyond the basics',
    types: [['hoodies', 'Hoodies', 'Comfort & expression'], ['jackets', 'Jackets', 'Everyday essentials'], ['layered', 'Layered Pieces', 'Beyond the basics']] },
  { key: 'accessories', name: 'Accessories', line: 'Scarves, phone cases and everyday essentials.', short: 'Everyday must-haves',
    types: [['scarves', 'Scarves & Wraps', 'Cultural accents'], ['phone-cases', 'Phone Cases', 'Everyday protection'], ['lifestyle', 'Lifestyle & Essentials', 'Everyday must-haves']] }
];
export const CATEGORY_KEYS = CATEGORIES.map(c => c.key);
export const categoryOf = (key) => CATEGORIES.find(c => c.key === key) ?? null;
export const typeName = (category, type) => categoryOf(category)?.types.find(([k]) => k === type)?.[1] ?? null;

/* ----------------------------------------------------------- collections */

export const COLLECTIONS = [
  { key: 'drop-01', name: 'Drop 01 — Urban Rituals', menu: ['Drop 01', 'Urban Rituals'], line: 'Wear identity. Live culture.', icon: 'drop',
    tile: 'Bold designs inspired by African heritage, reimagined for today’s generation.' },
  { key: 'essentials', name: 'Essentials', line: 'Timeless pieces for everyday expression.', icon: 'tee', chip: 'Everyday expression',
    tile: 'Timeless pieces for everyday movement. Clean designs, premium comfort and unmistakable identity.' },
  { key: 'limited', name: 'Limited Edition', line: 'Rare drops. Distinct stories.', icon: 'diamond', chip: 'Rare drops',
    tile: 'Rare drops. Distinct stories. Exclusive pieces inspired by culture, art and movement.' },
  { key: 'collaborations', name: 'Collaborations', line: 'Creative partnerships that push boundaries.', icon: 'rings', chip: 'Stronger together',
    tile: 'Different worlds. A shared culture. Collaborations that bring together creative minds and communities.' },
  { key: 'archive', name: 'Archive', line: 'Icons from past seasons.', icon: 'box', chip: 'Icons live on',
    tile: 'Past seasons. Timeless pieces. Explore selected items from previous drops.' }
];
export const COLLECTION_KEYS = COLLECTIONS.map(c => c.key);
export const collectionOf = (key) => COLLECTIONS.find(c => c.key === key) ?? null;

/* ------------------------------------------------------------- the pages */

/* The photos (assets/img/h-*, b-*, s-*) are cut from the owner's boards,
 * the brush words already painted on them, until the originals arrive.
 *
 * Each page: its hero (label, title lines with the violet part, the line under
 * it, the button), the panels under the hero, which filters it offers, and
 * the band at its foot. A page `includes` products by category and, within
 * that, by type; `groups` are the panels (and the Category filter). */

const DROP_BAND = (line) => ({ kicker: 'DROP 01', title: 'Urban Rituals', line, button: 'EXPLORE THE COLLECTION', to: '/collections/drop-01', words: true });

export const SHOP_PAGES = {
  all: {
    path: '/shop', label: 'SHOP', crumb: 'Shop',
    title: [['Wear Identity.'], ['Live ', { accent: 'Culture.' }]],
    sub: 'Explore contemporary pieces inspired by African heritage, designed for a global generation.',
    button: null,
    img: 'assets/img/h-shop-all.webp',
    // The panels: everything, then each category.
    groups: [
      { key: 'all', name: 'All Products', line: 'View everything' },
      ...CATEGORIES.map(c => ({ key: c.key, name: c.menuName ?? c.name, line: c.short, match: { category: c.key }, to: `/shop/${c.key}` }))
    ],
    filters: ['category', 'price', 'colour', 'size', 'availability'],
    band: { ...DROP_BAND('A collection rooted in culture, made for now.'), words: false, img: 'assets/img/b-shop-all.webp' }
  },
  tshirts: {
    path: '/shop/tshirts', label: 'T-SHIRTS', crumb: 'T-Shirts', includes: ['tshirts'],
    title: [['Wear Your'], [{ accent: 'Identity.' }]],
    sub: 'Statement tees rooted in culture, designed for everyday expression.',
    button: 'SHOP ALL T-SHIRTS',
    img: 'assets/img/h-tshirts.webp',
    allName: 'All T-Shirts',
    filters: ['category', 'price', 'colour', 'size', 'availability'],
    band: { ...DROP_BAND('Made to be worn. Built to mean something.'), button: 'EXPLORE THE DROP', words: false, img: 'assets/img/b-tshirts.webp' }
  },
  headwear: {
    path: '/shop/headwear', label: 'HEADWEAR', crumb: 'Headwear', includes: ['headwear'],
    title: [['More Than'], ['A ', { accent: 'Cap.' }]],
    sub: 'Headwear designed to carry culture, identity and purpose. From everyday fits to statement pieces, MASQ. caps are made to be worn, not just seen.',
    button: 'EXPLORE HEADWEAR',
    trusted: false,       // the design has no faces under its button
    img: 'assets/img/h-headwear.webp',
    allName: 'All Headwear', counts: true,
    filters: ['category', 'price', 'colour', 'collection'],
    band: { ...DROP_BAND('Headwear that speaks without words.'), words: false, img: 'assets/img/b-headwear.webp' }
  },
  bags: {
    path: '/shop/bags', label: 'BAGS & ACCESSORIES', crumb: 'Bags & Accessories', includes: ['bags'],
    title: [['Carry'], ['Your ', { accent: 'Culture.' }]],
    sub: 'Bags designed for movement, purpose and identity. Functional pieces with meaningful details, made to go with you everywhere.',
    button: 'SHOP ALL BAGS',
    img: 'assets/img/h-bags.webp',
    allName: 'All Bags',
    filters: ['category', 'price', 'colour', 'collection', 'availability'],
    band: { ...DROP_BAND('Bags for journeys that mean something.'), words: false, img: 'assets/img/b-bags.webp' }
  },
  outerwear: {
    path: '/shop/outerwear', label: 'OUTERWEAR', crumb: 'Outerwear', includes: ['outerwear'],
    // The owner's newer Outerwear design (category-outerwear-v2.webp).
    title: [['Layer'], ['Your ', { accent: 'Identity' }]],
    sub: 'Hoodies, jackets and layers designed for everyday movement. Protection, expression and culture — in every season.',
    button: 'SHOP OUTERWEAR',
    img: 'assets/img/h-outerwear.webp',
    allName: 'All Outerwear',
    filters: ['category', 'price', 'colour', 'size', 'collection'],
    band: { ...DROP_BAND('Outerwear for every journey.'), img: 'assets/img/b-outerwear.webp' }
  },
  accessories: {
    path: '/shop/accessories', label: 'ACCESSORIES', crumb: 'Accessories',
    // Accessories gathers the small pieces with the caps and the bags.
    includes: ['accessories', 'headwear', 'bags'],
    title: [['Details'], ['Carry ', { accent: 'Culture.' }]],
    sub: 'Accessories that complete the look. From caps and bags to everyday essentials, each piece is designed with purpose and identity.',
    button: 'SHOP ACCESSORIES',
    img: 'assets/img/h-accessories.webp',
    allName: 'All Accessories',
    plus: true,           // the design's cards carry a + rather than a bag
    groups: [
      { key: 'all', name: 'All Accessories', line: 'View everything' },
      { key: 'headwear', name: 'Caps & Headwear', line: 'Everyday style', match: { category: 'headwear' } },
      { key: 'bags', name: 'Bags', line: 'Movement & purpose', match: { category: 'bags' } },
      { key: 'scarves', name: 'Scarves & Wraps', line: 'Cultural accents', match: { category: 'accessories', type: 'scarves' } },
      { key: 'phone-cases', name: 'Phone Cases', line: 'Everyday protection', match: { category: 'accessories', type: 'phone-cases' }, panel: false },
      { key: 'lifestyle', name: 'Lifestyle & Essentials', line: 'Everyday must-haves', match: { category: 'accessories', type: 'lifestyle' } }
    ],
    filters: ['category', 'price', 'colour', 'collection', 'availability'],
    band: { ...DROP_BAND('Accessories for everyday journeys.'), img: 'assets/img/b-accessories.webp' }
  }
};

/** A category page's panels: everything in it, then each of its types. */
export function groupsOf(page) {
  if (page.groups) return page.groups;
  const c = categoryOf(page.includes[0]);
  return [
    { key: 'all', name: page.allName, line: 'View everything' },
    ...c.types.map(([key, name, line]) => ({ key, name, line, match: { category: c.key, type: key } }))
  ];
}

export const COLLECTION_PAGES = {
  'drop-01': {
    kicker: 'DROP 01', title: [['Urban'], [{ accent: 'Rituals' }]],
    tagline: 'Wear Identity. Live Culture.',
    sub: 'A contemporary collection inspired by African heritage, reimagined for today’s generation. Bold designs, everyday pieces, timeless meaning.',
    // The design's button reads "SHOP THE COLLECTIAR": a typo.
    button: 'SHOP THE COLLECTION',
    img: 'assets/img/h-drop-01.webp',
    filters: [],          // the design shows the pieces without a filter column
    gridTitle: 'The Collection',
    story: { kicker: 'BEHIND THE COLLECTION', title: ['More Than', 'A Look'],
      text: 'Urban Rituals draws from symbols, patterns and stories that have shaped our identity for generations — reimagined for the streets, the culture and the future.',
      button: 'EXPLORE THE STORY', to: '/journal/behind-the-design', film: 'THE LOOKBOOK', filmImg: 'assets/img/s-lookbook.webp', img: 'assets/img/s-drop-01.webp' },
    band: { kicker: 'DROP 01', title: 'Urban Rituals', line: 'People. Places. Patterns. Purpose.', button: 'SHOP THE COLLECTION', to: '#pieces', words: true, img: 'assets/img/b-drop-01.webp' }
  },
  essentials: {
    title: [['Essentials'], ['Everyday ', { accent: 'Expression.' }]], smallSecond: true,
    sub: 'Timeless pieces designed for everyday movement. Clean designs, premium comfort and unmistakable identity — made to be worn, anytime, anywhere.',
    button: 'SHOP ESSENTIALS',
    img: 'assets/img/h-essentials.webp',
    filters: ['category', 'price', 'colour', 'size', 'availability'],
    story: { title: ['Designed', 'For Every Day'], text: 'Clean silhouettes. Bold details. Made to move with you, from city streets to global stages.',
      button: 'DISCOVER THE STORY', to: '/journal/style-expression', img: 'assets/img/s-essentials.webp', words: true }
  },
  limited: {
    title: [['Limited'], [{ accent: 'Edition' }]],
    tagline: 'Rare drops. Distinct stories.',
    sub: 'Small runs. Bold designs. Exclusive pieces inspired by culture, art and movement. Once they’re gone, they’re gone.',
    button: 'SHOP LIMITED EDITION',
    img: 'assets/img/h-limited.webp',
    promises: true,
    badge: 'LIMITED EDITION',
    filters: ['category', 'price', 'colour', 'size', 'availability'],
    story: { kicker: 'THE STORY', title: ['More Than', { accent: 'A Collection' }],
      text: 'Limited Edition pieces are inspired by real stories, places and people. Each drop is a celebration of identity, creativity and the culture that moves us.',
      button: 'EXPLORE THE STORY', to: '/journal/brand-stories', img: 'assets/img/s-limited.webp', words: true }
  },
  collaborations: {
    title: [['Collaborations'], [{ accent: 'Stronger' }], [{ accent: 'Together.' }]],
    tagline: 'Different worlds. A shared culture.',
    sub: 'Collaborations that bring together creative minds, communities and cultures — reimagining African identity through fashion, art and movement.',
    button: 'SHOP COLLABORATIONS',
    img: 'assets/img/h-collaborations.webp',
    partners: true,
    filters: ['partner', 'category', 'price', 'colour', 'size'],
    // Waiting for real partners: nothing is shown until the owner adds them.
    empty: { title: 'Our first collaborations are on their way.', text: 'Join the list to hear first when they land.' }
  },
  archive: {
    title: [['Archive'], [{ accent: 'Icons Live On.' }]],
    tagline: 'Past seasons. Timeless pieces.',
    sub: 'Explore selected pieces from previous drops. Different stories, same identity — crafted with purpose, made to last.',
    button: 'EXPLORE THE ARCHIVE',
    img: 'assets/img/h-archive.webp',
    seasons: true,
    sort: 'newest',
    filters: ['season', 'category', 'price', 'colour', 'size', 'availability'],
    story: { title: ['Stories That', 'Shaped Us'], caps: true,
      text: 'Each piece in the archive represents a moment, a place and a purpose. Explore the journeys behind the designs.',
      button: 'EXPLORE THE STORY', to: '/journal/brand-stories', img: 'assets/img/s-archive.webp',
      film: 'ARCHIVE FILM', filmLine: 'A look back', filmImg: 'assets/img/a-film.webp' },
    empty: { title: 'The archive opens after our first season.', text: 'Pieces from past drops will live here.' }
  }
};

export const ALL_COLLECTIONS = {
  title: [['All'], [{ accent: 'Collections' }]],
  tagline: 'Wear Identity. Live Culture.',
  sub: 'Explore every MASQ. collection — from essentials to limited editions, collaborations and archival pieces. Different stories, same purpose.',
  button: 'EXPLORE COLLECTIONS',
  img: 'assets/img/h-collections.webp'
};

/* ------------------------------------------------------------- filters */

export const SORTS = [
  ['featured', 'Featured'],
  ['newest', 'Newest'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low']
];

export const PER_PAGE = 12;
