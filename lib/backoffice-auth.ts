import { NextResponse } from 'next/server'

const token = process.env.BACKOFFICE_TOKEN?.trim()

export const BACKOFFICE_PROTEGIDO = Boolean(token)

export function rechazoSiNoAutorizado(req: Request): NextResponse | null {
  if (!token) return null

  const enviado = req.headers.get('x-backoffice-token')?.trim()
  if (enviado && enviado === token) return null

  return NextResponse.json(
    { code: 'FORBIDDEN', message: 'Esta acción necesita el token del Backoffice' },
    { status: 403 },
  )
}
