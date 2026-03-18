import fs from 'fs'
import path from 'path'

const ensureDirectoryForFile = (filepath: string) => {
  fs.mkdirSync(path.dirname(filepath), { recursive: true })
}

export const readJsonFile = <T>(filepath: string, fallback: T): T => {
  const backupPath = `${filepath}.bak`

  const tryRead = (targetPath: string): T | null => {
    if (!fs.existsSync(targetPath)) return null
    try {
      return JSON.parse(fs.readFileSync(targetPath, 'utf-8')) as T
    } catch {
      return null
    }
  }

  return tryRead(filepath) ?? tryRead(backupPath) ?? fallback
}

export const writeJsonAtomic = (filepath: string, value: unknown) => {
  ensureDirectoryForFile(filepath)

  const tempPath = `${filepath}.tmp`
  const backupPath = `${filepath}.bak`
  const payload = `${JSON.stringify(value, null, 2)}\n`

  if (fs.existsSync(filepath)) {
    try {
      fs.copyFileSync(filepath, backupPath)
    } catch {}
  }

  fs.writeFileSync(tempPath, payload, 'utf-8')
  fs.renameSync(tempPath, filepath)
}
