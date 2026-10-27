import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createInMemoryRepositories } from '../support/in-memory-repositories'
import { createInMemoryStorage } from '../support/in-memory-storage'
import { createAttachmentService } from '@/lib/backend/services/attachments'
import type { Expense, Group, GroupMember } from '@/types'

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1, 2, 3])
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0, 0, 0, 0])
const TEXT_BYTES = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21])

const NOW = new Date('2026-06-01T00:00:00Z').getTime()

const groupA: Group = { id: 1, name: 'Trip', token: 'tokenaaa', currency: 'CAD', isArchived: false, createdAt: NOW }
const groupB: Group = { id: 2, name: 'House', token: 'tokenbbb', currency: 'CAD', isArchived: false, createdAt: NOW }
const memberAlice: GroupMember = { id: 1, groupId: 1, name: 'Alice', email: null }
const memberCharlie: GroupMember = { id: 2, groupId: 2, name: 'Charlie', email: null }
const dinnerExpense: Expense = {
  id: 1, groupId: 1, title: 'Dinner', amount: 5000, currency: 'CAD',
  paidById: 1, date: NOW, category: null, notes: null, splitMethod: 'equal', createdAt: NOW,
}
const soloExpense: Expense = {
  id: 2, groupId: 2, title: 'Paint', amount: 3000, currency: 'CAD',
  paidById: 2, date: NOW, category: null, notes: null, splitMethod: 'equal', createdAt: NOW,
}

function createService() {
  const { repositories, state } = createInMemoryRepositories({
    groups: [groupA, groupB],
    members: [memberAlice, memberCharlie],
    expenses: [dinnerExpense, soloExpense],
  })
  const storage = createInMemoryStorage()
  const service = createAttachmentService({
    repositories,
    storage,
    createId: () => 'fixedid',
    now: () => new Date('2026-06-04T12:00:00Z'),
  })
  return { service, state, storage }
}

describe('attachments', () => {
  it('stores a valid PNG and records metadata', async () => {
    const { service, state, storage } = createService()

    const result = await service.uploadAttachment(groupA.id, dinnerExpense.id, 'receipt.png', PNG_BYTES)

    assert.equal(result.success, true)
    if (!result.success) return
    assert.equal(result.data.contentType, 'image/png')
    assert.equal(result.data.filename, 'receipt.png')
    assert.equal(result.data.groupId, groupA.id)
    assert.equal(state.attachments.length, 1)
    assert.equal(storage._store.size, 1)
  })

  it('derives content type from magic bytes, not the filename', async () => {
    const { service } = createService()

    const result = await service.uploadAttachment(groupA.id, null, 'sneaky.png', PDF_BYTES)

    assert.equal(result.success, true)
    if (!result.success) return
    assert.equal(result.data.contentType, 'application/pdf')
    assert.equal(result.data.filename, 'sneaky.pdf')
  })

  it('rejects files that match no allowed signature', async () => {
    const { service, storage } = createService()

    const result = await service.uploadAttachment(groupA.id, null, 'notes.jpg', TEXT_BYTES)

    assert.equal(result.success, false)
    assert.equal(storage._store.size, 0)
  })

  it('rejects attaching to an expense from another group', async () => {
    const { service, state } = createService()

    // soloExpense belongs to groupB; the caller only holds groupA
    const result = await service.uploadAttachment(groupA.id, soloExpense.id, 'receipt.png', PNG_BYTES)

    assert.equal(result.success, false)
    assert.equal(state.attachments.length, 0)
  })

  it('refuses to stream an attachment through the wrong group', async () => {
    const { service } = createService()

    const uploaded = await service.uploadAttachment(groupA.id, dinnerExpense.id, 'receipt.png', PNG_BYTES)
    assert.equal(uploaded.success, true)
    if (!uploaded.success) return

    assert.equal(await service.getAttachmentStream(uploaded.data.id, groupB.id), null)
    assert.notEqual(await service.getAttachmentStream(uploaded.data.id, groupA.id), null)
  })

  it('deletes the stored file together with the record', async () => {
    const { service, state, storage } = createService()

    const uploaded = await service.uploadAttachment(groupA.id, null, 'receipt.png', PNG_BYTES)
    assert.equal(uploaded.success, true)
    if (!uploaded.success) return

    // Wrong group cannot delete it
    const denied = await service.deleteAttachment(uploaded.data.id, groupB.id)
    assert.equal(denied.success, false)

    const result = await service.deleteAttachment(uploaded.data.id, groupA.id)
    assert.equal(result.success, true)
    assert.equal(state.attachments.length, 0)
    assert.equal(storage._store.size, 0)
  })
})
