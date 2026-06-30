const motionDurations = {
  fast: 0.2,
  base: 0.26,
  slow: 0.34,
  modalOpen: 0.32,
  modalClose: 0.22
}

const motionEase = [0.22, 1, 0.36, 1] as const
const modalEase = [0.22, 1, 0.36, 1] as const

export const panelTransitions = {
  dialog: {
    initial: { opacity: 0, transform: 'scale(0.96)' },
    animate: { opacity: 1, transform: 'scale(1)' },
    exit: {
      opacity: 0,
      transform: 'scale(0.96)',
      transition: { duration: motionDurations.modalClose, ease: modalEase }
    },
    transition: { duration: motionDurations.modalOpen, ease: modalEase }
  },
  drawer: {
    initial: { opacity: 0, transform: 'translate3d(24px, 0, 0)' },
    animate: { opacity: 1, transform: 'translate3d(0, 0, 0)' },
    exit: { opacity: 0, transform: 'translate3d(24px, 0, 0)' },
    transition: { duration: motionDurations.slow, ease: motionEase }
  },
  menu: {
    initial: { opacity: 0, transform: 'translate3d(0, 4px, 0) scale(0.98)' },
    animate: { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
    exit: { opacity: 0, transform: 'translate3d(0, 4px, 0) scale(0.98)' },
    transition: { duration: motionDurations.fast, ease: motionEase }
  },
  popover: {
    initial: { opacity: 0, transform: 'translate3d(0, 6px, 0) scale(0.98)' },
    animate: { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
    exit: { opacity: 0, transform: 'translate3d(0, 6px, 0) scale(0.98)' },
    transition: { duration: motionDurations.base, ease: motionEase }
  },
  list: {
    initial: { opacity: 0, transform: 'translate3d(0, 6px, 0)' },
    animate: { opacity: 1, transform: 'translate3d(0, 0, 0)' },
    exit: { opacity: 0, transform: 'translate3d(0, -4px, 0)' },
    transition: { duration: motionDurations.base, ease: motionEase }
  }
}
