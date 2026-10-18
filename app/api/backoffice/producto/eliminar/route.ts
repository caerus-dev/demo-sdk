import { NextResponse } from 'next/server'
import { conRegistro, type LlamadaSDK } from '@/lib/caerus'
import { eliminarProducto, ensureSeed } from '@/lib/cine'
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
    const { key, productoKey } = (await req.json()) as { key?: string; productoKey?: string }
    const targetKey = key || productoKey

    if (!targetKey) {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'Falta la clave del producto' },
        { status: 400 },
      )
    }

    await conRegistro(llamadas, async () => {
      await eliminarProducto(targetKey)
    })

    return NextResponse.json({ key: targetKey, _llamadas: llamadas })
  } catch (error) {
    return errorResponse(error, llamadas)
  }
}
