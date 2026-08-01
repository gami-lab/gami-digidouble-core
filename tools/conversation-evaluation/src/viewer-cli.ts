#!/usr/bin/env node

import { DEFAULT_EVALUATION_OUTPUT_PATH } from './config.js'
import { startReportViewer } from './viewer.js'

export type ViewerCliIo = {
  log(message: string): void
  error(message: string): void
}

type ViewerConfig = {
  reportPath: string
  host: string
  port: number
}

export async function runViewerCli(
  argv: readonly string[] = process.argv.slice(2),
  io: ViewerCliIo = { log: console.log, error: console.error },
): Promise<number> {
  try {
    const config = parseViewerArgs(argv)
    if (config === null) {
      printHelp(io)
      return 0
    }
    const viewer = await startReportViewer(config)
    io.log(`Conversation evaluation report viewer: ${viewer.url}`)
    io.log(`Report: ${viewer.reportPath}`)
    io.log('Press Ctrl+C to stop.')
    await new Promise<void>((resolve) => {
      const stop = (): void => {
        process.removeListener('SIGINT', stop)
        void viewer.close().then(resolve)
      }
      process.once('SIGINT', stop)
    })
    return 0
  } catch (error: unknown) {
    io.error(error instanceof Error ? error.message : 'Unable to start report viewer.')
    return 1
  }
}

function parseViewerArgs(argv: readonly string[]): ViewerConfig | null {
  const config: ViewerConfig = {
    reportPath: DEFAULT_EVALUATION_OUTPUT_PATH,
    host: '127.0.0.1',
    port: 4173,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help') return null
    if (argument === '--report') {
      config.reportPath = requiredValue(argv, ++index, '--report')
    } else if (argument === '--host') {
      config.host = requiredValue(argv, ++index, '--host')
    } else if (argument === '--port') {
      const port = Number.parseInt(requiredValue(argv, ++index, '--port'), 10)
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error('Port must be an integer between 0 and 65535.')
      }
      config.port = port
    } else {
      throw new Error(`Unknown option ${argument ?? 'unknown'}.`)
    }
  }
  return config
}

function requiredValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index]
  if (value === undefined || value.startsWith('--')) throw new Error(`${option} requires a value.`)
  return value
}

function printHelp(io: ViewerCliIo): void {
  io.log(
    [
      'Conversation evaluation report viewer',
      '',
      'Usage:',
      `  pnpm --filter @gami/conversation-evaluation view --report ./${DEFAULT_EVALUATION_OUTPUT_PATH}`,
      '',
      'Options:',
      `  --report <path>  JSON report path (default: ./${DEFAULT_EVALUATION_OUTPUT_PATH})`,
      '  --host <host>    Bind host (default: 127.0.0.1)',
      '  --port <port>    Bind port (default: 4173; use 0 for an available port)',
    ].join('\n'),
  )
}

if (process.argv[1]?.endsWith('/viewer-cli.ts') === true) {
  void runViewerCli().then((exitCode) => {
    process.exitCode = exitCode
  })
}
