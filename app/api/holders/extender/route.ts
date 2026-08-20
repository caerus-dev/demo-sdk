import { NextResponse } from 'next/server'
import { caerus, conRegistro, type LlamadaSDK } from '@/lib/caerus'
import { ensureSeed } from '@/lib/cine'
import { errorResponse } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EXTRA_MS = 120_000

export async function POST(req: Request) {
  const llamadas: LlamadaSDK[] = []
  try {
    await ensureSeed()
    const { holderIds } = (await req.json()) as { holderIds?: string[] }
    if (!holderIds?.length) {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'Faltan holderIds' },
        { status: 400 },
      )
    }

    const resultados = await conRegistro(llamadas, () =>
      Promise.allSettled(holderIds.map((id) => caerus.extend(id, EXTRA_MS))),
    )

    const extendidos = resultados.filter((r) => r.status === 'fulfilled')
    if (extendidos.length === 0) {
      return NextResponse.json(
        {
          code: 'CONFLICT',
          message: 'No se pudo extender: alguna reserva ya no está vigente',
          _llamadas: llamadas,
        },
        { status: 409 },
      )
    }

    const nuevoExpiresAt = extendidos
      .map((r) => (r as PromiseFulfilledResult<{ expiresAt: Date }>).value.expiresAt)
      .sort((a, b) => a.getTime() - b.getTime())[0]!

    return NextResponse.json({
      extendidos: extendidos.length,
      expiresAt: nuevoExpiresAt.toISOString(),
      _llamadas: llamadas,
    })
  } catch (error) {
    return errorResponse(error, llamadas)
  }
}
