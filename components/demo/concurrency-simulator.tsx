'use client'

import { Zap, RotateCcw, Loader2 } from 'lucide-react'

interface ConcurrencySimulatorProps {
  onSimulate: (userCount: number) => Promise<void>
  onReset: () => Promise<void>
  isLoading: boolean
  modo: 'broken' | 'fixed'
}

export function ConcurrencySimulator({
  onSimulate,
  onReset,
  isLoading,
  modo,
}: ConcurrencySimulatorProps) {
  const isBroken = modo === 'broken'

  const handleSimulate = async () => {
    if (isLoading) return
    await onSimulate(20)
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-card/70 p-5 shadow-sm backdrop-blur">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-primary" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
              Simulador de Demanda Simultánea
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {isBroken
              ? 'Simula una ráfaga de 20 clientes intentando comprar los mismos asientos al mismo tiempo.'
              : 'Simula la misma ráfaga de 20 clientes con exclusividad garantizada en tiempo real por Caerus.'}
          </p>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onReset}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw className="size-3.5" />
            <span>Reiniciar Sala</span>
          </button>

          <button
            type="button"
            onClick={handleSimulate}
            disabled={isLoading}
            className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-md transition disabled:cursor-not-allowed disabled:opacity-60 ${
              isBroken
                ? 'bg-destructive hover:bg-destructive/90 shadow-destructive/20'
                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Simulando 20 compradores...</span>
              </>
            ) : (
              <>
                <Zap className="size-4 fill-white" />
                <span>Simular Alta Demanda (20 Compradores)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
