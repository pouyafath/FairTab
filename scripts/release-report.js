#!/usr/bin/env node
'use strict'

const { spawnSync } = require('child_process')

const GROUPS = [
  {
    key: 'backend',
    title: 'Backend',
    patterns: [
      /^lib\/backend\//,
      /^lib\/actions\//,
      /^lib\/calculations\//,
      /^lib\/server\//,
      /^lib\/validations\//,
      /^app\/api\/(?!backups\/)/,
      /^types\//,
    ],
  },
  {
    key: 'database',
    title: 'Database',
    patterns: [/^lib\/db\//, /^migrations\//, /^scripts\/migrate\.js$/],
  },
  {
    key: 'backup',
    title: 'Backup/Safety',
    patterns: [/^lib\/backups\//, /^app\/api\/backups\//, /^components\/settings\//],
  },
  {
    key: 'ui',
    title: 'UI',
    patterns: [/^app\//, /^components\//, /^public\//],
  },
  {
    key: 'qa',
    title: 'QA/CI',
    patterns: [
      /^tests\//,
      /^playwright\.config\.mjs$/,
      /^\.github\/workflows\//,
      /^scripts\/doctor\.js$/,
      /^scripts\/prepare-e2e-db\.js$/,
      /^scripts\/release-/,
      /^scripts\/smoke\.js$/,
      /^scripts\/verify-migrations\.js$/,
      /^package(-lock)?\.json$/,
      /^\.gitignore$/,
    ],
  },
  {
    key: 'docs',
    title: 'Docs',
    patterns: [/^docs\//, /^README\.md$/],
  },
  {
    key: 'other',
    title: 'Other',
    patterns: [],
  },
]

const REVIEWER_CHECKLIST = {
  backend: 'Review service/API behavior, authorization assumptions, and server runtime metadata.',
  database: 'Review migration order, schema compatibility, indexes, and rollback expectations.',
  backup: 'Review export, dry-run validation, restore gating, and destructive confirmation flows.',
  ui: 'Review desktop/mobile layout, keyboard focus, empty states, and production fallback UI.',
  qa: 'Review CI coverage, local scripts, smoke gates, and test fixture isolation.',
  docs: 'Review release instructions, QA guidance, and deployment/runbook accuracy.',
  other: 'Classify uncategorized files or document why they do not need a dedicated bucket.',
}

function parseStatusLine(line) {
  const trimmed = line.trimEnd()
  if (!trimmed) return null

  const status = trimmed.slice(0, 2)
  const rawPath = trimmed.slice(3)
  const path = rawPath.includes(' -> ') ? rawPath.split(' -> ').pop() : rawPath

  return { status, path }
}

function groupForPath(path) {
  return GROUPS.find((group) => group.patterns.some((pattern) => pattern.test(path))) ?? GROUPS.at(-1)
}

function buildReleaseReport(statusOutput) {
  const grouped = new Map(GROUPS.map((group) => [group.key, []]))
  const entries = statusOutput
    .split(/\r?\n/)
    .map(parseStatusLine)
    .filter(Boolean)

  for (const entry of entries) {
    const group = groupForPath(entry.path)
    grouped.get(group.key).push(entry)
  }

  const lines = [
    '# FairTab Release Review Report',
    '',
    `Total changed paths: ${entries.length}`,
    '',
    '## Reviewer Checklist',
    '',
  ]

  const activeGroups = GROUPS.filter((group) => grouped.get(group.key).length > 0)
  if (activeGroups.length === 0) {
    lines.push('_No review buckets contain changed paths._', '')
  } else {
    for (const group of activeGroups) {
      lines.push(`- [ ] ${group.title}: ${REVIEWER_CHECKLIST[group.key]}`)
    }
    lines.push('')
  }

  for (const group of GROUPS) {
    const items = grouped.get(group.key)
    lines.push(`## ${group.title} (${items.length})`)
    if (items.length === 0) {
      lines.push('', '_No changed paths._', '')
      continue
    }

    lines.push('')
    for (const item of items) {
      lines.push(`- \`${item.status.trim() || item.status}\` ${item.path}`)
    }
    lines.push('')
  }

  return lines.join('\n').trimEnd() + '\n'
}

function readGitStatus() {
  const result = spawnSync('git', ['status', '--short', '--untracked-files=all'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })

  if (result.error) {
    throw new Error(result.error.message)
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || `git status exited with ${result.status}`)
  }

  return result.stdout
}

function main() {
  try {
    process.stdout.write(buildReleaseReport(readGitStatus()))
  } catch (error) {
    console.error(`[fairtab] release report failed: ${error.message}`)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  buildReleaseReport,
  groupForPath,
  parseStatusLine,
}
