'use client'

import { useEffect, useState } from 'react'
import { User, ArrowRightLeft, RotateCcw, Loader2 } from 'lucide-react'
import {
  cambiarUsuario,
  getUsuarioActual,
  limpiarTodasLasCompras,
  rotarSiguienteUsuario,
  USUARIOS_DEMO,
  type UsuarioDemo,
} from '@/lib/client'
import { cn } from '@/lib/utils'

export function NavbarUser() {
  const [actual, setActual] = useState<UsuarioDemo | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [reseteando, setReseteando] = useState(false)

  useEffect(() => {
    setActual(getUsuarioActual())
  }, [])

  async function handleReset() {
    if (
      !window.confirm(
        '¿Reiniciar todo el cine en Caerus a los valores por defecto de config/sala.json? Esto liberará reservas en curso, borrará ventas y recreará las 30 butacas y productos limpios.',
      )
    ) {
      return
    }
    setReseteando(true)
    try {
      const res = await fetch('/api/cine/reset', { method: 'POST' })
      if (res.ok) {
        limpiarTodasLasCompras()
        for (const k of Object.keys(sessionStorage)) {
          if (k.startsWith('caerus_reserva_') || k.startsWith('caerus_intento_')) {
            sessionStorage.removeItem(k)
          }
        }
        window.location.reload()
      } else {
        alert('Hubo un error al reiniciar el estado en Caerus.')
      }
    } catch {
      alert('Error de conexión al intentar reiniciar.')
    } finally {
      setReseteando(false)
    }
  }

  if (!actual) return null

  return (
    <div className="relative flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setAbierto((prev) => !prev)}
        title="Cambiar usuario para prueba multi-pestaña / multi-PC"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer',
          actual.colorBadge,
          'hover:opacity-90',
        )}
      >
        <User className="size-3.5 shrink-0" />
        <span>{actual.nombre}</span>
        <span className="text-[10px] opacity-75 hidden sm:inline">({actual.rol})</span>
      </button>

      {abierto && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setAbierto(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-1.5 w-56 rounded-xl border border-border bg-card p-2 shadow-xl animate-in fade-in-0 zoom-in-95">
            <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/60 pb-1.5 mb-1.5">
              Simular Usuario (Multi-PC)
            </div>
            <div className="space-y-1">
              {USUARIOS_DEMO.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setAbierto(false)
                    cambiarUsuario(u.id)
                  }}
                  className={cn(
                    'w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left font-medium transition-colors cursor-pointer',
                    u.id === actual.id
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'size-2 rounded-full',
                        u.id === 'user_ana'
                          ? 'bg-emerald-400'
                          : u.id === 'user_beto'
                            ? 'bg-indigo-400'
                            : u.id === 'user_carlos'
                              ? 'bg-amber-400'
                              : 'bg-purple-400',
                      )}
                    />
                    {u.nombre}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{u.rol}</span>
                </button>
              ))}
            </div>

            <div className="border-t border-border/60 pt-1.5 mt-2">
              <button
                type="button"
                disabled={reseteando}
                onClick={handleReset}
                title="Borra reservas y ventas en Caerus y recrea las salas desde config/sala.json"
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10 font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                {reseteando ? (
                  <Loader2 className="size-3.5 animate-spin shrink-0" />
                ) : (
                  <RotateCcw className="size-3.5 shrink-0" />
                )}
                <span>{reseteando ? 'Reiniciando Caerus…' : 'Resetear estado del Cine'}</span>
              </button>
            </div>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={rotarSiguienteUsuario}
        title="Rotar al siguiente usuario (1 clic)"
        className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-secondary/40 text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors cursor-pointer"
      >
        <ArrowRightLeft className="size-3.5" />
      </button>
    </div>
  )
}
