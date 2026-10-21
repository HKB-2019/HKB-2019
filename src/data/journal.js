/* The MASQ. Journal: its six topics, as the owner's boards draw them, and
 * the stories it starts with. The server seeds these into the database once
 * (server/seed.js); after that the owner writes, edits and hides stories in
 * the admin's JOURNAL tab. The topics themselves are fixed here.
 *
 * Story text is plain: a blank line starts a new paragraph, a line starting
 * "## " is a heading, a line starting "> " is a quote set apart. */

export const TOPICS = [
  {
    key: 'culture-heritage', name: 'Culture & Heritage',
    lines: ['Culture', '& Heritage'],
    sub: 'Exploring the art, symbols, traditions and stories that shape African identity and inspire contemporary expression.',
    scribble: ['ROOTS', 'SYMBOLS', 'STORIES'],
    second: null,
    side: 'MORE TO READ',
    row: 'MORE STORIES',
    promo: { title: 'Wear the symbols', text: 'The pieces these stories inspire, from the mask to the pattern.', button: 'SHOP NOW', to: '/#drop' },
    quote: 'Symbols survive because they evolve.',
    img: 'assets/img/countdown.webp'
  },
  {
    key: 'style-expression', name: 'Style & Expression',
    lines: ['Wear', 'Your Story.'],
    sub: 'Style is a language. At MASQ., we see fashion as a form of self-expression — a way to tell your story, honour your roots and move culture forward.',
    scribble: ['STYLE', 'IDENTITY', 'CULTURE', 'ALWAYS'],
    second: { label: 'SHOP THE LOOKS', to: '/#drop' },
    side: 'TRENDING',
    row: 'EDITOR’S PICKS',
    promo: { title: 'Shop the Looks', text: 'Explore the pieces featured in our Style & Expression stories.', button: 'SHOP NOW', to: '/#drop' },
    quote: 'Style is not just what you wear, it’s how you carry your story.',
    img: 'assets/img/prod-tee-black.webp'
  },
  {
    key: 'people-creatives', name: 'People & Creatives',
    lines: ['Creative', 'People.', 'Bolder Culture.'],
    sub: 'Conversations with artists, designers, photographers and cultural innovators shaping what’s next.',
    scribble: ['PEOPLE', 'IDEAS', 'CULTURE', 'IMPACT'],
    second: { label: 'MEET THE CREATIVES', to: '#row' },
    side: 'TRENDING CREATIVES',
    row: 'FEATURED CREATIVES',
    promo: { title: 'Meet the Creatives', text: 'Discover the people behind the culture.', button: 'EXPLORE NOW', to: '#row' },
    quote: 'African creatives are not waiting for permission. We are building our own table.',
    img: 'assets/img/hero-design-2.webp'
  },
  {
    key: 'behind-the-design', name: 'Behind the Design',
    lines: ['From', 'Inspiration', 'to Expression.'],
    sub: 'The ideas, materials, craftsmanship and stories behind every MASQ. piece.',
    scribble: ['IDEAS', 'MATERIALS', 'PEOPLE', 'CRAFT'],
    second: { label: 'OUR PROCESS', to: '#side' },
    side: 'THE DESIGN PROCESS',
    // This topic's side list is the process itself, not a list of stories.
    process: [
      ['Inspiration', 'Cultural references, art and everyday life.'],
      ['Concept & Sketch', 'From ideas to first designs.'],
      ['Materials', 'Carefully chosen fabrics and finishes.'],
      ['Craftsmanship', 'Where tradition meets modern technique.'],
      ['The Final Piece', 'Worn around the world.']
    ],
    row: 'COLLECTION DEEP DIVES',
    promo: null,
    quote: 'Every stitch carries a story. Every detail has a purpose.',
    img: 'assets/img/ess-jacket.webp'
  },
  {
    key: 'lifestyle-community', name: 'Lifestyle & Community',
    lines: ['People.', 'Places.', 'Real Culture.'],
    sub: 'Music, city life, events and cultural movements that inspire and connect our community.',
    scribble: ['CITIES', 'PEOPLE', 'MUSIC', 'COMMUNITY'],
    second: { label: 'SEE THE COMMUNITY', to: '#row' },
    side: 'TRENDING STORIES',
    row: 'COMMUNITY STORIES',
    promo: { title: 'Events & Happenings', text: 'Pop-ups, launches and nights out: be the first to hear when we announce one.', button: 'GET THE NEWS', to: '#list' },
    quote: 'Culture lives in the people — the streets, the music, the creative energy, the everyday.',
    img: 'assets/img/hero-design.webp'
  },
  {
    key: 'brand-stories', name: 'Brand Stories',
    lines: ['Our', 'Story in', 'Motion.'],
    sub: 'Collections, campaigns, collaborations and milestones that define the MASQ. journey.',
    scribble: ['PEOPLE', 'CULTURE', 'IDEAS', 'ALWAYS'],
    second: { label: 'VIEW COLLECTIONS', to: '/#essentials' },
    side: 'LATEST ANNOUNCEMENTS',
    row: 'CAMPAIGNS & COLLECTIONS',
    promo: { title: 'Explore Our Collections', text: 'Discover the pieces, the stories and the inspiration behind each collection.', button: 'SHOP NOW', to: '/#drop' },
    quote: 'We don’t just make clothes. We tell stories, build culture and create space for what’s next.',
    img: 'assets/img/countdown.webp'
  }
];

