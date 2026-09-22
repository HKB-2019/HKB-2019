/* ==========================================================================
   MASQ. — interaction layer
   ========================================================================== */
(function () {
  'use strict';

  const $  = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  /* ---------------------------------------------------------------- data */

  const PRODUCTS = [
    { id:'tee',      name:'THE FACE TEE',        price:28000, img:'assets/img/prod-tee.webp',       sizes:['S','M','L','XL'] },
    { id:'cap',      name:'THE MARK CAP',        price:14000, img:'assets/img/prod-cap.webp',       sizes:['ONE SIZE'] },
    { id:'backpack', name:'THE CARRIER BACKPACK',price:65000, img:'assets/img/prod-backpack.webp',  sizes:['ONE SIZE'] },
    { id:'scarf',    name:'THE PATTERN SCARF',   price:18000, img:'assets/img/prod-scarf.webp',     sizes:['ONE SIZE'] },
    // revealed by "VIEW ALL"
    { id:'hoodie',   name:'THE RITUAL HOODIE',   price:52000, img:'assets/img/ess-hoodie.webp',     sizes:['S','M','L','XL'], extra:true },
    { id:'jacket',   name:'THE SYMBOL JACKET',   price:98000, img:'assets/img/ess-jacket.webp',     sizes:['M','L','XL'],     extra:true, badge:'LIMITED' },
    { id:'wallet',   name:'THE ARTIFACT WALLET', price:22000, img:'assets/img/ess-wallet.webp',     sizes:['ONE SIZE'],       extra:true },
    { id:'phone',    name:'THE MASK CASE',       price:12000, img:'assets/img/ess-phone.webp',      sizes:['ONE SIZE'],       extra:true, soldOut:true }
  ];

  const ESSENTIALS = [
    { id:'phone',   name:'THE MASK CASE',       price:12000, img:'assets/img/ess-phone.webp' },
    { id:'airpods', name:'THE POD SHELL',       price:9000,  img:'assets/img/ess-airpods.webp' },
    { id:'wallet',  name:'THE ARTIFACT WALLET', price:22000, img:'assets/img/ess-wallet.webp' },
    { id:'hoodie',  name:'THE RITUAL HOODIE',   price:52000, img:'assets/img/ess-hoodie.webp' },
    { id:'jacket',  name:'THE SYMBOL JACKET',   price:98000, img:'assets/img/ess-jacket.webp' },
    { id:'cap',     name:'THE MARK CAP',        price:14000, img:'assets/img/prod-cap.webp' },
    { id:'scarf',   name:'THE PATTERN SCARF',   price:18000, img:'assets/img/prod-scarf.webp' },
    { id:'backpack',name:'THE CARRIER BACKPACK',price:65000, img:'assets/img/prod-backpack.webp' }
  ];

  const CURRENCIES = {
    NGN: { symbol:'₦', rate:1,        decimals:0 },
    USD: { symbol:'$', rate:1/1550,   decimals:2 },
    GBP: { symbol:'£', rate:1/1980,   decimals:2 },
    EUR: { symbol:'€', rate:1/1690,   decimals:2 }
  };

  const INFO_COPY = {
    FAQ:      'Sizing, care and drop mechanics. Pieces run true to size; every MASQ. artifact ships with an authenticity card bearing its own mask number.',
    SHIPPING: 'Lagos & Abuja: 1–3 working days. Rest of Nigeria: 3–5 working days. International: 5–10 working days via DHL Express, duties calculated at checkout.',
    RETURNS:  'Unworn pieces may be returned within 14 days of delivery with tags and authenticity card intact. Limited jacket releases are final sale.',
    CONTACT:  'studio@masq.ng · +234 000 0000 · The Studio, 14 Ikoyi Crescent, Lagos. Monday to Friday, 10:00 – 18:00 WAT.'
  };

  /* ------------------------------------------------------------- currency */

  let currency = load('masq:currency', 'NGN');

  function formatPrice(ngn) {
    const c = CURRENCIES[currency] || CURRENCIES.NGN;
    const value = ngn * c.rate;
    return c.symbol + value.toLocaleString('en-US', {
      minimumFractionDigits: c.decimals,
      maximumFractionDigits: c.decimals
    });
  }

  function repriceAll() {
    $$('[data-ngn]').forEach(el => { el.textContent = formatPrice(Number(el.dataset.ngn)); });
    renderCart();
  }

  /* --------------------------------------------------------- storage util */

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }

  /* ---------------------------------------------------------------- toast */

  const toastWrap = $('#toastWrap');

  function toast(message, variant) {
    const el = document.createElement('div');
    el.className = 'toast' + (variant ? ' toast--' + variant : '');
    el.textContent = message;
    toastWrap.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-out');
      el.addEventListener('animationend', () => el.remove(), { once:true });
    }, 2600);
  }

  /* ------------------------------------------------------- overlay system */

  const scrim = $('#scrim');
  let activeOverlay = null;
  let lastFocused = null;

  function openOverlay(el) {
    if (activeOverlay) closeOverlay();
    lastFocused = document.activeElement;
    activeOverlay = el;
    el.hidden = false;
    scrim.hidden = false;
    document.body.classList.add('is-locked');
    requestAnimationFrame(() => {
      scrim.classList.add('is-open');
      el.classList.add('is-open');
      const target = el.querySelector('input, button:not([data-close])') || el.querySelector('[data-close]');
      if (target) target.focus({ preventScroll:true });
    });
  }

  function closeOverlay() {
    const el = activeOverlay;
    if (!el) return;
    activeOverlay = null;
    el.classList.remove('is-open');
    scrim.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    const done = () => { el.hidden = true; scrim.hidden = true; };
    setTimeout(done, 450);
    if (lastFocused && lastFocused.focus) lastFocused.focus({ preventScroll:true });
  }

  scrim.addEventListener('click', closeOverlay);
  document.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) closeOverlay();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (activeOverlay) { closeOverlay(); return; }
      if (currencyWrap.classList.contains('is-open')) closeCurrency();
    }
    if (e.key === 'Tab' && activeOverlay) trapFocus(e, activeOverlay);
  });

  function trapFocus(e, root) {
    const items = $$('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', root)
      .filter(el => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ----------------------------------------------------------------- cart */

  let cart = load('masq:cart', []);

  const cartCountEl = $('#cartCount');
  const bagCountEl  = $('#bagCount');
  const cartItemsEl = $('#cartItems');
  const subtotalEl  = $('#cartSubtotal');

  function cartQty() { return cart.reduce((n, i) => n + i.qty, 0); }

  function addToCart(product, size) {
    const key = product.id + '|' + size;
    const existing = cart.find(i => i.key === key);
    if (existing) existing.qty += 1;
    else cart.push({ key, id:product.id, name:product.name, price:product.price, img:product.img, size, qty:1 });
    persistCart();
    bumpCount();
    toast(product.name + ' ADDED TO BAG', 'violet');
  }

  function changeQty(key, delta) {
    const item = cart.find(i => i.key === key);
    if (!item) return;
    item.qty += delta;
    if (item.qty < 1) cart = cart.filter(i => i.key !== key);
    persistCart();
  }

  function removeItem(key) {
    cart = cart.filter(i => i.key !== key);
    persistCart();
    toast('REMOVED FROM BAG');
  }

  function persistCart() {
    save('masq:cart', cart);
    renderCart();
  }

  function bumpCount() {
    cartCountEl.classList.add('is-bump');
    setTimeout(() => cartCountEl.classList.remove('is-bump'), 320);
  }

  function renderCart() {
    const qty = cartQty();
    cartCountEl.textContent = qty;
    bagCountEl.textContent = '(' + qty + ')';

    if (!cart.length) {
      cartItemsEl.innerHTML =
        '<div class="empty"><p>YOUR BAG IS EMPTY</p>' +
        '<button class="btn btn--ghost" id="emptyShop">SHOP DROP 01</button></div>';
      subtotalEl.textContent = formatPrice(0);
      return;
    }

    cartItemsEl.innerHTML = cart.map(item => `
      <article class="line-item">
        <img class="line-item__img" src="${item.img}" alt="${item.name}">
        <div>
          <h3 class="line-item__name">${item.name}</h3>
          <p class="line-item__variant">SIZE ${item.size}</p>
          <p class="line-item__price" data-ngn="${item.price * item.qty}">${formatPrice(item.price * item.qty)}</p>
          <div class="qty">
            <button data-qty="-1" data-key="${item.key}" aria-label="Decrease quantity of ${item.name}">−</button>
            <span>${item.qty}</span>
            <button data-qty="1" data-key="${item.key}" aria-label="Increase quantity of ${item.name}">+</button>
          </div>
        </div>
        <button class="line-item__remove" data-remove="${item.key}">REMOVE</button>
      </article>`).join('');

    const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
    subtotalEl.textContent = formatPrice(total);
  }

  cartItemsEl.addEventListener('click', e => {
    const qtyBtn = e.target.closest('[data-qty]');
    if (qtyBtn) { changeQty(qtyBtn.dataset.key, Number(qtyBtn.dataset.qty)); return; }
    const rm = e.target.closest('[data-remove]');
    if (rm) { removeItem(rm.dataset.remove); return; }
    if (e.target.closest('#emptyShop')) { closeOverlay(); scrollToId('#drop'); }
  });

  $('#cartBtn').addEventListener('click', () => openOverlay($('#cartDrawer')));

  $('#checkoutBtn').addEventListener('click', function () {
    if (!cart.length) { toast('YOUR BAG IS EMPTY'); return; }
    const btn = this;
    btn.disabled = true;
    btn.textContent = 'PROCESSING…';
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'CHECKOUT';
      closeOverlay();
      toast('CHECKOUT IS A DEMO — NOTHING WAS CHARGED', 'violet');
    }, 1100);
  });

  /* ------------------------------------------------------- product render */

  let showAll = false;

  function cardHTML(p) {
    const wished = wishlist.includes(p.id);
    const sizes = p.soldOut
      ? '<button disabled>SOLD OUT</button>'
      : p.sizes.map(s => `<button data-size="${s}" data-id="${p.id}">${s}</button>`).join('');

    return `
      <article class="card" data-card="${p.id}" style="animation-delay:${Math.random() * 0.12}s">
        <div class="card__media">
          <img src="${p.img}" alt="${p.name}" loading="lazy">
          ${p.badge ? `<span class="card__badge">${p.badge}</span>` : ''}
          <button class="card__fav${wished ? ' is-on' : ''}" data-fav="${p.id}" aria-label="Save ${p.name}" aria-pressed="${wished}">
            <svg viewBox="0 0 20 18" aria-hidden="true"><path d="M10 16.5 2.9 9.6a4.3 4.3 0 0 1 6.1-6.1l1 1 1-1a4.3 4.3 0 0 1 6.1 6.1z" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>
          </button>
          <button class="card__quick" data-quick="${p.id}">${p.soldOut ? 'SOLD OUT' : 'QUICK ADD'}</button>
          <div class="card__sizes">${sizes}</div>
        </div>
        <h3 class="card__name">${p.name}</h3>
        <p class="card__price${p.soldOut ? ' card__sold' : ''}" data-ngn="${p.price}">${formatPrice(p.price)}</p>
      </article>`;
  }

  const grid = $('#productGrid');

  function renderGrid() {
    const list = showAll ? PRODUCTS : PRODUCTS.filter(p => !p.extra);
    grid.innerHTML = list.map(cardHTML).join('');
  }

  grid.addEventListener('click', e => {
    const fav = e.target.closest('[data-fav]');
    if (fav) { toggleWish(fav.dataset.fav, fav); return; }

    const quick = e.target.closest('[data-quick]');
    if (quick) {
      const product = PRODUCTS.find(p => p.id === quick.dataset.quick);
      if (product.soldOut) { toast('SOLD OUT — JOIN THE LIST FOR RESTOCKS'); return; }
      const card = quick.closest('.card');
      const wasOpen = card.classList.contains('is-picking');
      $$('.card.is-picking', grid).forEach(c => c.classList.remove('is-picking'));
      card.classList.toggle('is-picking', !wasOpen);
      return;
    }

    const sizeBtn = e.target.closest('[data-size]');
    if (sizeBtn) {
      const product = PRODUCTS.find(p => p.id === sizeBtn.dataset.id);
      addToCart(product, sizeBtn.dataset.size);
      sizeBtn.closest('.card').classList.remove('is-picking');
    }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.card')) {
      $$('.card.is-picking').forEach(c => c.classList.remove('is-picking'));
    }
  });

  /* ------------------------------------------------------------- wishlist */

  let wishlist = load('masq:wishlist', []);

  function toggleWish(id, btn) {
    const on = wishlist.includes(id);
    wishlist = on ? wishlist.filter(w => w !== id) : wishlist.concat(id);
    save('masq:wishlist', wishlist);
    btn.classList.toggle('is-on', !on);
    btn.setAttribute('aria-pressed', String(!on));
    toast(on ? 'REMOVED FROM SAVED' : 'SAVED TO YOUR LIST');
  }

  /* -------------------------------------------------------- view all / cta */

  const viewAllBtn = $('#viewAll');
  viewAllBtn.addEventListener('click', () => {
    showAll = !showAll;
    renderGrid();
    $('#viewAllLabel').textContent = showAll ? 'SHOW LESS' : 'VIEW ALL';
    viewAllBtn.setAttribute('aria-expanded', String(showAll));
    if (showAll) toast('SHOWING ALL ' + PRODUCTS.length + ' PIECES');
  });

  $('#shopAccessories').addEventListener('click', () => {
    showAll = true;
    renderGrid();
    $('#viewAllLabel').textContent = 'SHOW LESS';
    viewAllBtn.setAttribute('aria-expanded', 'true');
    scrollToId('#drop');
    toast('ACCESSORIES ADDED TO THE GRID', 'violet');
  });

  /* ------------------------------------------------------------- carousel */

  const track = $('#carTrack');
  const dotsWrap = $('#carDots');

  track.innerHTML = ESSENTIALS.map(p => `
    <article class="slide">
      <img src="${p.img}" alt="${p.name}" loading="lazy">
      <div class="slide__meta">
        <button class="slide__name" data-ess="${p.id}">${p.name}</button>
        <span class="slide__price" data-ngn="${p.price}">${formatPrice(p.price)}</span>
      </div>
    </article>`).join('');

  track.addEventListener('click', e => {
    const btn = e.target.closest('[data-ess]');
    if (!btn) return;
    const p = ESSENTIALS.find(x => x.id === btn.dataset.ess);
    addToCart({ id:p.id, name:p.name, price:p.price, img:p.img }, 'ONE SIZE');
  });

  function perView() {
    const slide = $('.slide', track);
    if (!slide) return 1;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return Math.max(1, Math.round((track.clientWidth + gap) / (slide.getBoundingClientRect().width + gap)));
  }

  // Page on whole screenfuls of slides, so the last dot is a real position
  // rather than the sliver left over by dividing the raw scroll width.
  function pageCount() {
    return Math.max(1, Math.ceil($$('.slide', track).length / perView()));
  }

  function maxScroll() { return track.scrollWidth - track.clientWidth; }

  function pageOffset(i) { return Math.min(i * track.clientWidth, maxScroll()); }

  function buildDots() {
    const pages = pageCount();
    dotsWrap.innerHTML = Array.from({ length: pages }, (_, i) =>
      `<button role="tab" data-page="${i}" aria-label="Go to page ${i + 1}"></button>`).join('');
    syncCarousel();
  }

  function syncCarousel() {
    const last = pageCount() - 1;
    const page = track.scrollLeft >= maxScroll() - 4
      ? last
      : Math.min(last, Math.round(track.scrollLeft / track.clientWidth));
    $$('button', dotsWrap).forEach((d, i) => {
      d.classList.toggle('is-active', i === page);
      d.setAttribute('aria-selected', String(i === page));
    });
    $('#carPrev').disabled = track.scrollLeft <= 4;
    $('#carNext').disabled = track.scrollLeft >= maxScroll() - 4;
  }

  function slideStep() {
    const slide = $('.slide', track);
    return slide ? slide.getBoundingClientRect().width + 11 : 180;
  }

  // page by a full viewport so the arrows and the dots stay in agreement
  $('#carPrev').addEventListener('click', () => track.scrollBy({ left:-track.clientWidth, behavior:'smooth' }));
  $('#carNext').addEventListener('click', () => track.scrollBy({ left: track.clientWidth, behavior:'smooth' }));
  dotsWrap.addEventListener('click', e => {
    const dot = e.target.closest('[data-page]');
    if (dot) track.scrollTo({ left: pageOffset(Number(dot.dataset.page)), behavior:'smooth' });
  });

  track.addEventListener('scroll', () => {
    window.clearTimeout(track._t);
    track._t = window.setTimeout(syncCarousel, 90);
  }, { passive:true });

  track.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); track.scrollBy({ left:slideStep(), behavior:'smooth' }); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); track.scrollBy({ left:-slideStep(), behavior:'smooth' }); }
  });

  // drag to scroll — `is-dragging` disables pointer events on the slides, so it
  // must only engage once the pointer has actually travelled, otherwise a plain
  // click on a slide never reaches its button.
  const DRAG_THRESHOLD = 5;
  let pressed = false, dragging = false, startX = 0, startScroll = 0;
  track.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') return;      // native touch scrolling is better
    pressed = true; dragging = false;
    startX = e.clientX;
    startScroll = track.scrollLeft;
  });
  window.addEventListener('pointermove', e => {
    if (!pressed) return;
    const dx = e.clientX - startX;
    if (!dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return;
      dragging = true;
      track.classList.add('is-dragging');
    }
    track.scrollLeft = startScroll - dx;
  });
  window.addEventListener('pointerup', () => {
    if (!pressed) return;
    pressed = false;
    if (dragging) {
      // swallow the click that ends a drag so it cannot add a product
      track.addEventListener('click', ev => { ev.stopPropagation(); ev.preventDefault(); },
        { capture:true, once:true });
      track.classList.remove('is-dragging');
      dragging = false;
    }
    syncCarousel();
  });

  window.addEventListener('resize', debounce(buildDots, 180));

  /* ---------------------------------------------------------- currency UI */

  const currencyWrap  = $('#currency');
  const currencyBtn   = $('#currencyBtn');
  const currencyMenu  = $('#currencyMenu');

  function openCurrency() {
    currencyWrap.classList.add('is-open');
    currencyBtn.setAttribute('aria-expanded', 'true');
  }
  function closeCurrency() {
    currencyWrap.classList.remove('is-open');
    currencyBtn.setAttribute('aria-expanded', 'false');
  }

  currencyBtn.addEventListener('click', e => {
    e.stopPropagation();
    currencyWrap.classList.contains('is-open') ? closeCurrency() : openCurrency();
  });

  currencyMenu.addEventListener('click', e => {
    const li = e.target.closest('[data-currency]');
    if (!li) return;
    currency = li.dataset.currency;
    save('masq:currency', currency);
    $('#currencyLabel').textContent = currency;
    $$('li', currencyMenu).forEach(x => x.setAttribute('aria-selected', String(x === li)));
    repriceAll();
    closeCurrency();
    toast('PRICES SHOWN IN ' + currency);
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#currency')) closeCurrency();
  });

  /* ----------------------------------------------------------- account UI */

  $('#accountBtn').addEventListener('click', () => openOverlay($('#accountModal')));

  const authForm = $('#authForm');
  const authMsg  = $('#authMsg');
  let authMode = 'signin';

  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      authMode = tab.dataset.tab;
      $$('.tab').forEach(t => {
        const active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', String(active));
      });
      $('#authSubmit').textContent = authMode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT';
      authMsg.classList.remove('is-show');
    });
  });

  authForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = authForm.email;
    const pass  = authForm.password;
    email.classList.remove('is-error');
    pass.classList.remove('is-error');

    if (!isEmail(email.value)) {
      email.classList.add('is-error');
      showMsg(authMsg, 'ENTER A VALID EMAIL ADDRESS', true);
      email.focus();
      return;
    }
    if (pass.value.length < 8) {
      pass.classList.add('is-error');
      showMsg(authMsg, 'PASSWORD MUST BE AT LEAST 8 CHARACTERS', true);
      pass.focus();
      return;
    }
    showMsg(authMsg, authMode === 'signin' ? 'WELCOME BACK TO MASQ.' : 'ACCOUNT CREATED — CHECK YOUR INBOX', false);
    setTimeout(() => { closeOverlay(); authForm.reset(); authMsg.classList.remove('is-show'); }, 1200);
  });

  /* -------------------------------------------------------------- film UI */

  $('#playFilm').addEventListener('click', () => openOverlay($('#filmModal')));

  const DURATION = 180; // 3:00
  let playing = false, elapsed = 0, timer = null;
  const fill = $('#playerFill'), timeEl = $('#playerTime'), toggle = $('#playerToggle');

  const PLAY_ICON  = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4.5 15.5 10 7 15.5z" fill="currentColor"/></svg>';
  const PAUSE_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5.5" y="4.5" width="3.4" height="11" fill="currentColor"/><rect x="11.1" y="4.5" width="3.4" height="11" fill="currentColor"/></svg>';

  function fmtTime(s) {
    return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  }

  function paintPlayer() {
    fill.style.width = (elapsed / DURATION * 100) + '%';
    timeEl.textContent = fmtTime(elapsed) + ' / ' + fmtTime(DURATION);
  }

  function stopPlayback() {
    playing = false;
    clearInterval(timer);
    toggle.innerHTML = PLAY_ICON;
    toggle.setAttribute('aria-label', 'Play');
  }

  toggle.addEventListener('click', () => {
    if (playing) { stopPlayback(); return; }
    playing = true;
    toggle.innerHTML = PAUSE_ICON;
    toggle.setAttribute('aria-label', 'Pause');
    timer = setInterval(() => {
      elapsed += 1;
      if (elapsed >= DURATION) { elapsed = DURATION; paintPlayer(); stopPlayback(); return; }
      paintPlayer();
    }, 1000);
  });

  $('#filmModal').addEventListener('transitionend', () => {
    if (!$('#filmModal').classList.contains('is-open') && playing) stopPlayback();
  });
  paintPlayer();

  /* -------------------------------------------------------- info modal UI */

  document.addEventListener('click', e => {
    const link = e.target.closest('[data-modal="info"]');
    if (!link) return;
    e.preventDefault();
    const title = link.dataset.title;
    $('#infoTitle').textContent = title;
    $('#infoText').textContent = INFO_COPY[title] || '';
    openOverlay($('#infoModal'));
  });

  /* ----------------------------------------------------------- newsletter */

  const nlForm = $('#newsletterForm');
  const nlMsg  = $('#formMsg');

  nlForm.addEventListener('submit', e => {
    e.preventDefault();
    const input = $('#email');
    const btn   = $('.btn--join', nlForm);
    input.classList.remove('is-error');

    if (!isEmail(input.value)) {
      input.classList.add('is-error');
      showMsg(nlMsg, 'PLEASE ENTER A VALID EMAIL ADDRESS', true);
      input.focus();
      return;
    }

    btn.disabled = true;
    btn.textContent = 'JOINING…';
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'JOIN';
      input.value = '';
      showMsg(nlMsg, 'YOU’RE IN. WATCH YOUR INBOX FOR DROP 02.', false);
      toast('WELCOME TO THE WORLD OF MASQ.', 'violet');
    }, 900);
  });

  function showMsg(el, text, isError) {
    el.textContent = text;
    el.classList.toggle('is-error', !!isError);
    el.classList.add('is-show');
  }

  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim()); }

  /* ------------------------------------------------------- nav / scrolling */

  const header = $('#header');
  const burger = $('#burger');
  const mobileNav = $('#mobileNav');

  burger.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });

  function scrollToId(hash) {
    const target = document.querySelector(hash);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.pageYOffset - 58;
    window.scrollTo({ top, behavior:'smooth' });
  }

  document.addEventListener('click', e => {
    const link = e.target.closest('[data-scroll]');
    if (!link) return;
    const hash = link.getAttribute('href');
    if (!hash || hash.charAt(0) !== '#') return;
    e.preventDefault();
    scrollToId(hash);
    mobileNav.classList.remove('is-open');
    burger.setAttribute('aria-expanded', 'false');
  });

  const sections = ['#drop', '#essentials', '#craft', '#film'];

  function onScroll() {
    header.classList.toggle('is-stuck', window.pageYOffset > 24);
    let current = '';
    sections.forEach(id => {
      const el = document.querySelector(id);
      if (el && el.getBoundingClientRect().top <= 140) current = id;
    });
    $$('.nav__link').forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === current));
  }

  window.addEventListener('scroll', onScroll, { passive:true });

  /* ---------------------------------------------------------- reveal on scroll */

  function initReveal() {
    const items = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach(i => i.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold:0.14, rootMargin:'0px 0px -40px 0px' });
    items.forEach(i => io.observe(i));
  }

  function debounce(fn, wait) {
    let t;
    return function () {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, arguments), wait);
    };
  }

  /* ------------------------------------------------------------------ init */

  $('#currencyLabel').textContent = currency;
  $$('li', currencyMenu).forEach(li => li.setAttribute('aria-selected', String(li.dataset.currency === currency)));

  renderGrid();
  renderCart();
  buildDots();
  initReveal();
  onScroll();
})();
