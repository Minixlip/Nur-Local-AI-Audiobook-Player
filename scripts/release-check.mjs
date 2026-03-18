import fs from 'fs'
import path from 'path'
import process from 'process'

const rootDir = process.cwd()

const fail = (message) => {
  console.error(`release-check: ${message}`)
  process.exit(1)
}

const readJson = (relativePath) => {
  const absolutePath = path.join(rootDir, relativePath)
  return JSON.parse(fs.readFileSync(absolutePath, 'utf-8'))
}

const readText = (relativePath) => {
  const absolutePath = path.join(rootDir, relativePath)
  return fs.readFileSync(absolutePath, 'utf-8')
}

const expectFile = (relativePath) => {
  if (!fs.existsSync(path.join(rootDir, relativePath))) {
    fail(`Missing required file: ${relativePath}`)
  }
}

const expectIncludes = (contents, expected, label) => {
  if (!contents.includes(expected)) {
    fail(`Expected ${label} to include: ${expected}`)
  }
}

const packageJson = readJson('package.json')
const builderConfig = readText('electron-builder.yml')

if (!packageJson.description || /electron application/i.test(packageJson.description)) {
  fail('package.json description still looks generic.')
}

if (!packageJson.author || /example\.com/i.test(String(packageJson.author))) {
  fail('package.json author is still a placeholder.')
}

if (!packageJson.homepage || /electron-vite/i.test(String(packageJson.homepage))) {
  fail('package.json homepage is still a scaffold placeholder.')
}

if (!packageJson.repository?.url) {
  fail('package.json repository.url is missing.')
}

expectIncludes(builderConfig, 'appId: com.minixlip.nur', 'electron-builder.yml appId')
expectIncludes(builderConfig, 'productName: Nur', 'electron-builder.yml productName')
expectIncludes(builderConfig, 'target: nsis', 'electron-builder.yml Windows target')
expectIncludes(builderConfig, 'provider: github', 'electron-builder.yml publish provider')
expectIncludes(builderConfig, 'owner: Minixlip', 'electron-builder.yml publish owner')
expectIncludes(builderConfig, 'repo: nur', 'electron-builder.yml publish repo')

expectFile('build/icon.ico')
expectFile('build/icon.icns')
expectFile('build/icon.png')
expectFile('nur_backend/default_speaker.wav')
expectFile('src/main/index.ts')
expectFile('src/preload/index.ts')
expectFile('src/renderer/src/App.tsx')

console.log('release-check: OK')
