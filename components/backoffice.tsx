'use client'

import { useEffect, useState } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import {
  CheckCircle2,
  Film,
  Loader2,
  Plus,
  Popcorn,
  PackagePlus,
  KeyRound,
  Trash2,
  RotateCcw,
} from 'lucide-react'
import { cabecerasBackoffice, fetcher, guardarTokenBackoffice, limpiarTodasLasCompras, tokenBackoffice } from '@/lib/client'
import { cn } from '@/lib/utils'
import type { FuncionDTO, ProductoDTO } from '@/lib/cine'

function BotonResetearTodo() {
  const bloqueado = useBloqueado()
  const [trabajando, setTrabajando] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)

  async function resetear() {
    if (
      !window.confirm(
        '¿Reiniciar todo el cine en Caerus? Esto liberará reservas en curso, borrará ventas y recreará todas las butacas y productos con los valores de config/sala.json.',
      )
    ) {
      return
    }
    setTrabajando(true)
    setResultado(null)
    try {
      const res = await fetch('/api/cine/reset', { method: 'POST' })
      const datos = await res.json().catch(() => null)
      if (res.ok && datos?.success) {
        setResultado('Cine reiniciado a defaults')
        limpiarTodasLasCompras()
        for (const k of Object.keys(sessionStorage)) {
          if (k.startsWith('caerus_reserva_') || k.startsWith('caerus_intento_')) {
            sessionStorage.removeItem(k)
          }
        }
      } else {
        setResultado('Error al reiniciar')
      }
    } finally {
      setTrabajando(false)
      globalMutate('/api/funciones')
      globalMutate('/api/productos')
    }
  }

  return (
    <div className="flex items-center gap-3">
      {resultado ? <span className="text-xs font-medium text-emerald-400">{resultado}</span> : null}
      <button
        type="button"
        onClick={resetear}
        disabled={trabajando || bloqueado}
        title="Borra todas las reservas y compras en Caerus y reconstruye el inventario desde config/sala.json"
        className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-40 cursor-pointer"
      >
        {trabajando ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <RotateCcw className="size-3.5" aria-hidden="true" />
        )}
        {trabajando ? 'Reiniciando Caerus…' : 'Resetear todo (Recrear sala)'}
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
    if (!confirm(`¿Eliminar "${titulo}" y sus 30 butacas del motor?`)) return
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
        Eliminar borra la capacidad y las 30 butacas con deleteResource.
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
  return (
    <div className="flex flex-col gap-8">
      <CampoToken />
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5">
        <div>
          <h2 className="font-display text-lg font-semibold text-foreground">
            Estado de la sala (Demo)
          </h2>
          <p className="text-sm text-muted-foreground">
            Reiniciá las butacas y el stock del candy bar a los valores iniciales de config/sala.json.
          </p>
        </div>
        <BotonResetearTodo />
      </section>
      <FuncionesCargadas />
      <StockCandy />
      <div className="grid gap-5 lg:grid-cols-2">
        <FuncionForm />
        <ProductoForm />
      </div>
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
        Crea la capacidad y las 30 butacas de la sala en Caerus.
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
