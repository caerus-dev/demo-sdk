import { NextResponse } from 'next/server'
import { caerus, conRegistro, type LlamadaSDK } from '@/lib/caerus'
import {
  butacaFromResource,
  ensureSeed,
  grupoButacas,
  infoKey,
  meta,
  FILAS,
} from '@/lib/cine'
import { errorResponse, exigirHolderVivo } from '@/lib/api'
import { COMPRADORES } from '@/lib/demo/broken-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

interface ResultadoIntento {
  seatKey: string
  col: string
  row: number
  userId: string
  userName: string
  success: boolean
  holderId?: string
  error?: string
}

export async function POST(req: Request) {
  const llamadas: LlamadaSDK[] = []
  try {
    await ensureSeed()
    const body = (await req.json().catch(() => ({}))) as {
      userCount?: number
      funcionId?: string
    }

    const funcionId = body.funcionId ?? 'horizonte'
    const userCount = Math.min(Math.max(body.userCount ?? 20, 2), 40)

    const compradores = Array.from({ length: userCount }, (_, i) => ({
      id: `usr_${i + 1}`,
      name: COMPRADORES[i % COMPRADORES.length] ?? `Usuario ${i + 1}`,
    }))

    // Cada comprador intenta reservar exactamente 1 butaca disputada de la zona central
    const BUTACAS_DISPUTADAS = ['C3', 'C4', 'D3', 'D4', 'E3', 'E4']
    const ttlSeconds = Number(process.env.CAERUS_TTL_SECONDS) || 30

    const intentosPlanificados = compradores.map((usr) => {
      const butaca = mezclar(BUTACAS_DISPUTADAS)[0]!
      const key = `funcion${funcionId}_${butaca}`
      const m = /^funcion.+_([A-Z])(\d+)$/.exec(key)
      return {
        seatKey: key,
        col: m ? m[1]! : '?',
        row: m ? Number(m[2]) : 0,
        userId: usr.id,
        userName: usr.name,
      }
    })

    const resultados: ResultadoIntento[] = []

    // Ejecutamos todos los intentos en paralelo envolviendo con registro
    await conRegistro(llamadas, async () => {
      const promesas = intentosPlanificados.map(async (plan) => {
        const intentoId = `sim_${plan.userId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
        try {
          // 🛡️ TAKE ATÓMICO CON CAERUS SRE
          const butacaHolder = await caerus.unitary(plan.seatKey).take({
            idempotencyKey: `${plan.userId}:${plan.seatKey}:${intentoId}`,
            ttlSeconds,
            ...meta({
              butacaKey: plan.seatKey,
              funcionId,
              comprador: plan.userName,
            }),
          })
          exigirHolderVivo(butacaHolder, plan.seatKey)

          // 💳 CONFIRMACIÓN ATÓMICA DE LA COMPRA EN CAERUS SRE
          await caerus.confirm(
            butacaHolder.id,
            meta({
              butacaKey: plan.seatKey,
              funcionId,
              comprador: plan.userName,
            }),
          )

          resultados.push({
            seatKey: plan.seatKey,
            col: plan.col,
            row: plan.row,
            userId: plan.userId,
            userName: plan.userName,
            success: true,
            holderId: butacaHolder.id,
          })
        } catch (error: any) {
          resultados.push({
            seatKey: plan.seatKey,
            col: plan.col,
            row: plan.row,
            userId: plan.userId,
            userName: plan.userName,
            success: false,
            error: error?.code ?? error?.message ?? 'CONFLICT',
          })
        }
      })

      await Promise.allSettled(promesas)
    })

    // Consultamos el mapa actualizado de butacas en Caerus
    const { resources } = await caerus.getResourcesByGroup(grupoButacas(funcionId), { pageSize: 200 })
    const butacas = resources
      .map(butacaFromResource)
      .filter((b) => (FILAS as readonly number[]).includes(b.fila))
      .sort((a, b) => {
        if (a.columna !== b.columna) return a.columna.localeCompare(b.columna)
        return a.fila - b.fila
      })

    // Agrupación para certificar doble-ventas (debe ser 0 con Caerus)
    const exitosPorButaca = new Map<string, ResultadoIntento[]>()
    for (const r of resultados.filter((r) => r.success)) {
      const list = exitosPorButaca.get(r.seatKey) || []
      list.push(r)
      exitosPorButaca.set(r.seatKey, list)
    }

    const doubleBookings = [...exitosPorButaca.entries()]
      .filter(([_, list]) => list.length > 1)
      .map(([key, list]) => ({
        seatKey: key,
        bookedBy: list.map((x) => x.userName),
      }))

    const exitosos = resultados.filter((r) => r.success)
    const rechazados = resultados.filter((r) => !r.success)

    return NextResponse.json({
      success: true,
      metrics: {
        totalAttempts: resultados.length,
        successfulBookings: exitosos.length,
        failedBookings: rechazados.length,
        doubleBookedSeats: doubleBookings.length, // 0 garantizado por Caerus
        doubleBookings,
        conflictRejections: rechazados.length,
        uniqueBuyersConfirmed: new Set(exitosos.map((x) => x.userName)).size,
      },
      butacas,
      compradoresPorButaca: Object.fromEntries(
        exitosos.map((x) => [x.seatKey, x.userName])
      ),
      _llamadas: llamadas,
    })
  } catch (error) {
    return errorResponse(error, llamadas)
  }
}
