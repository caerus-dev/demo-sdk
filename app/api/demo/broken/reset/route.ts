import { NextResponse } from 'next/server'
import { resetBrokenStore, getAllSeatsMap, getConflictMetrics } from '@/lib/demo/broken-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { funcionId?: string }
  const funcionId = body.funcionId ?? 'horizonte'

  resetBrokenStore(funcionId)

  return NextResponse.json({
    success: true,
    seats: getAllSeatsMap(),
    metrics: getConflictMetrics(),
  })
}
