// Minimal Cloudflare Workers type declarations used by lib/db/index.ts.
// Avoids a full @cloudflare/workers-types reference that would pollute globals.

declare interface D1Database {
  prepare(query: string): D1PreparedStatement
  dump(): Promise<ArrayBuffer>
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
  exec(query: string): Promise<D1ExecResult>
}

declare interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(colName?: string): Promise<T | null>
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
  raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]>
}

declare interface D1Result<T = unknown> {
  results: T[]
  success: boolean
  meta: object
  error?: string
}

declare interface D1ExecResult {
  count: number
  duration: number
}
