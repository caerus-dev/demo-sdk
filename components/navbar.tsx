import Link from 'next/link'
import { Clapperboard, Sparkles } from 'lucide-react'

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/demo" className="flex items-center gap-2.5">
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
        <div className="flex items-center gap-2.5">
          <Link
            href="/demo"
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3.5 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            <span>Demo Concurrencia</span>
          </Link>
        </div>
      </div>
    </header>
  )
}
