import { spawn } from 'node:child_process'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

const checks = [
  ['typecheck', ['run', 'typecheck']],
  ['build', ['run', 'build']]
]

for (const [label, args] of checks) {
  await runCheck(label, args)
}

console.log('All project tests passed.')

function runCheck(label, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n> ${label}`)
    const child = process.platform === 'win32'
      ? spawn('cmd.exe', ['/d', '/s', '/c', [npmCommand, ...args].join(' ')], {
          stdio: 'inherit'
        })
      : spawn(npmCommand, args, {
          stdio: 'inherit'
        })

    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${label} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`))
    })
  })
}
