'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { AlertTriangle, CheckCircle2, Loader2, Minus, Plus, Popcorn, TimerReset, X } from 'lucide-react'
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
  limpiarReserva,
  registrarCompraUsuario,
  type ProductoReservado,
  type ReservaSesion,
} from '@/lib/client'
import { publicar } from '@/lib/registro-cliente'
import type { ProductoDTO } from '@/lib/cine'
import { cn } from '@/lib/utils'

export function Checkout({ funcionId }: { funcionId: string }) {
  const router = useRouter()
  const { data: productosData, mutate: mutateProductos } = useSWR<{ productos: ProductoDTO[] }>(
    '/api/productos',
    fetcher,
    { revalidateOnFocus: false },
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
    const usuario = getUsuarioActual()
    setComprador(usuario.nombre)
  }, [funcionId])

  // Escuchar eventos de webhook para refrescar stock en vivo (SSE + compatibilidad con túneles)
  useEffect(() => {
    return conectarEventosWebhook({
      onWebhook: () => {
        void mutateProductos()
      },
    })
  }, [mutateProductos])

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
      ...reserva.butacas.map((b) => b.butacaHolderId),
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
        .map((b) => b.butacaHolderId),
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
          intento: intentoDe(funcionId, producto.key),
        }),
      })

      const json = (await res.json().catch(() => null)) as
        | { holderId: string; cantidad: number; expiresAt: string }
        | null
      publicar('candy bar', json)
      if (res.status === 409) {
        setAviso(`❌ Error de contención (ConflictError): Pediste ${cantidad} unidades, pero solo hay ${producto.disponibles} disponibles. El motor Caerus opera de forma atómica (todo o nada).`)
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
      persistir((previa) => ({ ...previa, productos: [...previa.productos, nuevo] }))
    } catch {
      setAviso('No pudimos agregar el producto. Revisá tu conexión.')
    } finally {
      setTrabajando(null)
    }
  }

  async function quitarProducto(p: ProductoReservado) {
    setTrabajando(p.productoKey)
    cerrarIntento(funcionId, p.productoKey)
    persistir((previa) => ({
      ...previa,
      productos: previa.productos.filter((x) => x.productoKey !== p.productoKey),
    }))
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
      router.push(`/funcion/${funcionId}`)
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

      const vence = datos.expiresAt
      expirado.current = false
      persistir((previa) => ({
        ...previa,
        butacas: previa.butacas.map((b) => ({ ...b, expiresAt: vence })),
        productos: previa.productos.map((p) => ({ ...p, expiresAt: vence })),
      }))
      setAviso(
        datos.extendidos === holderIds.length
          ? 'Listo, tenés dos minutos más.'
          : 'Te dimos más tiempo, pero alguna de tus reservas ya no estaba vigente.',
      )
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
    const usuario = getUsuarioActual()
    await new Promise((r) => setTimeout(r, 2200))
    try {
      const res = await fetch('/api/holders/confirmar', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          holderIds,
          comprador: comprador.trim(),
          usuarioId: usuario.id,
          precioTotal: total,
        }),
      })
      const cuerpo = (await res.json().catch(() => null)) as { confirmados?: number } | null
      publicar('pagar', cuerpo)
      if (res.status === 409) {
        const detalle = cuerpo ?? {}
        setAviso(
          detalle.confirmados
            ? `Una de tus reservas venció justo al confirmar. Las otras ${detalle.confirmados} quedaron a tu nombre.`
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

      // Registrar las butacas compradas para este usuario específico
      registrarCompraUsuario(
        usuario.id,
        funcionId,
        reserva.butacas.map((b) => b.butacaKey),
      )

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
      <div className="mx-auto max-w-md rounded-2xl border border-status-confirmed/40 bg-card p-8 text-center shadow-lg">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-status-confirmed/15 text-status-confirmed">
          <CheckCircle2 className="size-8 text-emerald-500" aria-hidden="true" />
        </span>
        <h2 className="font-display text-2xl font-bold text-foreground">¡Compra confirmada!</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Gracias, {comprador}. Confirmamos tus {reserva.butacas.length || ''} butacas
          {reserva.productos.length ? ' y tu pedido del candy bar' : ''}. El motor Caerus registró la venta en estado terminal (CONFIRMED).
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => router.push(`/funcion/${funcionId}`)}
            className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90 cursor-pointer"
          >
            Ver sala de butacas
          </button>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground cursor-pointer"
          >
            Volver a la cartelera
          </button>
        </div>
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
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.tamanio} · {formatPrecio(p.precio)}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      <span className={cn('font-medium', p.disponibles === 0 ? 'text-destructive' : 'text-emerald-400')}>
                        {p.disponibles} disponibles
                      </span>
                      {p.pendientes > 0 ? (
                        <span className="text-amber-400 text-[11px]">
                          ({p.pendientes} en {p.pendientes === 1 ? 'carrito' : 'carritos'})
                        </span>
                      ) : null}
                    </div>
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
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="comprador" className="block text-sm font-medium text-foreground">
                Nombre del comprador
              </label>
              <span className="text-[11px] text-muted-foreground">Elegí o escribí</span>
            </div>
            <input
              id="comprador"
              type="text"
              value={comprador}
              onChange={(e) => setComprador(e.target.value)}
              placeholder="Ej. Ana García"
              className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['Ana García', 'Beto Pérez', 'Carlos Gómez', 'Diana Prince'].map((nom) => (
                <button
                  key={nom}
                  type="button"
                  onClick={() => setComprador(nom)}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-xs font-medium transition-colors cursor-pointer",
                    comprador === nom
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border/70 bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  {nom}
                </button>
              ))}
            </div>
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
