/* The footer pages as first written, shared by the server (its defaults) and
 * the preview build. */

export const PAGES = ['FAQ', 'SHIPPING', 'RETURNS', 'CONTACT', 'PRIVACY', 'SIZE_GUIDE', 'TERMS'];

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
    'If you join the list, we keep your email address to tell you about new drops. If you ask to hear when a sold-out size is back, we keep your email address for that and remove it once we have told you. We do not sell or share your details.\n\n' +
    'To see or delete what we hold about you, contact us using the details on the Contact page.',
  // Linked from every product page. Says only what the design already
  // promised ("true to size"); measurements are the owner's to add.
  SIZE_GUIDE:
    'Our pieces run true to size. If you are between two sizes, choose the larger for a relaxed fit.\n\n' +
    'Questions about fit? Use the details on the Contact page and we will help.',
  // What a customer agrees to by paying. Describes what the code does; a
  // starting point for the owner to review, not legal advice.
  TERMS:
    'Prices are in Nigerian naira and include the pieces only. The delivery fee for your address is shown in the bag before you pay. Prices shown in other currencies are a guide; you are always charged in naira.\n\n' +
    'Payment is taken by Paystack. Your order is confirmed once Paystack confirms the payment. A piece is held for you while you pay and released if the payment is not completed.\n\n' +
    'A discount code takes money off the pieces, not the delivery, and only one code can be used per order.\n\n' +
    'If a piece sells out while your payment is being confirmed, we refund you in full.\n\n' +
    'Returns are covered on the Returns page. Questions: use the details on the Contact page.'
};
