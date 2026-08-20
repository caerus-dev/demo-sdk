import { NextResponse } from 'next/server'
import { caerus, conRegistro, type LlamadaSDK } from '@/lib/caerus'
import { ensureSeed } from '@/lib/cine'
import { errorResponse } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const llamadas: LlamadaSDK[] = []
  try {
    await ensureSeed()
    const { holderIds } = (await req.json()) as { holderIds?: string[] }
    if (!holderIds?.length) {
      return NextResponse.json({ liberados: 0 })
    }

    let liberados = 0
    await conRegistro(llamadas, () =>
      Promise.all(
        holderIds.map(async (id) => {
          try {
            await caerus.release(id)
            liberados += 1
          } catch {
          }
        }),
      ),
    )
    return NextResponse.json({ liberados, _llamadas: llamadas })
  } catch (error) {
    return errorResponse(error, llamadas)
  }
}
