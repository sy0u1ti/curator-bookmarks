import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { parseEgoSpaceArg, prepareIsolatedQaExtension, runEgoScenario } from './testing/ego-qa-extension.mjs'

// Runs the real built extension inside an isolated agent-owned Ego TaskSpace
// with isolated bookmark & tab shims so user bookmarks and tabs are never touched.
const space = parseEgoSpaceArg()
const root = path.resolve('.tmp', `ext-bookmark-mgmt-${Date.now()}`)
const output = path.resolve('output/playwright/extension-bookmark-management')
await mkdir(output, { recursive: true })

const extension = await prepareIsolatedQaExtension({
  name: 'Curator QA extension bookmark management',
  root
})

await runEgoScenario({
  root,
  space,
  title: `Curator extension bookmark management QA ${Date.now()}`,
  scenarioFile: 'src/testing/extension-bookmark-management-scenarios.mjs',
  exportName: 'runExtensionBookmarkManagementChecks',
  config: {
    extension: extension.replaceAll('\\', '/'),
    output: output.replaceAll('\\', '/')
  }
})
