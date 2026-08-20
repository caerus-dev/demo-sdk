import { NextResponse } from 'next/server'
import { caerus, conRegistro, type LlamadaSDK } from '@/lib/caerus'
import { CATALOGO_PRODUCTOS, ensureSeed } from '@/lib/cine'
import { errorResponse } from '@/lib/api'
import { rechazoSiNoAutorizado } from '@/lib/backoffice-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const rechazo = rechazoSiNoAutorizado(req)
  if (rechazo) return rechazo

  const llamadas: LlamadaSDK[] = []
  try {
    await ensureSeed()
    const { productoKey } = (await req.json()) as { productoKey?: string }

    const delCatalogo = CATALOGO_PRODUCTOS.find((p) => p.key === productoKey)
    if (!productoKey || !delCatalogo) {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'Producto desconocido' },
        { status: 400 },
      )
    }

    const resultado = await conRegistro(llamadas, async () => {
      const actual = await caerus.getResource(productoKey)
      const capacidadActual = actual.availableAmount + actual.pendingCount
      const delta = delCatalogo.stock - capacidadActual
      if (delta === 0) return { delta: 0, disponibles: actual.availableAmount }
      const repuesto = await caerus.updateResource(productoKey, delta, {
        idempotencyKey: `reponer:${productoKey}:${Date.now()}`,
      })
      return { delta, disponibles: repuesto.availableAmount }
    })

    return NextResponse.json({
      productoKey,
      nombre: delCatalogo.nombre,
      ...resultado,
      _llamadas: llamadas,
    })
  } catch (error) {
    return errorResponse(error, llamadas)
  }
}
