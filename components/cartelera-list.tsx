'use client'

import Image from 'next/image'
import Link from 'next/link'
import useSWR from 'swr'
import { Armchair, Clock, Hourglass } from 'lucide-react'
import { fetcher, formatPrecio } from '@/lib/client'
import type { FuncionDTO } from '@/lib/cine'
import { cn } from '@/lib/utils'

export function CarteleraList() {
  const { data, error, isLoading } = useSWR<{ funciones: FuncionDTO[] }>('/api/funciones', fetcher, {
    refreshInterval: 5000,
    refreshWhenHidden: true,
  })
  if (error) {
    return (
      <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        No se pudo cargar la cartelera. Reintentá en unos segundos.
      </p>
    )
  }
  if (isLoading || !data) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-96 animate-pulse rounded-2xl border border-border bg-card" />
        ))}
      </div>
    )
  }
  if (data.funciones.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
        No hay funciones cargadas. Creá una desde el{' '}
        <Link href="/backoffice" className="text-primary underline-offset-4 hover:underline">
          Backoffice
        </Link>
        .
      </p>
    )
  }
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {data.funciones.map((f) => (
        <FuncionCard key={f.key} funcion={f} />
      ))}
    </div>
  )
}

function FuncionCard({ funcion }: { funcion: FuncionDTO }) {
  const agotada = funcion.butacasDisponibles === 0
  const pocas = funcion.butacasDisponibles > 0 && funcion.butacasDisponibles <= 8
  return (
    <Link
      href={`/funcion/${funcion.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-black/40"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-muted">
        {funcion.posterUrl ? (
          <Image
            src={funcion.posterUrl || '/placeholder.svg'}
            alt={`Póster de ${funcion.titulo}`}
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
        <span
          className={cn(
            'absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold backdrop-blur',
            agotada
              ? 'bg-destructive/80 text-destructive-foreground'
              : pocas
                ? 'bg-primary/85 text-primary-foreground'
                : 'bg-background/70 text-foreground',
          )}
        >
          <Armchair className="size-3.5" aria-hidden="true" />
          {agotada ? 'Agotada' : `${funcion.butacasDisponibles} libres`}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-pretty font-display text-lg font-semibold leading-tight text-foreground">
          {funcion.titulo}
        </h3>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-4" aria-hidden="true" />
          {funcion.horario}
        </p>
        {funcion.politica === 'QUEUE' ? (
          <p className="flex items-center gap-1.5 text-xs text-status-queued">
            <Hourglass className="size-3.5" aria-hidden="true" />
            Con cola de espera
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">
            Desde{' '}
            <span className="font-semibold text-foreground">{formatPrecio(funcion.precioBase)}</span>
          </span>
          <span className="text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Elegir butacas →
          </span>
        </div>
      </div>
    </Link>
  )
}
