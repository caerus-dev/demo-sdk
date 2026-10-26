import { NextResponse } from 'next/server'
import { caerus, conRegistro, type LlamadaSDK } from '@/lib/caerus'
import { ensureSeed, meta, SALA_CONFIG } from '@/lib/cine'
import { errorResponse, esClaveValida, exigirHolderVivo } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const llamadas: LlamadaSDK[] = []
  try {
    await ensureSeed()
    const { id } = await params
    const { butacaKey, sessionId, intento, precio, fila, columna } = (await req.json()) as {
      butacaKey?: string
      sessionId?: string
      intento?: string
      precio?: number
      fila?: number
      columna?: string
    }
    if (!esClaveValida(butacaKey) || !sessionId) {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'Falta sessionId o la butacaKey no es válida' },
        { status: 400 },
      )
    }

    const sufijo = intento ?? sessionId
    const ttlSeconds = Number(process.env.CAERUS_TTL_SECONDS) || SALA_CONFIG.ttlSecondsDefault || 30

    const usuarioNombre =
      sessionId === 'user_beto'
        ? 'Beto Pérez'
        : sessionId === 'user_carlos'
          ? 'Carlos Gómez'
          : sessionId === 'user_diana'
            ? 'Diana Prince'
            : 'Ana García'

    const butacaHolder = await conRegistro(llamadas, async () => {
      const holder = await caerus.unitary(butacaKey).take({
        idempotencyKey: `${sessionId}:${butacaKey}:${sufijo}`,
        ttlSeconds,
        ...meta({
          butacaKey,
          funcionId: id,
          usuarioId: sessionId,
          comprador: usuarioNombre,
          ...(precio !== undefined ? { precio } : {}),
          ...(fila !== undefined ? { fila } : {}),
          ...(columna !== undefined ? { columna } : {}),
        }),
      })
      exigirHolderVivo(holder, butacaKey)
      return holder
    })

    if (butacaHolder.status === 'QUEUED') {
      return NextResponse.json({
        butacaKey,
        estado: 'EN_FILA',
        butacaHolderId: butacaHolder.id,
        expiresAt: butacaHolder.expiresAt?.toISOString(),
        _llamadas: llamadas,
      })
    }

    return NextResponse.json({
      butacaKey,
      estado: 'RESERVADA',
      butacaHolderId: butacaHolder.id,
      expiresAt: butacaHolder.expiresAt.toISOString(),
      _llamadas: llamadas,
    })
  } catch (error) {
    return errorResponse(error, llamadas)
  }
}
