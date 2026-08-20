import { NextResponse } from 'next/server'
import { caerus } from '@/lib/caerus'
import { ensureSeed, GRUPO_PRODUCTOS, productoFromResource } from '@/lib/cine'
import { errorResponse } from '@/lib/api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await ensureSeed()
    const { resources } = await caerus.getResourcesByGroup(GRUPO_PRODUCTOS, { pageSize: 100 })
    return NextResponse.json({ productos: resources.map(productoFromResource) })
  } catch (error) {
    return errorResponse(error)
  }
}
