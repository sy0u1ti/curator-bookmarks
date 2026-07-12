import path from 'node:path'

process.env.CURATOR_VISUAL_CAPTURE_DIR ||= path.resolve('output/playwright/interface-quality')

await import('./newtab/newtab-settings-drawer-motion.test.mjs')
