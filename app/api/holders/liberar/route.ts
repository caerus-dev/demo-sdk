import { NextResponse } from 'next/server'
import { caerus, conRegistro, type LlamadaSDK } from '@/lib/caerus'
import { ensureSeed } from '@/lib/cine'
import { errorResponse } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const llamadas: LlamadaSDK[] = []
  try {
    const { holderIds } = (await req.json().catch(() => ({}))) as { holderIds?: string[] }
    const validos = (holderIds ?? []).filter((id): id is string => Boolean(id && typeof id === 'string'))
    if (!validos.length) {
      return NextResponse.json({ liberados: 0 })
    }

    let liberados = 0
    await conRegistro(llamadas, () =>
      Promise.all(
        validos.map(async (id) => {
          try {
            await caerus.release(id)
            liberados += 1
          } catch (e) {
            console.warn(`[liberar] Error liberando holder ${id}:`, e)
          }
        }),
      ),
    )
    return NextResponse.json({ liberados, _llamadas: llamadas })
  } catch (error) {
    return errorResponse(error, llamadas)
  }
}

