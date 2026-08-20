import { NextResponse } from 'next/server'
import { crearFuncion, ensureSeed } from '@/lib/cine'
import { errorResponse } from '@/lib/api'
import { rechazoSiNoAutorizado } from '@/lib/backoffice-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const rechazo = rechazoSiNoAutorizado(req)
  if (rechazo) return rechazo

  try {
    await ensureSeed()
    const { titulo, horario, posterUrl, precioBase } = (await req.json()) as {
      titulo?: string
      horario?: string
      posterUrl?: string
      precioBase?: number
    }
    if (!titulo?.trim() || !horario?.trim() || !precioBase || precioBase <= 0) {
      return NextResponse.json(
        { code: 'VALIDATION', message: 'Faltan datos de la función o el precio es inválido' },
        { status: 400 },
      )
    }

    const { id } = await crearFuncion({
      titulo: titulo.trim(),
      horario: horario.trim(),
      posterUrl: posterUrl?.trim() || '/posters/nebula.png',
      precioBase,
    })
    return NextResponse.json({ id })
  } catch (error) {
    return errorResponse(error)
  }
}
