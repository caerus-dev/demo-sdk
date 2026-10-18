'use client'

import { useEffect, useState } from 'react'
import { UserRound, Users, ArrowRightLeft } from 'lucide-react'
import {
  cambiarUsuario,
  getUsuarioActual,
  rotarSiguienteUsuario,
  USUARIOS_DEMO,
  type UsuarioDemo,
} from '@/lib/client'
import { cn } from '@/lib/utils'

export function IdentidadUsuario({ className }: { className?: string }) {
  const [actual, setActual] = useState<UsuarioDemo | null>(null)

  useEffect(() => {
    setActual(getUsuarioActual())
  }, [])

  if (!actual) return null

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-secondary/30 px-3.5 py-2.5 text-sm shadow-sm',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <UserRound className="size-4 text-primary shrink-0" aria-hidden="true" />
        <span className="text-muted-foreground text-xs sm:text-sm">Identidad en esta ventana:</span>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border',
            actual.colorBadge,
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {actual.nombre} ({actual.rol})
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-muted-foreground hidden md:inline">Cambiar a:</span>
        {USUARIOS_DEMO.map((u) => (
          <button
            key={u.id}
            type="button"
            onClick={() => cambiarUsuario(u.id)}
            disabled={u.id === actual.id}
            title={`Simular sesión como ${u.nombre}`}
            className={cn(
              'rounded-md border px-2 py-1 text-xs font-medium transition-colors cursor-pointer',
              u.id === actual.id
                ? 'border-primary/60 bg-primary/10 text-primary font-bold opacity-100 cursor-default'
                : 'border-border/70 bg-card text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            {u.nombre.split(' ')[0]} ({u.rol.replace('Usuario ', 'U')})
          </button>
        ))}
        <button
          type="button"
          onClick={rotarSiguienteUsuario}
          title="Rotar al siguiente usuario de prueba"
          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary cursor-pointer"
        >
          <ArrowRightLeft className="size-3" aria-hidden="true" />
          Rotar
        </button>
      </div>
    </div>
  )
}
