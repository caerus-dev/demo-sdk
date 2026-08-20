'use client'

import { useEffect, useState } from 'react'
import { UserRound, RefreshCw } from 'lucide-react'
import { nombreDeUsuario, nuevoUsuario } from '@/lib/client'
import { cn } from '@/lib/utils'

export function IdentidadUsuario({ className }: { className?: string }) {
  const [nombre, setNombre] = useState('')

  useEffect(() => {
    setNombre(nombreDeUsuario())
  }, [])

  if (!nombre) return null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm',
        className,
      )}
    >
      <UserRound className="size-4 text-primary" aria-hidden="true" />
      <span className="text-muted-foreground">Estás comprando como</span>
      <span className="font-semibold text-foreground">{nombre}</span>
      <button
        type="button"
        onClick={nuevoUsuario}
        title="Genera una identidad nueva en esta ventana y suelta la selección guardada"
        className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
      >
        <RefreshCw className="size-3.5" aria-hidden="true" />
        Ser otro usuario
      </button>
    </div>
  )
}
