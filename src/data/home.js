/* The home page's words as designed. The server falls back to these until the
 * owner changes them in the admin, and the shop shows them if the server
 * cannot be reached — one copy, so the two never disagree. */

/** The menu items, in order, and the section each one scrolls to. */
export const NAV = ['shop', 'collections', 'about', 'journal'];
export const NAV_TARGETS = { shop: '#drop', collections: '#essentials', about: '#craft', journal: '#film' };

export const HOME_DEFAULT = {
  heroEyebrow:     'URBAN RITUALS',
  heroSub:         'Modern identity wear\nrooted in culture.',
  heroButton:      'SHOP DROP 01',
  heroImageAlt:    'Model wearing the MASQ. Face Tee in ultraviolet',
  craftTitle:      'Craft. Culture. Identity.',
  craftText:       'Each piece is designed as a modern artifact —\nwhere heritage meets contemporary expression.',
  dropTitle:       'Drop 01 — Urban Rituals',
  manifestoLine1:  'We don’t make clothes.',
  manifestoLine2:  'We create symbols.',
  manifestoTag:    'MASQ IS A LANGUAGE — WORN, NOT SPOKEN.',
  essentialsTitle: 'The Essentials',
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
    collections: { label: 'ESSENTIALS',  show: true },
    about:       { label: 'ABOUT',       show: true },
    journal:     { label: 'FILM',        show: true }
  }
};
