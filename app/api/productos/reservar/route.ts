import { NextResponse } from 'next/server'
import { caerus, conRegistro, type LlamadaSDK } from '@/lib/caerus'
import { ensureSeed, meta } from '@/lib/cine'
import { errorResponse, esCantidadValida, esClaveValida } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const llamadas: LlamadaSDK[] = []
  try {
    await ensureSeed()
    const { productoKey, cantidad, sessionId } = (await req.json()) as {
      productoKey?: string
      cantidad?: number
      sessionId?: string
    }
    if (!esClaveValida(productoKey) || !sessionId || !esCantidadValida(cantidad)) {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'Faltan datos o la cantidad es inválida' },
        { status: 400 },
      )
    }

    const holder = await conRegistro(llamadas, () =>
      caerus.pooled(productoKey).takeMany(cantidad, {
        idempotencyKey: `${sessionId}:${productoKey}:${cantidad}`,
        ttlSeconds: 120,
        ...meta({ productoKey, cantidad }),
      }),
    )
    return NextResponse.json({
      productoKey,
      holderId: holder.id,
      cantidad: holder.amount,
      expiresAt: holder.expiresAt.toISOString(),
      _llamadas: llamadas,
    })
  } catch (error) {
    return errorResponse(error, llamadas)
  }
}
