export const OPTIONS_REDUCED_MOTION_SURFACE_CLASS = [
  'motion-reduce:!animate-none motion-reduce:![transition-duration:80ms] motion-reduce:![scroll-behavior:auto]',
  'motion-reduce:[&_*]:!animate-none motion-reduce:[&_*::before]:!animate-none motion-reduce:[&_*::after]:!animate-none',
  'motion-reduce:[&_*]:![transition-duration:80ms] motion-reduce:[&_*::before]:![transition-duration:80ms] motion-reduce:[&_*::after]:![transition-duration:80ms]',
  'motion-reduce:[&_*]:![scroll-behavior:auto]'
].join(' ')

export const OPTIONS_REDUCED_MOTION_SHELL_TRANSFORM_CLASS = [
  'motion-reduce:[&_*]:![transform:none]',
  'motion-reduce:[&_*::before]:![transform:none]',
  'motion-reduce:[&_*::after]:![transform:none]'
].join(' ')
