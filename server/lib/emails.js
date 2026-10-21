/* An order's emails, from the owner's email receipt design (the desktop one,
 * which closes up for a phone): the MASQ. bar, a big thank-you with View
 * Order and Track Order, the order number, date and payment, every piece with
 * its photo, the sums, what happens next in three steps, a way to ask for
 * help, and the footer. Built from tables and inline styles, as email needs,
 * with a plain-text twin for mail apps that show no HTML.
 *
 * Nothing here comes from a customer's typing but their order's own words
 * (names of pieces, the town), and all of it is escaped. */

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const naira = (kobo) => (kobo < 0 ? '−' : '') + '₦' + (Math.abs(kobo) / 100).toLocaleString('en-NG');
const lagos = (d) => new Date(d).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', ',');

const INK = '#f4f1eb', DIM = '#a7a3ab', FAINT = '#77737c', LINE = '#26242d', CARD = '#0e0d13', BG = '#050407', OK = '#3ccf74';
const FONT = "font-family:Helvetica,Arial,sans-serif;";

/**
 * kind     'receipt' (paid) or 'shipped' (on its way)
 * order    { reference, email, paid_at, created_at, payment_method, subtotal_kobo, discount_kobo, discount_code,
 *            shipping_kobo, gift_kobo, address, courier, tracking, fulfilled_at }
 * items    [{ name, colour, size, qty, unit_price_kobo, img }]   img: a full address or ''
 * origin   "https://masq.ng"
 * social   { instagram, tiktok, x }   contact: an email address or ''
 */
