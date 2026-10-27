import type { StoragePort } from '../storage-port'

export function createLocalFsStorage(uploadsDir: string): StoragePort {
  return {
    isEnabled: () => true,

    async save(key: string, data: Uint8Array): Promise<void> {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodeFs = require('node:fs') as typeof import('node:fs')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodePath = require('node:path') as typeof import('node:path')

      const fullPath = safeJoin(uploadsDir, key, nodePath)
      await nodeFs.promises.mkdir(nodePath.dirname(fullPath), { recursive: true })
      await nodeFs.promises.writeFile(fullPath, data)
    },

    async read(key: string): Promise<ReadableStream | null> {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodeFs = require('node:fs') as typeof import('node:fs')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodePath = require('node:path') as typeof import('node:path')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Readable } = require('node:stream') as typeof import('node:stream')

      const fullPath = safeJoin(uploadsDir, key, nodePath)
      try {
        await nodeFs.promises.access(fullPath)
        const nodeStream = nodeFs.createReadStream(fullPath)
        return Readable.toWeb(nodeStream) as ReadableStream
      } catch {
        return null
      }
    },

    async delete(key: string): Promise<void> {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodeFs = require('node:fs') as typeof import('node:fs')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodePath = require('node:path') as typeof import('node:path')

      const fullPath = safeJoin(uploadsDir, key, nodePath)
      try {
        await nodeFs.promises.unlink(fullPath)
      } catch {
        // File already gone — that's fine
      }
    },
  }
}

function safeJoin(
  base: string,
  key: string,
  nodePath: typeof import('node:path')
): string {
  const resolved = nodePath.resolve(base, key)
  const resolvedBase = nodePath.resolve(base)
  if (!resolved.startsWith(resolvedBase + nodePath.sep) && resolved !== resolvedBase) {
    throw new Error('Path traversal detected')
  }
  return resolved
}
