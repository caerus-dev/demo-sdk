'use client'

import { Terminal, Trash2 } from 'lucide-react'
import { useRegistro, limpiar, type Anotada } from '@/lib/registro-cliente'
import { cn } from '@/lib/utils'

export function RegistroCaerus({ className }: { className?: string }) {
  const llamadas = useRegistro()
  return (
    <section
      className={cn('rounded-2xl border border-border bg-card', className)}
      aria-label="Llamadas al SDK de Caerus"
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
          <Terminal className="size-4 text-primary" aria-hidden="true" />
          Llamadas a Caerus
          <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-normal text-muted-foreground">
            @caerus-dev/sdk
          </code>
        </h2>
        {llamadas.length > 0 ? (
          <button
            type="button"
            onClick={limpiar}
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-destructive"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            limpiar
          </button>
        ) : null}
      </header>
      {llamadas.length === 0 ? (
        <p className="px-4 py-6 text-sm leading-relaxed text-muted-foreground">
          Tocá una butaca. Acá vas a ver la llamada exacta que el servidor le hace al SDK y
          lo que responde el motor: la reserva, el conflicto cuando otro se te adelanta, el
          vencimiento y la confirmación.
        </p>
      ) : (
        <ol className="divide-y divide-border/60">
          {llamadas.map((l) => (
            <Fila key={l.id} llamada={l} />
          ))}
        </ol>
      )}
    </section>
  )
}

function Fila({ llamada }: { llamada: Anotada }) {
  const fallo = Boolean(llamada.error)
  const hora = new Date(llamada.t).toLocaleTimeString('es-AR', { hour12: false })
  return (
    <li className="px-4 py-3">
      <div className="mb-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="tabular-nums">{hora}</span>
        <span className="rounded bg-secondary/70 px-1.5 py-0.5">{llamada.accion}</span>
        <span className="ml-auto tabular-nums">{llamada.ms} ms</span>
      </div>
      <code className="block break-words font-mono text-[13px] leading-relaxed text-foreground">
        {llamada.expresion}
      </code>
      <div
        className={cn(
          'mt-1 flex items-start gap-1.5 font-mono text-[12px] leading-relaxed',
          fallo ? 'text-destructive' : 'text-status-confirmed',
        )}
      >
        <span aria-hidden="true">{fallo ? '✕' : '→'}</span>
        <span className="break-words">{fallo ? llamada.error : llamada.resultado}</span>
      </div>
    </li>
  )
}
