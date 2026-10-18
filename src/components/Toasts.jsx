import { motion, AnimatePresence } from 'framer-motion';
import { useShop } from '../store/ShopContext.jsx';

/* AnimatePresence is the reason these can now leave as gracefully as they
 * arrive — the old version needed a class toggle plus an animationend
 * listener to fake an exit. */

export default function Toasts() {
  const { toasts } = useShop();
  return (
    <div className="toast-wrap" aria-live="polite" aria-atomic="true">
      <AnimatePresence initial={false}>
        {toasts.map(({ id, message, variant }) => (
          <motion.div
            key={id}
            className={`toast${variant ? ` toast--${variant}` : ''}`}
            // In with a settle and no bounce; out quicker and smaller than in,
            // so leaving never draws the eye.
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', duration: 0.35, bounce: 0 } }}
            exit={{ opacity: 0, y: 6, transition: { duration: 0.18, ease: [0.2, 0, 0, 1] } }}
          >{message}</motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