export function orderEmail({ kind, order, items, origin, social = {}, contact = '' }) {
  const ref = order.reference;
  const link = `${origin}/order?reference=${encodeURIComponent(ref)}`;
  const shipped = kind === 'shipped';
  const total = order.subtotal_kobo - order.discount_kobo + order.shipping_kobo;
  const count = items.reduce((n, i) => n + i.qty, 0);
  const town = order.address ? [order.address.city, order.address.state].filter(Boolean).join(', ') : '';
  const paidAt = order.paid_at ?? order.created_at;
  const img = (name) => `${origin}/assets/email/${name}.png`;
  const help = contact ? `mailto:${contact}` : `${origin}/?page=contact`;

  const heading = shipped ? 'Your order is on its way!' : 'Thanks for your order!';
  const intro = shipped
    ? `Your order has left the studio${order.courier ? ` with ${order.courier}` : ''}. Follow it on its way to you.`
    : 'Your payment has been confirmed and we’re getting your items ready. We’ll notify you again when your order ships.';
  const subject = shipped ? `Your MASQ. order is on its way (${ref.slice(0, 13)})` : `Your MASQ. order receipt (${ref.slice(0, 13)})`;
  const preheader = shipped ? 'Your order has left the studio.' : 'Thanks for your order! Your payment has been confirmed.';

  const button = (href, label, solid) => `<a href="${esc(href)}" style="display:inline-block;${FONT}font-size:15px;font-weight:600;text-decoration:none;padding:13px 26px;border-radius:6px;${solid ? `background:${OK};color:#050407;border:1px solid ${OK};` : `background:transparent;color:${INK};border:1px solid #d6d2cb;`}">${esc(label)}</a>`;
  const label = (t) => `<span style="${FONT}font-size:13px;color:${DIM};">${esc(t)}</span>`;
  const value = (t) => `<span style="${FONT}font-size:14px;color:${INK};">${esc(t)}</span>`;
  const fact = (icon, k, v, w) => `<td class="fact" valign="middle" width="${w}" style="padding:16px 14px;white-space:nowrap;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td valign="middle" style="padding-right:12px;"><img src="${img(icon)}" width="22" height="22" alt="" style="display:block;border:0;"></td>
      <td valign="middle">${label(k)}<br>${value(v)}</td></tr></table></td>`;

  const piece = (i) => {
    const opts = [i.colour && `Colour: ${i.colour}`, i.size && i.size !== 'ONE SIZE' && `Size: ${i.size}`, `Qty: ${i.qty}`].filter(Boolean).join('&nbsp;&nbsp;|&nbsp;&nbsp;');
    return `<tr>
      <td width="64" valign="top" style="padding:10px 0;">${i.img ? `<img src="${esc(i.img)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border-radius:6px;object-fit:cover;background:#1b1a21;border:0;">` : `<div style="width:56px;height:56px;border-radius:6px;background:#1b1a21;"></div>`}</td>
      <td valign="top" style="padding:12px 12px 10px;"><span style="${FONT}font-size:15px;font-weight:600;color:${INK};">${esc(i.name)}</span><br><span style="${FONT}font-size:13px;color:${DIM};">${opts}</span></td>
      <td valign="top" align="right" style="padding:12px 0 10px;${FONT}font-size:15px;color:${INK};white-space:nowrap;">${naira(i.unit_price_kobo * i.qty)}</td>
    </tr>`;
  };
  const sum = (k, v, colour = INK, big = false) => `<tr>
      <td style="padding:${big ? '12px 0 0' : '3px 0'};${FONT}font-size:${big ? 20 : 15}px;${big ? 'font-weight:700;' : ''}color:${colour};">${esc(k)}</td>
      <td align="right" style="padding:${big ? '12px 0 0' : '3px 0'};${FONT}font-size:${big ? 20 : 15}px;${big ? 'font-weight:700;' : ''}color:${colour};white-space:nowrap;">${v}</td></tr>`;

  // What happens next: confirmed, being prepared, out for delivery.
  const at = shipped ? 3 : 1;
  const steps = [
    ['Order confirmed', lagos(paidAt).replace(/ \d{4},/, ',')],
    ['Preparing items', at > 1 ? 'Packed with care' : 'We’ll notify you soon'],
    ['Out for delivery', shipped ? (order.tracking ? `Tracking: ${order.tracking}` : 'On its way to you') : 'You’ll get a tracking link']
  ];
  const step = ([title, note], n) => `<td class="step" align="center" valign="top" width="33%" style="padding:0 4px;">
      ${n <= at
        ? `<img src="${img('tick')}" width="22" height="22" alt="Done" style="display:block;margin:0 auto 8px;border:0;">`
        : `<div style="width:20px;height:20px;line-height:20px;margin:0 auto 8px;border:1px solid #8d8992;border-radius:50%;${FONT}font-size:11px;color:${DIM};text-align:center;">${n}</div>`}
      <span style="${FONT}font-size:13px;font-weight:600;color:${INK};">${esc(title)}</span><br>
      <span style="${FONT}font-size:12px;color:${DIM};">${esc(note)}</span></td>`;

  const socials = [['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['x', 'X']].filter(([k]) => social[k])
    .map(([k, name]) => `<a href="${esc(social[k])}" style="${FONT}font-size:12px;color:${DIM};text-decoration:none;">${name}</a>`).join('&nbsp;&nbsp;·&nbsp;&nbsp;');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${esc(subject)}</title>
<style>
  @media (max-width:600px){
    .wrap{ padding:0 !important; }
    .card{ border-radius:0 !important; border-left:0 !important; border-right:0 !important; }
    .pad{ padding-left:18px !important; padding-right:18px !important; }
    .hero h1{ font-size:30px !important; }
    .fact{ display:block !important; width:auto !important; border-left:0 !important; padding:10px 14px !important; }
    .btn-cell{ display:inline-block !important; padding-bottom:10px !important; }
    .step span{ font-size:11px !important; }
    .nav a{ margin-left:12px !important; }
    .stack{ display:block !important; width:auto !important; text-align:left !important; }
    .stack-gap{ padding-top:0 !important; }
    .hero-bag img{ width:180px !important; margin:0 0 6px auto !important; }
  }
</style></head>
<body style="margin:0;padding:0;background:${BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};"><tr><td class="wrap" align="center" style="padding:28px 12px;">
<table role="presentation" class="card" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:${CARD};border:1px solid ${LINE};border-radius:14px;">

  <tr><td class="pad" style="padding:22px 32px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td valign="middle"><a href="${esc(origin)}"><img src="${img('wordmark')}" width="104" height="40" alt="MASQ." style="display:block;border:0;"></a></td>
      <td class="nav" align="right" valign="middle" style="${FONT}font-size:14px;">
        <a href="${esc(origin)}/#drop" style="color:${INK};text-decoration:none;margin-left:22px;">Shop</a>
        <a href="${esc(origin)}/#essentials" style="color:${INK};text-decoration:none;margin-left:22px;">Collections</a>
        <a href="${esc(origin)}/?page=faq" style="color:${INK};text-decoration:none;margin-left:22px;">Help</a>
      </td></tr></table>
  </td></tr>

  <tr><td class="pad hero" style="padding:30px 32px 32px;background:${BG};background-image:radial-gradient(ellipse at 85% 40%, #12402a 0%, ${BG} 62%);">
    <!-- rtl puts the bag first in the code, so on a phone it stacks above the words; each cell reads ltr. -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="rtl"><tr>
      <td class="stack hero-bag" dir="ltr" width="230" valign="middle" align="right" style="width:230px;">
        <img src="${origin}/assets/email/hero-bag.png" width="230" height="196" alt="" style="display:block;border:0;width:230px;max-width:100%;height:auto;margin-left:auto;">
      </td>
      <td class="stack" dir="ltr" valign="middle" style="padding-right:12px;">
        <h1 style="margin:0 0 14px;${FONT}font-size:40px;line-height:1.08;font-weight:800;color:${INK};letter-spacing:-.02em;">${esc(heading)}</h1>
        <p style="margin:0 0 24px;max-width:380px;${FONT}font-size:16px;line-height:1.55;color:#d2cec7;">${esc(intro)}</p>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td class="btn-cell" style="padding-right:12px;">${button(link, 'View Order →', true)}</td>
          <td class="btn-cell">${button(link, 'Track Order', false)}</td>
        </tr></table>
      </td>
    </tr></table>
  </td></tr>

  <tr><td class="pad" style="padding:24px 32px 6px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:10px;background:#111017;"><tr>
      ${fact('order', 'Order number', ref, '46%')}
      ${fact('date', 'Order date', lagos(paidAt), '27%')}
      ${order.payment_method ? fact('card', 'Payment method', order.payment_method, '27%') : ''}
    </tr></table>
  </td></tr>

  ${shipped && (order.courier || order.tracking) ? `<tr><td class="pad" style="padding:16px 32px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1f4d33;border-radius:10px;background:#0d1a13;"><tr><td style="padding:14px 18px;">
      ${order.courier ? `${label('Courier')}<br>${value(order.courier)}<br>` : ''}
      ${order.tracking ? `<span style="display:block;height:8px;"></span>${label('Tracking number')}<br><span style="${FONT}font-size:16px;font-weight:700;color:${INK};letter-spacing:.04em;">${esc(order.tracking)}</span>` : ''}
    </td></tr></table></td></tr>` : ''}

  <tr><td class="pad" style="padding:22px 32px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="${FONT}font-size:20px;font-weight:700;color:${INK};">Order summary</td>
      <td align="right" style="${FONT}font-size:14px;color:${DIM};">${count} ${count === 1 ? 'item' : 'items'}</td></tr></table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;border-bottom:1px solid ${LINE};">${items.map(piece).join('')}</table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
      ${sum('Subtotal', naira(order.subtotal_kobo))}
      ${sum(`Shipping${town ? ` to ${town}` : ''}`, order.shipping_kobo ? naira(order.shipping_kobo) : 'Free')}
      ${order.discount_kobo > 0 ? sum(`Discount${order.discount_code ? ` (${order.discount_code})` : ''}`, naira(-order.discount_kobo), OK) : ''}
      ${order.gift_kobo > 0 ? sum('Paid by gift card', naira(-order.gift_kobo), OK) : ''}
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;border-top:1px solid ${LINE};">
      ${sum('Total paid', naira(total), INK, true)}
    </table>
  </td></tr>

  <tr><td class="pad" style="padding:26px 32px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:10px;background:#111017;"><tr><td style="padding:18px 18px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle" style="padding-right:12px;"><img src="${img('truck')}" width="30" height="30" alt="" style="display:block;border:0;"></td>
        <td valign="middle" style="${FONT}font-size:17px;font-weight:700;color:${INK};">What happens next?</td></tr></table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;"><tr>${steps.map((s, i) => step(s, i + 1)).join('')}</tr></table>
    </td></tr></table>
  </td></tr>

  <tr><td class="pad" style="padding:16px 32px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${LINE};border-radius:10px;"><tr>
      <td class="stack" style="padding:14px 16px;"><span style="${FONT}font-size:14px;font-weight:600;color:${INK};">Need help?</span><br>
        <span style="${FONT}font-size:13px;color:${DIM};">If you have any questions, visit our <a href="${esc(origin)}/?page=faq" style="color:${INK};">Help Centre</a> or contact our support team.</span></td>
      <td class="stack stack-gap" align="right" style="padding:14px 16px;white-space:nowrap;"><a href="${esc(help)}" style="display:inline-block;${FONT}font-size:13px;font-weight:600;color:${INK};text-decoration:none;padding:10px 14px;border:1px solid #d6d2cb;border-radius:6px;">Contact Support →</a></td>
    </tr></table>
  </td></tr>

  <tr><td class="pad" style="padding:26px 32px 26px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td class="stack" valign="top"><img src="${img('wordmark')}" width="78" height="30" alt="MASQ." style="display:block;border:0;"><span style="${FONT}font-size:12px;color:${DIM};">Style. People. Culture.</span></td>
      <td class="stack" align="right" valign="top" style="${FONT}font-size:11px;color:${FAINT};line-height:2;padding-top:10px;">
        ${socials ? `${socials}<br>` : ''}
        <a href="${esc(origin)}/?page=privacy" style="color:${FAINT};text-decoration:none;">Privacy Policy</a>&nbsp;|&nbsp;<a href="${esc(origin)}/?page=terms" style="color:${FAINT};text-decoration:none;">Terms of Service</a>&nbsp;|&nbsp;<a href="${esc(origin)}/account/notifications" style="color:${FAINT};text-decoration:none;">Email preferences</a>
      </td></tr></table>
  </td></tr>

</table>
<p style="margin:14px 0 0;${FONT}font-size:11px;color:${FAINT};">This email was sent to ${esc(order.email)} about an order at MASQ.</p>
</td></tr></table>
</body></html>`;

  // The plain-text twin, as the design's fallback.
  const pad = (k, v) => `${k}${' '.repeat(Math.max(2, 34 - k.length))}${v}`;
  const text = [
    'Hi,', '',
    shipped ? 'Your order is on its way!' : 'Thanks for your order!',
    intro, '',
    `Order number: ${ref}`,
    `Order date: ${lagos(paidAt)}`,
    ...(order.payment_method ? [`Payment method: ${order.payment_method}`] : []),
    ...(shipped && order.courier ? [`Courier: ${order.courier}`] : []),
    ...(shipped && order.tracking ? [`Tracking number: ${order.tracking}`] : []),
    '', 'Items:',
    ...items.map(i => pad(`- ${i.name} (${[i.colour, i.size].filter(Boolean).join(', ')}) × ${i.qty}`, naira(i.unit_price_kobo * i.qty))),
    '',
    pad('Subtotal:', naira(order.subtotal_kobo)),
    pad('Shipping:', order.shipping_kobo ? naira(order.shipping_kobo) : 'Free'),
    ...(order.discount_kobo > 0 ? [pad(`Discount${order.discount_code ? ` (${order.discount_code})` : ''}:`, naira(-order.discount_kobo))] : []),
    ...(order.gift_kobo > 0 ? [pad('Paid by gift card:', naira(-order.gift_kobo))] : []),
    pad('Total paid:', naira(total)),
    '',
    shipped ? `Follow your order: ${link}` : `View your order: ${link}`,
    ...(shipped ? [] : ['', 'You’ll receive another email when your order ships.']),
    '', `If you have any questions, visit our Help Centre (${origin}/?page=faq) or contact our support team${contact ? ` at ${contact}` : ''}.`,
    '', 'MASQ.', 'Style. People. Culture.', origin
  ].join('\n');

  return { subject, html, text, link };
}
