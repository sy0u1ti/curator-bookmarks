import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workDir = resolve(rootDir, '.tmp', 'ai-runtime-tests')
const distDir = resolve(workDir, 'dist')
const tsconfigPath = resolve(workDir, 'tsconfig.json')
const tscPath = resolve(rootDir, 'node_modules', 'typescript', 'bin', 'tsc')

await rm(workDir, { recursive: true, force: true })
await mkdir(workDir, { recursive: true })
await writeFile(tsconfigPath, JSON.stringify({
  extends: '../../tsconfig.json',
  compilerOptions: {
    noEmit: false,
    outDir: './dist',
    rootDir: '../../src',
    types: ['chrome', 'node']
  },
  include: [
    '../../src/shared/ai-runtime.ts',
    '../../src/shared/ai-runtime.test.ts',
    '../../src/shared/ai-response.ts',
    '../../src/shared/ai-provider-url.ts'
  ]
}, null, 2))

await run(process.execPath, [tscPath, '-p', tsconfigPath], rootDir)
await run(process.execPath, [resolve(distDir, 'shared', 'ai-runtime.test.js')], rootDir)

function run(command, args, cwd) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit'
    })

    child.on('error', rejectRun)
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolveRun()
        return
      }
      rejectRun(new Error(`${command} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`))
    })
  })
}
