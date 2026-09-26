import type { Variants, Transition } from 'framer-motion';

/**
 * Standard fintech motion easing curves and timings.
 * Restrained, subtle, snappy, and enterprise-grade.
 */
export const EASINGS = {
  smooth: [0.16, 1, 0.3, 1] as const, // Custom decelerate / ease-out
  standard: [0.2, 0, 0, 1] as const,
  enter: [0, 0, 0.2, 1] as const,
  exit: [0.4, 0, 1, 1] as const,
};

export const TRANSITIONS: Record<string, Transition> = {
  spring: {
    type: 'spring',
    stiffness: 400,
    damping: 30,
  },
  gentle: {
    type: 'spring',
    stiffness: 260,
    damping: 25,
  },
  smooth: {
    duration: 0.25,
    ease: EASINGS.smooth,
  },
  medium: {
    duration: 0.35,
    ease: EASINGS.smooth,
  },
  snappy: {
    duration: 0.15,
    ease: EASINGS.standard,
  },
};

/**
 * Reusable animation variants.
 */
export const pageTransitionVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: EASINGS.smooth,
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: {
      duration: 0.18,
      ease: EASINGS.standard,
    },
  },
};

export const fadeInVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.25, ease: EASINGS.smooth },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: EASINGS.standard },
  },
};

export const fadeUpVariants: Variants = {
  initial: { opacity: 0, y: 14 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: EASINGS.smooth },
  },
};

export const fadeDownVariants: Variants = {
  initial: { opacity: 0, y: -12 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: EASINGS.smooth },
  },
};

export const scaleInVariants: Variants = {
  initial: { opacity: 0, scale: 0.97 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: EASINGS.smooth },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    transition: { duration: 0.15, ease: EASINGS.standard },
  },
};

export const staggerContainerVariants = (
  staggerChildren = 0.05,
  delayChildren = 0.02
): Variants => ({
  initial: {},
  animate: {
    transition: {
      staggerChildren,
      delayChildren,
    },
  },
});

export const modalBackdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const modalDialogVariants: Variants = {
  initial: { opacity: 0, scale: 0.97, y: 8 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.22, ease: EASINGS.smooth },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    y: 6,
    transition: { duration: 0.16, ease: EASINGS.standard },
  },
};

export const toastVariants: Variants = {
  initial: { opacity: 0, y: -14, scale: 0.95 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.22, ease: EASINGS.smooth },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.95,
    transition: { duration: 0.18, ease: EASINGS.standard },
  },
};

export const tableRowVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.2, ease: EASINGS.smooth },
  },
};

export const formErrorVariants: Variants = {
  initial: { opacity: 0, height: 0, y: -4 },
  animate: {
    opacity: 1,
    height: 'auto',
    y: 0,
    transition: { duration: 0.18, ease: EASINGS.smooth },
  },
  exit: {
    opacity: 0,
    height: 0,
    y: -4,
    transition: { duration: 0.14, ease: EASINGS.standard },
  },
};
