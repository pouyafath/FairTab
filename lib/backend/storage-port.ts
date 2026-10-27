export interface StoragePort {
  isEnabled(): boolean
  save(key: string, data: Uint8Array, contentType: string): Promise<void>
  read(key: string): Promise<ReadableStream | null>
  delete(key: string): Promise<void>
}
