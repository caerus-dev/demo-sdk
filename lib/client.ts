'use client'

export const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Error de red')
    return r.json()
  })

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'server'
  let id = sessionStorage.getItem('caerus_session')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('caerus_session', id)
  }
  return id
}

export function tokenBackoffice(): string {
  if (typeof window === 'undefined') return ''
  return sessionStorage.getItem('caerus_backoffice_token') ?? ''
}

export function guardarTokenBackoffice(valor: string): void {
  if (typeof window === 'undefined') return
  if (valor.trim()) sessionStorage.setItem('caerus_backoffice_token', valor.trim())
  else sessionStorage.removeItem('caerus_backoffice_token')
}

export function cabecerasBackoffice(base: Record<string, string> = {}): Record<string, string> {
  const t = tokenBackoffice()
  return t ? { ...base, 'x-backoffice-token': t } : base
}

const NOMBRES = ['Ana', 'Beto', 'Caro', 'Dani', 'Emi', 'Fede', 'Gabi', 'Hugo', 'Ivo', 'Jime']

export function nombreDeUsuario(): string {
  if (typeof window === 'undefined') return ''
  const id = getSessionId()
  let suma = 0
  for (const c of id) suma = (suma * 31 + c.charCodeAt(0)) % 100000
  return NOMBRES[suma % NOMBRES.length] + '-' + id.slice(0, 4)
}

export function nuevoUsuario(): void {
  if (typeof window === 'undefined') return
  sessionStorage.clear()
  sessionStorage.setItem('caerus_session', crypto.randomUUID())
  window.location.reload()
}

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export function formatPrecio(valor: number): string {
  return pesos.format(valor)
}

export function formatRestante(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0')
  const s = (total % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export interface ButacaReservada {
  butacaKey: string
  butacaHolderId: string
  capacidadHolderId: string
  fila: number
  columna: string
  precio: number
  tipo: string
  expiresAt: string
}

export interface ProductoReservado {
  productoKey: string
  holderId: string
  nombre: string
  tamanio: string
  precio: number
  cantidad: number
  expiresAt: string
}

export interface ButacaEnFila {
  butacaKey: string
  butacaHolderId: string
  fila: number
  columna: string
  precio: number
  tipo: string
}

export interface ReservaSesion {
  funcionId: string
  butacas: ButacaReservada[]
  productos: ProductoReservado[]
  enFila?: ButacaEnFila[]
}

function reservaKey(funcionId: string): string {
  return `caerus_reserva_${funcionId}`
}

export function leerReserva(funcionId: string): ReservaSesion {
  if (typeof window === 'undefined') return { funcionId, butacas: [], productos: [] }
  try {
    const raw = sessionStorage.getItem(reservaKey(funcionId))
    if (raw) return JSON.parse(raw) as ReservaSesion
  } catch {
  }
  return { funcionId, butacas: [], productos: [] }
}

export function guardarReserva(reserva: ReservaSesion): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(reservaKey(reserva.funcionId), JSON.stringify(reserva))
}

export function limpiarReserva(funcionId: string): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(reservaKey(funcionId))
}
