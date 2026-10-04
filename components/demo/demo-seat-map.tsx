'use client'

import { useState } from 'react'
import { AlertTriangle, Users } from 'lucide-react'

export type DemoSeatStatus = 'available' | 'booked' | 'held' | 'abandoned'

export interface DemoSeatInfo {
  key: string
  col: string
  row: number
  precio?: number
  status: DemoSeatStatus
  isDoubleBooked?: boolean
  buyers?: string[]
}

interface DemoSeatMapProps {
  seats: Record<string, DemoSeatInfo>
  modo: 'broken' | 'fixed'
  funcionId?: string
  onSeatClick?: (seatKey: string) => void
  cargandoKey?: string | null
}

const COLS = ['A', 'B', 'C', 'D', 'E', 'F']
const ROWS = [1, 2, 3, 4, 5]
const SEAT = 40
const GAP = 12
const PAD_X = 36
const PAD_TOP = 88
const GRID_W = COLS.length * SEAT + (COLS.length - 1) * GAP
const VIEW_W = GRID_W + PAD_X * 2
const VIEW_H = PAD_TOP + ROWS.length * SEAT + (ROWS.length - 1) * GAP + 24

export function DemoSeatMap({
  seats,
  modo,
  funcionId = 'horizonte',
  onSeatClick,
  cargandoKey,
}: DemoSeatMapProps) {
  const isBroken = modo === 'broken'

  return (
    <div className="flex flex-col items-center rounded-2xl border border-border/80 bg-card/70 p-6 shadow-md backdrop-blur">
      <div className="mb-3 flex w-full items-center justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Mapa de la Sala
          </span>
          <p className="text-sm font-medium text-foreground">
            30 butacas · Zona central destacada (mayor demanda)
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background/80 px-2.5 py-1 text-xs text-muted-foreground">
          <Users className="size-3.5 text-primary" />
          <span>Fila 1 (adelante) a 5 (fondo)</span>
        </div>
      </div>

      {/* SVG Sala */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="mx-auto max-h-[480px] w-full min-w-[320px] select-none"
          aria-label="Mapa de butacas de cine"
        >
          {/* Pantalla Curva */}
          <path
            d={`M ${PAD_X} 44 Q ${VIEW_W / 2} 18 ${VIEW_W - PAD_X} 44`}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="opacity-80"
          />
          <text
            x={VIEW_W / 2}
            y={30}
            textAnchor="middle"
            className="fill-muted-foreground font-mono text-[11px] font-semibold tracking-widest"
          >
            ━━ PANTALLA ━━
          </text>

          {/* Columnas A-F */}
          {COLS.map((c, ci) => (
            <text
              key={c}
              x={PAD_X + ci * (SEAT + GAP) + SEAT / 2}
              y={PAD_TOP - 14}
              textAnchor="middle"
              className="fill-muted-foreground font-mono text-[11px] font-bold"
            >
              {c}
            </text>
          ))}

          {/* Zona Caliente (Highlight de las filas centrales 3 y 4) */}
          <rect
            x={PAD_X - 10}
            y={PAD_TOP + 2 * (SEAT + GAP) - 6}
            width={GRID_W + 20}
            height={2 * (SEAT + GAP)}
            rx={16}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={1}
            strokeDasharray="4 4"
            className="opacity-25"
          />

          {/* Butacas */}
          {ROWS.map((r, ri) =>
            COLS.map((c, ci) => {
              const key = `funcion${funcionId}_${c}${r}`
              const seat = seats[key] ?? {
                key,
                col: c,
                row: r,
                status: 'available',
                isDoubleBooked: false,
                buyers: [],
              }

              const x = PAD_X + ci * (SEAT + GAP)
              const y = PAD_TOP + ri * (SEAT + GAP)

              const isDouble = Boolean(seat.isDoubleBooked && seat.buyers && seat.buyers.length > 1)
              const isHeld = seat.status === 'held'
              const isAbandoned = seat.status === 'abandoned'
              const isBooked = seat.status === 'booked' || Boolean(seat.buyers && seat.buyers.length > 0 && !isHeld && !isAbandoned)
              const isLoading = cargandoKey === key

              let fill = 'var(--secondary)'
              let stroke = 'var(--border)'
              let textColor = 'var(--muted-foreground)'

              if (isDouble) {
                // 🚨 Sobreventa
                fill = 'color-mix(in oklch, var(--destructive) 85%, var(--card))'
                stroke = 'var(--destructive)'
                textColor = 'white'
              } else if (isAbandoned) {
                // 🔒 Bloqueada por abandono
                fill = 'color-mix(in oklch, #f59e0b 25%, var(--card))'
                stroke = '#f59e0b'
                textColor = '#f59e0b'
              } else if (isHeld) {
                // 🛒 En carrito / selección
                fill = 'var(--primary)'
                stroke = 'var(--primary)'
                textColor = 'var(--primary-foreground)'
              } else if (isBooked) {
                // 🟢 Vendida (verde confirmado)
                fill = '#10b981'
                stroke = '#059669'
                textColor = 'white'
              }

              const canClick = onSeatClick && !isBooked && !isAbandoned && !isLoading

              return (
                <g
                  key={key}
                  onClick={() => canClick && onSeatClick(key)}
                  style={{ cursor: canClick ? 'pointer' : 'default' }}
                >
                  <rect
                    x={x}
                    y={y}
                    width={SEAT}
                    height={SEAT}
                    rx={9}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isDouble ? 2.5 : isHeld ? 2 : 1.5}
                    className={isDouble ? 'animate-pulse' : ''}
                  />

                  {/* Icono de Alerta, Candado o Etiqueta de Butaca */}
                  {isDouble ? (
                    <text
                      x={x + SEAT / 2}
                      y={y + SEAT / 2 + 4}
                      textAnchor="middle"
                      className="fill-white font-mono text-[11px] font-black"
                    >
                      ⚠️
                    </text>
                  ) : isAbandoned ? (
                    <text
                      x={x + SEAT / 2}
                      y={y + SEAT / 2 + 4}
                      textAnchor="middle"
                      className="fill-amber-400 font-mono text-[10px] font-bold"
                    >
                      🔒
                    </text>
                  ) : (
                    <text
                      x={x + SEAT / 2}
                      y={y + SEAT / 2 + 4}
                      textAnchor="middle"
                      fill={textColor}
                      className="font-mono text-[10px] font-semibold"
                    >
                      {isLoading ? '···' : `${c}${r}`}
                    </text>
                  )}
                </g>
              )
            }),
          )}
        </svg>
      </div>



      {/* Referencias / Leyenda */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="size-3.5 rounded-md border border-border bg-secondary" />
          <span>Disponible</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-3.5 rounded-md border border-primary bg-primary" />
          <span>En Carrito / Selección</span>
        </div>
        {isBroken && (
          <div className="flex items-center gap-2">
            <span className="size-3.5 rounded-md border border-amber-500 bg-amber-500/30" />
            <span className="text-amber-400 font-medium">🔒 Bloqueada (Carrito abandonado)</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="size-3.5 rounded-md border border-emerald-500 bg-emerald-500/80" />
          <span>Vendida</span>
        </div>
        {isBroken && (
          <div className="flex items-center gap-2">
            <span className="size-3.5 rounded-md border border-destructive bg-destructive/80 animate-pulse" />
            <span className="font-bold text-destructive">⚠️ Sobreventa</span>
          </div>
        )}
      </div>
    </div>
  )
}
