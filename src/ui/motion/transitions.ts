export const motionDurations = {
  fast: 0.12,
  base: 0.18,
  slow: 0.26,
  modalOpen: 0.25,
  modalClose: 0.15
}

export const motionEase = [0.22, 0.72, 0.18, 1] as const
export const modalEase = [0.22, 1, 0.36, 1] as const

export const panelTransitions = {
  dialog: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: {
      opacity: 0,
      scale: 0.96,
      transition: { duration: motionDurations.modalClose, ease: modalEase }
    },
    transition: { duration: motionDurations.modalOpen, ease: modalEase }
  },
  drawer: {
    initial: { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 24 },
    transition: { duration: motionDurations.slow, ease: motionEase }
  },
  menu: {
    initial: { opacity: 0, scale: 0.98, y: 4 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.98, y: 4 },
    transition: { duration: motionDurations.fast, ease: motionEase }
  },
  popover: {
    initial: { opacity: 0, scale: 0.98, y: 6 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.98, y: 6 },
    transition: { duration: motionDurations.base, ease: motionEase }
  },
  list: {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
    transition: { duration: motionDurations.base, ease: motionEase }
  }
}
