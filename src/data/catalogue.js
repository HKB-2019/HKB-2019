/* The catalogue as designed: what an empty database is filled with (server/
 * seed.js), and the sample stock in the preview build. Prices are naira. */

/* Each piece's place in the Shop and Collections pages (src/data/shop.js):
 * `category`, `type` and `collections`; `isNew` puts NEW on it.
 *
 * A piece sold in colours lists them in `colours`, each with its own counts
 * per size and, if there is one, its own photo; the first is the colour in
 * the main photo. Other pieces have `sizes`. prod-tee-black is the tee's
 * photo recoloured — a stand-in until the real one is shot.
 *
 * Reproduces the storefront as designed: four featured pieces, four more
 * behind VIEW ALL, and the Essentials carousel as its own selection (the pod
 * shell is carousel-only; the tee is grid-only). */
export const CATALOGUE = [
  { id:'tee',      name:'THE FACE TEE',         naira:28000, img:'assets/img/p-tee-1.webp',      drop:1, featured:1, essential:0, category:'tshirts', type:'graphic', collections:['drop-01'], isNew:1, colours:[
      { name:'Indigo', hex:'#3d2f9e', sizes:{ S:12, M:18, L:14, XL:6 } },
      { name:'Black',  hex:'#141416', sizes:{ S:8, M:10, L:9, XL:4 }, img:'assets/img/prod-tee-black.webp' },
      { name:'White',  hex:'#efece6', sizes:{ S:5, M:7, L:6, XL:2 } }
    ] },
  { id:'cap',      name:'THE MARK CAP',         naira:14000, img:'assets/img/d-cap.webp',      drop:1, featured:1, essential:1, category:'headwear', type:'caps', collections:['drop-01', 'essentials'], colours:[
      { name:'Black',  hex:'#141416', sizes:{ 'ONE SIZE':30 } },
      { name:'Green',  hex:'#2f5a3c', sizes:{ 'ONE SIZE':12 } },
      { name:'White',  hex:'#efece6', sizes:{ 'ONE SIZE':10 } }
    ] },
  { id:'backpack', name:'THE CARRIER BACKPACK', naira:65000, img:'assets/img/d-backpack.webp', drop:1, featured:1, essential:1, category:'bags', type:'backpacks', collections:['drop-01', 'essentials'], sizes:{ 'ONE SIZE':8 } },
  { id:'scarf',    name:'THE PATTERN SCARF',    naira:18000, img:'assets/img/d-scarf.webp',    drop:1, featured:1, essential:1, category:'accessories', type:'scarves', collections:['drop-01', 'essentials', 'limited'], sizes:{ 'ONE SIZE':22 } },
  { id:'hoodie',   name:'THE RITUAL HOODIE',    naira:52000, img:'assets/img/ess-hoodie.webp',    drop:1, featured:0, essential:1, category:'outerwear', type:'hoodies', collections:['drop-01', 'essentials'], colours:[
      { name:'Black',  hex:'#141416', sizes:{ S:5, M:9, L:7, XL:3 } },
      { name:'Indigo', hex:'#3d2f9e', sizes:{ S:3, M:4, L:4, XL:2 } }
    ] },
  { id:'jacket',   name:'THE SYMBOL JACKET',    naira:98000, img:'assets/img/ess-jacket.webp',    drop:1, featured:0, essential:1, category:'outerwear', type:'jackets', collections:['drop-01', 'essentials', 'limited'], sizes:{ M:2, L:3, XL:1 }, badge:'LIMITED' },
  { id:'wallet',   name:'THE ARTIFACT WALLET',  naira:22000, img:'assets/img/ess-wallet.webp',    drop:1, featured:0, essential:1, category:'accessories', type:'lifestyle', collections:['drop-01', 'essentials'], sizes:{ 'ONE SIZE':16 } },
  { id:'phone',    name:'THE MASK CASE',        naira:12000, img:'assets/img/d-phone.webp',     drop:1, featured:0, essential:1, category:'accessories', type:'phone-cases', collections:['drop-01', 'essentials'], sizes:{ 'ONE SIZE':0 } },
  { id:'airpods',  name:'THE POD SHELL',        naira:9000,  img:'assets/img/d-airpods.webp',   drop:0, featured:0, essential:1, category:'accessories', type:'lifestyle', collections:['essentials'], sizes:{ 'ONE SIZE':24 } },

  /* The pieces drawn in the owner's Shop and Collections designs (design/
   * category-*.webp, collection-*.webp, shop-all.webp), with the designs' names,
   * prices and colours; `design` marks them. Each photo is cut from its board
   * (assets/img/d-*.webp) until the owner sends the real one. The counts are
   * samples: the owner sets the real ones in the admin. */
  { id:'symbols-tee', name:'THE SYMBOLS TEE', naira:28000, img:'assets/img/d-symbols-tee.webp', drop:0, featured:0, essential:0, category:'tshirts', type:'graphic', collections:[], design:1, colours:[
      { name:'Black', hex:'#141416', sizes:{ S:4, M:6, L:8, XL:10, XXL:12 } },
      { name:'White', hex:'#efece6', sizes:{ S:9, M:11, L:4, XL:6, XXL:8 } },
      { name:'Red', hex:'#d4352c', sizes:{ S:5, M:7, L:9, XL:11, XXL:4 } },
      { name:'Teal', hex:'#1f8a9a', sizes:{ S:10, M:12, L:5, XL:7, XXL:9 } } ] },
  { id:'rituals-tee', name:'THE RITUALS TEE', naira:26000, img:'assets/img/d-rituals-tee.webp', drop:0, featured:0, essential:0, category:'tshirts', type:'graphic', collections:['limited'], design:1, colours:[
      { name:'White', hex:'#efece6', sizes:{ S:7, M:9, L:11, XL:4, XXL:6 } },
      { name:'Black', hex:'#141416', sizes:{ S:12, M:5, L:7, XL:9, XXL:11 } },
      { name:'Violet', hex:'#5a2be0', sizes:{ S:8, M:10, L:12, XL:5, XXL:7 } },
      { name:'Sand', hex:'#d9c3a0', sizes:{ S:4, M:6, L:8, XL:10, XXL:12 } } ] },
  { id:'heritage-tee', name:'THE HERITAGE TEE', naira:28000, img:'assets/img/d-heritage-tee.webp', drop:0, featured:0, essential:0, category:'tshirts', type:'graphic', collections:[], design:1, colours:[
      { name:'Black', hex:'#141416', sizes:{ S:10, M:12, L:5, XL:7, XXL:9 } },
      { name:'Violet', hex:'#5a2be0', sizes:{ S:6, M:8, L:10, XL:12, XXL:5 } },
      { name:'Orange', hex:'#e8892a', sizes:{ S:11, M:4, L:6, XL:8, XXL:10 } } ] },
  { id:'culture-tee', name:'THE CULTURE TEE', naira:28000, img:'assets/img/d-culture-tee.webp', drop:0, featured:0, essential:0, category:'tshirts', type:'graphic', collections:[], design:1, colours:[
      { name:'Violet', hex:'#5a2be0', sizes:{ S:4, M:6, L:8, XL:10, XXL:12 } },
      { name:'Black', hex:'#141416', sizes:{ S:9, M:11, L:4, XL:6, XXL:8 } },
      { name:'White', hex:'#efece6', sizes:{ S:5, M:7, L:9, XL:11, XXL:4 } } ] },
  { id:'essential-tee', name:'THE ESSENTIAL TEE', naira:22000, img:'assets/img/d-essential-tee.webp', drop:0, featured:0, essential:0, category:'tshirts', type:'essential', collections:['essentials'], design:1, colours:[
      { name:'Black', hex:'#141416', sizes:{ S:7, M:9, L:11, XL:4, XXL:6 } },
      { name:'White', hex:'#efece6', sizes:{ S:12, M:5, L:7, XL:9, XXL:11 } },
      { name:'Sage', hex:'#9db59a', sizes:{ S:8, M:10, L:12, XL:5, XXL:7 } } ] },
  { id:'signature-tee', name:'THE SIGNATURE TEE', naira:25000, img:'assets/img/d-signature-tee.webp', drop:0, featured:0, essential:0, category:'tshirts', type:'essential', collections:['essentials'], design:1, colours:[
      { name:'White', hex:'#efece6', sizes:{ S:10, M:12, L:5, XL:7, XXL:9 } },
      { name:'Red', hex:'#d4352c', sizes:{ S:6, M:8, L:10, XL:12, XXL:5 } },
      { name:'Black', hex:'#141416', sizes:{ S:11, M:4, L:6, XL:8, XXL:10 } } ] },
  { id:'night-ritual-tee', name:'THE NIGHT RITUAL TEE', naira:30000, img:'assets/img/d-night-ritual-tee.webp', drop:0, featured:0, essential:0, category:'tshirts', type:'graphic', collections:[], design:1, colours:[
      { name:'Black', hex:'#141416', sizes:{ S:4, M:6, L:8, XL:10, XXL:12 } },
      { name:'Grey', hex:'#8a8a8f', sizes:{ S:9, M:11, L:4, XL:6, XXL:8 } },
      { name:'Violet', hex:'#5a2be0', sizes:{ S:5, M:7, L:9, XL:11, XXL:4 } } ] },
  { id:'tonal-mask-tee', name:'THE TONAL MASK TEE', naira:26000, img:'assets/img/d-tonal-mask-tee.webp', drop:0, featured:0, essential:0, category:'tshirts', type:'essential', collections:['essentials'], design:1, colours:[
      { name:'Black', hex:'#141416', sizes:{ S:7, M:9, L:11, XL:4, XXL:6 } },
      { name:'Charcoal', hex:'#3a3a3f', sizes:{ S:12, M:5, L:7, XL:9, XXL:11 } },
      { name:'White', hex:'#efece6', sizes:{ S:8, M:10, L:12, XL:5, XXL:7 } },
      { name:'Olive', hex:'#7b8a4a', sizes:{ S:4, M:6, L:8, XL:10, XXL:12 } } ] },
  { id:'strip-tee', name:'THE STRIP TEE', naira:26000, img:'assets/img/d-strip-tee.webp', drop:0, featured:0, essential:0, category:'tshirts', type:'graphic', collections:['essentials'], design:1, colours:[
      { name:'Red', hex:'#d4352c', sizes:{ S:10, M:12, L:5, XL:7, XXL:9 } },
      { name:'Blue', hex:'#2a5bd7', sizes:{ S:6, M:8, L:10, XL:12, XXL:5 } },
      { name:'Teal', hex:'#1f8a9a', sizes:{ S:11, M:4, L:6, XL:8, XXL:10 } } ] },
  { id:'collector-tee', name:'THE COLLECTOR TEE', naira:32000, img:'assets/img/d-collector-tee.webp', drop:0, featured:0, essential:0, category:'tshirts', type:'limited', collections:['limited'], design:1, colours:[
      { name:'Charcoal', hex:'#3a3a3f', sizes:{ S:4, M:6, L:8, XL:10, XXL:12 } },
      { name:'Grey', hex:'#8a8a8f', sizes:{ S:9, M:11, L:4, XL:6, XXL:8 } },
      { name:'White', hex:'#efece6', sizes:{ S:5, M:7, L:9, XL:11, XXL:4 } } ] },
  { id:'heritage-cap', name:'THE HERITAGE CAP', naira:14000, img:'assets/img/d-heritage-cap.webp', drop:0, featured:0, essential:0, category:'headwear', type:'caps', collections:[], design:1, colours:[
      { name:'Red', hex:'#d4352c', sizes:{ 'ONE SIZE':7 } },
      { name:'Coral', hex:'#ef6b5b', sizes:{ 'ONE SIZE':12 } },
      { name:'Blue', hex:'#2a5bd7', sizes:{ 'ONE SIZE':8 } },
      { name:'Green', hex:'#3f9a4f', sizes:{ 'ONE SIZE':4 } } ] },
  { id:'symbols-cap', name:'THE SYMBOLS CAP', naira:14000, img:'assets/img/d-symbols-cap.webp', drop:0, featured:0, essential:0, category:'headwear', type:'caps', collections:[], design:1, colours:[
      { name:'White', hex:'#efece6', sizes:{ 'ONE SIZE':10 } },
      { name:'Grey', hex:'#8a8a8f', sizes:{ 'ONE SIZE':6 } },
      { name:'Charcoal', hex:'#3a3a3f', sizes:{ 'ONE SIZE':11 } } ] },
  { id:'rituals-cap', name:'THE RITUALS CAP', naira:14000, img:'assets/img/d-rituals-cap.webp', drop:0, featured:0, essential:0, category:'headwear', type:'caps', collections:[], design:1, colours:[
      { name:'Violet', hex:'#5a2be0', sizes:{ 'ONE SIZE':4 } },
      { name:'Orange', hex:'#e8892a', sizes:{ 'ONE SIZE':9 } },
      { name:'Sky', hex:'#9cc3e6', sizes:{ 'ONE SIZE':5 } } ] },
  { id:'vision-bucket-hat', name:'THE VISION BUCKET HAT', naira:18000, img:'assets/img/d-vision-bucket-hat.webp', drop:0, featured:0, essential:0, category:'headwear', type:'bucket-hats', collections:[], design:1, colours:[
      { name:'Violet', hex:'#5a2be0', sizes:{ 'ONE SIZE':7 } },
      { name:'Black', hex:'#141416', sizes:{ 'ONE SIZE':12 } },
      { name:'White', hex:'#efece6', sizes:{ 'ONE SIZE':8 } } ] },
  { id:'culture-bucket-hat', name:'THE CULTURE BUCKET HAT', naira:18000, img:'assets/img/d-culture-bucket-hat.webp', drop:0, featured:0, essential:0, category:'headwear', type:'bucket-hats', collections:[], design:1, colours:[
      { name:'Orange', hex:'#e8892a', sizes:{ 'ONE SIZE':10 } },
      { name:'Blue', hex:'#2a5bd7', sizes:{ 'ONE SIZE':6 } },
      { name:'Black', hex:'#141416', sizes:{ 'ONE SIZE':11 } } ] },
  { id:'masq-beanie', name:'THE MASQ. BEANIE', naira:12000, img:'assets/img/d-masq-beanie.webp', drop:0, featured:0, essential:0, category:'headwear', type:'beanies', collections:[], design:1, colours:[
      { name:'Black', hex:'#141416', sizes:{ 'ONE SIZE':4 } },
      { name:'Grey', hex:'#8a8a8f', sizes:{ 'ONE SIZE':9 } },
      { name:'Lilac', hex:'#b9a8e8', sizes:{ 'ONE SIZE':5 } } ] },
  { id:'unity-cap', name:'THE UNITY CAP', naira:14000, img:'assets/img/d-unity-cap.webp', drop:0, featured:0, essential:0, category:'headwear', type:'caps', collections:[], design:1, colours:[
      { name:'Green', hex:'#3f9a4f', sizes:{ 'ONE SIZE':7 } },
      { name:'Pink', hex:'#e98aa6', sizes:{ 'ONE SIZE':12 } },
      { name:'Red', hex:'#d4352c', sizes:{ 'ONE SIZE':8 } },
      { name:'White', hex:'#efece6', sizes:{ 'ONE SIZE':4 } } ] },
  { id:'tonal-cap', name:'THE TONAL CAP', naira:16000, img:'assets/img/d-tonal-cap.webp', drop:0, featured:0, essential:0, category:'headwear', type:'caps', collections:['essentials'], design:1, colours:[
      { name:'Black', hex:'#141416', sizes:{ 'ONE SIZE':10 } },
      { name:'Charcoal', hex:'#3a3a3f', sizes:{ 'ONE SIZE':6 } },
      { name:'Grey', hex:'#8a8a8f', sizes:{ 'ONE SIZE':11 } },
      { name:'White', hex:'#efece6', sizes:{ 'ONE SIZE':7 } } ] },
  { id:'bucket-hat', name:'THE BUCKET HAT', naira:18000, img:'assets/img/d-bucket-hat.webp', drop:0, featured:0, essential:0, category:'headwear', type:'bucket-hats', collections:['essentials'], design:1, colours:[
      { name:'Red', hex:'#d4352c', sizes:{ 'ONE SIZE':4 } },
      { name:'White', hex:'#efece6', sizes:{ 'ONE SIZE':9 } },
      { name:'Sky', hex:'#9cc3e6', sizes:{ 'ONE SIZE':5 } } ] },
  { id:'symbol-cap', name:'THE SYMBOL CAP', naira:18000, img:'assets/img/d-symbol-cap.webp', drop:0, featured:0, essential:0, category:'headwear', type:'caps', collections:['limited'], design:1, colours:[
      { name:'Violet', hex:'#5a2be0', sizes:{ 'ONE SIZE':7 } },
      { name:'Black', hex:'#141416', sizes:{ 'ONE SIZE':12 } },
      { name:'Lilac', hex:'#b9a8e8', sizes:{ 'ONE SIZE':8 } } ] },
  { id:'archive-bucket-hat', name:'THE ARCHIVE BUCKET HAT', naira:20000, img:'assets/img/d-archive-bucket-hat.webp', drop:0, featured:0, essential:0, category:'headwear', type:'bucket-hats', collections:['limited'], design:1, colours:[
      { name:'Black', hex:'#141416', sizes:{ 'ONE SIZE':10 } },
      { name:'Grey', hex:'#8a8a8f', sizes:{ 'ONE SIZE':6 } },
      { name:'White', hex:'#efece6', sizes:{ 'ONE SIZE':11 } } ] },
  { id:'urban-rituals-backpack', name:'THE URBAN RITUALS BACKPACK', naira:75000, img:'assets/img/d-urban-rituals-backpack.webp', drop:0, featured:0, essential:0, category:'bags', type:'backpacks', collections:[], design:1, colours:[
      { name:'Violet', hex:'#5a2be0', sizes:{ 'ONE SIZE':4 } },
      { name:'Peach', hex:'#f0b38f', sizes:{ 'ONE SIZE':9 } },
      { name:'Black', hex:'#141416', sizes:{ 'ONE SIZE':5 } } ] },
  { id:'essential-crossbody', name:'THE ESSENTIAL CROSSBODY', naira:48000, img:'assets/img/d-essential-crossbody.webp', drop:0, featured:0, essential:0, category:'bags', type:'crossbody', collections:['essentials'], design:1, colours:[
      { name:'Red', hex:'#d4352c', sizes:{ 'ONE SIZE':7 } },
      { name:'Teal', hex:'#1f8a9a', sizes:{ 'ONE SIZE':12 } },
      { name:'Violet', hex:'#5a2be0', sizes:{ 'ONE SIZE':8 } } ] },
  { id:'heritage-tote', name:'THE HERITAGE TOTE', naira:52000, img:'assets/img/d-heritage-tote.webp', drop:0, featured:0, essential:0, category:'bags', type:'tote', collections:[], design:1, colours:[
      { name:'Blue', hex:'#2a5bd7', sizes:{ 'ONE SIZE':10 } },
      { name:'Tan', hex:'#c19a6b', sizes:{ 'ONE SIZE':6 } },
      { name:'White', hex:'#efece6', sizes:{ 'ONE SIZE':11 } } ] },
  { id:'monochrome-backpack', name:'THE MONOCHROME BACKPACK', naira:68000, img:'assets/img/d-monochrome-backpack.webp', drop:0, featured:0, essential:0, category:'bags', type:'backpacks', collections:[], design:1, colours:[
      { name:'Blue', hex:'#2a5bd7', sizes:{ 'ONE SIZE':4 } },
      { name:'Red', hex:'#d4352c', sizes:{ 'ONE SIZE':9 } },
      { name:'White', hex:'#efece6', sizes:{ 'ONE SIZE':5 } } ] },
  { id:'pattern-crossbody', name:'THE PATTERN CROSSBODY', naira:55000, img:'assets/img/d-pattern-crossbody.webp', drop:0, featured:0, essential:0, category:'bags', type:'crossbody', collections:[], design:1, colours:[
      { name:'Gold', hex:'#c99a2e', sizes:{ 'ONE SIZE':7 } },
      { name:'White', hex:'#efece6', sizes:{ 'ONE SIZE':12 } },
      { name:'Black', hex:'#141416', sizes:{ 'ONE SIZE':8 } } ] },
  { id:'canvas-tote', name:'THE CANVAS TOTE', naira:45000, img:'assets/img/d-canvas-tote.webp', drop:0, featured:0, essential:0, category:'bags', type:'tote', collections:[], design:1, colours:[
      { name:'Red', hex:'#d4352c', sizes:{ 'ONE SIZE':10 } },
      { name:'Black', hex:'#141416', sizes:{ 'ONE SIZE':6 } },
      { name:'White', hex:'#efece6', sizes:{ 'ONE SIZE':11 } } ] },
  { id:'travel-duffle', name:'THE TRAVEL DUFFLE', naira:80000, img:'assets/img/d-travel-duffle.webp', drop:0, featured:0, essential:0, category:'bags', type:'', collections:[], design:1, colours:[
      { name:'White', hex:'#efece6', sizes:{ 'ONE SIZE':4 } },
      { name:'Black', hex:'#141416', sizes:{ 'ONE SIZE':9 } },
      { name:'Pink', hex:'#e98aa6', sizes:{ 'ONE SIZE':5 } } ] },
  { id:'urban-sling-bag', name:'THE URBAN SLING BAG', naira:28000, img:'assets/img/d-urban-sling-bag.webp', drop:1, featured:0, essential:0, category:'bags', type:'crossbody', collections:['drop-01', 'essentials'], design:1, colours:[
      { name:'Navy', hex:'#1b2340', sizes:{ 'ONE SIZE':7 } },
      { name:'Gold', hex:'#c99a2e', sizes:{ 'ONE SIZE':12 } },
      { name:'Blue', hex:'#2a5bd7', sizes:{ 'ONE SIZE':8 } } ] },
  { id:'cultural-sling-bag', name:'THE CULTURAL SLING BAG', naira:32000, img:'assets/img/d-cultural-sling-bag.webp', drop:0, featured:0, essential:0, category:'bags', type:'crossbody', collections:['limited'], design:1, colours:[
      { name:'Blue', hex:'#2a5bd7', sizes:{ 'ONE SIZE':10 } },
      { name:'Orange', hex:'#e8892a', sizes:{ 'ONE SIZE':6 } },
      { name:'Grey', hex:'#8a8a8f', sizes:{ 'ONE SIZE':11 } } ] },
  { id:'classic-hoodie', name:'THE CLASSIC HOODIE', naira:45000, img:'assets/img/d-classic-hoodie.webp', drop:1, featured:0, essential:0, category:'outerwear', type:'hoodies', collections:['drop-01', 'essentials'], design:1, colours:[
      { name:'Black', hex:'#141416', sizes:{ S:4, M:6, L:8, XL:10, XXL:12 } },
      { name:'Violet', hex:'#5a2be0', sizes:{ S:9, M:11, L:4, XL:6, XXL:8 } },
      { name:'Lilac', hex:'#b9a8e8', sizes:{ S:5, M:7, L:9, XL:11, XXL:4 } },
      { name:'Grey', hex:'#8a8a8f', sizes:{ S:10, M:12, L:5, XL:7, XXL:9 } } ] },
  { id:'bomber-jacket', name:'THE BOMBER JACKET', naira:75000, img:'assets/img/d-bomber-jacket.webp', drop:1, featured:0, essential:0, category:'outerwear', type:'jackets', collections:['drop-01', 'essentials'], design:1, colours:[
      { name:'Charcoal', hex:'#3a3a3f', sizes:{ S:7, M:9, L:11, XL:4, XXL:6 } },
      { name:'Blue', hex:'#2a5bd7', sizes:{ S:12, M:5, L:7, XL:9, XXL:11 } },
      { name:'Olive', hex:'#7b8a4a', sizes:{ S:8, M:10, L:12, XL:5, XXL:7 } } ] },
  { id:'harrington-jacket', name:'THE HARRINGTON JACKET', naira:68000, img:'assets/img/d-harrington-jacket.webp', drop:0, featured:0, essential:0, category:'outerwear', type:'jackets', collections:[], design:1, colours:[
      { name:'Blue', hex:'#2a5bd7', sizes:{ S:10, M:12, L:5, XL:7, XXL:9 } },
      { name:'Tan', hex:'#c19a6b', sizes:{ S:6, M:8, L:10, XL:12, XXL:5 } },
      { name:'Grey', hex:'#8a8a8f', sizes:{ S:11, M:4, L:6, XL:8, XXL:10 } } ] },
  { id:'windbreaker', name:'THE WINDBREAKER', naira:62000, img:'assets/img/d-windbreaker.webp', drop:0, featured:0, essential:0, category:'outerwear', type:'jackets', collections:[], design:1, colours:[
      { name:'Black', hex:'#141416', sizes:{ S:4, M:6, L:8, XL:10, XXL:12 } },
      { name:'Red', hex:'#d4352c', sizes:{ S:9, M:11, L:4, XL:6, XXL:8 } },
      { name:'Olive', hex:'#7b8a4a', sizes:{ S:5, M:7, L:9, XL:11, XXL:4 } } ] },
  { id:'varsity-jacket', name:'THE VARSITY JACKET', naira:88000, img:'assets/img/d-varsity-jacket.webp', drop:0, featured:0, essential:0, category:'outerwear', type:'jackets', collections:[], design:1, colours:[
      { name:'Black', hex:'#141416', sizes:{ S:7, M:9, L:11, XL:4, XXL:6 } },
      { name:'White', hex:'#efece6', sizes:{ S:12, M:5, L:7, XL:9, XXL:11 } },
      { name:'Red', hex:'#d4352c', sizes:{ S:8, M:10, L:12, XL:5, XXL:7 } } ] },
  { id:'anorak-jacket', name:'THE ANORAK JACKET', naira:70000, img:'assets/img/d-anorak-jacket.webp', drop:0, featured:0, essential:0, category:'outerwear', type:'jackets', collections:[], design:1, colours:[
      { name:'Black', hex:'#141416', sizes:{ S:10, M:12, L:5, XL:7, XXL:9 } },
      { name:'Tan', hex:'#c19a6b', sizes:{ S:6, M:8, L:10, XL:12, XXL:5 } },
      { name:'Olive', hex:'#7b8a4a', sizes:{ S:11, M:4, L:6, XL:8, XXL:10 } } ] },
  { id:'pattern-hoodie', name:'THE PATTERN HOODIE', naira:52000, img:'assets/img/d-pattern-hoodie.webp', drop:0, featured:0, essential:0, category:'outerwear', type:'hoodies', collections:['essentials'], design:1, colours:[
      { name:'Violet', hex:'#5a2be0', sizes:{ S:4, M:6, L:8, XL:10, XXL:12 } },
      { name:'Blue', hex:'#2a5bd7', sizes:{ S:9, M:11, L:4, XL:6, XXL:8 } },
      { name:'Orange', hex:'#e8892a', sizes:{ S:5, M:7, L:9, XL:11, XXL:4 } } ] },
  { id:'padded-vest', name:'THE PADDED VEST', naira:48000, img:'assets/img/d-padded-vest.webp', drop:0, featured:0, essential:0, category:'outerwear', type:'layered', collections:[], design:1, colours:[
      { name:'Black', hex:'#141416', sizes:{ S:7, M:9, L:11, XL:4, XXL:6 } },
      { name:'Grey', hex:'#8a8a8f', sizes:{ S:12, M:5, L:7, XL:9, XXL:11 } },
      { name:'Olive', hex:'#7b8a4a', sizes:{ S:8, M:10, L:12, XL:5, XXL:7 } } ] },
  { id:'minimal-hoodie', name:'THE MINIMAL HOODIE', naira:42000, img:'assets/img/d-minimal-hoodie.webp', drop:0, featured:0, essential:0, category:'outerwear', type:'hoodies', collections:['essentials'], design:1, colours:[
      { name:'Charcoal', hex:'#3a3a3f', sizes:{ S:10, M:12, L:5, XL:7, XXL:9 } },
      { name:'Grey', hex:'#8a8a8f', sizes:{ S:6, M:8, L:10, XL:12, XXL:5 } },
      { name:'White', hex:'#efece6', sizes:{ S:11, M:4, L:6, XL:8, XXL:10 } } ] },
  { id:'heritage-bomber', name:'THE HERITAGE BOMBER', naira:85000, img:'assets/img/d-heritage-bomber.webp', drop:0, featured:0, essential:0, category:'outerwear', type:'jackets', collections:['limited'], design:1, colours:[
      { name:'Charcoal', hex:'#3a3a3f', sizes:{ S:4, M:6, L:8, XL:10, XXL:12 } },
      { name:'Blue', hex:'#2a5bd7', sizes:{ S:9, M:11, L:4, XL:6, XXL:8 } },
      { name:'Olive', hex:'#7b8a4a', sizes:{ S:5, M:7, L:9, XL:11, XXL:4 } } ] },
  { id:'ancestral-hoodie', name:'THE ANCESTRAL HOODIE', naira:70000, img:'assets/img/d-ancestral-hoodie.webp', drop:0, featured:0, essential:0, category:'outerwear', type:'hoodies', collections:['limited'], design:1, colours:[
      { name:'Charcoal', hex:'#3a3a3f', sizes:{ S:7, M:9, L:11, XL:4, XXL:6 } },
      { name:'Grey', hex:'#8a8a8f', sizes:{ S:12, M:5, L:7, XL:9, XXL:11 } },
      { name:'Violet', hex:'#5a2be0', sizes:{ S:8, M:10, L:12, XL:5, XXL:7 } } ] },
  { id:'origins-jacket', name:'THE ORIGINS JACKET', naira:95000, img:'assets/img/d-origins-jacket.webp', drop:0, featured:0, essential:0, category:'outerwear', type:'jackets', collections:['limited'], design:1, colours:[
      { name:'Black', hex:'#141416', sizes:{ S:10, M:12, L:5, XL:7, XXL:9 } },
      { name:'Red', hex:'#d4352c', sizes:{ S:6, M:8, L:10, XL:12, XXL:5 } },
      { name:'Olive', hex:'#7b8a4a', sizes:{ S:11, M:4, L:6, XL:8, XXL:10 } } ] },
  { id:'run-culture-hoodie', name:'THE RUN CULTURE HOODIE', naira:75000, img:'assets/img/d-run-culture-hoodie.webp', drop:0, featured:0, essential:0, category:'outerwear', type:'hoodies', collections:['limited'], design:1, colours:[
      { name:'Violet', hex:'#5a2be0', sizes:{ S:4, M:6, L:8, XL:10, XXL:12 } },
      { name:'Blue', hex:'#2a5bd7', sizes:{ S:9, M:11, L:4, XL:6, XXL:8 } },
      { name:'Orange', hex:'#e8892a', sizes:{ S:5, M:7, L:9, XL:11, XXL:4 } } ] },
  { id:'card-wallet', name:'THE CARD WALLET', naira:16000, img:'assets/img/d-card-wallet.webp', drop:0, featured:0, essential:0, category:'accessories', type:'lifestyle', collections:[], design:1, colours:[
      { name:'Lilac', hex:'#b9a8e8', sizes:{ 'ONE SIZE':7 } },
      { name:'White', hex:'#efece6', sizes:{ 'ONE SIZE':12 } },
      { name:'Black', hex:'#141416', sizes:{ 'ONE SIZE':8 } } ] },
  { id:'keychain', name:'THE KEYCHAIN', naira:8000, img:'assets/img/d-keychain.webp', drop:1, featured:0, essential:0, category:'accessories', type:'lifestyle', collections:['drop-01'], design:1, colours:[
      { name:'Red', hex:'#d4352c', sizes:{ 'ONE SIZE':10 } },
      { name:'White', hex:'#efece6', sizes:{ 'ONE SIZE':6 } },
      { name:'Blue', hex:'#2a5bd7', sizes:{ 'ONE SIZE':11 } },
      { name:'Gold', hex:'#c99a2e', sizes:{ 'ONE SIZE':7 } } ] },
  { id:'stainless-bottle', name:'THE STAINLESS BOTTLE', naira:18000, img:'assets/img/d-stainless-bottle.webp', drop:0, featured:0, essential:0, category:'accessories', type:'lifestyle', collections:[], design:1, colours:[
      { name:'Red', hex:'#d4352c', sizes:{ 'ONE SIZE':4 } },
      { name:'Pink', hex:'#e98aa6', sizes:{ 'ONE SIZE':9 } },
      { name:'Maroon', hex:'#6b1f2b', sizes:{ 'ONE SIZE':5 } } ] },
  { id:'sunglasses', name:'THE SUNGLASSES', naira:24000, img:'assets/img/d-sunglasses.webp', drop:0, featured:0, essential:0, category:'accessories', type:'lifestyle', collections:[], design:1, colours:[
      { name:'Violet', hex:'#5a2be0', sizes:{ 'ONE SIZE':7 } },
      { name:'White', hex:'#efece6', sizes:{ 'ONE SIZE':12 } },
      { name:'Blue', hex:'#2a5bd7', sizes:{ 'ONE SIZE':8 } } ] },
  { id:'lanyard', name:'THE LANYARD', naira:9000, img:'assets/img/d-lanyard.webp', drop:0, featured:0, essential:0, category:'accessories', type:'lifestyle', collections:[], design:1, colours:[
      { name:'White', hex:'#efece6', sizes:{ 'ONE SIZE':10 } },
      { name:'Maroon', hex:'#6b1f2b', sizes:{ 'ONE SIZE':6 } },
      { name:'Black', hex:'#141416', sizes:{ 'ONE SIZE':11 } } ] },
  { id:'socks', name:'THE SOCKS', naira:7000, img:'assets/img/d-socks.webp', drop:0, featured:0, essential:0, category:'accessories', type:'lifestyle', collections:[], design:1, colours:[
      { name:'Brown', hex:'#6b4a33', sizes:{ 'ONE SIZE':4 } },
      { name:'White', hex:'#efece6', sizes:{ 'ONE SIZE':9 } },
      { name:'Grey', hex:'#8a8a8f', sizes:{ 'ONE SIZE':5 } } ] },
  { id:'laptop-sleeve', name:'THE LAPTOP SLEEVE', naira:22000, img:'assets/img/d-laptop-sleeve.webp', drop:0, featured:0, essential:0, category:'accessories', type:'lifestyle', collections:[], design:1, colours:[
      { name:'Violet', hex:'#5a2be0', sizes:{ 'ONE SIZE':7 } },
      { name:'Tan', hex:'#c19a6b', sizes:{ 'ONE SIZE':12 } },
      { name:'Lilac', hex:'#b9a8e8', sizes:{ 'ONE SIZE':8 } } ] },
  { id:'mask-phone-case', name:'THE MASK PHONE CASE', naira:15000, img:'assets/img/d-mask-phone-case.webp', drop:0, featured:0, essential:0, category:'accessories', type:'phone-cases', collections:['limited'], design:1, colours:[
      { name:'Violet', hex:'#5a2be0', sizes:{ 'ONE SIZE':10 } },
      { name:'White', hex:'#efece6', sizes:{ 'ONE SIZE':6 } },
      { name:'Grey', hex:'#8a8a8f', sizes:{ 'ONE SIZE':11 } } ] },
  { id:'totem-keychain', name:'THE TOTEM KEYCHAIN', naira:9000, img:'assets/img/d-totem-keychain.webp', drop:0, featured:0, essential:0, category:'accessories', type:'lifestyle', collections:['limited'], design:1, colours:[
      { name:'Red', hex:'#d4352c', sizes:{ 'ONE SIZE':4 } },
      { name:'Sky', hex:'#9cc3e6', sizes:{ 'ONE SIZE':9 } },
      { name:'Black', hex:'#141416', sizes:{ 'ONE SIZE':5 } } ] }
];
