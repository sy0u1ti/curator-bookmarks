import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import { build as buildEsbuild } from 'esbuild'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import manifest from './src/manifest.json' with { type: 'json' }

const INSTANT_WALLPAPER_BOOT_ROUTE = '/instant-wallpaper-boot.js'
const INSTANT_WALLPAPER_BOOT_ENTRY = 'src/newtab/instant-wallpaper-boot.ts'

function instantWallpaperBootPlugin(minify: boolean): Plugin {
  return {
    name: 'curator-instant-wallpaper-boot',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        if (!context.path.endsWith('/src/newtab/newtab.html') || html.includes(INSTANT_WALLPAPER_BOOT_ROUTE)) {
          return html
        }
        return html.replace('<head>', `<head>\n    <script src="${INSTANT_WALLPAPER_BOOT_ROUTE}"></script>`)
      }
    },
    configureServer(server) {
      server.middlewares.use(INSTANT_WALLPAPER_BOOT_ROUTE, async (_request, response, next) => {
        try {
          const source = await buildInstantWallpaperBootScript(minify)
          response.statusCode = 200
          response.setHeader('content-type', 'text/javascript; charset=utf-8')
          response.end(source)
        } catch (error) {
          next(error)
        }
      })
    },
    async generateBundle() {
      const source = await buildInstantWallpaperBootScript(minify)
      this.emitFile({
        type: 'asset',
        fileName: INSTANT_WALLPAPER_BOOT_ROUTE.slice(1),
        source
      })
    }
  }
}

async function buildInstantWallpaperBootScript(minify: boolean): Promise<string> {
  const result = await buildEsbuild({
    bundle: true,
    entryPoints: [INSTANT_WALLPAPER_BOOT_ENTRY],
    format: 'iife',
    logLevel: 'silent',
    minify,
    platform: 'browser',
    target: 'es2022',
    write: false
  })
  return result.outputFiles[0]?.text || ''
}

export default defineConfig(({ mode }) => {
  const debugSourcemap = mode === 'debug' || process.env.CURATOR_DEBUG_SOURCEMAP === '1'

  return {
    plugins: [react(), tailwindcss(), instantWallpaperBootPlugin(!debugSourcemap), crx({ manifest })],
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
            if (
              id.includes('/src/options/sections/dashboard-virtual.ts') ||
              id.includes('/src/options/sections/dashboard-favicons.ts')
            ) {
              return 'options-dashboard'
            }
            if (id.includes('/src/options/sections/dashboard-lazy.ts')) {
              return 'options-dashboard-loader'
            }
            if (
              id.includes('/src/options/sections/availability-runner.ts') ||
              id.includes('/src/options/sections/classifier.ts')
            ) {
              return 'options-availability-engine'
            }
            if (
              id.includes('/src/options/sections/content-extraction.ts') ||
              id.includes('/src/options/sections/ai-settings.ts') ||
              id.includes('/src/shared/ai-response.ts') ||
              id.includes('/src/shared/ai-provider-url.ts') ||
              id.includes('/src/shared/content-snapshots.ts') ||
              id.includes('/src/shared/backup.ts') ||
              id.includes('/src/shared/bookmark-tags.ts') ||
              id.includes('/src/shared/recycle-bin.ts')
            ) {
              return 'options-data-ai-engine'
            }
            if (
              id.includes('/src/options/sections/ignore.ts') ||
              id.includes('/src/options/sections/recycle.ts') ||
              id.includes('/src/options/sections/duplicates.ts') ||
              id.includes('/src/options/sections/folder-cleanup.ts') ||
              id.includes('/src/options/sections/redirects.ts') ||
              id.includes('/src/options/sections/history.ts') ||
              id.includes('/src/options/sections/bookmark-add-history.ts')
            ) {
              return 'options-task-sections'
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
            if (id.includes('/src/shared/newtab-workspace-settings.ts')) {
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
