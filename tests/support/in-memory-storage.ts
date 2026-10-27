import type { StoragePort } from '@/lib/backend/storage-port'

export function createInMemoryStorage(): StoragePort & { _store: Map<string, Uint8Array> } {
  const store = new Map<string, Uint8Array>()

  return {
    _store: store,
    isEnabled: () => true,

    async save(key: string, data: Uint8Array): Promise<void> {
      store.set(key, data)
    },

    async read(key: string): Promise<ReadableStream | null> {
      const data = store.get(key)
      if (!data) return null
      return new ReadableStream({
        start(controller) {
          controller.enqueue(data)
          controller.close()
        },
      })
    },

    async delete(key: string): Promise<void> {
      store.delete(key)
    },
  }
}
