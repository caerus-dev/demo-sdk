'use client'

import { useState } from 'react'
import { Code2, ChevronDown, ChevronUp } from 'lucide-react'

export function CodeComparison() {
  const [isOpen, setIsOpen] = useState(false)

  const naiveCode = `// Sistema tradicional (vulnerable a peticiones simultáneas)
const asiento = await db.buscarAsiento(asientoId);

if (asiento.disponible) {
  // El tiempo de espera entre consultar y guardar permite compras duplicadas
  await procesarPago();
  await db.marcarVendido(asientoId, clienteId);
  return { exito: true };
}`

  const caerusCode = `// Con Caerus (reserva exclusiva y segura en una sola línea)
try {
  const reserva = await caerus.unitary(asientoId).take({
    ttlSeconds: 120, // Se libera solo si el cliente abandona la compra
  });

  await procesarPago();
  await caerus.confirm(reserva.id);
  return { exito: true };
} catch (error) {
  // Si otro cliente lo tomó una fracción de segundo antes, se notifica sin stock
  return { exito: false, motivo: 'SIN_STOCK' };
}`

  return (
    <div className="rounded-2xl border border-border/80 bg-card/60 shadow-sm backdrop-blur">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 text-left transition hover:bg-muted/40"
      >
        <div className="flex items-center gap-2.5">
          <Code2 className="size-4 text-primary" />
          <span className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
            Cómo se simplificó la lógica en el backend
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{isOpen ? 'Ocultar' : 'Ver simplificación'}</span>
          {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-border/70 p-4 pt-3">
          <p className="mb-4 text-xs text-muted-foreground">
            Caerus elimina la necesidad de bloqueos manuales complejos en la base de datos o lógica de reintentos,
            asegurando exclusividad inmediata y liberación automática ante carritos abandonados.
          </p>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col rounded-xl border border-destructive/30 bg-background/80 p-3.5">
              <span className="mb-2 font-mono text-[11px] font-bold text-destructive">
                Antes · Lógica tradicional (Vulnerable a duplicados)
              </span>
              <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-zinc-300">
                <code>{naiveCode}</code>
              </pre>
            </div>

            <div className="flex flex-col rounded-xl border border-emerald-500/30 bg-background/80 p-3.5">
              <span className="mb-2 font-mono text-[11px] font-bold text-emerald-400">
                Ahora · Con Caerus (Reserva exclusiva garantizada)
              </span>
              <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-zinc-300">
                <code>{caerusCode}</code>
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
