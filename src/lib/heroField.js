import {
  WebGLRenderer, Scene, PerspectiveCamera, Sprite, SpriteMaterial, CanvasTexture,
  AdditiveBlending, SRGBColorSpace
} from 'three';

/* The hero's one 3D moment (Three.js): behind the model, a soft violet light
 * and the five symbols of the MASQ. logo drifting slowly upward in depth. The
 * light leans toward the pointer and the view shifts a little with it.
 *
 * Started by src/components/Hero.jsx only on a large screen, after the hero has
 * settled, never for reduced motion; paused while the hero is off screen or
 * the tab is hidden. Returns a function that stops it and frees everything. */

/* The symbols, drawn crisp at any size, in the logo's colours. */
const SYMBOLS = [
  ['#22b8cc', (c) => {                                     // diamond in a diamond
    c.beginPath(); c.moveTo(64, 14); c.lineTo(114, 64); c.lineTo(64, 114); c.lineTo(14, 64); c.closePath(); c.stroke();
    c.beginPath(); c.moveTo(64, 46); c.lineTo(82, 64); c.lineTo(64, 82); c.lineTo(46, 64); c.closePath(); c.fill();
  }],
  ['#f0461e', (c) => {                                     // star with arrows
    line(c, 64, 16, 64, 112); line(c, 30, 30, 98, 98); line(c, 98, 30, 30, 98);
    for (const s of [-1, 1]) {
      const x = 64 + s * 46;
      c.beginPath(); c.moveTo(x - s * 14, 50); c.lineTo(x, 64); c.lineTo(x - s * 14, 78); c.stroke();
    }
  }],
  ['#f5a412', (c) => {                                     // two rings
    c.beginPath(); c.arc(64, 64, 46, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(64, 64, 24, 0, Math.PI * 2); c.stroke();
  }],
  ['#9b30f0', (c) => {                                     // asterisk
    line(c, 64, 16, 64, 112); line(c, 30, 30, 98, 98); line(c, 98, 30, 30, 98);
    line(c, 14, 64, 34, 64); line(c, 94, 64, 114, 64);
  }],
  ['#8fcf1a', (c) => {                                     // ringed target
    c.beginPath(); c.arc(64, 64, 32, 0, Math.PI * 2); c.stroke();
    line(c, 10, 64, 118, 64);
    c.beginPath(); c.arc(64, 64, 10, 0, Math.PI * 2); c.fill();
  }]
];

function line(c, x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }

function symbolTexture([colour, draw]) {
  const el = document.createElement('canvas');
  el.width = el.height = 128;
  const c = el.getContext('2d');
  c.strokeStyle = c.fillStyle = colour;
  c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round';
  c.shadowColor = colour; c.shadowBlur = 6;                 // a little ink-bleed, as printed
  draw(c);
  const t = new CanvasTexture(el);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function glowTexture() {
  const el = document.createElement('canvas');
  el.width = el.height = 256;
  const c = el.getContext('2d');
  const g = c.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(110, 60, 255, 0.9)');
  g.addColorStop(0.35, 'rgba(85, 40, 220, 0.35)');
  g.addColorStop(1, 'rgba(60, 20, 180, 0)');
  c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  const t = new CanvasTexture(el);
  t.colorSpace = SRGBColorSpace;
  return t;
}

const COUNT = 30;
const NEAR = 2, FAR = -16;            // depth range of the symbols
const rand = (a, b) => a + Math.random() * (b - a);

export function startHeroField(container) {
  const renderer = new WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.1, 60);
  camera.position.set(0, 0, 10);

  const textures = SYMBOLS.map(symbolTexture);
  const glowTex = glowTexture();
  const glow = new Sprite(new SpriteMaterial({ map: glowTex, blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55 }));
  glow.position.set(0.5, 0.6, -9);
  glow.scale.set(16, 16, 1);
  scene.add(glow);

  // Half the view's width and height at a depth: where a symbol may be.
  const reach = (z) => {
    const h = Math.tan((camera.fov * Math.PI) / 360) * (camera.position.z - z);
    return { w: h * camera.aspect, h };
  };

  const symbols = Array.from({ length: COUNT }, (_, i) => {
    const material = new SpriteMaterial({ map: textures[i % textures.length], blending: AdditiveBlending, depthWrite: false, transparent: true });
    const s = new Sprite(material);
    s.userData = { speed: rand(0.12, 0.32), sway: rand(0.2, 0.6), phase: rand(0, Math.PI * 2), spin: rand(-0.25, 0.25) };
    place(s, true);
    scene.add(s);
    return s;
  });

  function place(s, anywhere) {
    const z = rand(FAR, NEAR);
    const { w, h } = reach(z);
    s.position.set(rand(-w, w), anywhere ? rand(-h, h) : -h - 0.6, z);
    const near = (z - FAR) / (NEAR - FAR);               // 0 far … 1 near
    const size = 0.32 + near * 0.42;
    s.scale.set(size, size, 1);
    s.material.opacity = 0.18 + near * 0.5;              // far ones fade into the dark
    s.material.rotation = rand(0, Math.PI * 2);
    s.userData.x = s.position.x;
  }

  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  // The pointer, from -1 to 1 across the hero; the light and the view ease toward it.
  const target = { x: 0, y: 0 }, eased = { x: 0, y: 0 };
  const onMove = (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const r = container.getBoundingClientRect();
    target.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
    target.y = Math.max(-1, Math.min(1, -(((e.clientY - r.top) / r.height) * 2 - 1)));
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  let raf = 0, last = 0, visible = true, shown = false;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    eased.x += (target.x - eased.x) * Math.min(1, dt * 1.6);
    eased.y += (target.y - eased.y) * Math.min(1, dt * 1.6);

    camera.position.x = eased.x * 0.55;
    camera.position.y = eased.y * 0.35;
    camera.lookAt(0, 0, -6);
    glow.position.x = 0.5 + eased.x * 3.2;
    glow.position.y = 0.6 + eased.y * 2.2;

    const t = now / 1000;
    for (const s of symbols) {
      const u = s.userData;
      s.position.y += u.speed * dt;
      s.position.x = u.x + Math.sin(t * 0.3 + u.phase) * u.sway;
      s.material.rotation += u.spin * dt;
      if (s.position.y > reach(s.position.z).h + 0.6) place(s, false);
    }
    renderer.render(scene, camera);
    if (!shown) { shown = true; canvas.classList.add('is-on'); }
  }

  const run = () => { if (!raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };
  const pause = () => { cancelAnimationFrame(raf); raf = 0; };
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? run() : pause(); });
  io.observe(container);
  const onVis = () => (document.hidden ? pause() : run());
  document.addEventListener('visibilitychange', onVis);
  run();

  return () => {
    pause();
    io.disconnect(); ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pointermove', onMove);
    for (const s of symbols) s.material.dispose();
    glow.material.dispose();
    [...textures, glowTex].forEach(t => t.dispose());
    renderer.dispose();
    canvas.remove();
  };
}
