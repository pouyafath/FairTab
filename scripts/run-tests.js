#!/usr/bin/env node
'use strict'

/**
 * Runs the backend test suite without depending on shell glob expansion or
 * node's native `--test` glob support (which only exists on Node >= 21).
 *
 * The repo pins Node 20 via .nvmrc / engines, where `node --test tests/**\/*.test.ts`
 * is treated as a literal, non-existent path. This wrapper resolves the test
 * files in JS and passes them explicitly, so the same command works on Node 20
 * (CI) and Node 22 (local dev).
 *
 *   node scripts/run-tests.js
 *   npm test
 *
 * Any extra arguments are forwarded to `node --test` (e.g. --test-name-pattern).
 */

const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const repoRoot = path.join(__dirname, '..')
const testsDir = path.join(repoRoot, 'tests')
const loaderUrl = pathToFileURL(path.join(testsDir, 'register-loader.mjs')).href

function collectTestFiles(dir) {
  const files = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(full))
    } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      files.push(full)
    }
  }
  return files
}

const testFiles = collectTestFiles(testsDir).sort()

if (testFiles.length === 0) {
  console.error('[fairtab] run-tests: no *.test.ts files found under tests/')
  process.exit(1)
}

const extraArgs = process.argv.slice(2)
const args = ['--import', loaderUrl, '--test', ...extraArgs, ...testFiles]
const result = spawnSync(process.execPath, args, { stdio: 'inherit' })

if (result.error) {
  console.error(`[fairtab] run-tests failed to start: ${result.error.message}`)
  process.exit(1)
}

process.exit(result.status ?? 1)
