import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useShop } from '../store/ShopContext.jsx';
import { useFocusTrap } from '../lib/useFocusTrap.js';
import { Close, CaretLeft, CaretRight } from './Icons.jsx';

const ease = [0.16, 1, 0.3, 1];
const SCALE = 2;   // the sharp copies are about twice the size they show at; more only magnifies blur
const clamp = (n) => Math.min(100, Math.max(0, n));

/**
 * A product photo, full screen, at its sharpest. Tap or click to look closer
 * at that spot, then drag (or, with a mouse, just move) to look around; tap
 * again to see the whole photo. Several photos: arrows, arrow keys, or a
 * swipe while not zoomed. Escape, the cross or the dark space closes it.
 */
export default function ZoomViewer({ photos, index: first = 0, name }) {
  const { closeOverlay } = useShop();
  const ref = useFocusTrap(true);
  const [index, setIndex] = useState(first);
  const [zoomed, setZoomed] = useState(false);
  const [spot, setSpot] = useState({ x: 50, y: 50 });   // the point looked at, in % of the photo
  const [panning, setPanning] = useState(false);
  const press = useRef(null);
  const many = photos.length > 1;
  const photo = photos[index];

  const go = useCallback((step) => {
    setZoomed(false);
    setIndex(i => (i + step + photos.length) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    if (!many) return;
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [many, go]);

  const pointAt = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width * 100), y: clamp((e.clientY - r.top) / r.height * 100) };
  };

  const onPointerDown = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    press.current = { x: e.clientX, y: e.clientY, spot, w: r.width, h: r.height, moved: false, id: e.pointerId };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    // A mouse looks around by moving; no need to hold the button.
    if (zoomed && e.pointerType === 'mouse' && !press.current) { setSpot(pointAt(e)); return; }
    const p = press.current;
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (!p.moved && Math.hypot(dx, dy) < 6) return;
    p.moved = true;
    if (zoomed) {
      // Drag the photo: the spot moves the other way, scaled so the photo
      // stays under the finger.
      setPanning(true);
      setSpot({
        x: clamp(p.spot.x - dx / ((SCALE - 1) * p.w) * 100),
        y: clamp(p.spot.y - dy / ((SCALE - 1) * p.h) * 100)
      });
    }
  };

  const onPointerUp = (e) => {
    const p = press.current;
    press.current = null;
    setPanning(false);
    if (!p) return;
    const dx = e.clientX - p.x;
    if (!p.moved) {
      // A tap: look closer at that spot, or step back out.
      if (zoomed) setZoomed(false);
      else { setSpot(pointAt(e)); setZoomed(true); }
    } else if (!zoomed && many && Math.abs(dx) > 50) {
      go(dx < 0 ? 1 : -1);
    }
  };

  return (
    <motion.div
      ref={ref}
      className="zoom"
      role="dialog" aria-modal="true" aria-label={`${name}: photos`}
      data-lenis-prevent
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease }}
    >
      <div className="zoom__bar">
        <p className="zoom__count" aria-live="polite">
          {many ? `${index + 1} / ${photos.length}` : name}
        </p>
        <button type="button" className="zoom__toggle" aria-pressed={zoomed}
                onClick={() => { setSpot({ x: 50, y: 50 }); setZoomed(z => !z); }}>
          {zoomed ? 'Zoom out' : 'Zoom in'}
        </button>
        <button type="button" className="close-btn" data-close aria-label="Close photos" onClick={closeOverlay}>
          <Close />
        </button>
      </div>

      <div className="zoom__stage" onClick={(e) => { if (e.target === e.currentTarget) closeOverlay(); }}>
        <motion.div
          key={photo.img}
          className="zoom__frame"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease }}
        >
          <img
            className={`zoom__img${zoomed ? ' is-zoomed' : ''}${panning ? ' is-panning' : ''}`}
            src={photo.img2x || photo.img}
            alt={index === 0 ? name : `${name}, photo ${index + 1}`}
            draggable={false}
            style={{ transformOrigin: `${spot.x}% ${spot.y}%` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => { press.current = null; setPanning(false); }}
          />
        </motion.div>
      </div>

      {many && (
        <>
          <button type="button" className="zoom__arrow zoom__arrow--prev" aria-label="Previous photo" onClick={() => go(-1)}><CaretLeft /></button>
          <button type="button" className="zoom__arrow zoom__arrow--next" aria-label="Next photo" onClick={() => go(1)}><CaretRight /></button>
        </>
      )}
    </motion.div>
  );
}
