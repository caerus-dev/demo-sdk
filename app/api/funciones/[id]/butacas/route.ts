import { NextResponse } from 'next/server'
import {
  catalogoFuncion,
  ensureSeed,
  obtenerButacasFuncion,
} from '@/lib/cine'
import { errorResponse } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSeed()
    const { id } = await params
    const f = catalogoFuncion(id)
    const url = new URL(req.url)
    const usuarioId = url.searchParams.get('usuarioId') ?? undefined

    const { butacas, miEstado } = await obtenerButacasFuncion(id, usuarioId)
    const disponibles = butacas.filter((b) => b.disponible).length

    return NextResponse.json({
      funcion: {
        id,
        titulo: f?.titulo ?? 'Función',
        horario: f?.horario ?? '',
        posterUrl: f?.posterUrl ?? '',
        precioBase: f?.precioBase ?? 0,
        politica: f?.politica ?? 'FAIL',
        butacasDisponibles: disponibles,
        capacidadTotal: butacas.length,
      },
      butacas,
      miEstado,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
