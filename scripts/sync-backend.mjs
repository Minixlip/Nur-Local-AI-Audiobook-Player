import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const platform = process.platform
const isWindows = platform === 'win32'
const backendBinaryName = process.env.NUR_BACKEND_BINARY_NAME || (isWindows ? 'nur_engine.exe' : 'nur_engine')
const sourceRoot = process.env.NUR_BACKEND_SOURCE_DIR || path.join(root, 'nur_backend', 'dist')
const targetRoot = path.join(root, 'nur_backend', 'nur_engine')
const defaultSpeaker = path.join(root, 'nur_backend', 'default_speaker.wav')
const buildMetaFilename = 'build-meta.json'

const log = (message) => {
  console.log(`[backend:sync] ${message}`)
}

const fail = (message) => {
  console.error(`[backend:sync] ${message}`)
  process.exit(1)
}

const statIfExists = (filepath) => {
  try {
    return fs.statSync(filepath)
  } catch {
    return null
  }
}

const candidateSources = [
  path.join(sourceRoot, 'nur_engine'),
  path.join(sourceRoot, backendBinaryName),
  ...(isWindows ? [path.join(sourceRoot, 'nur_engine.exe')] : [])
]

const source = candidateSources.find((candidate) => fs.existsSync(candidate))

if (!source) {
  fail(
    `Missing backend build output for ${platform}. Looked in: ${candidateSources.join(', ')}`
  )
}

const sourceStats = statIfExists(source)
if (!sourceStats) {
  fail(`Unable to stat backend source: ${source}`)
}

fs.rmSync(targetRoot, { recursive: true, force: true })
fs.mkdirSync(targetRoot, { recursive: true })

if (sourceStats.isDirectory()) {
  fs.cpSync(source, targetRoot, { recursive: true })
} else {
  fs.copyFileSync(source, path.join(targetRoot, backendBinaryName))
}

const sourceBuildMeta = path.join(sourceRoot, 'nur_engine', buildMetaFilename)
const sourceRootBuildMeta = path.join(sourceRoot, buildMetaFilename)
const buildMetaSource = fs.existsSync(sourceBuildMeta)
  ? sourceBuildMeta
  : fs.existsSync(sourceRootBuildMeta)
    ? sourceRootBuildMeta
    : null

if (buildMetaSource) {
  fs.copyFileSync(buildMetaSource, path.join(targetRoot, buildMetaFilename))
  log('Copied build-meta.json')
}

if (fs.existsSync(defaultSpeaker)) {
  fs.copyFileSync(defaultSpeaker, path.join(targetRoot, 'default_speaker.wav'))
  log('Copied default_speaker.wav')
} else {
  log(`default_speaker.wav not found at ${defaultSpeaker}`)
}

const expectedBinary = path.join(targetRoot, backendBinaryName)
if (!fs.existsSync(expectedBinary)) {
  const fallbackBinary = path.join(targetRoot, 'nur_engine.exe')
  if (isWindows && backendBinaryName !== 'nur_engine.exe' && fs.existsSync(fallbackBinary)) {
    fs.copyFileSync(fallbackBinary, expectedBinary)
  } else {
    fail(`Backend binary is missing after sync: ${expectedBinary}`)
  }
}

if (!isWindows) {
  fs.chmodSync(expectedBinary, 0o755)
}

log(`Prepared ${targetRoot} for ${platform}`)
