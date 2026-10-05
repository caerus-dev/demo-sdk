'use client'

import { useState, useMemo, useEffect } from 'react'
import useSWR from 'swr'
import { DemoHeader } from '@/components/demo/demo-header'
import { DemoSeatMap, type DemoSeatInfo, type DemoSeatStatus } from '@/components/demo/demo-seat-map'
import { ConcurrencySimulator } from '@/components/demo/concurrency-simulator'
import { ConflictMetrics, type ConflictMetricsData } from '@/components/demo/conflict-metrics'
import { SeatLifecycleCard } from '@/components/demo/seat-lifecycle-card'
import { CodeComparison } from '@/components/demo/code-comparison'
import type { LlamadaSDK } from '@/lib/caerus'
import { fetcher, getSessionId } from '@/lib/client'
import { Terminal, CheckCircle2, Trash2 } from 'lucide-react'
import { WebhookMonitor } from '@/components/demo/webhook-monitor'

const HOLDER_STORAGE_KEY = 'caerus_active_holder_v1'

interface ButacaApiItem {
  key: string
  columna: string
  fila: number
  precio: number
  disponible: boolean
  estado?: 'DISPONIBLE' | 'EN_CARRITO' | 'CONFIRMADA'
  comprador?: string
}

interface ButacasResponse {
  funcion: { id: string; titulo: string }
  butacas: ButacaApiItem[]
}

interface ActiveHolderInfo {
  seatKey: string
  col: string
  row: number
  precio: number
  butacaHolderId: string
  expiresAt: string
  heldAt: number
}

