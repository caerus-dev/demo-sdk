import { NextResponse } from 'next/server'
import { caerus, conRegistro, type LlamadaSDK } from '@/lib/caerus'
import { ensureSeed, meta } from '@/lib/cine'
import { errorResponse } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const llamadas: LlamadaSDK[] = []
  try {
    await ensureSeed()
    const { holderIds, comprador, precioTotal } = (await req.json()) as {
      holderIds?: string[]
      comprador?: string
      precioTotal?: number
    }
    if (!holderIds?.length || !comprador?.trim()) {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'Faltan holders o el nombre del comprador' },
        { status: 400 },
      )
    }

    const estados = await conRegistro(llamadas, () =>
      Promise.all(
        holderIds.map(async (id) => {
          try {
            return { id, status: (await caerus.getResourceHolder(id)).status }
          } catch {
            return { id, status: 'DESCONOCIDO' as const }
          }
        }),
      ),
    )

    const caidos = estados.filter((e) => e.status !== 'PENDING')
    if (caidos.length > 0) {
      return NextResponse.json(
        {
          code: 'CONFLICT',
          message: 'Alguna de tus reservas ya no está vigente',
          vencidos: caidos.map((e) => e.id),
          confirmados: 0,
          _llamadas: llamadas,
        },
        { status: 409 },
      )
    }

    const resultados = await conRegistro(llamadas, () =>
      Promise.allSettled(
        holderIds.map((id) =>
          caerus.confirm(id, meta({ comprador: comprador.trim(), precioTotal })),
        ),
      ),
    )

    const confirmados = holderIds.filter((_, i) => resultados[i]!.status === 'fulfilled')
    const fallidos = holderIds.filter((_, i) => resultados[i]!.status === 'rejected')
    if (fallidos.length > 0) {
      return NextResponse.json(
        {
          code: 'CONFLICT',
          message:
            'Una de tus reservas venció justo al confirmar. El resto quedó confirmado a tu nombre.',
          confirmados: confirmados.length,
          confirmadosIds: confirmados,
          vencidos: fallidos,
          _llamadas: llamadas,
        },
        { status: 409 },
      )
    }
    return NextResponse.json({ confirmados: confirmados.length, _llamadas: llamadas })
  } catch (error) {
    return errorResponse(error, llamadas)
  }
}
