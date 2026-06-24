#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const DEFAULT_ENV = process.env
const DEFAULT_CWD = process.cwd()

function defaultRunCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })

  if (result.error) {
    return {
      status: null,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      error: result.error.message,
    }
  }

  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    error: null,
  }
}

function parseMajorVersion(value) {
  const match = String(value).trim().match(/^v?(\d+)/)
  return match ? Number(match[1]) : null
}

function parseMinimumMajor(range) {
  const match = String(range).match(/>=\s*(\d+)/)
  return match ? Number(match[1]) : null
}

function createCheck(status, label, detail) {
  return { status, label, detail }
}

function checkNodeVersion({ packageJson, nodeVersion }) {
  const minimumMajor = parseMinimumMajor(packageJson.engines?.node ?? '')
  const actualMajor = parseMajorVersion(nodeVersion)

  if (minimumMajor && (!actualMajor || actualMajor < minimumMajor)) {
    return createCheck('error', 'Node.js', `${nodeVersion} does not satisfy ${packageJson.engines.node}`)
  }

  return createCheck('ok', 'Node.js', `${nodeVersion} satisfies ${packageJson.engines?.node ?? 'project engine'}`)
}

function checkNpm({ packageJson, directCommandsReady, runCommand }) {
  const minimumMajor = parseMinimumMajor(packageJson.engines?.npm ?? '')
  const result = runCommand('npm', ['--version'])
  const fallbackStatus = directCommandsReady ? 'warn' : 'error'
  const fallbackHint = directCommandsReady
    ? 'Direct release commands are available from node_modules, so npm is only required for install/update workflows.'
    : 'Install dependencies with npm 10+ before running release checks.'

  if (result.error || result.status !== 0) {
    const detail = result.error || result.stderr.trim() || `npm exited with ${result.status}`
    return createCheck(fallbackStatus, 'npm', `${detail}. ${fallbackHint}`)
  }

  const version = result.stdout.trim()
  const major = parseMajorVersion(version)
  if (minimumMajor && (!major || major < minimumMajor)) {
    return createCheck(
      fallbackStatus,
      'npm',
      `${version || 'unknown version'} does not satisfy >=${minimumMajor}. ${fallbackHint}`
    )
  }

  return createCheck('ok', 'npm', `${version || 'available'} satisfies ${packageJson.engines?.npm ?? 'project engine'}`)
}

function checkReleaseDependencies({ cwd, fileExists, platform }) {
  const binDir = path.join(cwd, 'node_modules', '.bin')
  const commandSuffix = platform === 'win32' ? '.cmd' : ''
  const required = [
    path.join(binDir, `eslint${commandSuffix}`),
    path.join(cwd, 'node_modules', 'typescript', 'bin', 'tsc'),
    path.join(cwd, 'node_modules', '@playwright', 'test', 'cli.js'),
    path.join(cwd, 'node_modules', 'next', 'dist', 'bin', 'next'),
  ]
  const missing = required.filter((filePath) => !fileExists(filePath))

  if (missing.length > 0) {
    return createCheck(
      'error',
      'Release dependencies',
      `Missing local release command files: ${missing.map((filePath) => path.relative(cwd, filePath)).join(', ')}`
    )
  }

  return createCheck('ok', 'Release dependencies', 'Local lint, typecheck, Playwright, and Next commands are installed')
}

function checkMigrationVerifier({ cwd, fileExists }) {
  const required = [
    path.join(cwd, 'scripts', 'verify-migrations.js'),
    path.join(cwd, 'node_modules', 'better-sqlite3', 'package.json'),
  ]
  const missing = required.filter((filePath) => !fileExists(filePath))

  if (missing.length > 0) {
    return createCheck(
      'error',
      'Migration verifier',
      `Missing migration verifier dependency files: ${missing.map((filePath) => path.relative(cwd, filePath)).join(', ')}`
    )
  }

  return createCheck('ok', 'Migration verifier', 'Node migration verifier and better-sqlite3 are available')
}

function checkMigrations({ cwd, readDir }) {
  let files
  try {
    files = readDir(path.join(cwd, 'migrations'))
  } catch (error) {
    return createCheck('error', 'Migrations', `Cannot read migrations directory: ${error.message}`)
  }

  const sqlFiles = files.filter((file) => file.endsWith('.sql')).sort()
  if (sqlFiles.length === 0) {
    return createCheck('error', 'Migrations', 'No SQL migration files found')
  }

  return createCheck('ok', 'Migrations', `${sqlFiles.length} SQL file(s), latest ${sqlFiles.at(-1)}`)
}

