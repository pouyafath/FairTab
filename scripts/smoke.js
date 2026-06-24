#!/usr/bin/env node
'use strict'

const baseUrl = (process.env.SMOKE_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const routes = ['/', '/groups', '/personal', '/api/health']

async function check(route) {
  const url = `${baseUrl}${route}`
  const response = await fetch(url, { redirect: 'manual' })
  if (!response.ok) {
    throw new Error(`${route} returned ${response.status}`)
  }

  if (route === '/api/health') {
    const payload = await response.json()
    if (payload.status !== 'ok' || payload.database?.status !== 'ok') {
      throw new Error(`/api/health returned unhealthy payload: ${JSON.stringify(payload)}`)
    }
    if (!payload.app?.version) {
      throw new Error(`/api/health did not include app version metadata`)
    }
    if (!payload.runtime?.storageAdapter) {
      throw new Error(`/api/health did not include storage adapter metadata`)
    }
    if (payload.migrations?.drift === true) {
      throw new Error(`/api/health reported migration drift: ${JSON.stringify(payload.migrations)}`)
    }
    if (process.env.SMOKE_REQUIRE_BACKUP_AUTH === '1') {
      if (payload.runtime?.backupAuthConfigured !== true || payload.runtime?.backupAuthWarning) {
        throw new Error(`/api/health reported missing backup auth: ${JSON.stringify(payload.runtime)}`)
      }
    }
  }

  console.log(`[fairtab] smoke ok ${route} (${response.status})`)
}

async function main() {
  for (const route of routes) {
    await check(route)
  }
}

main().catch((error) => {
  console.error(`[fairtab] smoke failed: ${error.message}`)
  process.exit(1)
})
