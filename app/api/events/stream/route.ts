import { getWebhookHistory, subscribeToEvents, type WebhookEventLog } from '@/lib/event-bus'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const encoder = new TextEncoder()
  // Padding comment (~2KB) forces proxies/tunnels to flush each SSE frame immediately
  const pad = `: ${' '.repeat(2048)}\n\n`

  const stream = new ReadableStream({
    start(controller) {
      const sentIds = new Set<string>()

      // 1. Enviar el historial previo + padding para abrir el stream
      const initialHistory = getWebhookHistory()
      for (const item of initialHistory) {
        sentIds.add(item.id)
      }
      const initMessage = `${pad}event: init\ndata: ${JSON.stringify(initialHistory)}\n\n`
      controller.enqueue(encoder.encode(initMessage))

      const sendEvent = (event: WebhookEventLog) => {
        if (sentIds.has(event.id)) return
        sentIds.add(event.id)
        const message = `event: webhook\ndata: ${JSON.stringify(event)}\n\n${pad}`
        controller.enqueue(encoder.encode(message))
      }

      // 2. Suscribirse a nuevos eventos entrantes en memoria (0ms)
      const unsubscribe = subscribeToEvents((event: WebhookEventLog) => {
        try {
          sendEvent(event)
        } catch {
          unsubscribe()
        }
      })

      // 3. Sincronización entre workers de Next.js dev (cada 800ms) + Heartbeat
      let ticks = 0
      const interval = setInterval(() => {
        try {
          const latest = getWebhookHistory()
          // Recorrer de más viejo a más nuevo para respetar el orden de llegada
          for (let i = latest.length - 1; i >= 0; i--) {
            const ev = latest[i]
            if (ev && !sentIds.has(ev.id)) {
              sendEvent(ev)
            }
          }
          ticks++
          if (ticks % 12 === 0) {
            controller.enqueue(encoder.encode(`: heartbeat\n\n${pad}`))
          }
        } catch {
          clearInterval(interval)
          unsubscribe()
        }
      }, 800)

      // 4. Limpieza cuando el cliente cierra la pestaña o aborta
      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        unsubscribe()
        try {
          controller.close()
        } catch {
          // Silencioso
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, no-transform, must-revalidate',
      'Content-Encoding': 'none',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
