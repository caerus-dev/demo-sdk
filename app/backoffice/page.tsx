import { Backoffice } from '@/components/backoffice'

export const metadata = {
  title: 'Backoffice · Caerus Cine',
  description: 'Gestión de funciones, candy bar y auditoría de reservas en vivo.',
}

export default function BackofficePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold text-foreground text-balance">
          Backoffice
        </h1>
        <p className="mt-1 text-muted-foreground text-pretty">
          Cargá funciones y productos, y seguí en vivo cómo Caerus reserva, confirma y libera cada
          recurso.
        </p>
      </header>
      <Backoffice />
    </main>
  )
}
