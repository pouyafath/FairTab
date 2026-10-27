import type { StoragePort } from '../storage-port'

export function createNullStorage(): StoragePort {
  return {
    isEnabled: () => false,
    async save() {},
    async read() { return null },
    async delete() {},
  }
}
