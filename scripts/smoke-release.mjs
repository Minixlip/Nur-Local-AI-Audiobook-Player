import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import process from 'process'

const rootDir = process.cwd()

const candidateExecutables = [
  path.join(rootDir, 'dist', 'win-unpacked', 'Nur.exe'),
  path.join(rootDir, 'dist', 'win-unpacked', 'nur.exe'),
  path.join(rootDir, 'dist', 'mac', 'Nur.app', 'Contents', 'MacOS', 'Nur'),
  path.join(rootDir, 'dist', 'mac-arm64', 'Nur.app', 'Contents', 'MacOS', 'Nur'),
  path.join(rootDir, 'dist', 'mac-x64', 'Nur.app', 'Contents', 'MacOS', 'Nur'),
  path.join(rootDir, 'dist', 'linux-unpacked', 'nur')
]

const executablePath = candidateExecutables.find((candidate) => fs.existsSync(candidate))

if (!executablePath) {
  console.error(
    'smoke-release: no unpacked executable found. Run `npm run build:unpack` first.'
  )
  process.exit(1)
}

console.log(`smoke-release: launching ${executablePath}`)

const child = spawn(executablePath, [], {
  cwd: path.dirname(executablePath),
  env: {
    ...process.env,
    NUR_SMOKE_TEST: '1'
  },
  stdio: 'inherit'
})

child.on('exit', (code, signal) => {
  if (code === 0) {
    console.log('smoke-release: OK')
    process.exit(0)
    return
  }

  console.error(
    `smoke-release: failed with ${signal ? `signal ${signal}` : `exit code ${code ?? 'unknown'}`}`
  )
  process.exit(code ?? 1)
})
