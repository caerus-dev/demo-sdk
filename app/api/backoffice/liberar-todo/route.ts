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

    const liberados = await conRegistro(llamadas, async () => {
      const { holders } = await caerus.listResourceHolders({ status: 'PENDING', pageSize: 300 })
      const resultados = await Promise.allSettled(holders.map((h) => caerus.release(h.id)))
      return resultados.filter((r) => r.status === 'fulfilled').length
    })

    return NextResponse.json({ liberados, _llamadas: llamadas })
  } catch (error) {
    return errorResponse(error, llamadas)
  }
}
