import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { parseEgoSpaceArg, prepareIsolatedQaExtension, runEgoScenario } from '../testing/ego-qa-extension.mjs'

// Runs the real built extension inside an isolated agent-owned Ego TaskSpace
// with isolated bookmark & tab shims so user bookmarks and tabs are never touched.
const space = parseEgoSpaceArg()
const root = path.resolve('.tmp', `popup-folder-mgmt-${Date.now()}`)
const output = path.resolve('output/playwright/popup-folder-management')
await mkdir(output, { recursive: true })

const extension = await prepareIsolatedQaExtension({
  name: 'Curator QA popup folder management',
  root
})

await runEgoScenario({
  root,
  space,
  title: `Curator popup folder management QA ${Date.now()}`,
  scenarioFile: 'src/testing/popup-folder-management-scenarios.mjs',
  exportName: 'runPopupFolderManagementChecks',
  config: {
    extension: extension.replaceAll('\\', '/'),
    output: output.replaceAll('\\', '/')
  }
})
