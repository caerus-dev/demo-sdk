import { NextResponse } from 'next/server'
import { caerus, conRegistro, PLANTILLAS, type LlamadaSDK } from '@/lib/caerus'
import {
  butacaFromResource,
  butacaKey,
  ensureSeed,
  grupoButacas,
  meta,
  COLUMNAS,
  FILAS,
} from '@/lib/cine'
import { errorResponse } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VIVOS = ['PENDING', 'QUEUED'] as const

export async function POST(req: Request) {
  const llamadas: LlamadaSDK[] = []
  try {
    await ensureSeed()
    const body = (await req.json().catch(() => ({}))) as { funcionId?: string }
    const funcionId = body.funcionId ?? 'horizonte'

    // Limpiar notificaciones de webhooks acumuladas en memoria
    const globalWebhookState = globalThis as unknown as { __caerusWebhooks?: unknown[] }
    globalWebhookState.__caerusWebhooks = []

    await conRegistro(llamadas, async () => {
      // 1. Liberar holders activos en curso (PENDING y QUEUED)
      const paginas = await Promise.all(
        VIVOS.map((status) => caerus.listResourceHolders({ status, pageSize: 300 })),
      )
      const holders = paginas.flatMap((p) => p.holders)
      await Promise.allSettled(holders.map((h) => caerus.release(h.id)))

      // 2. Borrar todas las butacas existentes de la sala
      const { resources } = await caerus.getResourcesByGroup(grupoButacas(funcionId), { pageSize: 200 })
      await Promise.allSettled(resources.map((r) => caerus.deleteResource(r.key)))

      // 3. Recrear las 30 butacas de la sala limpias (A1 a F5) con precio base 4500
      const butacasNuevas = COLUMNAS.flatMap((columna) => FILAS.map((fila) => ({ columna, fila })))
      for (const { columna, fila } of butacasNuevas) {
        const key = butacaKey(funcionId, columna, fila)
        try {
          await caerus.createUnitary(PLANTILLAS.butaca, key, {
            groupKey: grupoButacas(funcionId),
            ...meta({ fila, columna, precio: 4500 }),
          })
        } catch (err: any) {
          // Si falló (ej: ALREADY_EXISTS o rate limit transitorio)
          // Forzamos un delete adicional y un último intento de crear
          await caerus.deleteResource(key).catch(() => {})
          await caerus.createUnitary(PLANTILLAS.butaca, key, {
            groupKey: grupoButacas(funcionId),
            ...meta({ fila, columna, precio: 4500 }),
          }).catch((createErr: any) => {
            console.error(`[reset] Falló la creación de ${key}:`, createErr.message || createErr)
          })
        }
      }
    })

    const { resources } = await caerus.getResourcesByGroup(grupoButacas(funcionId), { pageSize: 200 })
    const butacas = resources
      .map(butacaFromResource)
      .filter((b) => (FILAS as readonly number[]).includes(b.fila))
      .sort((a, b) => {
        if (a.columna !== b.columna) return a.columna.localeCompare(b.columna)
        return a.fila - b.fila
      })

    return NextResponse.json({
      success: true,
      butacas,
      _llamadas: llamadas,
    })
  } catch (error) {
    console.error('[reset] Error en /api/demo/fixed/reset:', (error as Error).message || error)
    return errorResponse(error, llamadas)
  }
}
