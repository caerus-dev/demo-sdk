import { NextResponse } from 'next/server'
import { caerus } from '@/lib/caerus'
import {
  butacaFromResource,
  ensureSeed,
  funcionFromResource,
  grupoButacas,
  infoKey,
} from '@/lib/cine'
import { errorResponse } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSeed()
    const { id } = await params

    const info = await caerus.getResource(infoKey(id))
    const { resources } = await caerus.getResourcesByGroup(grupoButacas(id), { pageSize: 200 })

    const butacas = resources.map(butacaFromResource).sort((a, b) => {
      if (a.columna !== b.columna) return a.columna.localeCompare(b.columna)
      return a.fila - b.fila
    })
    return NextResponse.json({
      funcion: funcionFromResource(info),
      butacas,
    })
  } catch (error) {
    return errorResponse(error)
  }
}
