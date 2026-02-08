/**
 * Logger
 * Simple structured logging
 */
import { config } from '@config/env'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  data?: Record<string, unknown>
}

class Logger {
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    const configLevel = config.log.level
    return levels.indexOf(level) >= levels.indexOf(configLevel as LogLevel)
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>) {
    if (!this.shouldLog(level)) return

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(data && { data }),
    }

    // In development, pretty print
    if (config.server.isDev) {
      const colorCode = {
        debug: '\x1b[36m', // Cyan
        info: '\x1b[32m', // Green
        warn: '\x1b[33m', // Yellow
        error: '\x1b[31m', // Red
      }[level]

      const reset = '\x1b[0m'
      console.log(
        `${colorCode}[${entry.level.toUpperCase()}]${reset} ${entry.timestamp} - ${entry.message}`,
        data ? JSON.stringify(data, null, 2) : ''
      )
    } else {
      // In production, structured JSON
      console.log(JSON.stringify(entry))
    }
  }

  debug(data: Record<string, unknown>, message: string): void
  debug(message: string): void
  debug(arg1: string | Record<string, unknown>, arg2?: string): void {
    if (typeof arg1 === 'string') {
      this.log('debug', arg1)
    } else {
      this.log('debug', arg2!, arg1)
    }
  }

  info(data: Record<string, unknown>, message: string): void
  info(message: string): void
  info(arg1: string | Record<string, unknown>, arg2?: string): void {
    if (typeof arg1 === 'string') {
      this.log('info', arg1)
    } else {
      this.log('info', arg2!, arg1)
    }
  }

  warn(data: Record<string, unknown>, message: string): void
  warn(message: string): void
  warn(arg1: string | Record<string, unknown>, arg2?: string): void {
    if (typeof arg1 === 'string') {
      this.log('warn', arg1)
    } else {
      this.log('warn', arg2!, arg1)
    }
  }

  error(data: Record<string, unknown>, message: string): void
  error(message: string): void
  error(arg1: string | Record<string, unknown>, arg2?: string): void {
    if (typeof arg1 === 'string') {
      this.log('error', arg1)
    } else {
      this.log('error', arg2!, arg1)
    }
  }
}

export const logger = new Logger()
