import { NextResponse } from 'next/server'
import { BACKOFFICE_PROTEGIDO } from '@/lib/backoffice-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ protegido: BACKOFFICE_PROTEGIDO })
}
