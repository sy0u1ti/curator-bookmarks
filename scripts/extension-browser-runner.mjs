import { access } from 'node:fs/promises'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export async function relaunchWithXvfbIfNeeded(importMetaUrl) {
  if (process.platform !== 'linux' || process.env.DISPLAY || process.env.CURATOR_XVFB_RELAUNCHED === '1') {
    return false
  }

  if (!commandExists('xvfb-run')) {
    return false
  }

  const scriptPath = fileURLToPath(importMetaUrl)
  const child = spawn('xvfb-run', [
    '-a',
    process.execPath,
    scriptPath,
    ...process.argv.slice(2)
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      CURATOR_XVFB_RELAUNCHED: '1'
    }
  })

  const code = await new Promise((resolve) => {
    child.on('close', resolve)
    child.on('error', () => resolve(1))
  })
  process.exit(Number(code) || 0)
}

export async function assertDistReady(distDir) {
  try {
    await access(`${distDir}/manifest.json`)
  } catch {
    throw new Error('dist/manifest.json not found - run npm run build first')
  }
}

export function getExtensionLaunchOptions(distDir, extraOptions = {}) {
  return {
    headless: false,
    ...extraOptions,
    args: [
      ...(extraOptions.args || []),
      `--disable-extensions-except=${distDir}`,
      `--load-extension=${distDir}`
    ]
  }
}

export async function waitForExtensionServiceWorker(context) {
  const existingWorker = context.serviceWorkers().find((worker) => worker.url().startsWith('chrome-extension://'))
  if (existingWorker) {
    return existingWorker
  }
  return context.waitForEvent('serviceworker', {
    timeout: 20000,
    predicate: (candidate) => candidate.url().startsWith('chrome-extension://')
  })
}

function commandExists(command) {
  const result = spawnSync('sh', ['-c', `command -v ${command}`], {
    stdio: 'ignore'
  })
  return result.status === 0
}
