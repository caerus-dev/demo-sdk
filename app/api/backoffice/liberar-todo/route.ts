import { NextResponse } from 'next/server'
import { caerus, conRegistro, type LlamadaSDK } from '@/lib/caerus'
import { ensureSeed } from '@/lib/cine'
import { errorResponse } from '@/lib/api'
import { rechazoSiNoAutorizado } from '@/lib/backoffice-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VIVOS = ['PENDING', 'QUEUED'] as const

export async function POST(req: Request) {
  const rechazo = rechazoSiNoAutorizado(req)
  if (rechazo) return rechazo

  const llamadas: LlamadaSDK[] = []
  try {
    await ensureSeed()

    const resumen = await conRegistro(llamadas, async () => {
      const paginas = await Promise.all(
        VIVOS.map((status) => caerus.listResourceHolders({ status, pageSize: 300 })),
      )
      const holders = paginas.flatMap((p) => p.holders)
      const resultados = await Promise.allSettled(holders.map((h) => caerus.release(h.id)))
      return {
        encontrados: holders.length,
        liberados: resultados.filter((r) => r.status === 'fulfilled').length,
      }
    })

    const fallidos = resumen.encontrados - resumen.liberados

    return NextResponse.json({
      ...resumen,
      fallidos,
      aviso: fallidos
        ? `${fallidos} de ${resumen.encontrados} figuran vigentes en el listado pero el motor ya no los tiene así: la vista persistida quedó atrasada.`
        : undefined,
      _llamadas: llamadas,
    })
  } catch (error) {
    return errorResponse(error, llamadas)
  }
}
