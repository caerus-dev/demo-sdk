import { NextResponse } from 'next/server'
import {
  bookSeatBroken,
  COMPRADORES,
  getConflictMetrics,
  getAllSeatsMap,
  initSeats,
} from '@/lib/demo/broken-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Butacas de alta demanda en la zona central de la sala
const ZONA_CALIENTE = [
  'C3', 'C4', 'C5', 'C6',
  'D3', 'D4', 'D5', 'D6',
  'E3', 'E4', 'E5', 'E6',
]

function mezclar<T>(array: T[]): T[] {
  const copia = [...array]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = copia[i]!
    copia[i] = copia[j]!
    copia[j] = temp
  }
  return copia
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      userCount?: number
      funcionId?: string
      reiniciarAntes?: boolean
    }

    const funcionId = body.funcionId ?? 'horizonte'
    const userCount = Math.min(Math.max(body.userCount ?? 20, 2), 40)

    if (body.reiniciarAntes) {
      initSeats(funcionId)
    }

    const compradores = Array.from({ length: userCount }, (_, i) => ({
      id: `usr_${i + 1}`,
      name: COMPRADORES[i % COMPRADORES.length] ?? `Usuario ${i + 1}`,
    }))

    // Cada comprador intenta reservar exactamente 1 butaca disputada de la zona central
    // Concentramos en 6 butacas centrales (C3, C4, D3, D4, E3, E4) para colisión directa
    const BUTACAS_DISPUTADAS = ['C3', 'C4', 'D3', 'D4', 'E3', 'E4']
    const intentos = compradores.map((usr) => {
      const butaca = mezclar(BUTACAS_DISPUTADAS)[0]!
      const key = `funcion${funcionId}_${butaca}`
      return bookSeatBroken(key, usr.id, usr.name)
    })

    // 🔥 Disparo simultáneo de las 20 peticiones
    await Promise.allSettled(intentos)

    const metrics = getConflictMetrics()
    const seats = getAllSeatsMap()

    return NextResponse.json({
      success: true,
      metrics,
      seats,
    })
  } catch (error) {
    console.error('[demo-broken-simulate] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Error desconocido' },
      { status: 500 },
    )
  }
}
