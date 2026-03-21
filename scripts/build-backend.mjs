import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const rootDir = process.cwd()
const backendDir = path.join(rootDir, 'nur_backend')
const specPath = path.join(backendDir, 'nur_engine.spec')
const distDir = path.join(backendDir, 'dist', 'nur_engine')
const buildWorkDir = path.join(backendDir, 'build')
const syncedBackendDir = path.join(backendDir, 'nur_engine')
const defaultSpeakerPath = path.join(backendDir, 'default_speaker.wav')
const platform = process.platform
const arch = process.arch
const buildMetaFilename = 'build-meta.json'

const backendBinaryName = platform === 'win32' ? 'nur_engine.exe' : 'nur_engine'
const builtBinaryPath = path.join(buildWorkDir, 'nur_engine', backendBinaryName)
const expectedBinaryPath = path.join(distDir, backendBinaryName)
const buildMetaPath = path.join(distDir, buildMetaFilename)
const syncedBuildMetaPath = path.join(syncedBackendDir, buildMetaFilename)
const syncedBackendBinaryPath = path.join(syncedBackendDir, backendBinaryName)
const requirementsPath = path.join(backendDir, 'requirements.txt')
const platformRequirementsPath = path.join(
  backendDir,
  platform === 'win32'
    ? 'requirements.windows.txt'
    : platform === 'darwin'
      ? 'requirements.macos.txt'
      : 'requirements.linux.txt'
)

const venvDir = path.join(backendDir, `.build-env-${platform}-${arch}`)
const venvPython =
  platform === 'win32'
    ? path.join(venvDir, 'Scripts', 'python.exe')
    : path.join(venvDir, 'bin', 'python3')

const log = (message) => {
  console.log(`[backend:build] ${message}`)
}

const fail = (message) => {
  console.error(`[backend:build] ${message}`)
  process.exit(1)
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: backendDir,
    stdio: 'inherit',
    ...options
  })

  if (result.status !== 0) {
    fail(`Command failed: ${command} ${args.join(' ')}`)
  }
}

const canRun = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: backendDir,
    stdio: 'ignore'
  })
  return result.status === 0
}

const capture = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: backendDir,
    encoding: 'utf-8',
    ...options
  })

  if (result.status !== 0) {
    fail(`Command failed: ${command} ${args.join(' ')}`)
  }

  return (result.stdout || '').trim()
}

const readBuildMeta = () => {
  if (!fs.existsSync(buildMetaPath)) {
    return null
  }

  try {
    return JSON.parse(fs.readFileSync(buildMetaPath, 'utf-8'))
  } catch {
    return null
  }
}

const shouldHashBackendFile = (relativePath) => {
  const normalized = relativePath.replace(/\\/g, '/')

  if (
    normalized.startsWith('dist/') ||
    normalized.startsWith('build/') ||
    normalized.startsWith('nur_engine/') ||
    normalized.startsWith('__pycache__/')
  ) {
    return false
  }

  if (normalized.startsWith('.build-env-')) {
    return false
  }

  return (
    normalized.endsWith('.py') ||
    normalized.endsWith('.spec') ||
    normalized.endsWith('.txt') ||
    normalized.endsWith('.wav')
  )
}

const collectBackendSourceFiles = (directory, base = directory) => {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    const relativePath = path.relative(base, fullPath)

    if (entry.isDirectory()) {
      if (
        entry.name === 'dist' ||
        entry.name === 'build' ||
        entry.name === 'nur_engine' ||
        entry.name === '__pycache__' ||
        entry.name.startsWith('.build-env-')
      ) {
        continue
      }
      files.push(...collectBackendSourceFiles(fullPath, base))
      continue
    }

    if (shouldHashBackendFile(relativePath)) {
      files.push(fullPath)
    }
  }

  return files
}

const backendSourceHash = () => {
  const hash = createHash('sha256')
  const files = collectBackendSourceFiles(backendDir).sort((left, right) =>
    left.localeCompare(right)
  )

  for (const filePath of files) {
    const relativePath = path.relative(backendDir, filePath).replace(/\\/g, '/')
    hash.update(relativePath)
    hash.update('\n')
    hash.update(fs.readFileSync(filePath))
    hash.update('\n')
  }

  return hash.digest('hex')
}

const sourceHash = backendSourceHash()

const writeBuildMeta = (pythonVersion) => {
  fs.mkdirSync(distDir, { recursive: true })
  fs.writeFileSync(
    buildMetaPath,
    JSON.stringify(
      {
        platform,
        arch,
        pythonVersion,
        sourceHash
      },
      null,
      2
    )
  )
}

const resolveSystemPython = () => {
  if (process.env.NUR_BACKEND_PYTHON) {
    return {
      command: process.env.NUR_BACKEND_PYTHON,
      args: []
    }
  }

  const candidates =
    platform === 'win32'
      ? [
          { command: 'py', args: ['-3.11'] },
          { command: 'py', args: ['-3.10'] },
          { command: 'py', args: ['-3'] },
          { command: 'python', args: [] },
          { command: 'python3', args: [] }
        ]
      : [
          { command: 'python3.11', args: [] },
          { command: 'python3.10', args: [] },
          { command: 'python3', args: [] },
          { command: 'python', args: [] }
        ]

  return (
    candidates.find((candidate) =>
      canRun(candidate.command, [...candidate.args, '-c', 'import sys; sys.exit(0)'])
    ) || null
  )
}

