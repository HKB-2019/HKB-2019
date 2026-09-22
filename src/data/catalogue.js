/* The shop's catalogue.
 *
 * This is still hard-coded — it moves to the database in the next stage of the
 * build. Keeping the shape close to what a products table will return (id,
 * name, price in minor-unit-free naira, variants) means the swap is a change
 * of source, not a change of every component. */

export const PRODUCTS = [
  { id:'tee',      name:'THE FACE TEE',         price:28000, img:'/assets/img/prod-tee.webp',      sizes:['S','M','L','XL'] },
  { id:'cap',      name:'THE MARK CAP',         price:14000, img:'/assets/img/prod-cap.webp',      sizes:['ONE SIZE'] },
  { id:'backpack', name:'THE CARRIER BACKPACK', price:65000, img:'/assets/img/prod-backpack.webp', sizes:['ONE SIZE'] },
  { id:'scarf',    name:'THE PATTERN SCARF',    price:18000, img:'/assets/img/prod-scarf.webp',    sizes:['ONE SIZE'] },
  // revealed by "VIEW ALL"
  { id:'hoodie',   name:'THE RITUAL HOODIE',    price:52000, img:'/assets/img/ess-hoodie.webp',    sizes:['S','M','L','XL'], extra:true },
  { id:'jacket',   name:'THE SYMBOL JACKET',    price:98000, img:'/assets/img/ess-jacket.webp',    sizes:['M','L','XL'],     extra:true, badge:'LIMITED' },
  { id:'wallet',   name:'THE ARTIFACT WALLET',  price:22000, img:'/assets/img/ess-wallet.webp',    sizes:['ONE SIZE'],       extra:true },
  { id:'phone',    name:'THE MASK CASE',        price:12000, img:'/assets/img/ess-phone.webp',     sizes:['ONE SIZE'],       extra:true, soldOut:true }
];

export const ESSENTIALS = [
  { id:'phone',    name:'THE MASK CASE',        price:12000, img:'/assets/img/ess-phone.webp' },
  { id:'airpods',  name:'THE POD SHELL',        price:9000,  img:'/assets/img/ess-airpods.webp' },
  { id:'wallet',   name:'THE ARTIFACT WALLET',  price:22000, img:'/assets/img/ess-wallet.webp' },
  { id:'hoodie',   name:'THE RITUAL HOODIE',    price:52000, img:'/assets/img/ess-hoodie.webp' },
  { id:'jacket',   name:'THE SYMBOL JACKET',    price:98000, img:'/assets/img/ess-jacket.webp' },
  { id:'cap',      name:'THE MARK CAP',         price:14000, img:'/assets/img/prod-cap.webp' },
  { id:'scarf',    name:'THE PATTERN SCARF',    price:18000, img:'/assets/img/prod-scarf.webp' },
  { id:'backpack', name:'THE CARRIER BACKPACK', price:65000, img:'/assets/img/prod-backpack.webp' }
];

export const CURRENCIES = {
  NGN: { symbol:'₦', rate:1,      decimals:0 },
  USD: { symbol:'$', rate:1/1550, decimals:2 },
  GBP: { symbol:'£', rate:1/1980, decimals:2 },
  EUR: { symbol:'€', rate:1/1690, decimals:2 }
};

export const INFO_COPY = {
  FAQ:      'Sizing, care and drop mechanics. Pieces run true to size; every MASQ. artifact ships with an authenticity card bearing its own mask number.',
  SHIPPING: 'Lagos & Abuja: 1–3 working days. Rest of Nigeria: 3–5 working days. International: 5–10 working days via DHL Express, duties calculated at checkout.',
  RETURNS:  'Unworn pieces may be returned within 14 days of delivery with tags and authenticity card intact. Limited jacket releases are final sale.',
  CONTACT:  'studio@masq.ng · +234 000 0000 · The Studio, 14 Ikoyi Crescent, Lagos. Monday to Friday, 10:00 – 18:00 WAT.'
};
