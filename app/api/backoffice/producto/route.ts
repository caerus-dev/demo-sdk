import { NextResponse } from 'next/server'
import { crearProducto, ensureSeed } from '@/lib/cine'
import { errorResponse } from '@/lib/api'
import { rechazoSiNoAutorizado } from '@/lib/backoffice-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const rechazo = rechazoSiNoAutorizado(req)
  if (rechazo) return rechazo

  try {
    await ensureSeed()
    const { nombre, tamanio, precio, stock } = (await req.json()) as {
      nombre?: string
      tamanio?: string
      precio?: number
      stock?: number
    }
    if (!nombre?.trim() || !precio || precio <= 0 || stock == null || stock < 0) {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'Faltan datos del producto o son inválidos' },
        { status: 400 },
      )
    }

    const { key } = await crearProducto({
      nombre: nombre.trim(),
      tamanio: tamanio?.trim() || 'Único',
      precio,
      stock,
    })
    return NextResponse.json({ key })
  } catch (error) {
    return errorResponse(error)
  }
}
