import { NextResponse } from 'next/server'
import { caerus } from '@/lib/caerus'
import { ensureSeed, holderToDTO } from '@/lib/cine'
import { errorResponse } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    await ensureSeed()
    const ids = new URL(req.url).searchParams.get('ids')
    if (!ids) return NextResponse.json({ holders: [] })

    const holders = await Promise.all(
      ids
        .split(',')
        .filter(Boolean)
        .map(async (id) => {
          try {
            return holderToDTO(await caerus.getResourceHolder(id))
          } catch {
            return null
          }
        }),
    )
    return NextResponse.json({ holders: holders.filter(Boolean) })
  } catch (error) {
    return errorResponse(error)
  }
}
