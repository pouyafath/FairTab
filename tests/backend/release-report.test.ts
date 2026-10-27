import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { describe, it } from 'node:test'

const require = createRequire(import.meta.url)
const {
  buildReleaseReport,
  groupForPath,
  parseStatusLine,
} = require('../../scripts/release-report.js') as {
  buildReleaseReport: (statusOutput: string) => string
  groupForPath: (path: string) => { key: string; title: string }
  parseStatusLine: (line: string) => { status: string; path: string } | null
}

describe('release report', () => {
  it('parses git status lines including renames', () => {
    assert.deepEqual(parseStatusLine(' M lib/backend/services/groups.ts'), {
      status: ' M',
      path: 'lib/backend/services/groups.ts',
    })
    assert.deepEqual(parseStatusLine('R  old/path.ts -> lib/db/schema.ts'), {
      status: 'R ',
      path: 'lib/db/schema.ts',
    })
    assert.equal(parseStatusLine(''), null)
  })

  it('groups changed paths by review area', () => {
    assert.equal(groupForPath('lib/backend/services/groups.ts').key, 'backend')
    assert.equal(groupForPath('lib/server/app-metadata.ts').key, 'backend')
    assert.equal(groupForPath('app/api/health/route.ts').key, 'backend')
    assert.equal(groupForPath('lib/db/schema.ts').key, 'database')
    assert.equal(groupForPath('scripts/migrate.js').key, 'database')
    assert.equal(groupForPath('app/api/backups/export/route.ts').key, 'backup')
    assert.equal(groupForPath('components/settings/backup-actions.tsx').key, 'backup')
    assert.equal(groupForPath('app/page.tsx').key, 'ui')
    assert.equal(groupForPath('tests/e2e/homepage.spec.mjs').key, 'qa')
    assert.equal(groupForPath('scripts/doctor.js').key, 'qa')
    assert.equal(groupForPath('scripts/release-report.js').key, 'qa')
    assert.equal(groupForPath('scripts/smoke.js').key, 'qa')
    assert.equal(groupForPath('scripts/verify-migrations.js').key, 'qa')
    assert.equal(groupForPath('package.json').key, 'qa')
    assert.equal(groupForPath('docs/qa.md').key, 'docs')
    assert.equal(groupForPath('local-notes.txt').key, 'other')
  })

  it('builds a markdown report from fixture status output', () => {
    const report = buildReleaseReport(`
 M lib/backend/services/groups.ts
 M app/api/health/route.ts
 M lib/db/schema.ts
?? app/api/backups/export/route.ts
?? components/settings/backup-actions.tsx
 M app/page.tsx
?? tests/e2e/homepage.spec.mjs
 M docs/qa.md
 M README.md
 M scripts/release-report.js
 M package.json
`)

    assert.match(report, /^# FairTab Release Review Report/)
    assert.match(report, /Total changed paths: 11/)
    assert.match(report, /## Reviewer Checklist/)
    assert.match(report, /- \[ \] Backend: Review service\/API behavior/)
    assert.match(report, /- \[ \] Database: Review migration order/)
    assert.match(report, /- \[ \] Backup\/Safety: Review export/)
    assert.match(report, /- \[ \] UI: Review desktop\/mobile layout/)
    assert.match(report, /- \[ \] QA\/CI: Review CI coverage/)
    assert.match(report, /- \[ \] Docs: Review release instructions/)
    assert.doesNotMatch(report, /- \[ \] Other:/)
    assert.match(report, /## Backend \(2\)[\s\S]*lib\/backend\/services\/groups\.ts/)
    assert.match(report, /## Backend \(2\)[\s\S]*app\/api\/health\/route\.ts/)
    assert.match(report, /## Database \(1\)[\s\S]*lib\/db\/schema\.ts/)
    assert.match(report, /## Backup\/Safety \(2\)[\s\S]*app\/api\/backups\/export\/route\.ts/)
    assert.match(report, /## UI \(1\)[\s\S]*app\/page\.tsx/)
    assert.match(report, /## QA\/CI \(3\)[\s\S]*tests\/e2e\/homepage\.spec\.mjs/)
    assert.match(report, /## QA\/CI \(3\)[\s\S]*scripts\/release-report\.js/)
    assert.match(report, /## QA\/CI \(3\)[\s\S]*package\.json/)
    assert.match(report, /## Docs \(2\)[\s\S]*README\.md/)
    assert.match(report, /## Other \(0\)[\s\S]*_No changed paths\._/)
  })

  it('renders an empty checklist when there are no changed paths', () => {
    const report = buildReleaseReport('')

    assert.match(report, /Total changed paths: 0/)
    assert.match(report, /## Reviewer Checklist[\s\S]*_No review buckets contain changed paths\._/)
  })
})
