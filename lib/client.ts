'use client'

export const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error('Error de red')
    return r.json()
  })

export interface UsuarioDemo {
  id: string
  nombre: string
  rol: string
  colorBadge: string
}

export const USUARIOS_DEMO: UsuarioDemo[] = [
  { id: 'user_ana', nombre: 'Ana García', rol: 'Usuario 1', colorBadge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { id: 'user_beto', nombre: 'Beto Pérez', rol: 'Usuario 2', colorBadge: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' },
  { id: 'user_carlos', nombre: 'Carlos Gómez', rol: 'Usuario 3', colorBadge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { id: 'user_diana', nombre: 'Diana Prince', rol: 'Usuario 4', colorBadge: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
]

export function getUsuarioActual(): UsuarioDemo {
  if (typeof window === 'undefined') return USUARIOS_DEMO[0]
  const storedId = sessionStorage.getItem('caerus_user_id')
  const found = USUARIOS_DEMO.find((u) => u.id === storedId)
  if (found) return found

  // Si no está seteado, asignamos Ana por defecto
  sessionStorage.setItem('caerus_user_id', USUARIOS_DEMO[0].id)
  sessionStorage.setItem('caerus_session', USUARIOS_DEMO[0].id)
  return USUARIOS_DEMO[0]
}

export function cambiarUsuario(usuarioId: string): void {
  if (typeof window === 'undefined') return
  const target = USUARIOS_DEMO.find((u) => u.id === usuarioId) ?? USUARIOS_DEMO[0]
  sessionStorage.setItem('caerus_user_id', target.id)
  sessionStorage.setItem('caerus_session', target.id)
  // No borramos las reservas: cada usuario mantiene su propio carrito aislado
  // en su clave correspondiente (caerus_reserva_<usuarioId>_<funcionId>)
  window.location.reload()
}

export function rotarSiguienteUsuario(): void {
  if (typeof window === 'undefined') return
  const actual = getUsuarioActual()
  const idx = USUARIOS_DEMO.findIndex((u) => u.id === actual.id)
  const siguiente = USUARIOS_DEMO[(idx + 1) % USUARIOS_DEMO.length]
  cambiarUsuario(siguiente.id)
}

export function registrarCompraUsuario(usuarioId: string, funcionId: string, butacasKeys: string[]): void {
  if (typeof window === 'undefined') return
  const clave = `caerus_compradas_${usuarioId}_${funcionId}`
  try {
    const prev = JSON.parse(localStorage.getItem(clave) || '[]') as string[]
    const unicas = Array.from(new Set([...prev, ...butacasKeys]))
    localStorage.setItem(clave, JSON.stringify(unicas))
  } catch {}
}

export function obtenerComprasUsuario(usuarioId: string, funcionId: string): string[] {
  if (typeof window === 'undefined') return []
  const clave = `caerus_compradas_${usuarioId}_${funcionId}`
  try {
    return JSON.parse(localStorage.getItem(clave) || '[]') as string[]
  } catch {
    return []
  }
}

export function limpiarTodasLasCompras(): void {
  if (typeof window === 'undefined') return
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith('caerus_compradas_')) {
      localStorage.removeItem(k)
    }
  }
}

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'server'
  let id = sessionStorage.getItem('caerus_session')
  if (!id) {
    const u = getUsuarioActual()
    id = u.id
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

export function nombreDeUsuario(): string {
  if (typeof window === 'undefined') return 'Ana García'
  return getUsuarioActual().nombre
}

export function nuevoUsuario(): void {
  rotarSiguienteUsuario()
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
  capacidadHolderId?: string
  fila: number
  columna: string
  precio: number
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
  expiresAt?: string
}

export interface ReservaSesion {
  funcionId: string
  butacas: ButacaReservada[]
  productos: ProductoReservado[]
  enFila?: ButacaEnFila[]
}

function reservaKey(usuarioId: string, funcionId: string): string {
  return `caerus_reserva_${usuarioId}_${funcionId}`
}

export function leerReserva(funcionId: string): ReservaSesion {
  if (typeof window === 'undefined') return { funcionId, butacas: [], productos: [] }
  const usuario = getUsuarioActual()
  try {
    const raw =
      sessionStorage.getItem(reservaKey(usuario.id, funcionId)) ||
      sessionStorage.getItem(`caerus_reserva_${funcionId}`)
    if (raw) {
      const parsed = JSON.parse(raw) as ReservaSesion
      const ahora = Date.now()
      // Descartar reservas y filas vencidas por TTL para no dejar estados fantasma
      const butacasVivas = (parsed.butacas || []).filter(
        (b) => new Date(b.expiresAt).getTime() > ahora,
      )
      const productosVivos = (parsed.productos || []).filter(
        (p) => new Date(p.expiresAt).getTime() > ahora,
      )
      const enFilaVivas = (parsed.enFila || []).filter(
        (b) => !b.expiresAt || new Date(b.expiresAt).getTime() > ahora,
      )
      const limpia: ReservaSesion = {
        ...parsed,
        butacas: butacasVivas,
        productos: productosVivos,
        enFila: enFilaVivas,
      }
      if (
        butacasVivas.length !== (parsed.butacas || []).length ||
        productosVivos.length !== (parsed.productos || []).length ||
        enFilaVivas.length !== (parsed.enFila || []).length
      ) {
        guardarReserva(limpia)
      }
      return limpia
    }
  } catch {}
  return { funcionId, butacas: [], productos: [] }
}

export function guardarReserva(reserva: ReservaSesion): void {
  if (typeof window === 'undefined') return
  const usuario = getUsuarioActual()
  sessionStorage.setItem(reservaKey(usuario.id, reserva.funcionId), JSON.stringify(reserva))
}

export function limpiarReserva(funcionId: string): void {
  if (typeof window === 'undefined') return
  const usuario = getUsuarioActual()
  sessionStorage.removeItem(reservaKey(usuario.id, funcionId))
  sessionStorage.removeItem(`caerus_reserva_${funcionId}`)
}

function intentoKey(usuarioId: string, funcionId: string, butacaKey: string): string {
  return `caerus_intento_${usuarioId}_${funcionId}_${butacaKey}`
}

export function intentoDe(funcionId: string, butacaKey: string): string {
  if (typeof window === 'undefined') return ''
  const usuario = getUsuarioActual()
  // Limpiamos cualquier clave residual previa y generamos un UUID fresco por cada intento de clic,
  // evitando que el caché de idempotencia de 24h en Redis devuelva holders viejos (EXPIRED/RELEASED/CONFIRMED).
  sessionStorage.removeItem(intentoKey(usuario.id, funcionId, butacaKey))
  sessionStorage.removeItem(`caerus_intento_${funcionId}_${butacaKey}`)
  return crypto.randomUUID()
}

export function cerrarIntento(funcionId: string, butacaKey: string): void {
  if (typeof window === 'undefined') return
  const usuario = getUsuarioActual()
  sessionStorage.removeItem(intentoKey(usuario.id, funcionId, butacaKey))
  sessionStorage.removeItem(`caerus_intento_${funcionId}_${butacaKey}`)
}

export interface EventoWebhookCliente {
  id: string
  eventType: string
  displayTitle: string
  resourceKey: string
  holderId?: string
  usuarioId?: string
  comprador?: string
  expiresAt?: string
  amount?: number
  occurredAt: string
  receivedAt: string
  dataSummary: string
  verified: boolean
  raw: Record<string, unknown>
}

/**
 * Conecta al stream SSE (/api/events/stream) para latencia 0ms en localhost
 * y en paralelo sincroniza contra /api/webhooks/caerus (JSON corto que Cloudflare Tunnel
 * nunca retiene en su buffer de streaming HTTP/2), deduplicando por id de evento.
 */
export function conectarEventosWebhook(opciones: {
  onInit?: (historial: EventoWebhookCliente[]) => void
  onWebhook: (evento: EventoWebhookCliente) => void
  onEstado?: (conectado: boolean) => void
}): () => void {
  const procesados = new Set<string>()
  let inicializado = false
  let cerrado = false

  function manejarLista(lista: EventoWebhookCliente[]) {
    if (cerrado || !Array.isArray(lista)) return
    opciones.onEstado?.(true)

    if (!inicializado) {
      inicializado = true
      for (const item of lista) {
        if (item?.id) procesados.add(item.id)
      }
      opciones.onInit?.(lista)
      return
    }

    if (lista.length === 0 && procesados.size > 0) {
      procesados.clear()
      return
    }

    // Recorrer de más antiguo a más reciente para disparar en orden cronológico
    for (let i = lista.length - 1; i >= 0; i--) {
      const ev = lista[i]
      if (ev?.id && !procesados.has(ev.id)) {
        procesados.add(ev.id)
        opciones.onWebhook(ev)
      }
    }
  }

  const es = new EventSource('/api/events/stream')

  es.onopen = () => {
    if (!cerrado) opciones.onEstado?.(true)
  }

  es.addEventListener('init', (e) => {
    try {
      const history = JSON.parse(e.data) as EventoWebhookCliente[]
      manejarLista(history)
    } catch {
      // Silencioso
    }
  })

  es.addEventListener('webhook', (e) => {
    try {
      const ev = JSON.parse(e.data) as EventoWebhookCliente
      if (!ev?.id) return
      inicializado = true
      if (!procesados.has(ev.id)) {
        procesados.add(ev.id)
        opciones.onWebhook(ev)
      }
    } catch {
      // Silencioso
    }
  })

  async function sincronizarPorJson() {
    if (cerrado) return
    try {
      const res = await fetch('/api/webhooks/caerus', { cache: 'no-store' })
      if (!res.ok) return
      const json = (await res.json()) as { events?: EventoWebhookCliente[] }
      if (Array.isArray(json?.events)) {
        manejarLista(json.events)
      }
    } catch {
      // Silencioso
    }
  }

  void sincronizarPorJson()
  const timer = setInterval(() => {
    void sincronizarPorJson()
  }, 1000)

  return () => {
    cerrado = true
    clearInterval(timer)
    es.close()
  }
}
