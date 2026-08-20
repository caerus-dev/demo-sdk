import { NextResponse } from 'next/server'
import { caerus, conRegistro, type LlamadaSDK } from '@/lib/caerus'
import { COLUMNAS, FILAS, butacaKey, ensureSeed, infoKey } from '@/lib/cine'
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
    const { funcionId } = (await req.json()) as { funcionId?: string }

    if (!funcionId) {
      return NextResponse.json({ code: 'VALIDATION', message: 'Falta funcionId' }, { status: 400 })
    }

    const resultado = await conRegistro(llamadas, async () => {
      await caerus.deleteResource(infoKey(funcionId))

      const claves = COLUMNAS.flatMap((columna) =>
        FILAS.map((fila) => butacaKey(funcionId, columna, fila)),
      )

      let borradas = 0
      for (let i = 0; i < claves.length; i += 12) {
        const tanda = await Promise.allSettled(
          claves.slice(i, i + 12).map((k) => caerus.deleteResource(k)),
        )
        borradas += tanda.filter((r) => r.status === 'fulfilled').length
      }
      return borradas
    })

    return NextResponse.json({ funcionId, butacasBorradas: resultado, _llamadas: llamadas })
  } catch (error) {
    return errorResponse(error, llamadas)
  }
}
