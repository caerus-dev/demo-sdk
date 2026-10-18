'use client'

import { useEffect, useState } from 'react'
import { Activity, Bell, ChevronDown, ChevronRight, ShieldCheck, Trash2 } from 'lucide-react'
import type { WebhookEventLog } from '@/lib/event-bus'
import { conectarEventosWebhook } from '@/lib/client'
import { cn } from '@/lib/utils'

export function WebhookFeed({ className }: { className?: string }) {
  const [events, setEvents] = useState<WebhookEventLog[]>([])
  const [openJson, setOpenJson] = useState<Set<string>>(new Set())
  const [conectado, setConectado] = useState(false)

  useEffect(() => {
    return conectarEventosWebhook({
      onEstado: (ok) => setConectado(ok),
      onInit: (history) => setEvents(history),
      onWebhook: (event) => {
        setEvents((prev) => {
          if (prev.some((x) => x.id === event.id)) return prev
          return [event, ...prev].slice(0, 30)
        })
      },
    })
  }, [])

  function toggleJson(id: string) {
    setOpenJson((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function limpiar() {
    await fetch('/api/webhooks/caerus', { method: 'DELETE' }).catch(() => {})
    setEvents([])
  }

  return (
    <div className={cn('rounded-2xl border border-border bg-card p-5 shadow-xs', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-primary" aria-hidden="true" />
          <h3 className="font-display text-sm font-semibold text-foreground">
            Monitor de Webhooks en Vivo
          </h3>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
              conectado
                ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border border-amber-500/30 bg-amber-500/10 text-amber-400',
            )}
          >
            <span
              className={cn(
                'size-1.5 rounded-full',
                conectado ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400',
              )}
            />
            {conectado ? 'Stream SSE Activo' : 'Conectando...'}
          </span>
        </div>

        {events.length > 0 && (
          <button
            type="button"
            onClick={limpiar}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="size-3" />
            Limpiar
          </button>
        )}
      </div>

      <div className="mt-3">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-muted-foreground">
            <Activity className="size-5 mb-1.5 opacity-40 text-primary" />
            <p>Esperando notificaciones del Control Plane...</p>
            <p className="mt-0.5 text-[11px] opacity-75">
              Los eventos `resource.taken`, `resource.queued`, `resource.expired`, etc. aparecerán aquí al instante vía Webhook.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
            {events.map((evt) => {
              const isOpen = openJson.has(evt.id)
              const isExpired = evt.eventType === 'resource.expired'
              const isTaken = evt.eventType === 'resource.taken'
              const isQueued = evt.eventType === 'resource.queued'
              const isReleased = evt.eventType === 'resource.released'
              const isConfirmed = evt.eventType === 'resource.confirmed'

              let badgeClass = 'border-border bg-secondary text-muted-foreground'
              if (isExpired) badgeClass = 'border-amber-500/40 bg-amber-500/15 text-amber-400'
              else if (isTaken) badgeClass = 'border-primary/40 bg-primary/15 text-primary'
              else if (isQueued) badgeClass = 'border-status-queued/40 bg-status-queued/15 text-status-queued'
              else if (isReleased) badgeClass = 'border-slate-500/40 bg-slate-500/15 text-slate-400'
              else if (isConfirmed) badgeClass = 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'

              return (
                <div
                  key={evt.id}
                  className="rounded-lg border border-border/80 bg-secondary/30 p-2.5 text-xs transition-colors hover:bg-secondary/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold border', badgeClass)}>
                        {evt.eventType}
                      </span>
                      <span className="font-semibold text-foreground">{evt.displayTitle}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {evt.verified ? (
                        <span className="inline-flex items-center gap-0.5 text-emerald-400" title="Firma HMAC verificada con éxito">
                          <ShieldCheck className="size-3" />
                          HMAC
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-muted-foreground/60" title="Sin firma o en modo local">
                          HMAC off
                        </span>
                      )}
                      <span className="font-mono">{evt.receivedAt}</span>
                      <button
                        type="button"
                        onClick={() => toggleJson(evt.id)}
                        className="text-muted-foreground hover:text-foreground p-0.5"
                        title="Ver payload crudo"
                      >
                        {isOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      </button>
                    </div>
                  </div>

                  <p className="mt-1 text-muted-foreground text-[11px] leading-relaxed">
                    {evt.dataSummary}
                  </p>

                  {isOpen && (
                    <pre className="mt-2 overflow-x-auto rounded bg-background/80 p-2 font-mono text-[10px] text-foreground/90 border border-border">
                      {JSON.stringify(evt.raw, null, 2)}
                    </pre>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
