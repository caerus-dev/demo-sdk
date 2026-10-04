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
    const { butacaKey, sessionId, intento } = (await req.json()) as {
      butacaKey?: string
      sessionId?: string
      intento?: string
    }
    if (!esClaveValida(butacaKey) || !sessionId) {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'Falta sessionId o la butacaKey no es válida' },
        { status: 400 },
      )
    }

    const sufijo = intento ?? crypto.randomUUID()

    const ttlSeconds = Number(process.env.CAERUS_TTL_SECONDS) || 30

    const resultado = await conRegistro(llamadas, async () => {
      const butacaHolder = await caerus.unitary(butacaKey).take({
        idempotencyKey: `${sessionId}:${butacaKey}:${sufijo}`,
        ttlSeconds,
        ...meta({ butacaKey, funcionId: id }),
      })
      exigirHolderVivo(butacaHolder, butacaKey)
      return { butacaHolder }
    })

    const { butacaHolder } = resultado
    if (butacaHolder.status === 'QUEUED') {
      return NextResponse.json({
        butacaKey,
        estado: 'EN_FILA',
        butacaHolderId: butacaHolder.id,
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
