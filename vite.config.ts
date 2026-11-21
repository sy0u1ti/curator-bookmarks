import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import { build as buildEsbuild } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import manifest from './src/manifest.json' with { type: 'json' }
import { buildSyncEngine } from './src/vendor/floccus/curator/build.mjs'
import { resolveSyncOAuthBuild } from './scripts/sync-oauth-config.mjs'

const INSTANT_WALLPAPER_BOOT_ROUTE = '/instant-wallpaper-boot.js'
const INSTANT_WALLPAPER_BOOT_ENTRY = 'src/newtab/instant-wallpaper-boot.ts'
const NEWTAB_BOOKMARK_PREBOOT_ROUTE = '/newtab-bookmark-preboot.js'
const NEWTAB_BOOKMARK_PREBOOT_ENTRY = 'src/newtab/newtab-bookmark-preboot-entry.ts'
const POPUP_PREBOOT_ROUTE = '/popup-preboot.js'
const POPUP_PREBOOT_ENTRY = 'src/popup/popup-preboot.ts'
const SYNC_ENGINE_MODULE = 'virtual:curator-sync-engine'
const RESOLVED_SYNC_ENGINE_MODULE = `\0${SYNC_ENGINE_MODULE}`
const NEWTAB_MODULE_PRELOAD_TAG_PATTERN = /^[ \t]*<link\b(?=[^>]*\brel=(["'])modulepreload\1)[^>]*>[^\S\r\n]*(?:\r?\n)?/gim

function removeCrossWorldNewtabModulePreloads(html: string): string {
  // A chrome://newtab override is loaded through a different extension world.
  // Chromium rejects Vite's document-level modulepreload entries for reuse and
  // records one extension error per chunk, so they add work without warming the
  // module graph. Static imports from the entry module still load every chunk.
  return html.replace(NEWTAB_MODULE_PRELOAD_TAG_PATTERN, '')
}

function syncEnginePlugin(minify: boolean, buildId: string, oauth: ReturnType<typeof resolveSyncOAuthBuild>['oauth']): Plugin {
  return {
    name: 'curator-sync-engine',
    resolveId(source) {
      return source === SYNC_ENGINE_MODULE ? RESOLVED_SYNC_ENGINE_MODULE : undefined
    },
    async load(id) {
      if (id !== RESOLVED_SYNC_ENGINE_MODULE) {
        return undefined
      }
      // The service worker can load neither chunks nor scripts on demand, and
      // the engine does; see src/vendor/floccus/curator/build.mjs.
      const { code } = await buildSyncEngine({ minify, buildId, oauth })
      return { code, moduleSideEffects: false }
    },
    async generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify({ buildId }) })
      this.emitFile({
        type: 'asset',
        fileName: 'licenses/floccus-MPL-2.0.txt',
        source: await readFile(new URL('./src/vendor/floccus/LICENSE.txt', import.meta.url), 'utf8')
      })
      this.emitFile({
        type: 'asset',
        fileName: 'licenses/floccus-SOURCE.md',
        source: await readFile(new URL('./src/vendor/floccus/README.md', import.meta.url), 'utf8')
      })
      this.emitFile({
        type: 'asset',
        fileName: 'licenses/OAUTH.md',
        source: await readFile(new URL('./src/vendor/floccus/OAUTH.md', import.meta.url), 'utf8')
      })
    }
  }
}

