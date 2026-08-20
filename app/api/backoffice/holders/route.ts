import { NextResponse } from 'next/server'
import { caerus, type ResourceHolderStatus } from '@/lib/caerus'
import {
  butacaFromResource,
  ensureSeed,
  funcionFromResource,
  GRUPO_FUNCIONES,
  GRUPO_PRODUCTOS,
  grupoButacas,
  holderToDTO,
  productoFromResource,
} from '@/lib/cine'
import { errorResponse } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ESTADOS: ResourceHolderStatus[] = ['PENDING', 'CONFIRMED', 'RELEASED', 'QUEUED', 'EXPIRED']

async function buildRefIndex(): Promise<Map<string, { resourceKey: string; etiqueta: string }>> {
  const index = new Map<string, { resourceKey: string; etiqueta: string }>()

  const { resources: funciones } = await caerus.getResourcesByGroup(GRUPO_FUNCIONES, {
    pageSize: 200,
  })
  for (const f of funciones) {
    const funcion = funcionFromResource(f)
    index.set(f.id, { resourceKey: f.key, etiqueta: `Capacidad · ${funcion.titulo}` })

    const { resources: butacas } = await caerus.getResourcesByGroup(grupoButacas(funcion.id), {
      pageSize: 200,
    })
    for (const b of butacas) {
      const butaca = butacaFromResource(b)
      index.set(b.id, {
        resourceKey: b.key,
        etiqueta: `Butaca ${butaca.columna}${butaca.fila} · ${funcion.titulo}`,
      })
    }
  }

  const { resources: productos } = await caerus.getResourcesByGroup(GRUPO_PRODUCTOS, {
    pageSize: 200,
  })
  for (const p of productos) {
    index.set(p.id, { resourceKey: p.key, etiqueta: `Candy · ${productoFromResource(p).nombre}` })
  }
  return index
}

export async function GET(req: Request) {
  try {
    await ensureSeed()
    const statusParam = new URL(req.url).searchParams.get('status')
    const status = ESTADOS.includes(statusParam as ResourceHolderStatus)
      ? (statusParam as ResourceHolderStatus)
      : undefined

    const [{ holders }, refIndex] = await Promise.all([
      caerus.listResourceHolders({ status, sort: 'NEWEST_FIRST', pageSize: 500 }),
      buildRefIndex(),
    ])
    return NextResponse.json({
      holders: holders.map((h) => holderToDTO(h, refIndex.get(h.resourceId))),
    })
  } catch (error) {
    return errorResponse(error)
  }
}
