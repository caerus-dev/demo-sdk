import { Backoffice } from '@/components/backoffice'

export const metadata = {
  title: 'Backoffice · Caerus Cine',
  description: 'Gestión de funciones, candy bar y reinicio del entorno de demo.',
}

export default function BackofficePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold text-foreground text-balance">
          Backoffice
        </h1>
        <p className="mt-1 text-muted-foreground text-pretty">
          Administrá funciones, stock del candy bar y el estado general de la sala para la demo.
        </p>
      </header>
      <Backoffice />
    </main>
  )
}
