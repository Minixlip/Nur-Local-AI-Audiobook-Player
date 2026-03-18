import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import util from 'util'

const logDateStamp = new Date().toISOString().slice(0, 10)
const logsDir = path.join(app.getPath('userData'), 'logs')
const mainLogPath = path.join(logsDir, `main-${logDateStamp}.log`)
const backendLogPath = path.join(logsDir, `backend-${logDateStamp}.log`)

let loggerInstalled = false

const stringifyArg = (value: unknown) =>
  typeof value === 'string'
    ? value
    : util.inspect(value, { depth: 6, colors: false, breakLength: Infinity, compact: true })

const appendLog = (level: string, args: unknown[]) => {
  fs.mkdirSync(logsDir, { recursive: true })
  const line = `[${new Date().toISOString()}] [${level}] ${args.map(stringifyArg).join(' ')}\n`
  fs.appendFileSync(mainLogPath, line, 'utf-8')
}

export const appendBackendLogLine = (message: string) => {
  fs.mkdirSync(logsDir, { recursive: true })
  const line = `[${new Date().toISOString()}] ${message}\n`
  fs.appendFileSync(backendLogPath, line, 'utf-8')
}

export const getLogsDir = () => {
  fs.mkdirSync(logsDir, { recursive: true })
  return logsDir
}

export const getMainLogPath = () => {
  fs.mkdirSync(logsDir, { recursive: true })
  return mainLogPath
}

export const getBackendLogPath = () => {
  fs.mkdirSync(logsDir, { recursive: true })
  return backendLogPath
}

export const installFileLogger = () => {
  if (loggerInstalled) return
  loggerInstalled = true

  const original = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
  }

  console.log = (...args: unknown[]) => {
    appendLog('INFO', args)
    original.log(...args)
  }

  console.info = (...args: unknown[]) => {
    appendLog('INFO', args)
    original.info(...args)
  }

  console.warn = (...args: unknown[]) => {
    appendLog('WARN', args)
    original.warn(...args)
  }

  console.error = (...args: unknown[]) => {
    appendLog('ERROR', args)
    original.error(...args)
  }

  process.on('uncaughtException', (error) => {
    appendLog('FATAL', ['Uncaught exception', error])
    original.error(error)
  })

  process.on('unhandledRejection', (reason) => {
    appendLog('FATAL', ['Unhandled rejection', reason])
    original.error(reason)
  })

  appendLog('INFO', ['Logger initialized', { mainLogPath }])
}
