import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { SeatMap } from '@/components/seat-map'
import { FuncionHeader } from '@/components/funcion-header'
import { RegistroCaerus } from '@/components/registro-caerus'
import { IdentidadUsuario } from '@/components/identidad-usuario'

export default async function FuncionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Volver a la cartelera
      </Link>
      <FuncionHeader funcionId={id} />
      <IdentidadUsuario className="mb-6" />
      <SeatMap funcionId={id} />
      <RegistroCaerus className="mt-8" />
    </main>
  )
}
