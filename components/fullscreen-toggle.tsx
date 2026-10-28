'use client'

import { useEffect, useState } from 'react'
import { Maximize, Minimize } from 'lucide-react'

export function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setIsSupported(Boolean(document.fullscreenEnabled))
      setIsFullscreen(Boolean(document.fullscreenElement))

      const handleFullscreenChange = () => {
        setIsFullscreen(Boolean(document.fullscreenElement))
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        // Ignorar si el usuario está escribiendo en un input, textarea o selector
        const target = e.target as HTMLElement | null
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable ||
            target.closest('input') ||
            target.closest('textarea'))
        ) {
          return
        }

        if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault()
          toggle()
        }
      }

      document.addEventListener('fullscreenchange', handleFullscreenChange)
      window.addEventListener('keydown', handleKeyDown)

      return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange)
        window.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [])

  const toggle = () => {
    if (typeof document === 'undefined') return

    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {})
    }
  }

  if (!isSupported) {
    return null
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={isFullscreen ? 'Salir de pantalla completa (Esc o F)' : 'Pantalla completa (F)'}
      aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground cursor-pointer"
    >
      {isFullscreen ? (
        <Minimize className="size-4" aria-hidden="true" />
      ) : (
        <Maximize className="size-4" aria-hidden="true" />
      )}
    </button>
  )
}