function instantWallpaperBootPlugin(minify: boolean): Plugin {
  return {
    name: 'curator-instant-wallpaper-boot',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        if (!context.path.endsWith('/src/newtab/newtab.html')) {
          return html
        }
        let transformedHtml = html
        if (!transformedHtml.includes(INSTANT_WALLPAPER_BOOT_ROUTE)) {
          const stylesheetIndex = transformedHtml.indexOf('<link rel="stylesheet"')
          if (stylesheetIndex >= 0) {
            const stylesheetLineStart = transformedHtml.lastIndexOf('\n', stylesheetIndex) + 1
            transformedHtml = `${transformedHtml.slice(0, stylesheetLineStart)}    <script src="${INSTANT_WALLPAPER_BOOT_ROUTE}"></script>\n${transformedHtml.slice(stylesheetLineStart)}`
          } else {
            transformedHtml = transformedHtml.replace(
              '</head>',
              `    <script src="${INSTANT_WALLPAPER_BOOT_ROUTE}"></script>\n  </head>`
            )
          }
        }
        if (!transformedHtml.includes(NEWTAB_BOOKMARK_PREBOOT_ROUTE)) {
          transformedHtml = transformedHtml.replace(
            '<body>',
            `<body>\n    <script src="${NEWTAB_BOOKMARK_PREBOOT_ROUTE}"></script>`
          )
        }
        return removeCrossWorldNewtabModulePreloads(transformedHtml)
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
      server.middlewares.use(NEWTAB_BOOKMARK_PREBOOT_ROUTE, async (_request, response, next) => {
        try {
          const source = await buildNewtabBookmarkPrebootScript(minify)
          response.statusCode = 200
          response.setHeader('content-type', 'text/javascript; charset=utf-8')
          response.end(source)
        } catch (error) {
          next(error)
        }
      })
    },
    async generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'licenses/react-bits-GlassSurface.txt',
        source: await readFile(new URL('./src/vendor/react-bits/LICENSE.md', import.meta.url), 'utf8')
      })
      const source = await buildInstantWallpaperBootScript(minify)
      this.emitFile({
        type: 'asset',
        fileName: INSTANT_WALLPAPER_BOOT_ROUTE.slice(1),
        source
      })
      const bookmarkPrebootSource = await buildNewtabBookmarkPrebootScript(minify)
      this.emitFile({
        type: 'asset',
        fileName: NEWTAB_BOOKMARK_PREBOOT_ROUTE.slice(1),
        source: bookmarkPrebootSource
      })
    }
  }
}

function popupPrebootPlugin(minify: boolean): Plugin {
  return {
    name: 'curator-popup-preboot',
    transformIndexHtml: {
      order: 'post',
      handler(html, context) {
        if (!context.path.endsWith('/src/popup/popup.html') || html.includes(POPUP_PREBOOT_ROUTE)) {
          return html
        }
        return html.replace('</body>', `    <script src="${POPUP_PREBOOT_ROUTE}"></script>\n  </body>`)
      }
    },
    configureServer(server) {
      server.middlewares.use(POPUP_PREBOOT_ROUTE, async (_request, response, next) => {
        try {
          const source = await buildPopupPrebootScript(minify)
          response.statusCode = 200
          response.setHeader('content-type', 'text/javascript; charset=utf-8')
          response.end(source)
        } catch (error) {
          next(error)
        }
      })
    },
    async generateBundle() {
      const source = await buildPopupPrebootScript(minify)
      this.emitFile({
        type: 'asset',
        fileName: POPUP_PREBOOT_ROUTE.slice(1),
        source
      })
    }
  }
}

async function buildInstantWallpaperBootScript(minify: boolean): Promise<string> {
  return buildBrowserIifeScript(INSTANT_WALLPAPER_BOOT_ENTRY, minify)
}

async function buildNewtabBookmarkPrebootScript(minify: boolean): Promise<string> {
  return buildBrowserIifeScript(NEWTAB_BOOKMARK_PREBOOT_ENTRY, minify)
}

async function buildPopupPrebootScript(minify: boolean): Promise<string> {
  return buildBrowserIifeScript(POPUP_PREBOOT_ENTRY, minify)
}

async function buildBrowserIifeScript(entryPoint: string, minify: boolean): Promise<string> {
  const result = await buildEsbuild({
    bundle: true,
    entryPoints: [entryPoint],
    format: 'iife',
    logLevel: 'silent',
    minify,
    platform: 'browser',
    target: 'es2022',
    write: false
  })
  return result.outputFiles[0]?.text || ''
}

