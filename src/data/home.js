/* The home page's words as designed. The server falls back to these until the
 * owner changes them in the admin, and the shop shows them if the server
 * cannot be reached — one copy, so the two never disagree. */

/** The menu items, in order, and the section each one scrolls to. */
export const NAV = ['shop', 'collections', 'about', 'journal'];
export const NAV_TARGETS = { shop: '#drop', collections: '#essentials', about: '#craft', journal: '#film' };

export const HOME_DEFAULT = {
  heroEyebrow:     'URBAN RITUALS',
  heroSub:         'Modern identity wear\nrooted in culture.',
  heroText:        'Contemporary fashion and lifestyle pieces inspired by African heritage, designed for a global generation.',
  heroButton:      'SHOP DROP 01',
  heroButton2:     'EXPLORE',
  heroImageAlt:    'A man in the violet MASQ. Face Tee before an indigo adire cloth',
  heroImageAlt2:   'A woman in the pink MASQ. Face Tee before an indigo adire cloth',
  craftTitle:      'Craft. Culture. Identity.',
  craftText:       'Each piece is designed as a modern artifact —\nwhere heritage meets contemporary expression.',
  dropTitle:       'Drop 01 — Urban Rituals',
  manifestoLine1:  'We don’t make clothes.',
  manifestoLine2:  'We create symbols.',
  manifestoTag:    'MASQ IS A LANGUAGE — WORN, NOT SPOKEN.',
  manifestoMore:   'OUR STORY',
  // Beside the play button on the film strip, one word to a line.
  filmWords:       'People\nPlaces\nPatterns\nPurpose',
  essentialsTitle: 'The Essentials',
  // The three promises above the sign-up: kept to the shop's real terms
  // (the Delivery and Returns pages).
  perk1Title:      'Delivery across Nigeria',
  perk1Text:       'Lagos & Abuja in 1–3 working days',
  perk2Title:      'Easy returns',
  perk2Text:       'Unworn pieces, within 14 days',
  perk3Title:      'Secure payment',
  perk3Text:       'Card, bank or transfer, through Paystack',
  newsletterTitle: 'Enter the world of MASQ.',
  newsletterNote:  'First access to every drop, and the story behind each mask. Nothing else.',
  // Over the countdown, while pieces are waiting for their drop time.
  countdownTitle:  'The next drop',
  // The pop-up that offers the mailing list to a first-time visitor.
  welcomeTitle:    'Be first to the next drop.',
  welcomeNote:     'New drops, restocks and the story behind each mask, straight to your inbox. Nothing else.',
  // Shown on the home page, `delay` seconds after a first-time visitor lands.
  welcome:         { show: true, delay: 4 },
  nav: {
    shop:        { label: 'SHOP',        show: true },
    collections: { label: 'COLLECTIONS', show: true },
    about:       { label: 'ABOUT',       show: true },
    journal:     { label: 'JOURNAL',     show: true }
  }
};
