#!/usr/bin/env node
'use strict'

const { spawnSync } = require('child_process')

function buildSteps(env = process.env) {
  const steps = [
    ['Whitespace diff check', ['git', ['diff', '--check']]],
    ['Doctor', [process.execPath, ['scripts/doctor.js']]],
    ['Lint', [process.execPath, ['node_modules/eslint/bin/eslint.js', '.']]],
    ['Typecheck', [process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit']]],
    ['Backend tests', [process.execPath, ['scripts/run-tests.js']]],
    ['Migration verification', [process.execPath, ['scripts/verify-migrations.js']]],
    ['Chromium E2E', [process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--grep-invert', '@visual', '--project=chromium']]],
    ['Build', [process.execPath, ['node_modules/next/dist/bin/next', 'build']]],
  ]

  if (!env.SMOKE_BASE_URL) return steps

  const smokeMode =
    env.SMOKE_REQUIRE_BACKUP_AUTH === '1'
      ? 'Deploy smoke (strict backup auth)'
      : 'Deploy smoke (normal)'
  steps.push([smokeMode, [process.execPath, ['scripts/smoke.js']]])

  return steps
}

function defaultRunCommand(command, args) {
  return spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
}

function runStep(label, command, args, options = {}) {
  const runCommand = options.runCommand ?? defaultRunCommand
  const logger = options.logger ?? console
  const startedAt = Date.now()
  logger.log(`[fairtab] release check: ${label}`)
  const result = runCommand(command, args)
  const duration = ((Date.now() - startedAt) / 1000).toFixed(1)

  if (result.error) {
    logger.error(`[fairtab] ${label} failed to start: ${result.error.message}`)
    return false
  }
  if (result.status !== 0) {
    logger.error(`[fairtab] ${label} failed after ${duration}s`)
    return false
  }

  logger.log(`[fairtab] ${label} passed in ${duration}s`)
  return true
}

function runReleaseCheck(options = {}) {
  const env = options.env ?? process.env
  const logger = options.logger ?? console
  const steps = buildSteps(env)

  for (const [label, [command, args]] of steps) {
    if (!runStep(label, command, args, options)) return 1
  }

  if (!env.SMOKE_BASE_URL) {
    logger.log('[fairtab] skipped deploy smoke; set SMOKE_BASE_URL to include it')
  } else if (env.SMOKE_REQUIRE_BACKUP_AUTH === '1') {
    logger.log('[fairtab] deploy smoke included strict backup auth gate')
  } else {
    logger.log('[fairtab] deploy smoke included without strict backup auth gate')
  }

  logger.log('[fairtab] release check complete')
  return 0
}

if (require.main === module) {
  process.exitCode = runReleaseCheck()
}

module.exports = {
  buildSteps,
  defaultRunCommand,
  runReleaseCheck,
  runStep,
}
