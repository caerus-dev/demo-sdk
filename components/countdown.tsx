'use client'

import { useEffect, useRef, useState } from 'react'
import { Timer } from 'lucide-react'
import { formatRestante } from '@/lib/client'
import { cn } from '@/lib/utils'

export function Countdown({
  expiresAt,
  onExpire,
  className,
  size = 'md',
}: {
  expiresAt: string | null
  onExpire?: () => void
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const [restante, setRestante] = useState<number>(() =>
    expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0,
  )
  const disparado = useRef(false)
  useEffect(() => {
    disparado.current = false
    if (!expiresAt) {
      setRestante(0)
      return
    }
    const target = new Date(expiresAt).getTime()
    const tick = () => {
      const ms = target - Date.now()
      setRestante(ms)
      if (ms <= 0 && !disparado.current) {
        disparado.current = true
        onExpire?.()
      }
    }
    tick()
    const iv = setInterval(tick, 250)
    return () => clearInterval(iv)
  }, [expiresAt, onExpire])
  if (!expiresAt) return null

  const agotando = restante <= 30_000
  const sizes = {
    sm: 'text-sm px-2.5 py-1 gap-1.5',
    md: 'text-base px-3 py-1.5 gap-2',
    lg: 'text-2xl px-4 py-2 gap-2.5',
  }
  return (
    <span
      role="timer"
      aria-live="polite"
      className={cn(
        'inline-flex items-center rounded-lg border font-semibold tabular-nums transition-colors',
        agotando
          ? 'border-destructive/50 bg-destructive/15 text-destructive'
          : 'border-primary/40 bg-primary/10 text-primary',
        sizes[size],
        className,
      )}
    >
      <Timer className={cn(size === 'lg' ? 'size-6' : 'size-4')} aria-hidden="true" />
      {formatRestante(restante)}
    </span>
  )
}
