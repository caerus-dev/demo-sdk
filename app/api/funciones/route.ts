import { NextResponse } from 'next/server'
import { CATALOGO_FUNCIONES, ensureSeed, obtenerButacasFuncion, type FuncionDTO } from '@/lib/cine'
import { errorResponse } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await ensureSeed()
    const funciones: FuncionDTO[] = await Promise.all(
      CATALOGO_FUNCIONES.map(async (f) => {
        try {
          const butacas = await obtenerButacasFuncion(f.id)
          const disponibles = butacas.filter((b) => b.disponible).length
          const total = butacas.length || f.filas * f.columnas.length
          return {
            id: f.id,
            key: f.id,
            titulo: f.titulo,
            horario: f.horario,
            posterUrl: f.posterUrl,
            precioBase: f.precioBase,
            politica: f.politica,
            butacasDisponibles: disponibles,
            capacidadTotal: total,
          }
        } catch {
          const total = f.filas * f.columnas.length
          return {
            id: f.id,
            key: f.id,
            titulo: f.titulo,
            horario: f.horario,
            posterUrl: f.posterUrl,
            precioBase: f.precioBase,
            politica: f.politica,
            butacasDisponibles: total,
            capacidadTotal: total,
          }
        }
      }),
    )
    return NextResponse.json({ funciones })
  } catch (error) {
    return errorResponse(error)
  }
}
