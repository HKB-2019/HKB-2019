import { NIGERIAN_STATES, zoneFor } from './settings.js';

/* Checks shared by every route that takes them, so they cannot drift apart. */

/** An email address worth sending to: something@somewhere.tld, at most 254 characters. */
export const isEmail = (v) => typeof v === 'string' && v.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/** Lower-cased and trimmed, the form an email is stored and compared in. */
export const normEmail = (v) => String(v ?? '').trim().toLowerCase();

/* ------------------------------------------------------ delivery details */

const fail = (status, message, field) => Object.assign(new Error(message), { status, field });

const text = (v, { label, field, min = 1, max }) => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  if (s.length < min) throw fail(400, `Please enter your ${label}.`, field);
  if (s.length > max) throw fail(400, `Your ${label} is too long.`, field);
  return s;
};

/**
 * Who an order goes to and where: for checkout, and for an address a
 * customer saves to their account. Without these an order is paid for and
 * undeliverable, so they are required, and checked here — the browser's
 * checks are a convenience for the customer, not a guarantee for the shop.
 */
export function deliveryDetails(body) {
  const name = text(body.name, { label: 'full name', field: 'name', min: 2, max: 80 });

  const phone = String(body.phone ?? '').trim();
  const digits = phone.replace(/\D/g, '');
  if (!/^\+?[\d\s()-]+$/.test(phone) || digits.length < 7 || digits.length > 15) {
    throw fail(400, 'Please enter a phone number the rider can call.', 'phone');
  }

  const a = body.address ?? {};
  const country = text(a.country, { label: 'country', field: 'country', min: 2, max: 56 });
  const inNigeria = ['nigeria', 'ng'].includes(country.toLowerCase());

  let state = text(a.state, { label: inNigeria ? 'state' : 'state or region', field: 'state', min: 2, max: 60 });
  if (inNigeria) {
    const match = NIGERIAN_STATES.find(s => s.toLowerCase() === state.toLowerCase().replace(/\s+state$/, ''));
    if (!match) throw fail(400, 'Please choose your state from the list.', 'state');
    state = match;
  }

  // A postcode, for the courier abroad (DHL and the like ask for one). Optional,
  // since many countries have none; not asked for, and not kept, in Nigeria.
  const postcode = inNigeria ? '' : String(a.postcode ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
  if (postcode && !/^[A-Z0-9][A-Z0-9 -]{1,11}$/.test(postcode)) {
    throw fail(400, 'Please check the postcode: letters, numbers, spaces and dashes only.', 'postcode');
  }

  const address = {
    line1: text(a.line1, { label: 'street address', field: 'line1', min: 3, max: 120 }),
    line2: String(a.line2 ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
    city: text(a.city, { label: 'city or area', field: 'city', min: 2, max: 60 }),
    state,
    ...(postcode ? { postcode } : {}),
    country: inNigeria ? 'Nigeria' : country
  };

  return { name, phone, address, zone: zoneFor(address) };
}
