import { NextResponse } from 'next/server'
import { caerusErrorCode, type LlamadaSDK } from './caerus'
import { ConflictError } from './caerus/errors'

const VIVOS = ['PENDING', 'QUEUED']

export function exigirHolderVivo(holder: { status: string }, recurso: string): void {
  if (VIVOS.includes(holder.status)) return
  throw new ConflictError(
    `Caerus devolvió un holder ${holder.status} para ${recurso}: esa reserva no está vigente`,
  )
}

export function errorResponse(error: unknown, llamadas?: LlamadaSDK[]) {
  const code = caerusErrorCode(error)
  const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado'
  const extra = llamadas?.length ? { _llamadas: llamadas } : {}
  if (code === 'CONFLICT') {
    return NextResponse.json({ code: 'CONFLICT', message, ...extra }, { status: 409 })
  }
  if (code === 'VALIDATION') {
    return NextResponse.json({ code: 'VALIDATION', message, ...extra }, { status: 400 })
  }
  if (code === 'CAERUS') {
    return NextResponse.json({ code: 'CAERUS', message, ...extra }, { status: 500 })
  }
  console.log('Error inesperado en Route Handler:', error)
  return NextResponse.json(
    { code: 'INTERNAL', message: 'Ocurrió un error inesperado', ...extra },
    { status: 500 },
  )
}
