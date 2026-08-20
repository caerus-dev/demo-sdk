import { NextResponse } from 'next/server'
import { caerus } from '@/lib/caerus'
import { ensureSeed, funcionFromResource, GRUPO_FUNCIONES } from '@/lib/cine'
import { errorResponse } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await ensureSeed()
    const { resources } = await caerus.getResourcesByGroup(GRUPO_FUNCIONES, { pageSize: 100 })
    return NextResponse.json({ funciones: resources.map(funcionFromResource) })
  } catch (error) {
    return errorResponse(error)
  }
}
