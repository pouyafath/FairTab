import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { describe, it } from 'node:test'

function healthPayload(runtime: Record<string, unknown>) {
  return {
    status: 'ok',
    database: { status: 'ok' },
    app: { version: '0.1.0' },
    runtime: {
      storageAdapter: 'sqlite',
      ...runtime,
    },
    migrations: {
      drift: false,
    },
  }
}

function startSmokeServer(payload: unknown): Promise<{ server: Server; baseUrl: string }> {
  const server = createServer((request, response) => {
    if (request.url === '/api/health') {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(payload))
      return
    }

    if (request.url === '/' || request.url === '/groups' || request.url === '/personal') {
      response.end('ok')
      return
    }

    response.statusCode = 404
    response.end('not found')
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` })
    })
  })
}

async function withSmokeServer(
  payload: unknown,
  run: (baseUrl: string) => void | Promise<void>
) {
  const { server, baseUrl } = await startSmokeServer(payload)
  try {
    await run(baseUrl)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }
}

function runSmoke(baseUrl: string, env: Record<string, string> = {}) {
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    SMOKE_BASE_URL: baseUrl,
    ...env,
  }
  if (!('SMOKE_REQUIRE_BACKUP_AUTH' in env)) delete childEnv.SMOKE_REQUIRE_BACKUP_AUTH

  return new Promise<{ status: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(process.execPath, ['scripts/smoke.js'], {
        cwd: process.cwd(),
        env: childEnv,
      })
      let stdout = ''
      let stderr = ''

      child.stdout.setEncoding('utf8')
      child.stderr.setEncoding('utf8')
      child.stdout.on('data', (chunk) => {
        stdout += chunk
      })
      child.stderr.on('data', (chunk) => {
        stderr += chunk
      })
      child.on('error', reject)
      child.on('close', (status) => resolve({ status, stdout, stderr }))
    }
  )
}

function strictSmoke(baseUrl: string) {
  return runSmoke(baseUrl, { SMOKE_REQUIRE_BACKUP_AUTH: '1' })
}

describe('deploy smoke script', () => {
  it('passes non-strict smoke when backup auth is not configured', async () => {
    await withSmokeServer(
      healthPayload({ backupAuthConfigured: false, backupAuthWarning: 'missing token' }),
      async (baseUrl) => {
        const result = await runSmoke(baseUrl)

        assert.equal(result.status, 0)
        assert.match(result.stdout, /smoke ok \/api\/health/)
      }
    )
  })

  it('fails strict smoke when backup auth is missing', async () => {
    await withSmokeServer(
      healthPayload({ backupAuthConfigured: false, backupAuthWarning: 'missing token' }),
      async (baseUrl) => {
        const result = await strictSmoke(baseUrl)

        assert.notEqual(result.status, 0)
        assert.match(result.stderr, /missing backup auth/)
      }
    )
  })

  it('passes strict smoke when backup auth is configured', async () => {
    await withSmokeServer(
      healthPayload({ backupAuthConfigured: true, backupAuthWarning: null }),
      async (baseUrl) => {
        const result = await strictSmoke(baseUrl)

        assert.equal(result.status, 0)
        assert.match(result.stdout, /smoke ok \/api\/health/)
      }
    )
  })
})
