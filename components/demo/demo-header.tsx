'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowRight, ShieldCheck, ShieldAlert, Sparkles } from 'lucide-react'

interface DemoHeaderProps {
  modo: 'broken' | 'fixed'
}

export function DemoHeader({ modo }: DemoHeaderProps) {
  const isBroken = modo === 'broken'

  return (
    <div className="mb-6 rounded-2xl border border-border/80 bg-card/60 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/demo"
            className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
            title="Volver a la selección general"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <span
              className={`flex size-8 items-center justify-center rounded-lg ${
                isBroken
                  ? 'bg-destructive/15 text-destructive'
                  : 'bg-emerald-500/15 text-emerald-400'
              }`}
            >
              {isBroken ? <ShieldAlert className="size-4" /> : <ShieldCheck className="size-4" />}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Simulación de Concurrencia
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    isBroken
                      ? 'border border-destructive/30 bg-destructive/15 text-destructive'
                      : 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-400'
                  }`}
                >
                  {isBroken ? 'Sistema Tradicional' : 'Sistema con Caerus'}
                </span>
              </div>
              <h1 className="font-display text-lg font-bold text-foreground">
                {isBroken
                  ? 'Sin Caerus: Sobreventa y Bloqueo Indefinido'
                  : 'Con Caerus: Cero Sobreventa y Liberación Automática'}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isBroken ? (
            <Link
              href="/demo/fixed"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 hover:text-emerald-200"
            >
              <Sparkles className="size-3.5" />
              <span>Ver Solución con Caerus</span>
              <ArrowRight className="size-3.5" />
            </Link>
          ) : (
            <Link
              href="/demo/broken"
              className="inline-flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/20"
            >
              <ShieldAlert className="size-3.5" />
              <span>Ver Sistema Tradicional</span>
              <ArrowLeft className="size-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
