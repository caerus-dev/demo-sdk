'use client'

import { useEffect, useState } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import {
  CheckCircle2,
  Clock,
  Film,
  Loader2,
  Plus,
  Popcorn,
  RefreshCw,
  Eraser,
  PackagePlus,
  KeyRound,
  Trash2,
  XCircle,
} from 'lucide-react'
import { cabecerasBackoffice, fetcher, formatPrecio, guardarTokenBackoffice, tokenBackoffice } from '@/lib/client'
import { cn } from '@/lib/utils'
import type { FuncionDTO, HolderDTO, ProductoDTO } from '@/lib/cine'

type Estado = HolderDTO['status']

const ESTADOS: { value: Estado | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'CONFIRMED', label: 'Confirmados' },
  { value: 'RELEASED', label: 'Liberados' },
  { value: 'EXPIRED', label: 'Vencidos' },
  { value: 'QUEUED', label: 'En cola' },
]

const ESTILO_ESTADO: Record<Estado, { label: string; clase: string; Icon: typeof CheckCircle2 }> = {
  PENDING: {
    label: 'Pendiente',
    clase: 'bg-status-pending/15 text-status-pending',
    Icon: Clock,
  },
  CONFIRMED: {
    label: 'Confirmado',
    clase: 'bg-status-confirmed/15 text-status-confirmed',
    Icon: CheckCircle2,
  },
  RELEASED: {
    label: 'Liberado',
    clase: 'bg-muted text-muted-foreground',
    Icon: XCircle,
  },
  EXPIRED: {
    label: 'Vencido',
    clase: 'bg-destructive/15 text-destructive',
    Icon: XCircle,
  },
  QUEUED: {
    label: 'En cola',
    clase: 'bg-status-queued/15 text-status-queued',
    Icon: Clock,
  },
}