function checkPlaywright({ cwd, fileExists, platform, runCommand }) {
  const binary = path.join(cwd, 'node_modules', '.bin', platform === 'win32' ? 'playwright.cmd' : 'playwright')
  const version = runCommand(binary, ['--version'])
  if (version.error || version.status !== 0) {
    const detail = version.error || version.stderr.trim() || `playwright exited with ${version.status}`
    return createCheck('error', 'Playwright', `${detail}. Run npm install before browser checks.`)
  }

  const executable = runCommand(process.execPath, [
    '-e',
    "const { chromium } = require('@playwright/test'); process.stdout.write(chromium.executablePath())",
  ])

  if (executable.error || executable.status !== 0) {
    const detail = executable.error || executable.stderr.trim() || `chromium lookup exited with ${executable.status}`
    return createCheck('error', 'Playwright Chromium', `${detail}. Run npx playwright install chromium.`)
  }

  const executablePath = executable.stdout.trim()
  if (!executablePath || !fileExists(executablePath)) {
    return createCheck(
      'warn',
      'Playwright Chromium',
      `Chromium browser binary is not installed at ${executablePath || '(unknown path)'}; run npx playwright install chromium.`
    )
  }

  return createCheck('ok', 'Playwright', `${version.stdout.trim()}; Chromium binary present`)
}

function checkSmokeEnvironment(env) {
  if (env.SMOKE_BASE_URL && env.SMOKE_REQUIRE_BACKUP_AUTH === '1') {
    return createCheck('ok', 'Deploy smoke', 'Strict backup-auth smoke is enabled')
  }

  if (env.SMOKE_BASE_URL) {
    return createCheck(
      'warn',
      'Deploy smoke',
      'SMOKE_BASE_URL is set, but SMOKE_REQUIRE_BACKUP_AUTH=1 is not; deploy smoke will run in normal mode.'
    )
  }

  if (env.SMOKE_REQUIRE_BACKUP_AUTH === '1') {
    return createCheck(
      'warn',
      'Deploy smoke',
      'SMOKE_REQUIRE_BACKUP_AUTH=1 is set without SMOKE_BASE_URL; release-check will skip deploy smoke.'
    )
  }

  return createCheck('warn', 'Deploy smoke', 'SMOKE_BASE_URL is not set; release-check will skip deploy smoke.')
}

function checkBackupTokenHint(env) {
  if (env.FAIRTAB_BACKUP_TOKEN) {
    return createCheck('ok', 'Backup token', 'FAIRTAB_BACKUP_TOKEN is present in this environment')
  }

  return createCheck(
    'warn',
    'Backup token',
    'FAIRTAB_BACKUP_TOKEN is not set locally; restore execution is disabled unless the deployment configures it.'
  )
}

function buildDoctorReport(options = {}) {
  const cwd = options.cwd ?? DEFAULT_CWD
  const env = options.env ?? DEFAULT_ENV
  const platform = options.platform ?? process.platform
  const runCommand = options.runCommand ?? defaultRunCommand
  const readFile = options.readFile ?? fs.readFileSync
  const readDir = options.readDir ?? fs.readdirSync
  const fileExists = options.fileExists ?? fs.existsSync
  const nodeVersion = options.nodeVersion ?? process.version

  const packageJson = JSON.parse(readFile(path.join(cwd, 'package.json'), 'utf8'))
  const releaseDependencyCheck = checkReleaseDependencies({ cwd, fileExists, platform })
  const migrationVerifierCheck = checkMigrationVerifier({ cwd, fileExists })
  const directCommandsReady =
    releaseDependencyCheck.status === 'ok' && migrationVerifierCheck.status === 'ok'

  const checks = [
    checkNodeVersion({ packageJson, nodeVersion }),
    checkNpm({ packageJson, directCommandsReady, runCommand }),
    releaseDependencyCheck,
    migrationVerifierCheck,
    checkMigrations({ cwd, readDir }),
    checkPlaywright({ cwd, fileExists, platform, runCommand }),
    checkSmokeEnvironment(env),
    checkBackupTokenHint(env),
  ]

  const errors = checks.filter((check) => check.status === 'error')
  const warnings = checks.filter((check) => check.status === 'warn')

  return {
    ok: errors.length === 0,
    checks,
    errorCount: errors.length,
    warningCount: warnings.length,
  }
}

function formatDoctorReport(report) {
  const lines = ['[fairtab] doctor']

  for (const check of report.checks) {
    lines.push(`[${check.status}] ${check.label}: ${check.detail}`)
  }

  if (report.ok) {
    lines.push(`[fairtab] doctor passed with ${report.warningCount} warning(s)`)
  } else {
    lines.push(`[fairtab] doctor failed with ${report.errorCount} error(s) and ${report.warningCount} warning(s)`)
  }

  return lines.join('\n') + '\n'
}

function main() {
  const report = buildDoctorReport()
  const formatted = formatDoctorReport(report)
  if (report.ok) {
    process.stdout.write(formatted)
  } else {
    process.stderr.write(formatted)
    process.exitCode = 1
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  buildDoctorReport,
  checkMigrationVerifier,
  checkNpm,
  checkReleaseDependencies,
  defaultRunCommand,
  formatDoctorReport,
  parseMajorVersion,
  parseMinimumMajor,
}
