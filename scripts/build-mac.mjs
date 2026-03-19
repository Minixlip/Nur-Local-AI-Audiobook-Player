import { spawnSync } from 'node:child_process'
import process from 'node:process'

if (process.platform !== 'darwin') {
  console.error('[build:mac] macOS builds must be run on a Mac host.')
  process.exit(1)
}

const targetArch = process.arch === 'arm64' ? 'arm64' : 'x64'

const result = spawnSync('npx', ['electron-builder', '--mac', `--${targetArch}`], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}