export default function FixedDemoPage() {
  const { data, mutate } = useSWR<ButacasResponse>(
    '/api/funciones/horizonte/butacas',
    fetcher,
    { refreshInterval: 3000, refreshWhenHidden: true },
  )

  const [metrics, setMetrics] = useState<ConflictMetricsData | null>(null)
  const [llamadas, setLlamadas] = useState<LlamadaSDK[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [cargandoKey, setCargandoKey] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [activeHolder, setActiveHolder] = useState<ActiveHolderInfo | null>(null)
  const [isProcessingLifecycle, setIsProcessingLifecycle] = useState(false)
  const [simulatedBuyers, setSimulatedBuyers] = useState<Record<string, string>>({})

  // Restaurar holder activo de sessionStorage solo tras montar en cliente (evita error de hidratación)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(HOLDER_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as ActiveHolderInfo
        if (new Date(parsed.expiresAt).getTime() > Date.now()) {
          setActiveHolder(parsed)
        } else {
          sessionStorage.removeItem(HOLDER_STORAGE_KEY)
        }
      }
    } catch {}
    setMounted(true)
  }, [])

  // Persistir holder activo en sessionStorage una vez montado el cliente
  useEffect(() => {
    if (!mounted) return
    if (activeHolder) {
      sessionStorage.setItem(HOLDER_STORAGE_KEY, JSON.stringify(activeHolder))
    } else {
      sessionStorage.removeItem(HOLDER_STORAGE_KEY)
    }
  }, [activeHolder, mounted])

  // Si el holder es liberado externamente (ej. Telemetry Dashboard de Caerus)
  useEffect(() => {
    if (!activeHolder || !data?.butacas) return

    // Solo verificamos si pasaron al menos 3 segundos desde la reserva local,
    // para evitar que el estado previo en caché de SWR limpie la selección inmediatamente.
    if (Date.now() - activeHolder.heldAt > 3000) {
      const current = data.butacas.find((b) => b.key === activeHolder.seatKey)
      if (current && current.disponible) {
        setActiveHolder(null)
      }
    }
  }, [data, activeHolder])

  // Mapeo en vivo de butacas desde Caerus
  const seats = useMemo(() => {
    const map: Record<string, DemoSeatInfo> = {}
    
    // 1. Inicializar siempre las 30 butacas para que sean clickeables
    // aunque la sincronización con el backend tenga latencia o estén temporalmente omitidas
    const COLS = ['A', 'B', 'C', 'D', 'E', 'F']
    const ROWS = [1, 2, 3, 4, 5]
    for (const c of COLS) {
      for (const r of ROWS) {
        const key = `funcionhorizonte_${c}${r}`
        map[key] = {
          key,
          col: c,
          row: r,
          precio: 4500,
          status: 'available',
          isDoubleBooked: false,
          buyers: [],
        }
      }
    }

    // 2. Actualizar con los datos reales del backend
    if (data?.butacas) {
      data.butacas.forEach((b) => {
        const isMine = activeHolder?.seatKey === b.key
        let status: DemoSeatStatus = 'available'
        if (isMine) {
          status = 'held'
        } else if (b.estado === 'CONFIRMADA' || simulatedBuyers[b.key]) {
          status = 'booked' // 🟢 Confirmada y pagada definitivamente
        } else if (b.estado === 'EN_CARRITO') {
          status = 'held' // 🛒 En carrito / retenida por 30s
        } else if (!b.disponible) {
          status = 'booked'
        }

        const buyerName = b.comprador || simulatedBuyers[b.key] || 'Confirmada'

        map[b.key] = {
          key: b.key,
          col: b.columna,
          row: b.fila,
          precio: b.precio,
          status,
          isDoubleBooked: false,
          buyers: isMine
            ? ['Tu Selección']
            : status === 'held'
            ? ['En Carrito']
            : status === 'booked'
            ? [buyerName]
            : [],
        }
      })
    }
    return map
  }, [data, activeHolder, simulatedBuyers])

  // Reserva individual al hacer clic en una butaca
  const handleSeatClick = async (seatKey: string) => {
    const seat = seats[seatKey]
    if (!seat || seat.status === 'booked' || isLoading || cargandoKey) return
    if (activeHolder?.seatKey === seatKey) return

    setCargandoKey(seatKey)
    try {
      // Si el cliente ya tenía otra butaca en su carrito, la soltamos primero en Caerus
      if (activeHolder) {
        await fetch('/api/holders/liberar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ holderIds: [activeHolder.butacaHolderId] }),
        }).catch(() => {})
        setActiveHolder(null)
      }

      const res = await fetch('/api/funciones/horizonte/reservar-butaca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          butacaKey: seatKey,
          sessionId: getSessionId(),
          intento: crypto.randomUUID(),
        }),
      })
      const json = await res.json()
      if (json._llamadas) {
        setLlamadas((prev) => [...json._llamadas, ...prev].slice(0, 30))
      }
      if (json.estado === 'RESERVADA') {
        const precioReal = seat.precio ?? 4500
        setActiveHolder({
          seatKey,
          col: seat.col,
          row: seat.row,
          precio: precioReal,
          butacaHolderId: json.butacaHolderId,
          expiresAt: json.expiresAt,
          heldAt: Date.now(),
        })
      }
      await mutate()
    } catch (err) {
      console.error('Error reservando butaca:', err)
    } finally {
      setCargandoKey(null)
    }
  }

  // Confirmar compra individual con Caerus
  const handleConfirmSelected = async () => {
    if (!activeHolder) return
    setIsProcessingLifecycle(true)
    try {
      const res = await fetch('/api/holders/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holderIds: [activeHolder.butacaHolderId],
          comprador: 'Cliente Demo',
          precioTotal: activeHolder.precio,
        }),
      })
      if (res.ok) {
        const json = await res.json()
        if (json._llamadas) {
          setLlamadas((prev) => [...json._llamadas, ...prev].slice(0, 30))
        }
      }
      setActiveHolder(null)
      await mutate()
    } catch (err) {
      console.error('Error confirmando compra:', err)
      setActiveHolder(null)
      await mutate()
    } finally {
      setIsProcessingLifecycle(false)
    }
  }

  // Liberar reserva individual en Caerus
  const handleReleaseSelected = async () => {
    if (!activeHolder) return
    setIsProcessingLifecycle(true)
    try {
      const res = await fetch('/api/holders/liberar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holderIds: [activeHolder.butacaHolderId] }),
      })
      if (res.ok) {
        const json = await res.json()
        if (json._llamadas) {
          setLlamadas((prev) => [...json._llamadas, ...prev].slice(0, 30))
        }
      }
      setActiveHolder(null)
      await mutate()
    } catch (err) {
      console.error('Error liberando reserva:', err)
      setActiveHolder(null)
      await mutate()
    } finally {
      setIsProcessingLifecycle(false)
    }
  }

  // Simulación masiva concurrente
  const handleSimulate = async (userCount: number) => {
    setIsLoading(true)
    setActiveHolder(null)
    try {
      const res = await fetch('/api/demo/fixed/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userCount, funcionId: 'horizonte' }),
      })
      const json = await res.json()
      if (json.metrics) setMetrics(json.metrics)
      if (json.compradoresPorButaca) {
        setSimulatedBuyers(json.compradoresPorButaca)
      }
      if (json._llamadas) {
        setLlamadas((prev) => [...json._llamadas, ...prev].slice(0, 30))
      }
      await mutate()
    } catch (err) {
      console.error('Error simulando Caerus:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Reiniciar sala liberando holders activos
  const handleReset = async () => {
    setIsLoading(true)
    setActiveHolder(null)
    sessionStorage.removeItem(HOLDER_STORAGE_KEY)
    setSimulatedBuyers({})
    setLlamadas([])
    try {
      await fetch('/api/webhooks/caerus', { method: 'DELETE' }).catch(() => {})
      await fetch('/api/demo/fixed/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funcionId: 'horizonte' }),
      })
      setMetrics(null)
      await mutate()
    } catch (err) {
      console.error('Error reiniciando Caerus:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <DemoHeader modo="fixed" />

      {/* Panel de Inyección Concurrente */}
      <ConcurrencySimulator
        onSimulate={handleSimulate}
        onReset={handleReset}
        isLoading={isLoading}
        modo="fixed"
      />

      {/* Métricas de Éxito y Cero Sobreventa */}
      <ConflictMetrics metrics={metrics} modo="fixed" />

      {/* Tarjeta de Ciclo de Vida cuando hay un asiento reservado */}
      {activeHolder && (
        <SeatLifecycleCard
          seatKey={activeHolder.seatKey}
          col={activeHolder.col}
          row={activeHolder.row}
          precio={activeHolder.precio}
          expiresAt={activeHolder.expiresAt}
          modo="fixed"
          onConfirm={handleConfirmSelected}
          onRelease={handleReleaseSelected}
          onExpire={() => {
            setActiveHolder(null)
            void mutate()
          }}
          isProcessing={isProcessingLifecycle}
        />
      )}

      {/* Visualización de la Sala en Vivo */}
      <DemoSeatMap
        seats={seats}
        modo="fixed"
        funcionId="horizonte"
        onSeatClick={handleSeatClick}
        cargandoKey={cargandoKey}
      />

      {/* Monitor de Webhooks en Vivo (Caerus -> Backend) */}
      <WebhookMonitor />

      {/* Inspector de Actividad en Vivo (Siempre visible para telemetría) */}
      <div className="rounded-2xl border border-border/80 bg-card/60 p-4 shadow-sm backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="size-4 text-emerald-400" />
            <h3 className="font-display text-xs font-bold uppercase tracking-wider text-foreground">
              Operaciones Procesadas en Tiempo Real {llamadas.length > 0 && `(${llamadas.length})`}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
              <CheckCircle2 className="size-3" />
              <span>Motor Caerus Cloud Conectado</span>
            </span>
            {llamadas.length > 0 && (
              <button
                type="button"
                onClick={() => setLlamadas([])}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/80 px-2.5 py-1 text-xs font-semibold text-muted-foreground transition hover:text-foreground hover:bg-secondary"
                title="Limpiar registro de operaciones"
              >
                <Trash2 className="size-3.5" />
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </div>

        {llamadas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 p-4 text-center text-xs text-muted-foreground">
            A la espera de operaciones · Hacé clic en una butaca o ejecutá una simulación para observar las llamadas al SDK en tiempo real.
          </div>
        ) : (
          <div className="max-h-56 overflow-y-auto rounded-xl border border-border/70 bg-background/90 p-3 font-mono text-[11px] space-y-2">
            {llamadas.slice(0, 15).map((l, idx) => (
              <div key={idx} className="flex flex-col border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                  <span>{new Date(l.t).toLocaleTimeString()}</span>
                  <span className={l.error ? 'text-destructive font-semibold' : 'text-emerald-400 font-semibold'}>
                    {l.ms} ms {l.error ? '✕ SIN STOCK' : '✓ RESERVADA'}
                  </span>
                </div>
                <div className="text-zinc-300 truncate">
                  <code>{l.expresion}</code>
                </div>
                {!l.error && l.resultado && (
                  <div className="text-muted-foreground text-[10px]">
                    → {l.resultado}
                  </div>
                )}
              </div>
            ))}
            {llamadas.length > 15 && (
              <div className="text-center text-[10px] text-muted-foreground pt-1">
                + {llamadas.length - 15} operaciones adicionales procesadas.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Simplificación de Código */}
      <CodeComparison />
    </div>
  )
}
