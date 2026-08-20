import Link from 'next/link'
import { Clapperboard, SlidersHorizontal } from 'lucide-react'

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Clapperboard className="size-5" aria-hidden="true" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-lg font-semibold tracking-tight text-foreground">
              Caerus Cine
            </span>
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
              demo de concurrencia
            </span>
          </span>
        </Link>
        <Link
          href="/backoffice"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Backoffice
        </Link>
      </div>
    </header>
  )
}
