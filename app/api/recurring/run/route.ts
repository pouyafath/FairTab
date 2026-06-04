import { NextResponse } from 'next/server'
import { getBackend } from '@/lib/backend/runtime'

export async function POST() {
  const materialized = await getBackend().recurring.materializeDueRecurring(new Date())
  return NextResponse.json({ materialized })
}
