import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { describe, it } from 'node:test'

const require = createRequire(import.meta.url)
const {
  buildDoctorReport,
  formatDoctorReport,
  parseMajorVersion,
  parseMinimumMajor,
} = require('../../scripts/doctor.js') as {
  buildDoctorReport: (options: Record<string, unknown>) => {
    ok: boolean
    checks: Array<{ status: string; label: string; detail: string }>
    errorCount: number
    warningCount: number
  }
  formatDoctorReport: (report: {
    ok: boolean
    checks: Array<{ status: string; label: string; detail: string }>
    errorCount: number
    warningCount: number
  }) => string
  parseMajorVersion: (value: string) => number | null
  parseMinimumMajor: (range: string) => number | null
}

function packageJson() {
  return JSON.stringify({
    engines: {
      node: '>=20',
      npm: '>=10',
    },
  })
}

function successfulRunCommand(command: string, args: string[]) {
  if (command === 'npm') return { status: 0, stdout: '10.9.0\n', stderr: '', error: null }
  if (command.endsWith('node_modules/.bin/playwright')) {
    return { status: 0, stdout: 'Version 1.61.0\n', stderr: '', error: null }
  }
  if (args.includes("const { chromium } = require('@playwright/test'); process.stdout.write(chromium.executablePath())")) {
    return { status: 0, stdout: '/playwright/chromium\n', stderr: '', error: null }
  }

  return { status: 1, stdout: '', stderr: `unexpected command ${command}`, error: null }
}

function installedFileExists(filePath: string) {
  return (
    filePath === '/playwright/chromium' ||
    filePath.endsWith('node_modules/.bin/eslint') ||
    filePath.endsWith('node_modules/typescript/bin/tsc') ||
    filePath.endsWith('node_modules/@playwright/test/cli.js') ||
    filePath.endsWith('node_modules/next/dist/bin/next') ||
    filePath.endsWith('scripts/verify-migrations.js') ||
    filePath.endsWith('node_modules/better-sqlite3/package.json')
  )
}

describe('doctor script', () => {
  it('parses simple engine version ranges', () => {
    assert.equal(parseMajorVersion('v22.1.0'), 22)
    assert.equal(parseMajorVersion('10.9.0'), 10)
    assert.equal(parseMajorVersion('not-a-version'), null)
    assert.equal(parseMinimumMajor('>=20'), 20)
    assert.equal(parseMinimumMajor('>=10'), 10)
  })

  it('passes core tool checks and reports non-blocking production hints', () => {
    const report = buildDoctorReport({
      cwd: '/repo',
      env: {},
      nodeVersion: 'v22.1.0',
      platform: 'darwin',
      readFile: () => packageJson(),
      readDir: () => ['0001_initial.sql', '0002_indexes.sql'],
      fileExists: installedFileExists,
      runCommand: successfulRunCommand,
    })

    assert.equal(report.ok, true)
    assert.equal(report.errorCount, 0)
    assert.equal(report.warningCount, 2)
    assert.deepEqual(
      report.checks.filter((check) => check.status === 'warn').map((check) => check.label),
      ['Deploy smoke', 'Backup token']
    )
    assert.match(formatDoctorReport(report), /doctor passed with 2 warning/)
  })

  it('warns when npm is missing but direct release dependencies are installed', () => {
    const report = buildDoctorReport({
      cwd: '/repo',
      env: {},
      nodeVersion: 'v22.1.0',
      platform: 'darwin',
      readFile: () => packageJson(),
      readDir: () => ['0001_initial.sql'],
      fileExists: installedFileExists,
      runCommand: (command: string, args: string[]) => {
        if (command === 'npm') return { status: null, stdout: '', stderr: '', error: 'ENOENT' }
        return successfulRunCommand(command, args)
      },
    })

    assert.equal(report.ok, true)
    assert.equal(report.errorCount, 0)
    assert.equal(report.checks.find((check) => check.label === 'npm')?.status, 'warn')
    assert.match(formatDoctorReport(report), /Direct release commands are available/)
  })

  it('errors when npm is missing and direct release dependencies are unavailable', () => {
    const report = buildDoctorReport({
      cwd: '/repo',
      env: { SMOKE_BASE_URL: 'https://fairtab.example.com', SMOKE_REQUIRE_BACKUP_AUTH: '1' },
      nodeVersion: 'v22.1.0',
      platform: 'darwin',
      readFile: () => packageJson(),
      readDir: () => ['0001_initial.sql'],
      fileExists: () => false,
      runCommand: (command: string) => {
        if (command === 'npm') return { status: null, stdout: '', stderr: '', error: 'ENOENT' }
        return { status: 1, stdout: '', stderr: 'not installed', error: null }
      },
    })

    assert.equal(report.ok, false)
    assert.equal(report.checks.find((check) => check.label === 'npm')?.status, 'error')
    assert.equal(report.checks.find((check) => check.label === 'Release dependencies')?.status, 'error')
  })

  it('reports migration verifier readiness separately from migration files', () => {
    const report = buildDoctorReport({
      cwd: '/repo',
      env: {},
      nodeVersion: 'v22.1.0',
      platform: 'darwin',
      readFile: () => packageJson(),
      readDir: () => ['0001_initial.sql'],
      fileExists: (filePath: string) =>
        installedFileExists(filePath) &&
        !filePath.endsWith('scripts/verify-migrations.js') &&
        !filePath.endsWith('node_modules/better-sqlite3/package.json'),
      runCommand: successfulRunCommand,
    })

    assert.equal(report.ok, false)
    assert.equal(report.checks.find((check) => check.label === 'Migration verifier')?.status, 'error')
    assert.equal(report.checks.find((check) => check.label === 'Migrations')?.status, 'ok')
  })

  it('recognizes strict deploy smoke and configured backup token as ready', () => {
    const report = buildDoctorReport({
      cwd: '/repo',
      env: {
        SMOKE_BASE_URL: 'https://fairtab.example.com',
        SMOKE_REQUIRE_BACKUP_AUTH: '1',
        FAIRTAB_BACKUP_TOKEN: 'secret',
      },
      nodeVersion: 'v22.1.0',
      platform: 'darwin',
      readFile: () => packageJson(),
      readDir: () => ['0001_initial.sql'],
      fileExists: installedFileExists,
      runCommand: successfulRunCommand,
    })

    assert.equal(report.ok, true)
    assert.equal(report.warningCount, 0)
    assert.match(formatDoctorReport(report), /Strict backup-auth smoke is enabled/)
  })
})