function manualChunks(id: string): string | undefined {
  const normalizedId = id.replaceAll('\\', '/')
  if (normalizedId.includes('/src/shared/text.ts')) {
    return 'shared-text'
  }
  if (id.includes('/src/newtab/content-state.ts') || normalizedId.includes('/src/newtab/content-state.ts')) {
    return 'newtab-content-state'
  }
  if (normalizedId.includes('/src/newtab/interactions.ts')) {
    return 'newtab-interactions'
  }
  if (normalizedId.includes('/src/newtab/icon-settings.ts')) {
    return 'newtab-icon-settings'
  }
  if (normalizedId.includes('/src/newtab/folder-settings.ts')) {
    return 'newtab-folder-settings'
  }
  if (normalizedId.includes('/src/newtab/search-engines.ts')) {
    return 'newtab-search-engines'
  }
  if (normalizedId.includes('/src/shared/newtab-workspace-settings.ts')) {
    return 'newtab-workspace-settings'
  }
  if (normalizedId.includes('/src/newtab/favicon-cache.ts')) {
    return 'newtab-favicon-cache'
  }
  return undefined
}

function sharedCoreChunks(id: string): string | undefined {
  const normalizedId = id.replaceAll('\\', '/')
  if (normalizedId.includes('/src/shared/text.ts')) {
    return 'shared-text'
  }
  if (normalizedId.includes('/src/shared/constants.ts')) {
    return 'shared-constants'
  }
  if (normalizedId.includes('/src/shared/format.ts')) {
    return 'shared-format'
  }
  if (
    normalizedId.includes('/src/shared/storage.ts') ||
    normalizedId.includes('/src/shared/bookmark-tags.ts') ||
    normalizedId.includes('/src/shared/content-snapshots.ts') ||
    normalizedId.includes('/src/shared/repositories/')
  ) {
    return 'shared-core'
  }
  return undefined
}

function sharedSearchChunks(id: string): string | undefined {
  const normalizedId = id.replaceAll('\\', '/')
  if (normalizedId.includes('/src/shared/search/pinyin.ts')) {
    return undefined
  }
  if (
    normalizedId.includes('/src/popup/search.ts') ||
    normalizedId.includes('/src/popup/search-lookup.ts') ||
    normalizedId.includes('/src/popup/search-index.ts') ||
    normalizedId.includes('/src/shared/search-query.ts') ||
    normalizedId.includes('/src/shared/search/')
  ) {
    return 'shared-search'
  }
  if (normalizedId.includes('/src/shared/newtab-workspace-settings.ts')) {
    return 'newtab-workspace-settings'
  }
  return undefined
}

export default defineConfig(({ mode }) => {
  const debugSourcemap = mode === 'debug' || process.env.CURATOR_DEBUG_SOURCEMAP === '1'
  const buildId = randomUUID()
  const { publicKey, oauth } = resolveSyncOAuthBuild(loadEnv(mode, process.cwd(), 'CURATOR_'), { release: mode === 'release' })
  const buildManifest = { ...manifest, ...(publicKey ? { key: publicKey } : {}) }

  return {
    define: { __CURATOR_BUILD_ID__: JSON.stringify(buildId) },
    plugins: [react(), tailwindcss(), syncEnginePlugin(!debugSourcemap, buildId, oauth), instantWallpaperBootPlugin(!debugSourcemap), popupPrebootPlugin(!debugSourcemap), crx({ manifest: buildManifest })],
    build: {
      outDir: mode === 'release' ? 'release/dist' : 'dist',
      emptyOutDir: true,
      modulePreload: false,
      sourcemap: debugSourcemap,
      rollupOptions: {
        input: { archive: 'src/archive/archive.html' },
        output: {
          codeSplitting: {
            groups: [
              {
                priority: 40,
                name(id) {
                  return sharedCoreChunks(id)
                }
              },
              {
                priority: 30,
                name(id) {
                  return sharedSearchChunks(id)
                }
              },
              {
                priority: 20,
                name(id) {
                  return id.replaceAll('\\', '/').includes('/src/shared/search/pinyin.ts')
                    ? 'shared-pinyin'
                    : undefined
                }
              },
              {
                priority: 10,
                name(id) {
                  return manualChunks(id)
                }
              }
            ]
          }
        }
      }
    }
  }
})
