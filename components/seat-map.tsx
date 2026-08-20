'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { AlertTriangle, ArrowRight, Hourglass, Loader2 } from 'lucide-react'
import { Countdown } from '@/components/countdown'
import {
  fetcher,
  formatPrecio,
  getSessionId,
  guardarReserva,
  leerReserva,
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
}

const COLS = ['A', 'B', 'C', 'D', 'E', 'F']
const ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const SEAT = 40
const GAP = 12
const PAD_X = 36
const PAD_TOP = 92
const GRID_W = COLS.length * SEAT + (COLS.length - 1) * GAP
const VIEW_W = GRID_W + PAD_X * 2
const VIEW_H = PAD_TOP + ROWS.length * SEAT + (ROWS.length - 1) * GAP + 24

export function SeatMap({ funcionId }: { funcionId: string }) {
  const router = useRouter()
  const { data, mutate } = useSWR<Respuesta>(
    `/api/funciones/${funcionId}/butacas`,
    fetcher,
    { refreshInterval: 3000, refreshWhenHidden: true },
  )

  const [reserva, setReserva] = useState<ReservaSesion>({
    funcionId,
    butacas: [],
    productos: [],
  })
  const [conflictos, setConflictos] = useState<Set<string>>(new Set())
  const [aviso, setAviso] = useState<string | null>(null)
  const [cargando, setCargando] = useState<string | null>(null)
  useEffect(() => {
    const guardada = leerReserva(funcionId)
    setReserva(guardada)
    if (guardada.butacas.length === 0) return

    let vigente = true
    const ids = guardada.butacas.flatMap((b) => [b.butacaHolderId, b.capacidadHolderId])
    fetch(`/api/holders?ids=${ids.join(',')}`)
      .then((r) => r.json() as Promise<{ holders: { id: string; status: string }[] }>)
      .then(({ holders }) => {
        if (!vigente) return
        const vivos = new Set(holders.filter((h) => h.status === 'PENDING').map((h) => h.id))
        const butacas = guardada.butacas.filter((b) => vivos.has(b.butacaHolderId))
        if (butacas.length === guardada.butacas.length) return
        const next = { ...guardada, butacas }
        setReserva(next)
        guardarReserva(next)
      })
      .catch(() => {})

    return () => {
      vigente = false
    }
  }, [funcionId])
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

  const persistir = useCallback((next: ReservaSesion) => {
    setReserva(next)
    guardarReserva(next)
  }, [])

  const reservaRef = useRef(reserva)
  useEffect(() => {
    reservaRef.current = reserva
  }, [reserva])

  const enFila = useMemo(() => reserva.enFila ?? [], [reserva])

  const enFilaSet = useMemo(() => new Set(enFila.map((b) => b.butacaKey)), [enFila])
  useEffect(() => {
    if (enFila.length === 0) return

    let vigente = true

    async function revisarFila() {
      const actuales = reservaRef.current.enFila ?? []
      if (actuales.length === 0) return

      const ids = actuales.map((b) => b.butacaHolderId).join(',')
      const res = await fetch(`/api/holders?ids=${ids}`).catch(() => null)
      if (!res || !vigente) return

      const { holders } = (await res.json().catch(() => ({ holders: [] }))) as {
        holders: { id: string; status: string }[]
      }
      const estadoPorId = new Map(holders.map((h) => [h.id, h.status]))
      for (const espera of actuales) {
        const estado = estadoPorId.get(espera.butacaHolderId)
        if (estado === 'PENDING') {
          const reclamo = await fetch(`/api/funciones/${funcionId}/reclamar-capacidad`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              butacaHolderId: espera.butacaHolderId,
              butacaKey: espera.butacaKey,
              sessionId: getSessionId(),
            }),
          }).catch(() => null)
          if (!reclamo || !vigente) return

          const datos = (await reclamo.json().catch(() => null)) as
            | { estado: string; capacidadHolderId?: string; expiresAt?: string }
            | null
          publicar('te toca', datos)
          if (!datos || datos.estado !== 'RESERVADA') continue

          const nueva: ButacaReservada = {
            butacaKey: espera.butacaKey,
            butacaHolderId: espera.butacaHolderId,
            capacidadHolderId: datos.capacidadHolderId!,
            fila: espera.fila,
            columna: espera.columna,
            precio: espera.precio,
            tipo: espera.tipo,
            expiresAt: datos.expiresAt!,
          }
          const previa = reservaRef.current
          const next = {
            ...previa,
            butacas: [...previa.butacas, nueva],
            enFila: (previa.enFila ?? []).filter((x) => x.butacaKey !== espera.butacaKey),
          }
          reservaRef.current = next
          setReserva(next)
          guardarReserva(next)
          setAviso(`Te tocó la ${espera.columna}${espera.fila}: la fila avanzó y es tuya.`)
          void mutate()
          continue
        }
        if (estado && estado !== 'QUEUED') {
          const previa = reservaRef.current
          const next = {
            ...previa,
            enFila: (previa.enFila ?? []).filter((x) => x.butacaKey !== espera.butacaKey),
          }
          reservaRef.current = next
          setReserva(next)
          guardarReserva(next)
          setAviso(`Se venció tu lugar en la fila para la ${espera.columna}${espera.fila}.`)
        }
      }
    }
    void revisarFila()
    const iv = setInterval(() => void revisarFila(), 2500)
    return () => {
      vigente = false
      clearInterval(iv)
    }
  }, [enFila.length, funcionId, mutate])

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

    const next = { ...reservaRef.current, butacas: vivas }
    reservaRef.current = next
    setReserva(next)
    guardarReserva(next)
    setAviso(
      vivas.length === 0
        ? 'Se venció el tiempo de tu reserva. Las butacas volvieron a estar libres.'
        : 'Se venció una de tus butacas y volvió a estar libre. Las demás siguen reservadas.',
    )
    void mutate()
  }, [mutate])

  async function reservar(butaca: ButacaDTO) {
    setAviso(null)
    setCargando(butaca.key)
    try {
      const res = await fetch(`/api/funciones/${funcionId}/reservar-butaca`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ butacaKey: butaca.key, sessionId: getSessionId() }),
      })

      const json = (await res.json().catch(() => null)) as
        | {
            estado: 'RESERVADA' | 'EN_FILA'
            butacaHolderId: string
            capacidadHolderId?: string
            expiresAt?: string
          }
        | null
      publicar('reservar', json)
      if (res.status === 409) {
        setConflictos((prev) => new Set(prev).add(butaca.key))
        setAviso('Esa butaca la acaba de tomar otra persona')
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
          tipo: butaca.tipo,
        }
        persistir({ ...reserva, enFila: [...(reserva.enFila ?? []), enEspera] })
        setAviso('Esa butaca está tomada. Quedaste en la fila: si no la pagan, es tuya.')
        void mutate()
        return
      }

      const nueva: ButacaReservada = {
        butacaKey: butaca.key,
        butacaHolderId: json.butacaHolderId,
        capacidadHolderId: json.capacidadHolderId!,
        fila: butaca.fila,
        columna: butaca.columna,
        precio: butaca.precio,
        tipo: butaca.tipo,
        expiresAt: json.expiresAt!,
      }
      persistir({ ...reserva, butacas: [...reserva.butacas, nueva] })
      void mutate()
    } catch {
      setAviso('No pudimos reservar la butaca. Revisá tu conexión.')
    } finally {
      setCargando(null)
    }
  }

  async function liberar(butacaKey: string) {
    const target = reserva.butacas.find((b) => b.butacaKey === butacaKey)
    if (!target) return
    setCargando(butacaKey)
    persistir({
      ...reserva,
      butacas: reserva.butacas.filter((b) => b.butacaKey !== butacaKey),
    })
    try {
      const res = await fetch('/api/holders/liberar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          holderIds: [target.butacaHolderId, target.capacidadHolderId],
        }),
      })
      publicar('quitar', await res.json().catch(() => null))
    } finally {
      setCargando(null)
      void mutate()
    }
  }

  function onSeatClick(butaca: ButacaDTO) {
    if (seleccionadas.has(butaca.key)) {
      void liberar(butaca.key)
      return
    }
    void reservar(butaca)
  }

  const total = reserva.butacas.reduce((acc, b) => acc + b.precio, 0)
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        {aviso ? (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2.5 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{aviso}</span>
          </div>
        ) : null}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="mx-auto h-auto w-full max-w-md"
            role="group"
            aria-label="Mapa de butacas"
          >

            <path
              d={`M ${PAD_X} 46 Q ${VIEW_W / 2} 20 ${VIEW_W - PAD_X} 46`}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <text
              x={VIEW_W / 2}
              y={30}
              textAnchor="middle"
              className="fill-muted-foreground"
              style={{ fontSize: 11, letterSpacing: 2 }}
            >
              PANTALLA
            </text>
            {COLS.map((c, ci) => (
              <text
                key={c}
                x={PAD_X + ci * (SEAT + GAP) + SEAT / 2}
                y={PAD_TOP - 12}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 11 }}
              >
                {c}
              </text>
            ))}
            {ROWS.map((r, ri) =>
              COLS.map((c, ci) => {
                const key = `funcion${funcionId}_${c}${r}`
                const butaca = butacasPorKey.get(key)
                const x = PAD_X + ci * (SEAT + GAP)
                const y = PAD_TOP + ri * (SEAT + GAP)

                const isSel = seleccionadas.has(key)
                const isFila = enFilaSet.has(key)
                const isConflict = conflictos.has(key)
                const ocupada = !isSel && !isFila && (isConflict || (butaca ? !butaca.disponible : false))
                const isLoading = cargando === key

                let fill = 'var(--secondary)'
                let stroke = 'var(--border)'
                if (isSel) {
                  fill = 'var(--primary)'
                  stroke = 'var(--primary)'
                } else if (isFila) {
                  fill = 'color-mix(in oklch, var(--status-queued) 25%, var(--card))'
                  stroke = 'var(--status-queued)'
                } else if (ocupada) {
                  fill = 'color-mix(in oklch, var(--destructive) 22%, var(--card))'
                  stroke = 'color-mix(in oklch, var(--destructive) 45%, transparent)'
                }
                return (
                  <g key={key}>
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
                      tabIndex={ocupada || isFila ? -1 : 0}
                      aria-label={`Butaca ${c}${r}${
                        isSel
                          ? ', seleccionada'
                          : isFila
                            ? ', en la fila'
                            : ocupada
                              ? ', ocupada'
                              : ', libre'
                      }`}
                      aria-disabled={ocupada || isFila}
                      style={{ cursor: ocupada || isFila || isLoading ? 'not-allowed' : 'pointer' }}
                      onClick={() => !ocupada && !isFila && !isLoading && butaca && onSeatClick(butaca)}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && !ocupada && !isFila && butaca) {
                          e.preventDefault()
                          onSeatClick(butaca)
                        }
                      }}
                    />
                    <text
                      x={x + SEAT / 2}
                      y={y + SEAT / 2 + 4}
                      textAnchor="middle"
                      pointerEvents="none"
                      style={{ fontSize: 10, fontWeight: 600 }}
                      fill={
                        isSel
                          ? 'var(--primary-foreground)'
                          : isFila
                            ? 'var(--status-queued)'
                            : ocupada
                              ? 'color-mix(in oklch, var(--destructive) 70%, var(--foreground))'
                              : 'var(--muted-foreground)'
                      }
                    >
                      {isLoading ? '···' : `${c}${r}`}
                    </text>
                  </g>
                )
              }),
            )}
          </svg>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <Legend swatch="bg-secondary border-border" label="Libre" />
            <Legend swatch="bg-primary border-primary" label="Tu selección" />
            <Legend swatch="border-destructive/50 bg-destructive/20" label="Ocupada" />
            <Legend swatch="border-status-queued bg-status-queued/25 border-dashed" label="En la fila" />
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
                No la perdiste. Si quien la tiene no paga, el motor te la asigna sola.
              </p>
            </div>
          ) : null}
          {reserva.butacas.length === 0 && enFila.length === 0 ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Tocá una butaca libre para reservarla al instante. Se guarda por unos minutos
              con un temporizador; si se vence, vuelve a estar disponible para todos.
            </p>
          ) : reserva.butacas.length === 0 ? null : (
            <>
              <ul className="mb-4 flex flex-col gap-2">
                {reserva.butacas
                  .slice()
                  .sort((a, b) => a.columna.localeCompare(b.columna) || a.fila - b.fila)
                  .map((b) => (
                    <li
                      key={b.butacaKey}
                      className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="inline-flex size-7 items-center justify-center rounded-md bg-primary/20 font-semibold text-primary">
                          {b.columna}
                          {b.fila}
                        </span>
                        <span className="text-muted-foreground">{b.tipo}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="font-medium text-foreground">
                          {formatPrecio(b.precio)}
                        </span>
                        <button
                          type="button"
                          onClick={() => liberar(b.butacaKey)}
                          className="text-xs text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
                        >
                          quitar
                        </button>
                      </span>
                    </li>
                  ))}
              </ul>
              <div className="mb-4 flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="text-muted-foreground">Subtotal butacas</span>
                <span className="font-display text-lg font-semibold text-foreground">
                  {formatPrecio(total)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/funcion/${funcionId}/checkout`)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Continuar al checkout
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </>
          )}
          {cargando ? (
            <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              procesando…
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  )
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn('size-3.5 rounded border', swatch)} />
      {label}
    </span>
  )
}
