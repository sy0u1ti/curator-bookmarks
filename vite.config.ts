import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest.json' with { type: 'json' }

export default defineConfig(({ mode }) => {
  const debugSourcemap = mode === 'debug' || process.env.CURATOR_DEBUG_SOURCEMAP === '1'

  return {
    plugins: [crx({ manifest })],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: debugSourcemap,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('pinyin-pro')) {
              return 'vendor-pinyin'
            }
            if (id.includes('/src/newtab/content-state.ts')) {
              return 'newtab-content-state'
            }
            if (id.includes('/src/newtab/interactions.ts')) {
              return 'newtab-interactions'
            }
            if (id.includes('/src/newtab/icon-settings.ts')) {
              return 'newtab-icon-settings'
            }
            if (id.includes('/src/newtab/folder-settings.ts')) {
              return 'newtab-folder-settings'
            }
            if (id.includes('/src/newtab/search-engines.ts')) {
              return 'newtab-search-engines'
            }
            if (id.includes('/src/newtab/workspace-settings.ts')) {
              return 'newtab-workspace-settings'
            }
            if (id.includes('/src/newtab/favicon-cache.ts')) {
              return 'newtab-favicon-cache'
            }
            return undefined
          }
        }
      }
    }
  }
})
