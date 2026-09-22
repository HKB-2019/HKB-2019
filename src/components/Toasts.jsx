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
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >{message}</motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
