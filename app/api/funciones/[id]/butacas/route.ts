import { NextResponse } from 'next/server'
import { caerus } from '@/lib/caerus'
import {
  butacaFromResource,
  ensureSeed,
  funcionFromResource,
  grupoButacas,
  infoKey,
  FILAS,
  COLUMNAS,
} from '@/lib/cine'
import { errorResponse } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSeed()
    const { id } = await params

    const info = await caerus.getResource(infoKey(id)).catch(() => null)
    const { resources } = await caerus.getResourcesByGroup(grupoButacas(id), { pageSize: 200 })

    const butacas = resources
      .map(butacaFromResource)
      .filter((b) => (FILAS as readonly number[]).includes(b.fila))
      .sort((a, b) => {
        if (a.columna !== b.columna) return a.columna.localeCompare(b.columna)
        return a.fila - b.fila
      })

    const capacidadTotal = COLUMNAS.length * FILAS.length

    return NextResponse.json({
      funcion: info
        ? { ...funcionFromResource(info), capacidadTotal }
        : {
            id,
            key: infoKey(id),
            titulo: 'El Último Horizonte',
            horario: 'Hoy 20:30',
            posterUrl: '/posters/nebula.png',
            precioBase: 4500,
            butacasDisponibles: butacas.filter((b) => b.disponible).length,
            capacidadTotal,
            politica: 'FAIL',
          },
      butacas,
    })
  } catch (error) {
    console.error('[butacas] Error en /api/funciones/[id]/butacas:', (error as Error).message || error)
    return errorResponse(error)
  }
}