export const TOPIC_KEYS = TOPICS.map(t => t.key);
export const topicOf = (key) => TOPICS.find(t => t.key === key) ?? null;

/* The Journal's own front page. */
export const JOURNAL_HOME = {
  lines: ['Culture.', 'Style.', 'Identity.'],
  sub: 'Stories, perspectives and creative expressions shaping the culture we wear.',
  scribble: ['WEAR', 'IDENTITY', 'LIVE', 'CULTURE'],
  img: 'assets/img/hero-design.webp'
};

/* Reading time: about 200 words a minute, never under one. */
export const readMinutes = (body) => Math.max(1, Math.round(String(body ?? '').split(/\s+/).filter(Boolean).length / 200));

/* The stories the Journal opens with. Written from what is true about the
 * brand, its pieces and well-documented traditions: no invented people,
 * interviews or events. The owner replaces or adds to them in the admin. */
export const STARTER_STORIES = [
  {
    slug: 'symbols-that-speak', topic: 'culture-heritage', featured: true, pick: true, date: '2026-10-12',
    title: 'Symbols That Speak: The Stories Behind African Icons',
    dek: 'A deeper look into the symbols, meanings and traditions that inspire MASQ. designs.',
    img: 'assets/img/countdown.webp',
    quote: 'Symbols survive because they evolve. They speak to the past, the present and the future at the same time.',
    body: `African symbols are more than art — they are languages. They carry stories of identity, spirituality, strength and community, passed down through generations. At MASQ., these symbols inspire our designs, connecting heritage with contemporary expression.

In this piece, we look at a few of the visual languages that shape the way we draw, and why they still feel so alive.

## Adinkra

Adinkra symbols come from the Akan people of Ghana. Each one stands for an idea: Gye Nyame for the supremacy of God, Sankofa — often drawn as a bird looking back — for going back to fetch what was left behind. Traditionally they were stamped onto cloth with carved calabash stamps, and they are still printed, painted and carved today.

## Nsibidi

Nsibidi is a system of signs from the Cross River region of south-eastern Nigeria, used among peoples including the Ejagham and the Efik. Some of its signs are everyday; others were known only to members of societies such as Ekpe. It was written on walls, on bodies and on cloth, and it is a reminder that West Africa had its own ways of writing ideas down.

## Uli and adire

Uli is the flowing line painting of the Igbo, once drawn on skin and walls with dark plant dyes. Adire is the indigo resist-dyed cloth of the Yoruba, its patterns made by tying, stitching or painting a starch paste before the dye. Both turn pattern into meaning.

> We don’t copy these symbols. We learn from them: the confidence of a single line, the weight a shape can carry.

## Why it matters to us

The MASQ. mark is not any one of these. It is drawn in their spirit — bold shapes, strong colour, a face that looks back at you. Wearing it is a way of saying that where we come from is not behind us. It travels with us.`
  },
  {
    slug: 'adire-the-indigo-thread', topic: 'culture-heritage', date: '2026-10-05',
    title: 'Adire: The Indigo Thread',
    dek: 'The Yoruba art of resist-dyed indigo cloth, and why its patterns sit behind our pieces.',
    img: 'assets/img/hero-design.webp',
    quote: 'Pattern is memory you can wear.',
    body: `Look behind the models in our Drop 01 photographs and you will see deep blue cloth, broken by white lines and circles. That cloth is inspired by adire, the indigo resist-dyed textile of the Yoruba people of south-western Nigeria.

## How adire is made

The word adire is often explained as "tie and dye", but the craft has many methods. In adire oniko, the cloth is tied before it goes into the dye. In adire eleko, a starch paste is painted or stencilled onto the cloth, and where the paste sits, the indigo cannot reach. When the paste is washed away, the pattern appears in pale lines against the blue.

Towns such as Abeokuta and Osogbo are known for it, and generations of women have carried the craft forward, each pattern with a name and often a story.

> The colour is patient. Cloth goes into the dye again and again until the blue is as deep as it should be.

## Why it speaks to us

Adire is proof that a pattern can be both everyday and meaningful. It was worn, not hung on walls. That is what we want for our pieces too: clothes you live in that still say something about where you come from.`
  },
  {
    slug: 'five-ways-to-style-masq', topic: 'style-expression', featured: true, date: '2026-10-10',
    title: '5 Ways to Style MASQ. This Season',
    dek: 'From everyday essentials to statement pieces, here’s how to style MASQ. for different moments, moods and occasions.',
    img: 'assets/img/prod-tee-black.webp',
    quote: 'Let one piece speak. Let everything else listen.',
    body: `The MASQ. mask is loud on purpose. The trick to wearing it is deciding what else gets to talk.

## 1. Tee, tailored

Put the Face Tee under a straight, dark trouser and clean shoes. The print becomes the only colour in the room, and the outfit reads as considered rather than casual.

## 2. Layered under the Symbol Jacket

Wear the tee under the Symbol Jacket, open. The mask on the chest and the mask on the back make a pair — one for the people you walk towards, one for the people you leave behind.

## 3. Black on black

The black Face Tee with black denim and the black Mark Cap. Tone on tone lets the embroidery and the print do the work, and it looks right from morning to late.

## 4. The scarf as the statement

Keep everything plain and let the Pattern Scarf carry the colour — round the neck, knotted on a bag, or loose over the shoulders.

## 5. White for daylight

The white Face Tee belongs in the sun. Pair it with light trousers and let it be easy.

> Style is not just what you wear, it’s how you carry your story.`
  },
  {
    slug: 'day-to-night-one-tee', topic: 'style-expression', pick: true, date: '2026-10-03',
    title: 'From Day to Night: One Tee, Three Looks',
    dek: 'One Face Tee, worn three ways between the morning and the last song.',
    img: 'assets/img/hero-design-2.webp',
    body: `A good tee should not need changing when the day does. Here is how one MASQ. Face Tee works from first coffee to last song.

## Morning

Loose, with relaxed trousers and trainers. Nothing tucked, nothing fussy.

## Afternoon

Tucked into tailored trousers, with a belt and a watch. The print stays the focus; the rest gets sharper.

## Night

Under the Symbol Jacket, with the Mark Cap. Darker, a little more edge, the mask showing between the open fronts.`
  },
  {
    slug: 'creatives-we-are-listening', topic: 'people-creatives', featured: true, date: '2026-10-08',
    title: 'Creatives, We’re Listening',
    dek: 'Photographers, painters, musicians, designers: this space is for the people shaping the culture. Here’s how to be part of it.',
    img: 'assets/img/hero-design-2.webp',
    quote: 'African creatives are not waiting for permission. We are building our own table.',
    body: `MASQ. began with a simple belief: the most exciting ideas in fashion and culture are coming from people who have never been asked for them.

This part of the Journal is for those people. We want to tell the stories of the photographers documenting everyday life, the painters reworking old symbols, the musicians soundtracking the city, and the designers building something of their own.

## What we’re looking for

Work that is rooted somewhere. It does not have to be traditional, and it does not have to be polished. It has to be honest about where it comes from.

## How to reach us

Send us a short note through our contact page with a link to your work and a line about who you are. We read everything. When we feature someone, we do it properly: in their words, with their work, credited.

> Your story, in your words. That’s the only kind we want to tell.`
  },
  {
    slug: 'the-story-behind-the-masq-mark', topic: 'behind-the-design', featured: true, pick: true, date: '2026-10-12',
    title: 'The Story Behind the MASQ. Mark',
    dek: 'A deep dive into the meaning, inspiration and design journey behind our signature mark.',
    img: 'assets/img/ess-jacket.webp',
    quote: 'Every stitch carries a story. Every detail has a purpose.',
    body: `Every MASQ. piece carries the same face. It is the first thing people notice, and the question we are asked most: why a mask?

## A face that is more than a face

Across West Africa, masks are not disguises. In masquerade traditions such as Egungun among the Yoruba and Mmanwu among the Igbo, the mask is a presence — something that brings the past into the room. We wanted a mark with that kind of weight: not decoration, but a character.

## Split down the middle

The mark is divided in two. One half is calm, cream and teal; the other is bright, orange and red, with an eye that looks straight at you. It is our way of saying that identity has more than one side, and that you do not have to choose.

## The colours

Teal, amber, violet, red and cream. They come from the energy of the city — market cloth, painted buses, signs at night — more than from any single tradition.

## Drawn by hand

The lines are rough on purpose. A mark this strong could easily look like a logo from anywhere. The brush keeps it human.

> We don’t make clothes. We create symbols.`
  },
  {
    slug: 'from-sketch-to-street-drop-01', topic: 'behind-the-design', date: '2026-10-08',
    title: 'From Sketch to Street: Inside Drop 01',
    dek: 'A look at the creative process from first sketches to the finished pieces.',
    img: 'assets/img/prod-scarf.webp',
    body: `Drop 01 — Urban Rituals started as pages of drawings and ended as pieces in people’s hands. Here is the road between.

## Inspiration

It starts with looking: at cloth, at signs, at the way people dress on the street. We collect more than we use.

## Concept and sketch

The mask was drawn many times before it settled. Each piece in the drop asks a different question of it — how big, where, in what colour.

## Materials

We choose fabrics for how they feel after a year, not just on the first day: tees with weight, a scarf that moves, a cap that keeps its shape.

## Craft

Prints are checked against the drawing; embroidery is checked stitch by stitch. If a piece does not look like the sketch, it does not leave the studio.

## The final piece

And then it is yours. The last step of the design is the one you take, wearing it.`
  },
  {
    slug: 'lagos-a-city-that-moves-different', topic: 'lifestyle-community', featured: true, date: '2026-10-12',
    title: 'Lagos: A City That Moves Different',
    dek: 'The people, places and energy that make Lagos a centre of culture, creativity and self-expression.',
    img: 'assets/img/hero-design.webp',
    quote: 'Culture lives in the people — the streets, the music, the creative energy, the everyday.',
    body: `Lagos does not wait for anyone. It is the city where we design, and it is in every piece we make.

## The pace

Traffic that stops and starts, a danfo horn, a hawker who sells you water through a car window: the city has a rhythm, and you learn to move with it.

## The sound

Afrobeats and its many cousins came out of rooms like the ones in this city and now play everywhere. In Lagos you hear them first, from every shop and every car.

## The style

People here dress with intention — for church, for work, for a night out — and mix tailoring, traditional cloth and streetwear without a second thought. It is the most confident dressing we know.

> Made for the culture means made for here first.

## Why it matters

When we say MASQ. is rooted in culture, this is the culture we mean: lived, loud, everyday. We are proud to make clothes for it.`
  },
  {
    slug: 'drop-01-urban-rituals', topic: 'brand-stories', featured: true, pick: true, date: '2026-10-12',
    title: 'Drop 01 — Urban Rituals',
    dek: 'Our first collection, and the idea behind it: everyday rituals, worn.',
    img: 'assets/img/countdown.webp',
    quote: 'We don’t make clothes. We create symbols.',
    body: `Every city has its rituals: the morning route, the Friday night, the Sunday best. Urban Rituals is our first collection, and it is made for those moments.

## What’s in it

The Face Tee in indigo, black and white, the Symbol Jacket with the mask on its back, the Mark Cap, the Pattern Scarf, the Carrier Backpack and the Ritual Hoodie — each one carrying the MASQ. mark in a different way.

## Why a drop

We make a little at a time, so each piece gets our full attention, and we make it again only when it is right. When something sells out, you can ask to be told when it is back.

## What’s next

This is the first chapter. More pieces, more stories and more people are coming — and the Journal is where we will tell you about them first.

> This is not what you wear. It’s who you are.`
  },
  {
    slug: 'gift-cards-are-here', topic: 'brand-stories', date: '2026-10-06',
    title: 'MASQ. Gift Cards Are Here',
    dek: 'Give the choice, in your colours, with a message and a link to send.',
    img: 'assets/img/hero-design-2.webp',
    body: `Not sure of their size, or which colour they would choose? You can now give a MASQ. gift card.

## How it works

Choose an amount, pick the card’s colours and write a message. Once it is paid, you get a link to send to them — by message, email or however you like. They spend it at checkout, all at once or bit by bit.

## Topping up

A card can be topped up later, by you or by anyone who has its link. Useful for birthdays that come round every year.`
  }
];
