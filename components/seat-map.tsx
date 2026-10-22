'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { AlertTriangle, ArrowRight, Hourglass, Loader2, RefreshCw } from 'lucide-react'
import { Countdown } from '@/components/countdown'
import {
  cerrarIntento,
  conectarEventosWebhook,
  fetcher,
  formatPrecio,
  getSessionId,
  getUsuarioActual,
  guardarReserva,
  intentoDe,
  leerReserva,
  obtenerComprasUsuario,
  type ButacaEnFila,
  type ButacaReservada,
  type ReservaSesion,
} from '@/lib/client'
import { publicar } from '@/lib/registro-cliente'
import type { ButacaDTO, FuncionDTO } from '@/lib/cine'
import { cn } from '@/lib/utils'

interface Respuesta {
  funcion: FuncionDTO
  butacas: ButacaDTO[]
  miEstado?: {
    reservadas: ButacaReservada[]
    enCola: ButacaEnFila[]
    compradas: string[]
  }
}

const COLS = ['A', 'B', 'C', 'D', 'E', 'F']
const ROWS = [1, 2, 3, 4, 5]
const SEAT = 40
const GAP = 12
const PAD_X = 36
const PAD_TOP = 92
const GRID_W = COLS.length * SEAT + (COLS.length - 1) * GAP
const VIEW_W = GRID_W + PAD_X * 2
const VIEW_H = PAD_TOP + ROWS.length * SEAT + (ROWS.length - 1) * GAP + 24

