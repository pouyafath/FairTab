import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
  requireBackupAuthorization,
  requireConfiguredBackupAuthorization,
} from '@/lib/backups/auth'

const originalBackupToken = process.env.FAIRTAB_BACKUP_TOKEN

function setBackupToken(value: string | undefined) {
  if (value === undefined) delete process.env.FAIRTAB_BACKUP_TOKEN
  else process.env.FAIRTAB_BACKUP_TOKEN = value
}

function backupRequest(input: { token?: string; bearer?: string } = {}) {
  const url = new URL('https://fairtab.test/api/backups/export')
  if (input.token) url.searchParams.set('token', input.token)

  return new Request(url, {
    headers: input.bearer ? { Authorization: `Bearer ${input.bearer}` } : undefined,
  })
}

afterEach(() => {
  setBackupToken(originalBackupToken)
})

describe('backup route authorization', () => {
  it('allows export and dry-run routes when no backup token is configured', async () => {
    setBackupToken(undefined)

    assert.equal(await requireBackupAuthorization(backupRequest()), null)
  })

  it('requires a bearer token when backup auth is configured', async () => {
    setBackupToken('expected-token')

    const response = await requireBackupAuthorization(backupRequest())

    assert.ok(response)
    assert.equal(response.status, 401)
    assert.equal(response.headers.get('WWW-Authenticate'), 'Bearer')
    assert.deepEqual(await response.json(), {
      error: 'Backup token required',
      hint: 'Set the Authorization header to Bearer <FAIRTAB_BACKUP_TOKEN>.',
    })
  })

  it('rejects an incorrect bearer token', async () => {
    setBackupToken('expected-token')

    const response = await requireBackupAuthorization(backupRequest({ bearer: 'wrong-token' }))

    assert.ok(response)
    assert.equal(response.status, 401)
  })

  it('allows the correct bearer token', async () => {
    setBackupToken('expected-token')

    assert.equal(await requireBackupAuthorization(backupRequest({ bearer: 'expected-token' })), null)
  })

  it('keeps URL token compatibility for backup routes', async () => {
    setBackupToken('expected-token')

    assert.equal(await requireBackupAuthorization(backupRequest({ token: 'expected-token' })), null)
  })

  it('blocks restore routes when no server backup token is configured', async () => {
    setBackupToken(undefined)

    const response = await requireConfiguredBackupAuthorization(backupRequest())

    assert.ok(response)
    assert.equal(response.status, 403)
    assert.deepEqual(await response.json(), {
      error: 'Backup token is not configured',
      hint: 'Set FAIRTAB_BACKUP_TOKEN before enabling backup export or restore.',
    })
  })

  it('allows restore routes when configured and authorized', async () => {
    setBackupToken('expected-token')

    assert.equal(
      await requireConfiguredBackupAuthorization(backupRequest({ bearer: 'expected-token' })),
      null
    )
  })

  it('rejects a token that is a prefix of the expected token', async () => {
    setBackupToken('expected-token')

    const response = await requireBackupAuthorization(backupRequest({ bearer: 'expected' }))

    assert.ok(response)
    assert.equal(response.status, 401)
  })
})

describe('export route authorization', () => {
  it('blocks GET /api/backups/export when no backup token is configured', async () => {
    setBackupToken(undefined)

    const { GET } = await import('@/app/api/backups/export/route')
    const response = await GET(backupRequest())

    assert.equal(response.status, 403)
    assert.deepEqual(await response.json(), {
      error: 'Backup token is not configured',
      hint: 'Set FAIRTAB_BACKUP_TOKEN before enabling backup export or restore.',
    })
  })
})
