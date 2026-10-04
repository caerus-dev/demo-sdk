import { NextResponse } from 'next/server'
import { getAllSeatsMap, getConflictMetrics, initSeats } from '@/lib/demo/broken-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const funcionId = searchParams.get('funcionId') ?? 'horizonte'

  const seats = getAllSeatsMap()
  if (Object.keys(seats).length === 0) {
    initSeats(funcionId)
  }

  return NextResponse.json({
    seats: getAllSeatsMap(),
    metrics: getConflictMetrics(),
  })
}
