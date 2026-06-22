import type { Variants } from 'framer-motion'

/* ============================================================
   Variantes reutilizables de animación (Framer Motion)
   ============================================================ */

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, type: 'spring', stiffness: 50 },
  },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6 } },
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
}

export const viewportOnce = { once: true, amount: 0.2 } as const