export function SeatMap({ funcionId }: { funcionId: string }) {
  const router = useRouter()
  const usuarioActual = getUsuarioActual()
  const { data, mutate, isValidating } = useSWR<Respuesta>(
    `/api/funciones/${funcionId}/butacas?usuarioId=${usuarioActual.id}`,
    fetcher,
    { refreshInterval: 2000, refreshWhenHidden: true },
  )

  const [reserva, setReserva] = useState<ReservaSesion>({
    funcionId,
    butacas: [],
    productos: [],
  })
  const [conflictos, setConflictos] = useState<Set<string>>(new Set())
  const [soltando, setSoltando] = useState<Set<string>>(new Set())
  const [compradasPorMi, setCompradasPorMi] = useState<Set<string>>(new Set())
  const [aviso, setAviso] = useState<string | null>(null)
  const [cargando, setCargando] = useState<string | null>(null)

  useEffect(() => {
    setReserva(leerReserva(funcionId))
    const usuario = getUsuarioActual()
    setCompradasPorMi(new Set(obtenerComprasUsuario(usuario.id, funcionId)))
  }, [funcionId])

  // Reconciliación con el estado autoritativo en Caerus para este usuario
  useEffect(() => {
    if (!data?.miEstado) return

    const serverReservadas = data.miEstado.reservadas
    const serverEnCola = data.miEstado.enCola
    const serverCompradas = new Set(data.miEstado.compradas)

    const usuario = getUsuarioActual()
    const misComprasLocales = new Set(obtenerComprasUsuario(usuario.id, funcionId))
    const misComprasTotales = new Set([...serverCompradas, ...misComprasLocales])

    setCompradasPorMi(misComprasTotales)

    // Detectar si una butaca en fila fue promovida a mi carrito activo
    const previaFila = reservaRef.current.enFila ?? []
    previaFila.forEach((espera) => {
      const ahoraEnCarrito = serverReservadas.find((b) => b.butacaKey === espera.butacaKey)
      if (ahoraEnCarrito) {
        const match = /([A-Z]\d+)$/.exec(espera.butacaKey)
        const seatName = match ? match[1] : espera.butacaKey
        setAviso(`🎉 ¡Te tocó la butaca ${seatName}! La fila avanzó y la reserva es tuya.`)
      }
    })

    // Descartar de las reservas cualquier butaca que ya haya sido confirmada/comprada
    // Esto asegura que al volver de pagar rápido, la butaca confirmada desaparezca del carrito inmediatamente
    const ahora = Date.now()
    const serverReservadasLimpias = serverReservadas.filter(
      (b) => !misComprasTotales.has(b.butacaKey),
    )
    const serverKeys = new Set(serverReservadasLimpias.map((b) => b.butacaKey))
    const localesVivas = (reservaRef.current.butacas || []).filter((b) => {
      if (serverKeys.has(b.butacaKey)) return false
      if (new Date(b.expiresAt).getTime() <= ahora) return false
      if (soltando.has(b.butacaKey)) return false
      if (misComprasTotales.has(b.butacaKey)) return false
      const butacaDTO = data?.butacas?.find((sb) => sb.key === b.butacaKey)
      if (butacaDTO && butacaDTO.estado === 'CONFIRMADA') {
        return false
      }
      return true
    })

    const next: ReservaSesion = {
      ...reservaRef.current,
      funcionId,
      butacas: [...serverReservadasLimpias, ...localesVivas],
      enFila: serverEnCola,
    }
    reservaRef.current = next
    setReserva(next)
    guardarReserva(next)
  }, [data?.miEstado, funcionId])

  useEffect(() => {
    if (!data?.butacas) return
    setSoltando((prev) => {
      if (prev.size === 0) return prev
      const siguen = new Set(
        [...prev].filter((key) => data.butacas.some((b) => b.key === key && !b.disponible)),
      )
      return siguen.size === prev.size ? prev : siguen
    })
  }, [data])

  useEffect(() => {
    if (!data?.butacas) return
    setConflictos((prev) => {
      if (prev.size === 0) return prev
      const siguen = new Set(
        [...prev].filter((key) => data.butacas.some((b) => b.key === key && !b.disponible)),
      )
      return siguen.size === prev.size ? prev : siguen
    })
  }, [data])

  const seleccionadas = useMemo(
    () => new Set(reserva.butacas.map((b) => b.butacaKey)),
    [reserva],
  )

  const butacasPorKey = useMemo(() => {
    const m = new Map<string, ButacaDTO>()
    data?.butacas.forEach((b) => m.set(b.key, b))
    return m
  }, [data])

  const reservaRef = useRef(reserva)
  useEffect(() => {
    reservaRef.current = reserva
  }, [reserva])

  const persistir = useCallback((actualizar: (previa: ReservaSesion) => ReservaSesion) => {
    const next = actualizar(reservaRef.current)
    reservaRef.current = next
    setReserva(next)
    guardarReserva(next)
    return next
  }, [])

  // Suscripción reactiva a eventos Webhook de Caerus (SSE + sincronización compatible con Cloudflare Tunnel)
  useEffect(() => {
    return conectarEventosWebhook({
      onWebhook: (payload) => {
        try {
          if (payload.eventType === 'system.reset') {
            const limpia = { funcionId, butacas: [], productos: [] }
            reservaRef.current = limpia
            setReserva(limpia)
            guardarReserva(limpia)
            setCompradasPorMi(new Set())
            void mutate()
            return
          }

          const idLimpiado = funcionId.replace(/^funcion/, '')
          if (
            !payload.resourceKey.startsWith(`funcion${idLimpiado}_`) &&
            !payload.resourceKey.startsWith(`funcion${funcionId}_`) &&
            !payload.resourceKey.startsWith(`${idLimpiado}_`)
          ) {
            return
          }

          // Refrescar el mapa ante cualquier evento que afecte a la sala
          void mutate()

          const pKey = payload.resourceKey
          const match = /([A-Z]\d+)$/.exec(pKey)
          const seatName = match ? match[1] : pKey

          // 1. Manejo de expiración o liberación remota (Dashboard o abandono)
          if (payload.eventType === 'resource.expired' || payload.eventType === 'resource.released') {
            const previa = reservaRef.current
            const tenia = previa.butacas.find(
              (b) => (payload.holderId ? b.butacaHolderId === payload.holderId : b.butacaKey === pKey),
            )
            if (tenia) {
              cerrarIntento(funcionId, tenia.butacaKey)
              const next = {
                ...previa,
                butacas: previa.butacas.filter((b) => b.butacaKey !== tenia.butacaKey),
              }
              reservaRef.current = next
              setReserva(next)
              guardarReserva(next)
              setAviso(
                payload.eventType === 'resource.expired'
                  ? `⏱️ Carrito expirado: La butaca ${seatName} venció y volvió a estar disponible.`
                  : `🔓 Telemetría: La butaca ${seatName} fue liberada y vuelve a estar libre.`,
              )
            }

            // Actualizar optimísticamente SWR ante evento SSE de liberación/expiración
            void mutate(
              (current) => {
                if (!current) return current
                return {
                  ...current,
                  butacas: current.butacas.map((b) =>
                    b.key === pKey
                      ? {
                          ...b,
                          disponible: true,
                          estado: 'DISPONIBLE' as const,
                          enMiCarrito: false,
                          holderId: undefined,
                        }
                      : b,
                  ),
                  miEstado: current.miEstado
                    ? {
                        ...current.miEstado,
                        reservadas: current.miEstado.reservadas.filter((b) => b.butacaKey !== pKey),
                        enCola: current.miEstado.enCola.filter((b) => b.butacaKey !== pKey),
                      }
                    : undefined,
                }
              },
              { revalidate: true },
            )
          }

          // 2. Promoción reactiva de la cola (QUEUED -> PENDING)
          if (payload.eventType === 'resource.taken') {
            const previa = reservaRef.current
            const enEspera = (previa.enFila ?? []).find(
              (b) => (payload.holderId ? b.butacaHolderId === payload.holderId : b.butacaKey === pKey),
            )
            if (enEspera) {
              const nueva: ButacaReservada = {
                butacaKey: enEspera.butacaKey,
                butacaHolderId: payload.holderId || enEspera.butacaHolderId,
                fila: enEspera.fila,
                columna: enEspera.columna,
                precio: enEspera.precio,
                expiresAt: payload.expiresAt || new Date(Date.now() + 30000).toISOString(),
              }
              const next = {
                ...previa,
                butacas: [...previa.butacas.filter((b) => b.butacaKey !== enEspera.butacaKey), nueva],
                enFila: (previa.enFila ?? []).filter((x) => x.butacaKey !== enEspera.butacaKey),
              }
              reservaRef.current = next
              setReserva(next)
              guardarReserva(next)
              setAviso(`🎉 ¡Te tocó la butaca ${seatName}! La fila avanzó y la reserva es tuya.`)
            }
          }

          // 3. Compra confirmada por otro: si yo estaba en la fila para esa butaca, se cancela mi espera
          if (payload.eventType === 'resource.confirmed') {
            const previa = reservaRef.current
            const enEspera = (previa.enFila ?? []).find((b) => b.butacaKey === pKey)
            if (enEspera) {
              void fetch('/api/holders/liberar', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ holderIds: [enEspera.butacaHolderId] }),
              }).catch(() => {})
              persistir((prev) => ({
                ...prev,
                enFila: (prev.enFila ?? []).filter((x) => x.butacaKey !== pKey),
              }))
              setAviso(`❌ La butaca ${seatName} fue comprada por otro usuario. Tu lugar en la fila finalizó.`)
            }
          }
        } catch (err) {
          console.error('[SSE] Error procesando evento de webhook:', err)
        }
      },
    })
  }, [funcionId, mutate, persistir])

  const enFila = useMemo(() => reserva.enFila ?? [], [reserva])
  const enFilaSet = useMemo(() => new Set(enFila.map((b) => b.butacaKey)), [enFila])

  // Polling exclusivo para detectar expiración de un holder mientras espera en la cola (QUEUED -> EXPIRED),
  // ya que Caerus no emite el webhook resource.expired para la cola mientras no se libere stock.
  // La promoción de QUEUED a PENDING se procesa por el Webhook resource.taken vía SSE.
  useEffect(() => {
    if (enFila.length === 0) return

    const timer = setInterval(async () => {
      const actuales = reservaRef.current.enFila ?? []
      if (actuales.length === 0) return

      const ids = actuales.map((b) => b.butacaHolderId).join(',')
      try {
        const res = await fetch(`/api/holders?ids=${ids}`)
        if (!res.ok) return
        const body = (await res.json()) as { holders: Array<{ id: string; status: string; expiresAt?: string }> }
        const map = new Map(body.holders.map((h) => [h.id, h]))

        actuales.forEach((espera) => {
          const h = map.get(espera.butacaHolderId)
          const match = /([A-Z]\d+)$/.exec(espera.butacaKey)
          const seatName = match ? match[1] : espera.butacaKey

          if (!h || h.status === 'EXPIRED') {
            // El motor Caerus marcó el holder como expirado (TTL de cola agotado)
            persistir((prev) => ({
              ...prev,
              enFila: (prev.enFila ?? []).filter((x) => x.butacaKey !== espera.butacaKey),
            }))
            setAviso(`⏱️ Tiempo agotado en la fila: Expiró tu turno de espera para la butaca ${seatName}.`)
            void mutate()
          } else if (h.status === 'PENDING') {
            // ¡Caerus promovió el holder de la cola a PENDING!
            // Mutamos para que el servidor reconcilie miEstado y pase a la selección activa
            void mutate()
          }
        })
      } catch (err) {
        console.warn('[Queue polling] Error consultando estado:', err)
      }
    }, 2500)

    return () => clearInterval(timer)
  }, [enFila.length, mutate, persistir])

  // Si la butaca para la que estaba en cola fue comprada por otro (confirmada), cancelar mi espera
  useEffect(() => {
    if (!data?.butacas) return
    const actuales = reservaRef.current.enFila ?? []
    if (actuales.length === 0) return

    actuales.forEach((espera) => {
      const b = data.butacas.find((sb) => sb.key === espera.butacaKey)
      if (b && b.estado === 'CONFIRMADA') {
        const match = /([A-Z]\d+)$/.exec(espera.butacaKey)
        const seatName = match ? match[1] : espera.butacaKey
        void fetch('/api/holders/liberar', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ holderIds: [espera.butacaHolderId] }),
        }).catch(() => {})
        persistir((prev) => ({
          ...prev,
          enFila: (prev.enFila ?? []).filter((x) => x.butacaKey !== espera.butacaKey),
        }))
        setAviso(`❌ La butaca ${seatName} fue comprada definitivamente. Tu lugar en la fila finalizó.`)
      }
    })
  }, [data, persistir])

  const proximaExpiracion = useMemo(() => {
    if (reserva.butacas.length === 0) return null
    return reserva.butacas
      .map((b) => b.expiresAt)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]
  }, [reserva])

  const onExpire = useCallback(() => {
    const ahora = Date.now()
    const actuales = reservaRef.current.butacas
    const vivas = actuales.filter((b) => new Date(b.expiresAt).getTime() > ahora)
    if (vivas.length === actuales.length) return
    actuales
      .filter((b) => new Date(b.expiresAt).getTime() <= ahora)
      .forEach((b) => cerrarIntento(funcionId, b.butacaKey))

    const next = { ...reservaRef.current, butacas: vivas }
    reservaRef.current = next
    setReserva(next)
    guardarReserva(next)
    setAviso(
      vivas.length === 0
        ? 'Se venció el tiempo de tu reserva y las butacas volvieron a estar libres.'
        : 'Se venció el tiempo de algunas de tus butacas y volvieron a estar libres.',
    )
    void mutate()
  }, [funcionId, mutate])

  async function onSeatClick(butaca: ButacaDTO) {
    if (cargando) return
    if (seleccionadas.has(butaca.key)) {
      await liberar(butaca.key)
      return
    }
    setCargando(butaca.key)
    setConflictos((prev) => {
      if (!prev.has(butaca.key)) return prev
      const next = new Set(prev)
      next.delete(butaca.key)
      return next
    })
    try {
      const res = await fetch(`/api/funciones/${funcionId}/reservar-butaca`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          butacaKey: butaca.key,
          sessionId: getSessionId(),
          intento: intentoDe(funcionId, butaca.key),
        }),
      })

      const json = (await res.json().catch(() => null)) as
        | {
            estado: 'RESERVADA' | 'EN_FILA'
            butacaHolderId: string
            expiresAt?: string
          }
        | null
      publicar('reservar', json)
      if (res.status === 409) {
        setConflictos((prev) => new Set(prev).add(butaca.key))
        setAviso('Esa butaca la acaba de tomar otra persona.')
        void mutate()
        return
      }
      if (!res.ok || !json) {
        setAviso('No pudimos reservar la butaca. Reintentá en un momento.')
        return
      }
      if (json.estado === 'EN_FILA') {
        const enEspera: ButacaEnFila = {
          butacaKey: butaca.key,
          butacaHolderId: json.butacaHolderId,
          fila: butaca.fila,
          columna: butaca.columna,
          precio: butaca.precio,
          expiresAt: json.expiresAt,
        }
        persistir((previa) => ({ ...previa, enFila: [...(previa.enFila ?? []), enEspera] }))
        setAviso('Esa butaca está tomada. Quedaste en la fila: si no la pagan, es tuya.')
        void mutate()
        return
      }

      const nueva: ButacaReservada = {
        butacaKey: butaca.key,
        butacaHolderId: json.butacaHolderId,
        fila: butaca.fila,
        columna: butaca.columna,
        precio: butaca.precio,
        expiresAt: json.expiresAt!,
      }
      persistir((previa) => ({ ...previa, butacas: [...previa.butacas, nueva] }))
      void mutate()
    } catch {
      setAviso('No pudimos reservar la butaca. Revisá tu conexión.')
    } finally {
      setCargando(null)
    }
  }

  async function liberar(butacaKey: string) {
    const target = reservaRef.current.butacas.find((b) => b.butacaKey === butacaKey)
    const enFilaTarget = (reservaRef.current.enFila ?? []).find((b) => b.butacaKey === butacaKey)
    const holderId = target?.butacaHolderId ?? enFilaTarget?.butacaHolderId
    if (!holderId) return

    setCargando(butacaKey)
    cerrarIntento(funcionId, butacaKey)
    setSoltando((prev) => new Set(prev).add(butacaKey))

    // Quitar inmediatamente de la selección local o fila para respuesta visual instantánea
    persistir((previa) => ({
      ...previa,
      butacas: previa.butacas.filter((b) => b.butacaKey !== butacaKey),
      enFila: (previa.enFila ?? []).filter((b) => b.butacaKey !== butacaKey),
    }))

    // Optimistic update inmediato en la caché de SWR para que butaca.disponible = true y enMiCarrito = false
    void mutate(
      (current) => {
        if (!current) return current
        return {
          ...current,
          butacas: current.butacas.map((b) =>
            b.key === butacaKey
              ? {
                  ...b,
                  disponible: true,
                  estado: 'DISPONIBLE' as const,
                  enMiCarrito: false,
                  holderId: undefined,
                }
              : b,
          ),
          miEstado: current.miEstado
            ? {
                ...current.miEstado,
                reservadas: current.miEstado.reservadas.filter((b) => b.butacaKey !== butacaKey),
                enCola: current.miEstado.enCola.filter((b) => b.butacaKey !== butacaKey),
              }
            : undefined,
        }
      },
      { revalidate: false },
    )

    try {
      const res = await fetch('/api/holders/liberar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          holderIds: [holderId],
        }),
      })
      publicar('quitar', await res.json().catch(() => null))
      if (enFilaTarget) {
        setAviso('Saliste de la lista de espera para esta butaca.')
      }
    } catch (err) {
      console.warn('[liberar] error al liberar en servidor:', err)
    } finally {
      await mutate()
      setSoltando((prev) => {
        const next = new Set(prev)
        next.delete(butacaKey)
        return next
      })
      setCargando(null)
    }
  }

  const subtotal = reserva.butacas.reduce((acc, b) => acc + b.precio, 0)

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        {aviso ? (
          <div
            role="status"
            className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-foreground"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span>{aviso}</span>
            </div>
            <button
              type="button"
              onClick={() => setAviso(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Cerrar
            </button>
          </div>
        ) : null}

        <div className="relative rounded-2xl border border-border bg-card p-6 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sala en vivo · {data?.funcion.titulo}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void mutate()}
                title="Sincronizar mapa"
                className="rounded-md border border-border p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className={cn('size-3.5', isValidating && 'animate-spin')} />
              </button>
            </div>
          </div>

          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="mx-auto block h-auto w-full max-w-[560px]"
            aria-label="Mapa de butacas"
          >
            {/* Pantalla curva */}
            <path
              d={`M ${PAD_X} 36 Q ${VIEW_W / 2} 12 ${VIEW_W - PAD_X} 36`}
              fill="none"
              stroke="color-mix(in oklch, var(--primary) 45%, transparent)"
              strokeWidth={3}
              strokeLinecap="round"
            />
            <text
              x={VIEW_W / 2}
              y={26}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 9, letterSpacing: '0.25em' }}
            >
              PANTALLA
            </text>

            {/* Grilla de butacas */}
            {ROWS.map((r, ri) =>
              COLS.map((c, ci) => {
                const key = `funcion${funcionId}_${c}${r}`
                const butaca = butacasPorKey.get(key)
                const usuarioActual = getUsuarioActual()
                const isSoltando = soltando.has(key)
                const isSel = !isSoltando && (seleccionadas.has(key) || Boolean(butaca?.enMiCarrito))
                const isMiaComprada = Boolean(
                  (butaca &&
                    butaca.estado === 'CONFIRMADA' &&
                    (butaca.usuarioId === usuarioActual.id || compradasPorMi.has(key))) ||
                    Boolean(butaca?.compradaPorMi),
                )
                const isFila = !isSel && (enFilaSet.has(key) || Boolean(butaca?.enMiCola))
                const isConflicto = conflictos.has(key)
                const isVendidaDefinitiva = Boolean(
                  butaca && butaca.estado === 'CONFIRMADA' && !isSel && !isMiaComprada,
                )
                const ocupada = Boolean(
                  !isSel &&
                  !isMiaComprada &&
                  !isFila &&
                  !isSoltando &&
                  !isVendidaDefinitiva &&
                  (isConflicto || (butaca ? !butaca.disponible : false)),
                )
                const isLoading = cargando === key
                const esQueue = data?.funcion.politica === 'QUEUE'

                const x = PAD_X + ci * (SEAT + GAP)
                const y = PAD_TOP + ri * (SEAT + GAP)

                let fill = 'var(--secondary)'
                let stroke = 'var(--border)'
                if (isConflicto) {
                  fill = 'color-mix(in oklch, var(--destructive) 35%, var(--card))'
                  stroke = 'var(--destructive)'
                } else if (isSoltando) {
                  fill = 'var(--secondary)'
                  stroke = 'var(--border)'
                } else if (isMiaComprada) {
                  fill = '#10b981'
                  stroke = '#059669'
                } else if (isSel) {
                  fill = 'var(--primary)'
                  stroke = 'color-mix(in oklch, var(--primary) 70%, black)'
                } else if (isFila) {
                  fill = 'color-mix(in oklch, var(--status-queued) 25%, var(--card))'
                  stroke = 'var(--status-queued)'
                } else if (isVendidaDefinitiva) {
                  fill = 'oklch(0.18 0.005 60)'
                  stroke = 'oklch(1 0 0 / 8%)'
                } else if (ocupada) {
                  fill = 'color-mix(in oklch, var(--destructive) 25%, var(--card))'
                  stroke = 'var(--destructive)'
                }

                return (
                  <g key={key}>
                    {butaca ? (
                      <title>{`${c}${r} · ${formatPrecio(butaca.precio)}${
                        isMiaComprada
                          ? ` (Tu compra confirmada${butaca.comprador ? ` · ${butaca.comprador}` : ''})`
                          : isSel
                            ? ' (En tu carrito - Pending con timer)'
                            : isFila
                              ? ' (En la fila de espera)'
                              : isVendidaDefinitiva
                                ? ` (Vendida${butaca.comprador ? ` a ${butaca.comprador}` : ' a otro'} · Confirmada definitiva)`
                                : ocupada
                                  ? esQueue
                                    ? ' (En carrito de otro · ¡Click para sumarte a la fila!)'
                                    : ' (En carrito de otro · Bloqueo temporal con timer)'
                                  : ' (Libre)'
                      }`}</title>
                    ) : null}
                    <rect
                      x={x}
                      y={y}
                      width={SEAT}
                      height={SEAT}
                      rx={9}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={1.5}
                      strokeDasharray={isFila ? '4 3' : undefined}
                      role="button"
                      tabIndex={isVendidaDefinitiva || isMiaComprada || isFila || isSoltando ? -1 : 0}
                      aria-label={`Butaca ${c}${r}${
                        isMiaComprada
                          ? ', compra confirmada'
                          : isSel
                            ? ', en tu carrito (clic para quitar)'
                            : isFila
                              ? ', en tu lista de espera (clic para salir)'
                              : isVendidaDefinitiva
                                ? ', vendida'
                                : ocupada
                                  ? ', ocupada'
                                  : ', libre'
                      }`}
                      aria-disabled={isVendidaDefinitiva || isMiaComprada || isSoltando}
                      style={{
                        cursor:
                          isVendidaDefinitiva || isMiaComprada || isLoading || isSoltando
                            ? 'not-allowed'
                            : 'pointer',
                      }}
                      onClick={() => {
                        if (isMiaComprada) {
                          setAviso('Ya compraste esta butaca. Tu ticket está confirmado.')
                          return
                        }
                        if (isVendidaDefinitiva) {
                          setAviso(
                            `Esta butaca ya fue vendida y confirmada${
                              butaca?.comprador ? ` por ${butaca.comprador}` : ' por otro usuario'
                            }. No admite lista de espera.`,
                          )
                          return
                        }
                        if (isSoltando || isLoading) {
                          return
                        }
                        if (isSel || isFila) {
                          void liberar(key)
                          return
                        }
                        if (butaca) {
                          onSeatClick(butaca)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (
                          (e.key === 'Enter' || e.key === ' ') &&
                          !isVendidaDefinitiva &&
                          !isMiaComprada &&
                          !isSoltando &&
                          !isLoading &&
                          butaca
                        ) {
                          e.preventDefault()
                          if (isSel || isFila) {
                            void liberar(key)
                          } else {
                            onSeatClick(butaca)
                          }
                        }
                      }}
                    />
                    <text
                      x={x + SEAT / 2}
                      y={y + SEAT / 2 + 4}
                      textAnchor="middle"
                      pointerEvents="none"
                      style={{
                        fontSize: isVendidaDefinitiva ? 11 : 10,
                        fontWeight: isVendidaDefinitiva ? 700 : 600,
                      }}
                      fill={
                        isMiaComprada
                          ? '#ffffff'
                          : isSel
                            ? 'var(--primary-foreground)'
                            : isFila
                              ? 'var(--status-queued)'
                              : isVendidaDefinitiva
                                ? 'oklch(0.45 0.01 60)'
                                : isSoltando
                                  ? 'var(--muted-foreground)'
                                  : ocupada
                                    ? 'color-mix(in oklch, var(--destructive) 70%, var(--foreground))'
                                    : 'var(--muted-foreground)'
                      }
                    >
                      {isVendidaDefinitiva ? '✕' : isLoading ? '···' : `${c}${r}`}
                    </text>
                  </g>
                )
              }),
            )}
          </svg>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <Legend swatch="bg-secondary border-border" label="Libre (Gris)" />
            <Legend swatch="bg-primary border-primary text-primary-foreground font-medium" label="En tu carrito (Amarillo · Pending)" />
            <Legend swatch="bg-[#10b981] border-[#059669] text-white font-medium" label="Tu compra (Verde · Confirmed)" />
            <Legend swatch="border-destructive/60 bg-destructive/25 text-red-400" label="En carrito de otro (Roja · Disputable)" />
            <Legend swatch="bg-black/60 border-white/10 text-zinc-500 font-bold" icon="✕" label="Vendida a otro (Gris ✕ · Definitiva)" />
            <Legend swatch="border-status-queued bg-status-queued/25 border-dashed text-sky-400" label="En la fila (Celeste · Queued)" />
          </div>
        </div>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-foreground">Tu selección</h2>
            {proximaExpiracion ? (
              <Countdown expiresAt={proximaExpiracion} onExpire={onExpire} size="sm" />
            ) : null}
          </div>

          {enFila.length > 0 ? (
            <div className="mb-4 rounded-lg border border-status-queued/40 bg-status-queued/10 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-status-queued">
                <Hourglass className="size-4" aria-hidden="true" />
                En la fila
              </p>
              <ul className="flex flex-col gap-1">
                {enFila.map((b) => (
                  <li key={b.butacaKey} className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {b.columna}
                      {b.fila}
                    </span>{' '}
                    — esperando que se libere
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                No la perdiste. Si quien la tiene no paga o la libera, el motor te la asigna reactivamente por Webhook.
              </p>
            </div>
          ) : null}

          {reserva.butacas.length === 0 && enFila.length === 0 ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Tocá una butaca libre para reservarla al instante. El temporizador es gestionado por Caerus; si expira,
              el motor emite un Webhook y vuelve a estar libre automáticamente.
            </p>
          ) : reserva.butacas.length === 0 ? null : (
            <>
              <ul className="mb-4 flex flex-col gap-2">
                {reserva.butacas.map((b) => (
                  <li
                    key={b.butacaKey}
                    className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm"
                  >
                    <span>
                      Butaca{' '}
                      <span className="font-semibold text-foreground">
                        {b.columna}
                        {b.fila}
                      </span>
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-foreground">{formatPrecio(b.precio)}</span>
                      <button
                        type="button"
                        onClick={() => void liberar(b.butacaKey)}
                        disabled={cargando === b.butacaKey}
                        title="Liberar el lock en Caerus inmediatamente"
                        className="inline-flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Liberar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mb-5 flex items-baseline justify-between border-t border-border pt-3">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="font-display text-xl font-bold text-foreground">
                  {formatPrecio(subtotal)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => router.push(`/funcion/${funcionId}/checkout`)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span>Continuar al checkout</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

function Legend({
  swatch,
  label,
  icon,
}: {
  swatch: string
  label: string
  icon?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'flex size-3.5 items-center justify-center rounded-sm border text-[9px] leading-none',
          swatch,
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span>{label}</span>
    </div>
  )
}
