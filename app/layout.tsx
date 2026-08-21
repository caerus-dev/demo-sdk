import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Space_Grotesk } from 'next/font/google'
import { Navbar } from '@/components/navbar'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' })

export const metadata: Metadata = {
  title: 'Caerus Cine — demo de concurrencia',
  description:
    'Demo de cine que muestra reservas concurrentes: butacas que se toman por un rato, se liberan solas y entran en conflicto cuando dos personas quieren lo mismo.',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#1a1712',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`dark ${geist.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-dvh bg-background font-sans antialiased">
        <Navbar />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
