import { NextResponse } from 'next/server'
import {
  holdSeatBroken,
  abandonSeatBroken,
  confirmSeatBroken,
  releaseSeatBroken,
  getConflictMetrics,
  getAllSeatsMap,
} from '@/lib/demo/broken-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const {
      seatKey,
      action = 'hold',
      userId = 'manual_usr',
      userName = 'Tu Selección',
    } = (await req.json()) as {
      seatKey: string
      action?: 'hold' | 'abandon' | 'confirm' | 'release'
      userId?: string
      userName?: string
    }

    let success = false
    if (action === 'hold') {
      success = holdSeatBroken(seatKey, userId, userName)
    } else if (action === 'abandon') {
      success = abandonSeatBroken(seatKey)
    } else if (action === 'confirm') {
      success = confirmSeatBroken(seatKey)
    } else if (action === 'release') {
      success = releaseSeatBroken(seatKey)
    }

    const metrics = getConflictMetrics()
    const seats = getAllSeatsMap()

    return NextResponse.json({
      success,
      action,
      metrics,
      seats,
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 },
    )
  }
}
