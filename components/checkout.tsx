'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { AlertTriangle, CheckCircle2, Loader2, Minus, Plus, Popcorn, TimerReset, X } from 'lucide-react'
import { Countdown } from '@/components/countdown'
import {
  fetcher,
  formatPrecio,
  getSessionId,
  guardarReserva,
  leerReserva,
  limpiarReserva,
  type ProductoReservado,
  type ReservaSesion,
} from '@/lib/client'
import { publicar } from '@/lib/registro-cliente'
import type { ProductoDTO } from '@/lib/cine'

export function Checkout({ funcionId }: { funcionId: string }) {
  const router = useRouter()
  const { data: productosData } = useSWR<{ productos: ProductoDTO[] }>(
    '/api/productos',
    fetcher,
    { refreshInterval: 5000 },
  )

  const [reserva, setReserva] = useState<ReservaSesion>({
    funcionId,
    butacas: [],
    productos: [],
  })
  const [cantidades, setCantidades] = useState<Record<string, number>>({})
  const [aviso, setAviso] = useState<string | null>(null)
  const [comprador, setComprador] = useState('')
  const [pagando, setPagando] = useState(false)
  const [ok, setOk] = useState(false)
  const [trabajando, setTrabajando] = useState<string | null>(null)
  useEffect(() => {
    setReserva(leerReserva(funcionId))
  }, [funcionId])

  const persistir = useCallback((next: ReservaSesion) => {
    setReserva(next)
    guardarReserva(next)
  }, [])

  const productosEnCarro = useMemo(
    () => new Set(reserva.productos.map((p) => p.productoKey)),
    [reserva],
  )

  const totalButacas = reserva.butacas.reduce((a, b) => a + b.precio, 0)
  const totalProductos = reserva.productos.reduce((a, p) => a + p.precio * p.cantidad, 0)
  const total = totalButacas + totalProductos

  const proximaExpiracion = useMemo(() => {
    if (reserva.butacas.length === 0 && reserva.productos.length === 0) return null
    const fechas = [
      ...reserva.butacas.map((b) => b.expiresAt),
      ...reserva.productos.map((p) => p.expiresAt),
    ]
    return fechas.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]
  }, [reserva])

  const holderIds = useMemo(
    () => [
      ...reserva.butacas.flatMap((b) => [b.butacaHolderId, b.capacidadHolderId]),
      ...reserva.productos.map((p) => p.holderId),
    ],
    [reserva],
  )

  const expirado = useRef(false)

  const onExpire = useCallback(() => {
    if (ok || expirado.current) return
    expirado.current = true

    const ahora = Date.now()
    const vivos = [
      ...reserva.butacas
        .filter((b) => new Date(b.expiresAt).getTime() > ahora)
        .flatMap((b) => [b.butacaHolderId, b.capacidadHolderId]),
      ...reserva.productos
        .filter((p) => new Date(p.expiresAt).getTime() > ahora)
        .map((p) => p.holderId),
    ]
    if (vivos.length > 0) {
      void fetch('/api/holders/liberar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ holderIds: vivos }),
      }).catch(() => {})
    }
    setAviso('Se venció el tiempo de la reserva. Volvé a elegir tus butacas.')
    limpiarReserva(funcionId)
    setTimeout(() => router.push(`/funcion/${funcionId}`), 1800)
  }, [funcionId, ok, reserva, router])

  function getQty(key: string): number {
    return cantidades[key] ?? 1
  }

  function setQty(key: string, value: number) {
    setCantidades((prev) => ({ ...prev, [key]: Math.max(1, value) }))
  }

  async function agregarProducto(producto: ProductoDTO) {
    const cantidad = getQty(producto.key)
    setAviso(null)
    setTrabajando(producto.key)
    try {
      const res = await fetch('/api/productos/reservar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          productoKey: producto.key,
          cantidad,
          sessionId: getSessionId(),
        }),
      })

      const json = (await res.json().catch(() => null)) as
        | { holderId: string; cantidad: number; expiresAt: string }
        | null
      publicar('candy bar', json)
      if (res.status === 409) {
        setAviso(`No hay stock suficiente de ${producto.nombre} para esa cantidad.`)
        return
      }
      if (!res.ok || !json) {
        setAviso('No pudimos agregar el producto. Reintentá.')
        return
      }
      const nuevo: ProductoReservado = {
        productoKey: producto.key,
        holderId: json.holderId,
        nombre: producto.nombre,
        tamanio: producto.tamanio,
        precio: producto.precio,
        cantidad: json.cantidad,
        expiresAt: json.expiresAt,
      }
      persistir({ ...reserva, productos: [...reserva.productos, nuevo] })
    } catch {
      setAviso('No pudimos agregar el producto. Revisá tu conexión.')
    } finally {
      setTrabajando(null)
    }
  }

  async function quitarProducto(p: ProductoReservado) {
    setTrabajando(p.productoKey)
    persistir({
      ...reserva,
      productos: reserva.productos.filter((x) => x.productoKey !== p.productoKey),
    })
    try {
      const res = await fetch('/api/holders/liberar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ holderIds: [p.holderId] }),
      })
      publicar('quitar candy', await res.json().catch(() => null))
    } finally {
      setTrabajando(null)
    }
  }

  async function cancelar() {
    setTrabajando('cancelar')
    try {
      const res = await fetch('/api/holders/liberar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ holderIds }),
      })
      publicar('cancelar', await res.json().catch(() => null))
    } finally {
      limpiarReserva(funcionId)
      router.push('/')
    }
  }

  async function extender() {
    setTrabajando('extender')
    setAviso(null)
    try {
      const res = await fetch('/api/holders/extender', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ holderIds }),
      })
      const datos = (await res.json().catch(() => null)) as
        | { extendidos?: number; expiresAt?: string }
        | null
      publicar('más tiempo', datos)
      if (!res.ok || !datos?.expiresAt) {
        setAviso('No pudimos darte más tiempo: alguna reserva ya no está vigente.')
        return
      }

      const extra = 120_000
      const next: ReservaSesion = {
        ...reserva,
        butacas: reserva.butacas.map((b) => ({
          ...b,
          expiresAt: new Date(new Date(b.expiresAt).getTime() + extra).toISOString(),
        })),
        productos: reserva.productos.map((p) => ({
          ...p,
          expiresAt: new Date(new Date(p.expiresAt).getTime() + extra).toISOString(),
        })),
      }
      expirado.current = false
      persistir(next)
      setAviso('Listo, tenés dos minutos más.')
    } finally {
      setTrabajando(null)
    }
  }

  async function pagar() {
    if (!comprador.trim()) {
      setAviso('Ingresá el nombre del comprador para continuar.')
      return
    }
    setAviso(null)
    setPagando(true)
    await new Promise((r) => setTimeout(r, 2200))
    try {
      const res = await fetch('/api/holders/confirmar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ holderIds, comprador: comprador.trim(), precioTotal: total }),
      })
      const cuerpo = (await res.json().catch(() => null)) as { confirmados?: number } | null
      publicar('pagar', cuerpo)
      if (res.status === 409) {
        const detalle = cuerpo ?? {}
        setAviso(
          detalle.confirmados
            ? `Una de tus reservas venció justo al confirmar. Las otras ${detalle.confirmados} quedaron a tu nombre; podés verlas en el Backoffice.`
            : 'Alguna de tus reservas venció mientras pagabas. Volvé a elegir tus butacas.',
        )
        limpiarReserva(funcionId)
        setTimeout(() => router.push(`/funcion/${funcionId}`), detalle.confirmados ? 4000 : 2000)
        return
      }
      if (!res.ok) {
        setAviso('No pudimos confirmar el pago. Reintentá.')
        return
      }
      setOk(true)
      limpiarReserva(funcionId)
    } catch {
      setAviso('No pudimos confirmar el pago. Revisá tu conexión.')
    } finally {
      setPagando(false)
    }
  }
  if (ok) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-status-confirmed/40 bg-card p-8 text-center">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-status-confirmed/15 text-status-confirmed">
          <CheckCircle2 className="size-8" aria-hidden="true" />
        </span>
        <h2 className="font-display text-2xl font-bold text-foreground">¡Compra confirmada!</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Gracias, {comprador}. Confirmamos {reserva.butacas.length || 'tus'} butacas
          {reserva.productos.length ? ' y tu pedido del candy bar' : ''}. Podés ver el registro
          en el Backoffice.
        </p>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="mt-6 w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Volver a la cartelera
        </button>
      </div>
    )
  }

  const sinReserva = reserva.butacas.length === 0
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-6">
        {aviso ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{aviso}</span>
          </div>
        ) : null}
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 font-display text-lg font-semibold text-foreground">
            Butacas reservadas
          </h2>
          {sinReserva ? (
            <p className="text-sm text-muted-foreground">
              No tenés butacas reservadas.{' '}
              <button
                type="button"
                onClick={() => router.push(`/funcion/${funcionId}`)}
                className="text-primary underline-offset-4 hover:underline"
              >
                Elegir butacas
              </button>
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {reserva.butacas
                .slice()
                .sort((a, b) => a.columna.localeCompare(b.columna) || a.fila - b.fila)
                .map((b) => (
                  <li
                    key={b.butacaKey}
                    className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2.5 text-sm"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="inline-flex size-8 items-center justify-center rounded-md bg-primary/20 font-semibold text-primary">
                        {b.columna}
                        {b.fila}
                      </span>
                      <span className="text-muted-foreground">Butaca {b.tipo}</span>
                    </span>
                    <span className="font-medium text-foreground">{formatPrecio(b.precio)}</span>
                  </li>
                ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-foreground">
            <Popcorn className="size-5 text-primary" aria-hidden="true" />
            Candy bar
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Sumá algo para la función. Cada producto se reserva del stock compartido.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(productosData?.productos ?? []).map((p) => {
              const enCarro = productosEnCarro.has(p.key)
              const agotado = p.disponibles === 0
              const qty = getQty(p.key)
              return (
                <div
                  key={p.key}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-3.5"
                >
                  <div>
                    <p className="font-medium text-foreground">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.tamanio} · {formatPrecio(p.precio)} · {p.disponibles} en stock
                    </p>
                  </div>
                  {enCarro ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-status-confirmed/15 px-3 py-2 text-xs font-medium text-status-confirmed">
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      Agregado
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center rounded-lg border border-border">
                        <button
                          type="button"
                          aria-label="Restar"
                          onClick={() => setQty(p.key, qty - 1)}
                          className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
                        >
                          <Minus className="size-3.5" aria-hidden="true" />
                        </button>
                        <span className="w-7 text-center text-sm tabular-nums">{qty}</span>
                        <button
                          type="button"
                          aria-label="Sumar"
                          onClick={() => setQty(p.key, qty + 1)}
                          className="flex size-8 items-center justify-center text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="size-3.5" aria-hidden="true" />
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={agotado || trabajando === p.key}
                        onClick={() => agregarProducto(p)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary/90 px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {trabajando === p.key ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : null}
                        {agotado ? 'Sin stock' : 'Agregar'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      </div>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-foreground">Resumen</h2>
            {proximaExpiracion ? (
              <Countdown expiresAt={proximaExpiracion} onExpire={onExpire} size="sm" />
            ) : null}
          </div>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Butacas ({reserva.butacas.length})</dt>
              <dd className="text-foreground">{formatPrecio(totalButacas)}</dd>
            </div>
            {reserva.productos.map((p) => (
              <div key={p.productoKey} className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  {p.cantidad}× {p.nombre}
                  <button
                    type="button"
                    aria-label={`Quitar ${p.nombre}`}
                    onClick={() => quitarProducto(p)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </dt>
                <dd className="text-foreground">{formatPrecio(p.precio * p.cantidad)}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-display text-2xl font-bold text-foreground">
              {formatPrecio(total)}
            </span>
          </div>
          <div className="mt-5">
            <label htmlFor="comprador" className="mb-1.5 block text-sm font-medium text-foreground">
              Nombre del comprador
            </label>
            <input
              id="comprador"
              type="text"
              value={comprador}
              onChange={(e) => setComprador(e.target.value)}
              placeholder="Ej. Ana Pérez"
              className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="button"
            disabled={sinReserva || pagando}
            onClick={pagar}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pagando ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {pagando ? 'Procesando pago…' : `Pagar ${formatPrecio(total)}`}
          </button>
          <button
            type="button"
            disabled={sinReserva || pagando || trabajando === 'extender'}
            onClick={extender}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-primary/40 px-4 py-2.5 text-sm text-primary transition-colors hover:bg-primary/10 disabled:opacity-40"
          >
            {trabajando === 'extender' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <TimerReset className="size-4" aria-hidden="true" />
            )}
            Necesito más tiempo
          </button>
          <button
            type="button"
            disabled={pagando || trabajando === 'cancelar'}
            onClick={cancelar}
            className="mt-2 w-full rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive disabled:opacity-40"
          >
            Cancelar compra
          </button>
        </div>
      </aside>
    </div>
  )
}
