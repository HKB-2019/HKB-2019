/* The footer pages as first written, shared by the server (its defaults) and
 * the preview build. */

export const PAGES = ['FAQ', 'SHIPPING', 'RETURNS', 'CONTACT', 'PRIVACY', 'SIZE_GUIDE'];

/* The first four are the copy from the original design. CONTACT holds
 * placeholder details and must be replaced before launch. PRIVACY describes
 * what this code actually collects and why — it is a factual starting point
 * for the owner to review, not legal advice. */
export const PAGES_DEFAULT = {
  FAQ:      'Sizing, care and drop mechanics. Pieces run true to size; every MASQ. artifact ships with an authenticity card bearing its own mask number.',
  SHIPPING: 'Lagos & Abuja: 1–3 working days. Rest of Nigeria: 3–5 working days. The delivery fee for your address is shown before you pay.',
  RETURNS:  'Unworn pieces may be returned within 14 days of delivery with tags and authenticity card intact. Limited jacket releases are final sale.',
  CONTACT:  'studio@masq.ng · +234 000 0000 · The Studio, 14 Ikoyi Crescent, Lagos. Monday to Friday, 10:00 – 18:00 WAT.',
  PRIVACY:
    'When you order, we collect your name, email, phone number and delivery address, and use them only to deliver your order and contact you about it.\n\n' +
    'Payments are handled by Paystack. We never see or store your card details.\n\n' +
    'If you join the list, we keep your email address to tell you about new drops. We do not sell or share your details.\n\n' +
    'To see or delete what we hold about you, contact us using the details on the Contact page.',
  // Linked from every product page. Says only what the design already
  // promised ("true to size"); measurements are the owner's to add.
  SIZE_GUIDE:
    'Our pieces run true to size. If you are between two sizes, choose the larger for a relaxed fit.\n\n' +
    'Questions about fit? Use the details on the Contact page and we will help.'
};
