import { motion } from 'framer-motion';

/* Scroll reveal. `whileInView` replaces the hand-rolled IntersectionObserver,
 * and `once` means a section settles after its first pass rather than
 * re-animating every time it scrolls back past. */

export default function Reveal({ children, delay = 0, y = 18, className = '', as = 'div', ...rest }) {
  const Tag = motion[as] || motion.div;
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.7, delay, ease: [0.33, 0.02, 0.18, 1] }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
