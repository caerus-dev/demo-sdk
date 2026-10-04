export default function DemoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8">
      {children}
    </main>
  )
}
