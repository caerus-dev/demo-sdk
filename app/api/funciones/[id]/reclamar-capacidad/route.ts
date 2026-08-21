import { NextResponse } from 'next/server'
import { caerus, conRegistro, type LlamadaSDK } from '@/lib/caerus'
import { ensureSeed, infoKey, meta } from '@/lib/cine'
import { errorResponse, esClaveValida, exigirHolderVivo } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const llamadas: LlamadaSDK[] = []
  try {
    await ensureSeed()
    const { id } = await params
    const { butacaHolderId, butacaKey, sessionId, intento } = (await req.json()) as {
      butacaHolderId?: string
      butacaKey?: string
      sessionId?: string
      intento?: string
    }
    if (!butacaHolderId || !butacaKey || !sessionId) {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'Faltan butacaHolderId, butacaKey o sessionId' },
        { status: 400 },
      )
    }

    const resultado = await conRegistro(llamadas, async () => {
      const butacaHolder = await caerus.getResourceHolder(butacaHolderId)
      if (butacaHolder.status !== 'PENDING') {
        return { estado: butacaHolder.status, capacidadHolder: null, butacaHolder }
      }
      try {
        const capacidadHolder = await caerus.pooled(infoKey(id)).takeMany(1, {
          idempotencyKey: `${sessionId}:${infoKey(id)}:${butacaKey}:${intento ?? sessionId}`,
          ttlSeconds: 120,
          ...meta({ butacaKey, funcionId: id }),
        })
        exigirHolderVivo(capacidadHolder, infoKey(id))
        return { estado: 'PENDING' as const, capacidadHolder, butacaHolder }
      } catch (error) {
        await caerus.release(butacaHolder.id).catch(() => {})
        throw error
      }
    })
    if (!resultado.capacidadHolder) {
      return NextResponse.json({
        butacaKey,
        estado: resultado.estado,
        _llamadas: llamadas,
      })
    }
    return NextResponse.json({
      butacaKey,
      estado: 'RESERVADA',
      butacaHolderId,
      capacidadHolderId: resultado.capacidadHolder.id,
      expiresAt: resultado.butacaHolder.expiresAt.toISOString(),
      _llamadas: llamadas,
    })
  } catch (error) {
    return errorResponse(error, llamadas)
  }
}
