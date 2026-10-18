import { NextResponse } from 'next/server'
import { caerus, conRegistro, type LlamadaSDK } from '@/lib/caerus'
import { ensureSeed } from '@/lib/cine'
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
    const { productoKey, key, delta } = (await req.json()) as {
      productoKey?: string
      key?: string
      delta?: number
    }
    const targetKey = productoKey || key

    if (!targetKey) {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'Falta la clave del producto' },
        { status: 400 },
      )
    }

    if (typeof delta !== 'number' || !Number.isInteger(delta) || delta === 0) {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'El delta es requerido y debe ser un número entero distinto de 0' },
        { status: 400 },
      )
    }

    const resultado = await conRegistro(llamadas, async () => {
      const repuesto = await caerus.updateResource(targetKey, delta)
      return { delta, disponibles: repuesto.availableAmount }
    })

    return NextResponse.json({
      productoKey: targetKey,
      ...resultado,
      _llamadas: llamadas,
    })
  } catch (error) {
    return errorResponse(error, llamadas)
  }
}

export const PATCH = POST
