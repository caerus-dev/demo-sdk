'use client'

import useSWR from 'swr'
import { Bell, Radio, Clock, ArrowRight, Trash2 } from 'lucide-react'
import { fetcher } from '@/lib/client'
import type { WebhookEventLog } from '@/app/api/webhooks/caerus/route'

interface WebhookApiResponse {
  status: string
  events: WebhookEventLog[]
}

export function WebhookMonitor() {
  const { data, mutate } = useSWR<WebhookApiResponse>(
    '/api/webhooks/caerus',
    fetcher,
    { refreshInterval: 2000 },
  )

  const events = data?.events ?? []

  const handleClear = async () => {
    await fetch('/api/webhooks/caerus', { method: 'DELETE' }).catch(() => {})
    await mutate({ status: 'online', events: [] }, false)
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card/60 p-5 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Bell className="size-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-bold text-foreground">
                Notificaciones Asíncronas en Tiempo Real
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                <Radio className="size-2.5 animate-pulse" />
                <span>En vivo</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Caerus avisa a tus sistemas cuando un carrito vence o una butaca se desocupa.
            </p>
          </div>
        </div>

        {events.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/80 px-2.5 py-1 text-xs font-semibold text-muted-foreground transition hover:text-foreground hover:bg-secondary"
            title="Limpiar lista de notificaciones"
          >
            <Trash2 className="size-3.5" />
            <span>Limpiar</span>
          </button>
        )}
      </div>

      {/* Lista de Notificaciones de Negocio */}
      <div className="mt-4">
        {events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 p-4 text-center">
            <Clock className="mx-auto size-5 text-muted-foreground mb-1.5" />
            <p className="text-xs font-medium text-foreground">
              A la espera de eventos de la sala
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Cuando un cliente abandona o compra una butaca, Caerus envía la notificación automáticamente.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {events.map((evt) => {
              const isExpired = evt.eventType === 'resource.expired'
              const isTaken = evt.eventType === 'resource.taken'
              const isConfirmed = evt.eventType === 'resource.confirmed'

              const badgeColor = isExpired
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : isTaken
                ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                : isConfirmed
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-purple-500/30 bg-purple-500/10 text-purple-300'

              return (
                <div
                  key={evt.id}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-background/70 px-3.5 py-2.5 text-xs transition hover:bg-background/90"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={`rounded-lg border px-2.5 py-1 font-semibold text-[11px] ${badgeColor}`}>
                      {evt.displayTitle || evt.eventType}
                    </span>
                    <span className="font-medium text-foreground">
                      {evt.dataSummary}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground shrink-0 pl-2">
                    {evt.receivedAt}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="mt-3.5 flex items-center gap-2 rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 text-[11px] text-muted-foreground">
        <ArrowRight className="size-3.5 text-primary shrink-0" />
        <span>
          <strong>Integración empresarial:</strong> Mientras Caerus libera la sala en tiempo real en su motor para no perder ventas, este evento permite a tu pasarela de pagos y CRM cancelar la orden o enviar un email de recuperación de carrito.
        </span>
      </div>
    </div>
  )
}