if (!fs.existsSync(specPath)) {
  fail(`Missing PyInstaller spec: ${specPath}`)
}

if (!fs.existsSync(requirementsPath)) {
  fail(`Missing backend requirements file: ${requirementsPath}`)
}

if (!fs.existsSync(platformRequirementsPath)) {
  fail(`Missing platform backend requirements file: ${platformRequirementsPath}`)
}

const existingBuildMeta = readBuildMeta()

if (fs.existsSync(expectedBinaryPath) && process.env.NUR_BACKEND_REBUILD !== '1') {
  if (
    existingBuildMeta?.platform === platform &&
    existingBuildMeta?.arch === arch &&
    existingBuildMeta?.sourceHash === sourceHash
  ) {
    log(`Reusing existing backend build: ${expectedBinaryPath}`)
    process.exit(0)
  }

  log(
    `Discarding stale backend build metadata (${existingBuildMeta?.platform || 'unknown'}/${existingBuildMeta?.arch || 'unknown'} / ${existingBuildMeta?.sourceHash || 'missing'}) for ${platform}/${arch}.`
  )
}

if (
  platform === 'win32' &&
  !fs.existsSync(expectedBinaryPath) &&
  fs.existsSync(syncedBackendBinaryPath) &&
  fs.existsSync(syncedBuildMetaPath) &&
  process.env.NUR_BACKEND_REBUILD !== '1'
) {
  try {
    const syncedMeta = JSON.parse(fs.readFileSync(syncedBuildMetaPath, 'utf-8'))
    if (
      syncedMeta?.platform === platform &&
      syncedMeta?.arch === arch &&
      syncedMeta?.sourceHash === sourceHash
    ) {
      log(`Restoring backend build output from ${syncedBackendDir}`)
      fs.rmSync(distDir, { recursive: true, force: true })
      fs.mkdirSync(path.dirname(distDir), { recursive: true })
      fs.cpSync(syncedBackendDir, distDir, { recursive: true })
      process.exit(0)
    }
  } catch {
    log(`Ignoring unreadable synced backend metadata at ${syncedBuildMetaPath}`)
  }
}

const python = resolveSystemPython()
if (!python) {
  fail(
    'Python 3.10 or 3.11 is required to build the backend. Set NUR_BACKEND_PYTHON to a working interpreter.'
  )
}

const pythonVersion = capture(python.command, [
  ...python.args,
  '-c',
  'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")'
])

if (!['3.10', '3.11'].includes(pythonVersion)) {
  fail(
    `Unsupported Python version ${pythonVersion}. The Chatterbox + Piper backend currently supports Python 3.10 or 3.11.`
  )
}

if (platform === 'darwin') {
  log(`Preparing macOS backend for ${arch}.`)
  if (arch === 'x64') {
    log('Intel macOS builds are less tested than Apple Silicon. Validate Chatterbox carefully on target hardware.')
  }
}

if (!fs.existsSync(venvPython)) {
  log(`Creating backend virtual environment at ${venvDir}`)
  run(python.command, [...python.args, '-m', 'venv', venvDir], { cwd: rootDir })
}

log('Upgrading backend build tooling...')
run(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip', 'setuptools', 'wheel'])

log('Installing PyInstaller...')
run(venvPython, ['-m', 'pip', 'install', 'pyinstaller'])

log(`Installing backend dependencies for ${platform}...`)
run(venvPython, [
  '-m',
  'pip',
  'install',
  '-r',
  requirementsPath,
  '-r',
  platformRequirementsPath
])

log('Cleaning previous backend build artifacts...')
fs.rmSync(distDir, { recursive: true, force: true })
fs.rmSync(buildWorkDir, { recursive: true, force: true })

log('Building backend executable with PyInstaller...')
run(venvPython, ['-m', 'PyInstaller', '--noconfirm', 'nur_engine.spec'])

if (!fs.existsSync(expectedBinaryPath) && fs.existsSync(builtBinaryPath)) {
  log(`Restoring collected backend executable from build output: ${builtBinaryPath}`)
  fs.mkdirSync(distDir, { recursive: true })
  fs.copyFileSync(builtBinaryPath, expectedBinaryPath)
}

if (!fs.existsSync(expectedBinaryPath)) {
  fail(`Backend build completed but expected binary is missing: ${expectedBinaryPath}`)
}

if (fs.existsSync(defaultSpeakerPath)) {
  fs.copyFileSync(defaultSpeakerPath, path.join(distDir, 'default_speaker.wav'))
  log(`Bundled default speaker into backend build: ${path.join(distDir, 'default_speaker.wav')}`)
} else {
  log(`Default speaker file not found at ${defaultSpeakerPath}`)
}

writeBuildMeta(pythonVersion)

log(`Backend build is ready: ${expectedBinaryPath}`)
