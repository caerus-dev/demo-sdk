'use client'

import { useState, useEffect } from 'react'
import { DemoHeader } from '@/components/demo/demo-header'
import { DemoSeatMap, type DemoSeatInfo } from '@/components/demo/demo-seat-map'
import { ConcurrencySimulator } from '@/components/demo/concurrency-simulator'
import { ConflictMetrics, type ConflictMetricsData } from '@/components/demo/conflict-metrics'
import { SeatLifecycleCard } from '@/components/demo/seat-lifecycle-card'

export default function BrokenDemoPage() {
  const [seats, setSeats] = useState<Record<string, DemoSeatInfo>>({})
  const [metrics, setMetrics] = useState<ConflictMetricsData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [cargandoKey, setCargandoKey] = useState<string | null>(null)
  const [selectedSeatKey, setSelectedSeatKey] = useState<string | null>(null)
  const [isProcessingLifecycle, setIsProcessingLifecycle] = useState(false)

  // Cargar estado inicial de butacas
  useEffect(() => {
    fetch('/api/demo/broken/seats?funcionId=horizonte')
      .then((r) => r.json())
      .then((data) => {
        if (data.seats) setSeats(data.seats)
        if (data.metrics) setMetrics(data.metrics)
      })
      .catch((err) => console.error('Error cargando butacas iniciales:', err))
  }, [])

  // Selección individual al hacer clic en una butaca
  const handleSeatClick = async (seatKey: string) => {
    const seat = seats[seatKey]
    if (!seat || seat.status === 'booked' || seat.status === 'abandoned' || isLoading || cargandoKey) return

    setCargandoKey(seatKey)
    try {
      const res = await fetch('/api/demo/broken/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatKey, action: 'hold', userName: 'Tu Selección' }),
      })
      const data = await res.json()
      if (data.seats) setSeats(data.seats)
      if (data.metrics) setMetrics(data.metrics)
      setSelectedSeatKey(seatKey)
    } catch (err) {
      console.error('Error seleccionando butaca:', err)
    } finally {
      setCargandoKey(null)
    }
  }

  // Confirmar compra individual
  const handleConfirmSelected = async () => {
    if (!selectedSeatKey) return
    setIsProcessingLifecycle(true)
    try {
      const res = await fetch('/api/demo/broken/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatKey: selectedSeatKey, action: 'confirm', userName: 'Comprador Confirmado' }),
      })
      const data = await res.json()
      if (data.seats) setSeats(data.seats)
      if (data.metrics) setMetrics(data.metrics)
      setSelectedSeatKey(null)
    } catch (err) {
      console.error('Error confirmando compra:', err)
    } finally {
      setIsProcessingLifecycle(false)
    }
  }

  // Simular abandono de carrito (queda bloqueada indefinidamente)
  const handleAbandonSelected = async () => {
    if (!selectedSeatKey) return
    setIsProcessingLifecycle(true)
    try {
      const res = await fetch('/api/demo/broken/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatKey: selectedSeatKey, action: 'abandon' }),
      })
      const data = await res.json()
      if (data.seats) setSeats(data.seats)
      if (data.metrics) setMetrics(data.metrics)
      setSelectedSeatKey(null)
    } catch (err) {
      console.error('Error simulando abandono:', err)
    } finally {
      setIsProcessingLifecycle(false)
    }
  }

  // Cancelar selección
  const handleReleaseSelected = async () => {
    if (!selectedSeatKey) return
    setIsProcessingLifecycle(true)
    try {
      const res = await fetch('/api/demo/broken/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatKey: selectedSeatKey, action: 'release' }),
      })
      const data = await res.json()
      if (data.seats) setSeats(data.seats)
      if (data.metrics) setMetrics(data.metrics)
      setSelectedSeatKey(null)
    } catch (err) {
      console.error('Error liberando selección:', err)
    } finally {
      setIsProcessingLifecycle(false)
    }
  }

  // Simulación masiva concurrente
  const handleSimulate = async (userCount: number) => {
    setIsLoading(true)
    setSelectedSeatKey(null)
    try {
      const res = await fetch('/api/demo/broken/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userCount, funcionId: 'horizonte' }),
      })
      const data = await res.json()
      if (data.seats) setSeats(data.seats)
      if (data.metrics) setMetrics(data.metrics)
    } catch (err) {
      console.error('Error simulando concurrencia:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Reiniciar sala
  const handleReset = async () => {
    setIsLoading(true)
    setSelectedSeatKey(null)
    try {
      const res = await fetch('/api/demo/broken/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funcionId: 'horizonte' }),
      })
      const data = await res.json()
      if (data.seats) setSeats(data.seats)
      if (data.metrics) setMetrics(data.metrics)
    } catch (err) {
      console.error('Error reiniciando sala:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const selectedSeat = selectedSeatKey ? seats[selectedSeatKey] : null

  return (
    <div className="flex flex-col gap-6">
      <DemoHeader modo="broken" />

      {/* Panel de Inyección Concurrente */}
      <ConcurrencySimulator
        onSimulate={handleSimulate}
        onReset={handleReset}
        isLoading={isLoading}
        modo="broken"
      />

      {/* Métricas de Conflicto y Sobreventa */}
      <ConflictMetrics metrics={metrics} modo="broken" />

      {/* Tarjeta de Ciclo de Vida cuando hay un asiento seleccionado */}
      {selectedSeat && (
        <SeatLifecycleCard
          seatKey={selectedSeat.key}
          col={selectedSeat.col}
          row={selectedSeat.row}
          precio={4500}
          modo="broken"
          onConfirm={handleConfirmSelected}
          onAbandon={handleAbandonSelected}
          onRelease={handleReleaseSelected}
          isProcessing={isProcessingLifecycle}
        />
      )}

      {/* Visualización de la Sala con Butacas Duplicadas */}
      <DemoSeatMap
        seats={seats}
        modo="broken"
        funcionId="horizonte"
        onSeatClick={handleSeatClick}
        cargandoKey={cargandoKey}
      />
    </div>
  )
}
