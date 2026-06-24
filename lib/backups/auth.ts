import 'server-only'

function readBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization')
  if (!authorization) return null

  const match = authorization.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

export function requireBackupAuthorization(request: Request): Response | null {
  const expectedToken = process.env.FAIRTAB_BACKUP_TOKEN
  if (!expectedToken) return null

  const urlToken = new URL(request.url).searchParams.get('token')
  const providedToken = readBearerToken(request) ?? urlToken

  if (providedToken === expectedToken) return null

  return Response.json(
    {
      error: 'Backup token required',
      hint: 'Set the Authorization header to Bearer <FAIRTAB_BACKUP_TOKEN>.',
    },
    {
      status: 401,
      headers: { 'WWW-Authenticate': 'Bearer' },
    }
  )
}

export function requireConfiguredBackupAuthorization(request: Request): Response | null {
  if (!process.env.FAIRTAB_BACKUP_TOKEN) {
    return Response.json(
      {
        error: 'Backup token is not configured',
        hint: 'Set FAIRTAB_BACKUP_TOKEN before enabling backup export or restore.',
      },
      { status: 403 }
    )
  }

  return requireBackupAuthorization(request)
}
