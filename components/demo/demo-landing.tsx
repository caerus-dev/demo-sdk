'use client'

import Link from 'next/link'
import {
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'

export function DemoLanding() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8">
      {/* Hero Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
          <Sparkles className="size-3.5" />
          <span>Gestión de Concurrencia</span>
        </div>
        <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          El Problema vs La Solución
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base">
          ¿Qué ocurre cuando múltiples clientes intentan comprar los mismos asientos al mismo tiempo?
          Una comparación en vivo del impacto en el negocio antes y después de Caerus.
        </p>
      </div>

      {/* Split Screen Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Card 1: Sin Caerus (Problema) */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-destructive/30 bg-card/70 p-7 shadow-lg backdrop-blur transition hover:border-destructive/60">
          <div className="absolute right-0 top-0 -mr-10 -mt-10 size-40 rounded-full bg-destructive/10 blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
                <ShieldAlert className="size-6" />
              </span>
              <span className="rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-destructive">
                Sistema Tradicional
              </span>
            </div>

            <h2 className="mt-5 font-display text-2xl font-bold text-foreground">
              Sin Caerus
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Implementación convencional sin control de concurrencia distribuido.
            </p>

            <ul className="mt-6 space-y-4 text-xs text-muted-foreground sm:text-sm">
              <li className="flex items-start gap-2.5">
                <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
                <span>
                  <strong className="text-foreground">Sobreventa de entradas:</strong> Cuando varios clientes compran simultáneamente, el sistema confirma compras duplicadas para la misma butaca física.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
                <span>
                  <strong className="text-foreground">Bloqueo indefinido por carritos abandonados:</strong> Los usuarios que inician la compra y la abandonan dejan las butacas retenidas, impidiendo nuevas ventas y generando pérdidas de ingresos.
                </span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4 border-t border-border/60">
            <Link
              href="/demo/broken"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-destructive px-5 py-3 text-sm font-bold text-white shadow-md shadow-destructive/20 transition hover:bg-destructive/90"
            >
              <span>Simular Problema en Vivo</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        {/* Card 2: Con Caerus (Solución) */}
        <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-emerald-500/30 bg-card/70 p-7 shadow-lg backdrop-blur transition hover:border-emerald-500/60">
          <div className="absolute right-0 top-0 -mr-10 -mt-10 size-40 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                <ShieldCheck className="size-6" />
              </span>
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Protegido
              </span>
            </div>

            <h2 className="mt-5 font-display text-2xl font-bold text-foreground">
              Con Caerus
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Cada asiento gestionado como un recurso compartido con control en tiempo real.
            </p>

            <ul className="mt-6 space-y-4 text-xs text-muted-foreground sm:text-sm">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>
                  <strong className="text-foreground">Cero sobreventa garantizada:</strong> El sistema adjudica cada butaca a un único comprador en tiempo real. Cualquier solicitud concurrente adicional es rechazada al instante.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>
                  <strong className="text-foreground">Expiración automática de reservas:</strong> Si el cliente no completa el pago en el tiempo límite, la butaca se libera sola de inmediato, volviendo a estar disponible para la venta sin intervención manual.
                </span>
              </li>
            </ul>
          </div>

          <div className="mt-8 pt-4 border-t border-border/60">
            <Link
              href="/demo/fixed"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-emerald-500/20 transition hover:bg-emerald-500"
            >
              <span>Ver Solución con Caerus</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
