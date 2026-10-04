'use client'

import { AlertTriangle, Lock, ShieldAlert, ShieldCheck } from 'lucide-react'

export interface ConflictMetricsData {
  totalAttempts: number
  successfulBookings: number
  failedBookings: number
  doubleBookedSeats: number
  doubleBookings?: Array<{
    seatKey: string
    col?: string
    row?: number
    bookedBy: string[]
    count?: number
  }>
  affectedUsers?: number
  conflictRejections?: number
  abandonedBlockedSeats?: number
  abandonedSeatsList?: string[]
}

interface ConflictMetricsProps {
  metrics: ConflictMetricsData | null
  modo: 'broken' | 'fixed'
}

export function ConflictMetrics({ metrics, modo }: ConflictMetricsProps) {
  if (!metrics || (metrics.totalAttempts === 0 && !metrics.abandonedBlockedSeats)) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-card/40 p-5 text-center text-xs text-muted-foreground">
        Hacé clic en una butaca libre para probar la selección, o en <strong>"Simular Alta Demanda"</strong> para ver el comportamiento bajo concurrencia masiva.
      </div>
    )
  }

  const isBroken = modo === 'broken'
  const hasDoubleBookings = metrics.doubleBookedSeats > 0
  const hasAbandonedSeats = Boolean(metrics.abandonedBlockedSeats && metrics.abandonedBlockedSeats > 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Banner de Estado General */}
      {isBroken ? (
        <div className="flex items-start gap-3.5 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs">
          <ShieldAlert className="size-5 shrink-0 text-destructive mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-display font-bold text-destructive text-sm">
              🚨 PROBLEMA DE CONCURRENCIA DETECTADO EN SALA
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              {hasDoubleBookings && (
                <span>
                  El sistema tradicional confirmó compras duplicadas para las mismas butacas físicas. Hay{' '}
                  <strong className="text-destructive font-bold">{metrics.doubleBookedSeats} butacas</strong> vendidas a{' '}
                  <strong className="text-foreground">{metrics.affectedUsers ?? 0} clientes simultáneos</strong>.{' '}
                </span>
              )}
              {hasAbandonedSeats && (
                <span>
                  Hay <strong className="text-amber-400 font-bold">{metrics.abandonedBlockedSeats} butacas bloqueadas</strong> por carritos abandonados que no se liberaron solas, impidiendo que otros clientes las compren.
                </span>
              )}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3.5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs">
          <ShieldCheck className="size-5 shrink-0 text-emerald-400 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-display font-bold text-emerald-400 text-sm">
              🛡️ CERO SOBREVENTA: CADA CLIENTE RECIBIÓ SU BUTACA EXCLUSIVA
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              Caerus garantizó que cada butaca fuera reservada por un único comprador. Los{' '}
              <strong className="text-foreground font-bold">{metrics.failedBookings} intentos excedentes</strong>{' '}
              fueron informados de inmediato que el asiento ya no estaba disponible, protegiendo la integridad del inventario.
            </p>
          </div>
        </div>
      )}

      {/* Grid de Métricas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border/80 bg-card/60 p-3.5 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Intentos de Compra
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold text-foreground">
              {metrics.totalAttempts}
            </span>
            <span className="text-[10px] text-muted-foreground">solicitudes</span>
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card/60 p-3.5 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Compras Aceptadas
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={`font-mono text-2xl font-bold ${
                isBroken ? 'text-primary' : 'text-emerald-400'
              }`}
            >
              {metrics.successfulBookings}
            </span>
            <span className="text-[10px] text-muted-foreground">tickets</span>
          </div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card/60 p-3.5 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {isBroken ? 'Carritos Abandonados' : 'Sin Inventario'}
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={`font-mono text-2xl font-bold ${isBroken && hasAbandonedSeats ? 'text-amber-400' : 'text-muted-foreground'}`}>
              {isBroken ? (metrics.abandonedBlockedSeats ?? 0) : metrics.failedBookings}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {isBroken ? 'retenidos' : 'rechazados'}
            </span>
          </div>
        </div>

        <div
          className={`rounded-xl border p-3.5 shadow-sm ${
            hasDoubleBookings
              ? 'border-destructive/50 bg-destructive/15'
              : 'border-emerald-500/40 bg-emerald-500/10'
          }`}
        >
          <span
            className={`text-[11px] font-semibold uppercase tracking-wider ${
              hasDoubleBookings ? 'text-destructive' : 'text-emerald-400'
            }`}
          >
            Sobreventa (Doble Venta)
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className={`font-mono text-2xl font-black ${
                hasDoubleBookings ? 'text-destructive animate-pulse' : 'text-emerald-400'
              }`}
            >
              {metrics.doubleBookedSeats}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {hasDoubleBookings ? 'butacas duplicadas' : 'conflictos (0%)'}
            </span>
          </div>
        </div>
      </div>

      {/* Detalle de Butacas en Conflicto (si hay sobreventa) */}
      {isBroken && metrics.doubleBookings && metrics.doubleBookings.length > 0 && (
        <div className="rounded-2xl border border-destructive/30 bg-card/70 p-4">
          <div className="mb-2.5 flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
              Detalle de Asientos con Múltiples Compradores
            </h4>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {metrics.doubleBookings.map((b) => (
              <div
                key={b.seatKey}
                className="flex items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs"
              >
                <span className="font-mono font-bold text-destructive">
                  Butaca {b.col && b.row ? `${b.col}${b.row}` : (b.seatKey.split('_')[1] ?? b.seatKey)}:
                </span>
                <span className="text-muted-foreground">
                  Vendida a <strong className="text-foreground">{b.bookedBy.join(', ')}</strong> ({b.bookedBy.length} compradores)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detalle de Butacas Bloqueadas por Abandono */}
      {isBroken && hasAbandonedSeats && metrics.abandonedSeatsList && metrics.abandonedSeatsList.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-card/70 p-4">
          <div className="mb-2.5 flex items-center gap-2">
            <Lock className="size-4 text-amber-400" />
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
              Butacas Bloqueadas por Carritos Abandonados (Sin Expiración)
            </h4>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {metrics.abandonedSeatsList.map((seatName) => (
              <span
                key={seatName}
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-mono font-bold text-amber-300"
              >
                🔒 Butaca {seatName}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
