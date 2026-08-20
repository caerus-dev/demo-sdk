import { CarteleraList } from '@/components/cartelera-list'

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10">
      <section className="mb-10">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-primary">
          Concurrencia en vivo
        </p>
        <h1 className="text-balance font-display text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
          Cartelera
        </h1>
        <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
          Elegí una función y reservá tus butacas. Las reservas duran unos minutos y se
          liberan solas si nadie paga. Abrí esta demo en dos pestañas y mirá cómo se ocupan
          las butacas en tiempo real, y qué pasa cuando dos personas quieren la misma.
        </p>
      </section>
      <CarteleraList />
    </main>
  )
}
