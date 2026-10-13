/* The catalogue as designed: what an empty database is filled with (server/
 * seed.js), and the sample stock in the preview build. Prices are naira. */

/* A piece sold in colours lists them in `colours`, each with its own counts
 * per size; the first is the colour in its photo. Other pieces have `sizes`.
 *
 * Reproduces the storefront as designed: four featured pieces, four more
 * behind VIEW ALL, and the Essentials carousel as its own selection (the pod
 * shell is carousel-only; the tee is grid-only). */
export const CATALOGUE = [
  { id:'tee',      name:'THE FACE TEE',         naira:28000, img:'assets/img/prod-tee.webp',      drop:1, featured:1, essential:0, colours:[
      { name:'Indigo', hex:'#3d2f9e', sizes:{ S:12, M:18, L:14, XL:6 } },
      { name:'Black',  hex:'#141416', sizes:{ S:8, M:10, L:9, XL:4 } },
      { name:'White',  hex:'#efece6', sizes:{ S:5, M:7, L:6, XL:2 } }
    ] },
  { id:'cap',      name:'THE MARK CAP',         naira:14000, img:'assets/img/prod-cap.webp',      drop:1, featured:1, essential:1, sizes:{ 'ONE SIZE':30 } },
  { id:'backpack', name:'THE CARRIER BACKPACK', naira:65000, img:'assets/img/prod-backpack.webp', drop:1, featured:1, essential:1, sizes:{ 'ONE SIZE':8 } },
  { id:'scarf',    name:'THE PATTERN SCARF',    naira:18000, img:'assets/img/prod-scarf.webp',    drop:1, featured:1, essential:1, sizes:{ 'ONE SIZE':22 } },
  { id:'hoodie',   name:'THE RITUAL HOODIE',    naira:52000, img:'assets/img/ess-hoodie.webp',    drop:1, featured:0, essential:1, colours:[
      { name:'Black',  hex:'#141416', sizes:{ S:5, M:9, L:7, XL:3 } },
      { name:'Indigo', hex:'#3d2f9e', sizes:{ S:3, M:4, L:4, XL:2 } }
    ] },
  { id:'jacket',   name:'THE SYMBOL JACKET',    naira:98000, img:'assets/img/ess-jacket.webp',    drop:1, featured:0, essential:1, sizes:{ M:2, L:3, XL:1 }, badge:'LIMITED' },
  { id:'wallet',   name:'THE ARTIFACT WALLET',  naira:22000, img:'assets/img/ess-wallet.webp',    drop:1, featured:0, essential:1, sizes:{ 'ONE SIZE':16 } },
  { id:'phone',    name:'THE MASK CASE',        naira:12000, img:'assets/img/ess-phone.webp',     drop:1, featured:0, essential:1, sizes:{ 'ONE SIZE':0 } },
  { id:'airpods',  name:'THE POD SHELL',        naira:9000,  img:'assets/img/ess-airpods.webp',   drop:0, featured:0, essential:1, sizes:{ 'ONE SIZE':24 } }
];
