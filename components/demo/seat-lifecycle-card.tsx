'use client'

import { useState, useEffect } from 'react'
import { Timer, CheckCircle2, ShoppingCart, XCircle, Loader2, LogOut } from 'lucide-react'

interface SeatLifecycleCardProps {
  seatKey: string
  col: string
  row: number
  precio?: number
  expiresAt?: string | null
  modo: 'broken' | 'fixed'
  onConfirm: () => Promise<void>
  onAbandon?: () => Promise<void>
  onRelease: () => Promise<void>
  onExpire?: () => void
  isProcessing: boolean
}

export function SeatLifecycleCard({
  seatKey,
  col,
  row,
  precio = 4500,
  expiresAt,
  modo,
  onConfirm,
  onAbandon,
  onRelease,
  onExpire,
  isProcessing,
}: SeatLifecycleCardProps) {
  const isBroken = modo === 'broken'
  const [segundosRestantes, setSegundosRestantes] = useState<number>(30)

  // Temporizador para el modo Con Caerus
  useEffect(() => {
    if (!expiresAt) {
      setSegundosRestantes(30)
      return
    }

    const expTime = new Date(expiresAt).getTime()
    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((expTime - Date.now()) / 1000))
      setSegundosRestantes(diff)
      if (diff <= 0 && onExpire) {
        onExpire()
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [expiresAt, onExpire])

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card/90 p-5 shadow-lg backdrop-blur">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Info del Asiento */}
        <div className="flex items-center gap-3.5">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <ShoppingCart className="size-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tu Selección
              </span>
            </div>
            <h3 className="font-display text-lg font-bold text-foreground">
              Butaca {col}{row} · <span className="text-primary">${precio.toLocaleString('es-AR')}</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Entrada individual · Función Hoy 20:30
            </p>
          </div>
        </div>

        {/* Temporizador (En modo con Caerus) */}
        {!isBroken && (
          <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2">
            <Timer className={`size-4 ${segundosRestantes <= 10 ? 'text-destructive animate-pulse' : 'text-amber-400'}`} />
            <div className="text-left">
              <div className="text-[10px] uppercase font-semibold text-muted-foreground">
                Tiempo para completar compra
              </div>
              <div className={`font-mono text-base font-bold ${segundosRestantes <= 10 ? 'text-destructive' : 'text-amber-400'}`}>
                {formatTimer(segundosRestantes)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Botones de Acción */}
      <div className="mt-4 pt-3 border-t border-border/60 flex flex-wrap items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onRelease}
          disabled={isProcessing}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-50"
        >
          <XCircle className="size-3.5" />
          <span>Soltar Butaca</span>
        </button>

        {isBroken && onAbandon && (
          <button
            type="button"
            onClick={onAbandon}
            disabled={isProcessing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-50"
            title="Simula que el cliente cerró el navegador sin concretar el pago"
          >
            <LogOut className="size-3.5" />
            <span>Simular Abandono (Cerrar pestaña)</span>
          </button>
        )}

        <button
          type="button"
          onClick={onConfirm}
          disabled={isProcessing}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md transition hover:bg-primary/90 disabled:opacity-50"
        >
          {isProcessing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="size-3.5" />
          )}
          <span>Confirmar y Pagar</span>
        </button>
      </div>
    </div>
  )
}
