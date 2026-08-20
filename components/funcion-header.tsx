'use client'

import useSWR from 'swr'
import { Clock, Armchair, Hourglass, Ban } from 'lucide-react'
import { fetcher } from '@/lib/client'
import type { ButacaDTO, FuncionDTO } from '@/lib/cine'

export function FuncionHeader({ funcionId }: { funcionId: string }) {
  const { data } = useSWR<{ funcion: FuncionDTO; butacas: ButacaDTO[] }>(
    `/api/funciones/${funcionId}/butacas`,
    fetcher,
    { refreshInterval: 3000 },
  )

  const f = data?.funcion
  return (
    <div className="mb-8">
      <h1 className="text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {f?.titulo ?? 'Cargando función…'}
      </h1>
      {f ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="size-4" aria-hidden="true" />
            {f.horario}
          </span>
          <span className="flex items-center gap-1.5">
            <Armchair className="size-4" aria-hidden="true" />
            {f.butacasDisponibles} de {f.capacidadTotal} butacas libres
          </span>
          {f.politica === 'QUEUE' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-status-queued/40 bg-status-queued/10 px-2.5 py-1 text-xs font-medium text-status-queued">
              <Hourglass className="size-3.5" aria-hidden="true" />
              Con cola de espera
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <Ban className="size-3.5" aria-hidden="true" />
              Sin cola: el segundo pierde
            </span>
          )}
        </div>
      ) : null}
    </div>
  )
}
