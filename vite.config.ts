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
      sourcemap: debugSourcemap
    }
  }
})