function EstadoBadge({ estado }: { estado: Estado }) {
  const cfg = ESTILO_ESTADO[estado] ?? ESTILO_ESTADO.RELEASED
  const { Icon } = cfg
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.clase}`}
    >
      <Icon className="size-3" aria-hidden="true" />
      {cfg.label}
    </span>
  )
}

function BotonSoltarTodo({ alTerminar }: { alTerminar: () => void }) {
  const bloqueado = useBloqueado()
  const [trabajando, setTrabajando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

  async function soltar() {
    setTrabajando(true)
    setResultado(null)
    try {
      const res = await fetch('/api/backoffice/liberar-todo', { method: 'POST', headers: cabecerasBackoffice() })
      const datos = (await res.json().catch(() => null)) as { liberados?: number } | null
      setResultado(
        res.status === 403
          ? 'El token no coincide'
          : res.ok && typeof datos?.liberados === 'number'
            ? datos.liberados === 0
              ? 'No habia reservas en curso'
              : `${datos.liberados} reservas liberadas`
            : 'No se pudo liberar',
      )
      alTerminar()
    } finally {
      setTrabajando(false)
      globalMutate('/api/funciones')
    }
  }

  return (
    <div className="flex items-center gap-2">
      {resultado ? <span className="text-xs text-muted-foreground">{resultado}</span> : null}
      <button
        type="button"
        onClick={soltar}
        disabled={trabajando || bloqueado}
        title="Libera todas las reservas en curso. No toca las compras confirmadas."
        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive disabled:opacity-40"
      >
        {trabajando ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Eraser className="size-3.5" aria-hidden="true" />
        )}
        Soltar reservas en curso
      </button>
    </div>
  )
}

function FuncionesCargadas() {
  const bloqueado = useBloqueado()
  const { data, mutate } = useSWR<{ funciones: FuncionDTO[] }>('/api/funciones', fetcher, {
    refreshInterval: 5000,
  })
  const [trabajando, setTrabajando] = useState<string | null>(null)

  async function eliminar(funcionId: string, titulo: string) {
    if (!confirm(`¿Eliminar "${titulo}" y sus 54 butacas del motor?`)) return
    setTrabajando(funcionId)
    try {
      await fetch('/api/backoffice/funcion/eliminar', {
        method: 'POST',
        headers: cabecerasBackoffice({ 'content-type': 'application/json' }),
        body: JSON.stringify({ funcionId }),
      })
      await mutate()
    } finally {
      setTrabajando(null)
    }
  }

  const funciones = data?.funciones ?? []
  if (funciones.length === 0) return null

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-foreground">
        <Film className="size-5 text-primary" aria-hidden="true" />
        Funciones en cartelera
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Eliminar borra la capacidad y las 54 butacas con deleteResource.
      </p>
      <ul className="flex flex-col gap-2">
        {funciones.map((f) => (
          <li
            key={f.key}
            className="flex items-center justify-between gap-3 rounded-lg bg-secondary/50 px-3 py-2.5 text-sm"
          >
            <span className="flex flex-col">
              <span className="text-foreground">{f.titulo}</span>
              <span className="text-xs text-muted-foreground">
                {f.butacasDisponibles} de {f.capacidadTotal} libres ·{' '}
                {f.politica === 'QUEUE' ? 'con cola' : 'sin cola'}
              </span>
            </span>
            <button
              type="button"
              onClick={() => eliminar(f.id, f.titulo)}
              disabled={trabajando === f.id || bloqueado}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive disabled:opacity-40"
            >
              {trabajando === f.id ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-3.5" aria-hidden="true" />
              )}
              Eliminar
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function StockCandy() {
  const bloqueado = useBloqueado()
  const { data, mutate } = useSWR<{ productos: ProductoDTO[] }>('/api/productos', fetcher, {
    refreshInterval: 5000,
  })
  const [trabajando, setTrabajando] = useState<string | null>(null)

  async function reponer(productoKey: string) {
    setTrabajando(productoKey)
    try {
      await fetch('/api/backoffice/reponer', {
        method: 'POST',
        headers: cabecerasBackoffice({ 'content-type': 'application/json' }),
        body: JSON.stringify({ productoKey }),
      })
      await mutate()
    } finally {
      setTrabajando(null)
    }
  }

  const productos = data?.productos ?? []
  if (productos.length === 0) return null

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-1 flex items-center gap-2 font-display text-lg font-semibold text-foreground">
        <Popcorn className="size-5 text-primary" aria-hidden="true" />
        Stock del candy bar
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Reponer ajusta el stock con updateResource, sin borrar ni recrear el recurso.
      </p>
      <ul className="flex flex-col gap-2">
        {productos.map((p) => (
          <li
            key={p.key}
            className="flex items-center justify-between gap-3 rounded-lg bg-secondary/50 px-3 py-2.5 text-sm"
          >
            <span className="text-foreground">{p.nombre}</span>
            <span className="flex items-center gap-3">
              <span className="tabular-nums text-muted-foreground">{p.disponibles} en stock</span>
              <button
                type="button"
                onClick={() => reponer(p.key)}
                disabled={trabajando === p.key || bloqueado}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-40"
              >
                {trabajando === p.key ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <PackagePlus className="size-3.5" aria-hidden="true" />
                )}
                Reponer
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function useBloqueado() {
  const { data } = useSWR<{ protegido: boolean }>('/api/backoffice/estado', fetcher)
  const [tiene, setTiene] = useState(false)

  useEffect(() => {
    setTiene(Boolean(tokenBackoffice()))
    const t = setInterval(() => setTiene(Boolean(tokenBackoffice())), 1000)
    return () => clearInterval(t)
  }, [])

  return Boolean(data?.protegido) && !tiene
}

function CampoToken() {
  const [valor, setValor] = useState('')
  const [guardado, setGuardado] = useState(false)
  const bloqueado = useBloqueado()

  useEffect(() => {
    setValor(tokenBackoffice())
  }, [])

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm',
        bloqueado ? 'border-primary/40 bg-primary/10' : 'border-border bg-secondary/30',
      )}
    >
      <KeyRound className={cn('size-4', bloqueado ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
      <span className={bloqueado ? 'text-primary' : 'text-muted-foreground'}>
        {bloqueado ? 'Solo lectura: cargá el token para poder modificar' : 'Token del Backoffice'}
      </span>
      <input
        type="password"
        value={valor}
        onChange={(e) => {
          setValor(e.target.value)
          setGuardado(false)
        }}
        placeholder="solo si la demo está publicada"
        className="min-w-48 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary/60"
      />
      <button
        type="button"
        onClick={() => {
          guardarTokenBackoffice(valor)
          setGuardado(true)
        }}
        className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
      >
        {guardado ? 'Guardado' : 'Guardar'}
      </button>
    </div>
  )
}

export function Backoffice() {
  const [filtro, setFiltro] = useState<Estado | 'ALL'>('ALL')
  const auditUrl = `/api/backoffice/holders${filtro === 'ALL' ? '' : `?status=${filtro}`}`
  const { data, isLoading, mutate } = useSWR<{ holders: HolderDTO[] }>(auditUrl, fetcher, {
    refreshInterval: 3000,
  })
  const holders = data?.holders ?? []
  return (
    <div className="flex flex-col gap-8">
      <CampoToken />
      <div className="grid gap-5 lg:grid-cols-2">
        <FuncionForm />
        <ProductoForm />
      </div>
      <FuncionesCargadas />
      <StockCandy />
      <section className="rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Auditoría de holders
            </h2>
            <p className="text-sm text-muted-foreground">
              Cada reserva y venta que gestiona Caerus, en vivo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BotonSoltarTodo alTerminar={() => mutate()} />
            <button
              type="button"
              onClick={() => mutate()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Refrescar
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-border p-4">
          {ESTADOS.map((e) => (
            <button
              key={e.value}
              type="button"
              onClick={() => setFiltro(e.value)}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                filtro === e.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Recurso</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Cantidad</th>
                <th className="px-5 py-3 font-medium">Comprador</th>
                <th className="px-5 py-3 font-medium">Vence / Confirmado</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && holders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto size-5 animate-spin" aria-hidden="true" />
                  </td>
                </tr>
              ) : holders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                    No hay holders para este filtro.
                  </td>
                </tr>
              ) : (
                holders.map((h) => (
                  <tr
                    key={h.id}
                    className="border-b border-border/60 last:border-0 hover:bg-secondary/30"
                  >
                    <td className="px-5 py-3 text-foreground">
                      {h.etiqueta ?? h.resourceKey ?? h.resourceId}
                    </td>
                    <td className="px-5 py-3">
                      <EstadoBadge estado={h.status} />
                    </td>
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">{h.amount}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {String(h.metadata?.comprador ?? '—')}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">
                      {new Date(h.expiresAt).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Campo({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      {children}
    </label>
  )
}

const inputClase =
  'w-full rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/20'

function FuncionForm() {
  const bloqueado = useBloqueado()
  const [titulo, setTitulo] = useState('')
  const [horario, setHorario] = useState('')
  const [precioBase, setPrecioBase] = useState('')
  const [estado, setEstado] = useState<'idle' | 'saving' | 'ok'>('idle')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEstado('saving')
    try {
      const res = await fetch('/api/backoffice/funcion', {
        method: 'POST',
        headers: cabecerasBackoffice({ 'content-type': 'application/json' }),
        body: JSON.stringify({
          titulo,
          horario,
          precioBase: Number(precioBase),
        }),
      })
      if (!res.ok) {
        setEstado('idle')
        return
      }
      setTitulo('')
      setHorario('')
      setPrecioBase('')
      setEstado('ok')
      globalMutate('/api/funciones')
      setTimeout(() => setEstado('idle'), 2000)
    } catch {
      setEstado('idle')
    }
  }
  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5"
    >
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
        <Film className="size-5 text-primary" aria-hidden="true" />
        Nueva función
      </h2>
      <p className="-mt-2 text-sm text-muted-foreground">
        Crea la capacidad y las 54 butacas de la sala en Caerus.
      </p>
      <Campo label="Título">
        <input
          className={inputClase}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ej. Amanecer Rojo"
          required
        />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Horario">
          <input
            className={inputClase}
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            placeholder="Hoy 21:00"
            required
          />
        </Campo>
        <Campo label="Precio base">
          <input
            className={inputClase}
            type="number"
            min={1}
            value={precioBase}
            onChange={(e) => setPrecioBase(e.target.value)}
            placeholder="4500"
            required
          />
        </Campo>
      </div>
      <button
        type="submit"
        disabled={estado === 'saving' || bloqueado}
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {estado === 'saving' ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : estado === 'ok' ? (
          <CheckCircle2 className="size-4" aria-hidden="true" />
        ) : (
          <Plus className="size-4" aria-hidden="true" />
        )}
        {estado === 'ok' ? 'Función creada' : 'Crear función'}
      </button>
    </form>
  )
}

function ProductoForm() {
  const bloqueado = useBloqueado()
  const [nombre, setNombre] = useState('')
  const [tamanio, setTamanio] = useState('')
  const [precio, setPrecio] = useState('')
  const [stock, setStock] = useState('')
  const [estado, setEstado] = useState<'idle' | 'saving' | 'ok'>('idle')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEstado('saving')
    try {
      const res = await fetch('/api/backoffice/producto', {
        method: 'POST',
        headers: cabecerasBackoffice({ 'content-type': 'application/json' }),
        body: JSON.stringify({
          nombre,
          tamanio,
          precio: Number(precio),
          stock: Number(stock),
        }),
      })
      if (!res.ok) {
        setEstado('idle')
        return
      }
      setNombre('')
      setTamanio('')
      setPrecio('')
      setStock('')
      setEstado('ok')
      globalMutate('/api/productos')
      setTimeout(() => setEstado('idle'), 2000)
    } catch {
      setEstado('idle')
    }
  }
  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5"
    >
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
        <Popcorn className="size-5 text-primary" aria-hidden="true" />
        Nuevo producto de candy bar
      </h2>
      <p className="-mt-2 text-sm text-muted-foreground">
        Alta de stock compartido como recurso múltiple.
      </p>
      <Campo label="Nombre">
        <input
          className={inputClase}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Agua Mineral"
          required
        />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo label="Tamaño">
          <input
            className={inputClase}
            value={tamanio}
            onChange={(e) => setTamanio(e.target.value)}
            placeholder="500ml"
          />
        </Campo>
        <Campo label="Precio">
          <input
            className={inputClase}
            type="number"
            min={1}
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="2500"
            required
          />
        </Campo>
        <Campo label="Stock">
          <input
            className={inputClase}
            type="number"
            min={0}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="50"
            required
          />
        </Campo>
      </div>
      <button
        type="submit"
        disabled={estado === 'saving' || bloqueado}
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {estado === 'saving' ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : estado === 'ok' ? (
          <CheckCircle2 className="size-4" aria-hidden="true" />
        ) : (
          <Plus className="size-4" aria-hidden="true" />
        )}
        {estado === 'ok' ? 'Producto creado' : 'Crear producto'}
      </button>
    </form>
  )
}
