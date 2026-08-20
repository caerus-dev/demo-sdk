import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Checkout } from '@/components/checkout'
import { RegistroCaerus } from '@/components/registro-caerus'
import { IdentidadUsuario } from '@/components/identidad-usuario'

export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8">
      <Link
        href={`/funcion/${id}`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Volver al mapa de butacas
      </Link>
      <h1 className="mb-6 font-display text-3xl font-bold text-foreground text-balance">
        Finalizá tu compra
      </h1>
      <IdentidadUsuario className="mb-6" />
      <Checkout funcionId={id} />
      <RegistroCaerus className="mt-8" />
    </main>
  )
}
