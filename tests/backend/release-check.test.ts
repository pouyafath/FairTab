import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { describe, it } from 'node:test'

const require = createRequire(import.meta.url)
const {
  buildSteps,
  runReleaseCheck,
} = require('../../scripts/release-check.js') as {
  buildSteps: (env?: Record<string, string>) => Array<[string, [string, string[]]]>
  runReleaseCheck: (options: {
    env?: Record<string, string>
    logger?: { log: (message: string) => void; error: (message: string) => void }
    runCommand?: (command: string, args: string[]) => { status: number; error?: Error | null }
  }) => number
}

function captureLogger() {
  const logs: string[] = []
  const errors: string[] = []

  return {
    logger: {
      log: (message: string) => logs.push(message),
      error: (message: string) => errors.push(message),
    },
    logs,
    errors,
  }
}

describe('release check script', () => {
  it('runs direct release gates in release order', () => {
    assert.deepEqual(
      buildSteps({}).map(([label]) => label),
      [
        'Whitespace diff check',
        'Doctor',
        'Lint',
        'Typecheck',
        'Backend tests',
        'Migration verification',
        'Chromium E2E',
        'Build',
      ]
    )
  })

  it('labels deploy smoke mode clearly', () => {
    assert.deepEqual(
      buildSteps({ SMOKE_BASE_URL: 'https://fairtab.example.com' }).map(([label]) => label),
      [
        'Whitespace diff check',
        'Doctor',
        'Lint',
        'Typecheck',
        'Backend tests',
        'Migration verification',
        'Chromium E2E',
        'Build',
        'Deploy smoke (normal)',
      ]
    )

    assert.deepEqual(
      buildSteps({
        SMOKE_BASE_URL: 'https://fairtab.example.com',
        SMOKE_REQUIRE_BACKUP_AUTH: '1',
      }).map(([label]) => label),
      [
        'Whitespace diff check',
        'Doctor',
        'Lint',
        'Typecheck',
        'Backend tests',
        'Migration verification',
        'Chromium E2E',
        'Build',
        'Deploy smoke (strict backup auth)',
      ]
    )
  })

  it('stops on the first failed gate and reports the failed label', () => {
    const { logger, logs, errors } = captureLogger()
    const commands: string[] = []

    const status = runReleaseCheck({
      env: {},
      logger,
      runCommand: (command, args) => {
        commands.push(`${command} ${args.join(' ')}`)
        if (args.join(' ') === 'scripts/doctor.js') return { status: 1, error: null }
        return { status: 0, error: null }
      },
    })

    assert.equal(status, 1)
    assert.deepEqual(commands, ['git diff --check', `${process.execPath} scripts/doctor.js`])
    assert.match(logs.join('\n'), /release check: Doctor/)
    assert.match(errors.join('\n'), /Doctor failed/)
  })

  it('runs strict smoke after build when requested', () => {
    const { logger, logs, errors } = captureLogger()
    const commands: string[] = []

    const status = runReleaseCheck({
      env: {
        SMOKE_BASE_URL: 'https://fairtab.example.com',
        SMOKE_REQUIRE_BACKUP_AUTH: '1',
      },
      logger,
      runCommand: (command, args) => {
        commands.push(`${command} ${args.join(' ')}`)
        return { status: 0, error: null }
      },
    })

    assert.equal(status, 0)
    assert.deepEqual(commands, [
      'git diff --check',
      `${process.execPath} scripts/doctor.js`,
      `${process.execPath} node_modules/eslint/bin/eslint.js .`,
      `${process.execPath} node_modules/typescript/bin/tsc --noEmit`,
      `${process.execPath} --import ./tests/register-loader.mjs --test tests/**/*.test.ts`,
      `${process.execPath} scripts/verify-migrations.js`,
      `${process.execPath} node_modules/@playwright/test/cli.js test --grep-invert @visual --project=chromium`,
      `${process.execPath} node_modules/next/dist/bin/next build`,
      `${process.execPath} scripts/smoke.js`,
    ])
    assert.equal(errors.length, 0)
    assert.match(logs.join('\n'), /strict backup auth gate/)
  })
})
