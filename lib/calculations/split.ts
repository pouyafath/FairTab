import type { SplitMethod } from '@/types'

export interface ParticipantInput {
  memberId: number
  shareValue: number
}

export interface ParticipantShare {
  memberId: number
  shareValue: number // raw stored input
  amountCents: number // computed exact amount owed
}

/**
 * Calculate per-participant amounts for a given split method.
 * Remainder cents are distributed to the highest-fractional participants first,
 * or in order for equal splits.
 */
export function calculateSplits(
  totalCents: number,
  method: SplitMethod,
  participants: ParticipantInput[]
): ParticipantShare[] {
  if (participants.length === 0) {
    throw new Error('At least one participant is required')
  }

  switch (method) {
    case 'equal':
      return splitEqual(totalCents, participants)
    case 'exact':
      return splitExact(totalCents, participants)
    case 'percentage':
      return splitPercentage(totalCents, participants)
    case 'shares':
      return splitByShares(totalCents, participants)
    default:
      throw new Error(`Unknown split method: ${method}`)
  }
}

function splitEqual(totalCents: number, participants: ParticipantInput[]): ParticipantShare[] {
  const n = participants.length
  const base = Math.floor(totalCents / n)
  const remainder = totalCents - base * n

  return participants.map((p, i) => ({
    memberId: p.memberId,
    shareValue: 1,
    amountCents: i < remainder ? base + 1 : base,
  }))
}

function splitExact(totalCents: number, participants: ParticipantInput[]): ParticipantShare[] {
  const sum = participants.reduce((acc, p) => acc + p.shareValue, 0)
  if (sum !== totalCents) {
    throw new Error(
      `Exact amounts (${(sum / 100).toFixed(2)}) must sum to total (${(totalCents / 100).toFixed(2)})`
    )
  }
  return participants.map((p) => ({
    memberId: p.memberId,
    shareValue: p.shareValue,
    amountCents: p.shareValue,
  }))
}

function splitPercentage(totalCents: number, participants: ParticipantInput[]): ParticipantShare[] {
  const sumPct = participants.reduce((acc, p) => acc + p.shareValue, 0)
  if (sumPct !== 100) {
    throw new Error(`Percentages must sum to 100 (got ${sumPct})`)
  }

  const bases = participants.map((p) => Math.floor((totalCents * p.shareValue) / 100))
  const rems = participants.map((p, i) => ({
    index: i,
    rem: (totalCents * p.shareValue) % 100,
  }))

  const sumBases = bases.reduce((a, b) => a + b, 0)
  let remainder = totalCents - sumBases

  rems.sort((a, b) => b.rem - a.rem)
  const adjustments = new Array(participants.length).fill(0)
  for (let i = 0; i < remainder; i++) {
    adjustments[rems[i].index] += 1
  }

  return participants.map((p, i) => ({
    memberId: p.memberId,
    shareValue: p.shareValue,
    amountCents: bases[i] + adjustments[i],
  }))
}

function splitByShares(totalCents: number, participants: ParticipantInput[]): ParticipantShare[] {
  const totalShares = participants.reduce((acc, p) => acc + p.shareValue, 0)
  if (totalShares <= 0) {
    throw new Error('Total shares must be greater than 0')
  }

  const bases = participants.map((p) =>
    Math.floor((totalCents * p.shareValue) / totalShares)
  )
  const rems = participants.map((p, i) => ({
    index: i,
    rem: (totalCents * p.shareValue) % totalShares,
  }))

  const sumBases = bases.reduce((a, b) => a + b, 0)
  let remainder = totalCents - sumBases

  rems.sort((a, b) => b.rem - a.rem)
  const adjustments = new Array(participants.length).fill(0)
  for (let i = 0; i < remainder; i++) {
    adjustments[rems[i].index] += 1
  }

  return participants.map((p, i) => ({
    memberId: p.memberId,
    shareValue: p.shareValue,
    amountCents: bases[i] + adjustments[i],
  }))
}
