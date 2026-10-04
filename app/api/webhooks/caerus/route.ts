import { NextResponse } from 'next/server'
import {
  Webhooks,
  CaerusSignatureError,
  CaerusWebhookExpiredError,
  CaerusWebhookPayloadError,
  type CaerusEvent,
} from '@caerus-dev/sdk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export interface WebhookEventLog {
  id: string
  eventType: string
  displayTitle: string
  objectId?: string
  occurredAt: string
  receivedAt: string
  dataSummary: string
  verified: boolean
  raw: Record<string, unknown>
}

const globalWebhookState = globalThis as unknown as { __caerusWebhooks?: WebhookEventLog[] }

function getWebhookList(): WebhookEventLog[] {
  if (!globalWebhookState.__caerusWebhooks) {
    globalWebhookState.__caerusWebhooks = []
  }
  return globalWebhookState.__caerusWebhooks
}

const sdkWebhooks = new Webhooks()

/**
 * Webhook Receiver para Caerus
 * Ruta: /api/webhooks/caerus
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const signatureHeader =
      req.headers.get('caerus-signature') ??
      req.headers.get('x-caerus-signature') ??
      ''
    const secret = process.env.CAERUS_WEBHOOK_SECRET?.trim()
    const isSimulation = req.headers.get('x-demo-simulation') === 'true'

    let event: CaerusEvent | null = null
    let parsedBody: Record<string, unknown> = {}
    let isVerified = false

    if (secret && !isSimulation) {
      try {
        event = sdkWebhooks.constructEvent(rawBody, signatureHeader, secret)
        isVerified = true
      } catch (err) {
        if (err instanceof CaerusSignatureError) {
          console.error('[Caerus Webhook] ❌ Firma inválida:', err.message)
          return NextResponse.json(
            { error: 'Firma de webhook inválida' },
            { status: 400 },
          )
        }
        if (err instanceof CaerusWebhookExpiredError) {
          console.error('[Caerus Webhook] ❌ Timestamp expirado:', err.message)
          return NextResponse.json(
            { error: 'Timestamp de webhook expirado' },
            { status: 400 },
          )
        }
        if (err instanceof CaerusWebhookPayloadError) {
          console.error('[Caerus Webhook] ❌ Payload JSON malformado:', err.message)
          return NextResponse.json(
            { error: 'Payload JSON inválido' },
            { status: 400 },
          )
        }
        throw err
      }
    } else {
      try {
        parsedBody = JSON.parse(rawBody)
      } catch {
        parsedBody = { raw: rawBody }
      }
    }

    const eventType = String(
      event?.eventType ??
      req.headers.get('x-caerus-event') ??
      parsedBody.eventType ??
      parsedBody.type ??
      'unknown'
    )
    const rawData = (event?.data ?? parsedBody.data ?? {}) as Record<string, unknown>
    const resourceKey = String(
      rawData.resourceKey ??
      rawData.resource_key ??
      event?.objectId ??
      parsedBody.objectId ??
      ''
    )

    let seatLabel = ''
    const match = /funcion.+_([A-Z]\d+)/.exec(resourceKey)
    if (match) {
      seatLabel = `Butaca ${match[1]}`
    } else if (resourceKey && !resourceKey.includes('-')) {
      seatLabel = `Butaca ${resourceKey.replace(/^funcion[a-z]+_/, '')}`
    } else {
      seatLabel = 'Butaca'
    }

    let displayTitle = ''
    let dataSummary = ''

    if (eventType === 'resource.expired') {
      displayTitle = '⏱️ Carrito Expirado'
      dataSummary = `Tiempo agotado: ${seatLabel} liberada automáticamente para nuevos compradores.`
    } else if (eventType === 'resource.taken') {
      displayTitle = '🛒 Reserva en Curso'
      dataSummary = `${seatLabel} retenida temporalmente por 30 segundos.`
    } else if (eventType === 'resource.released') {
      displayTitle = '🔓 Reserva Cancelada'
      dataSummary = `${seatLabel} liberada y disponible para la venta.`
    } else if (eventType === 'resource.confirmed') {
      displayTitle = '✅ Compra Concretada'
      dataSummary = `Entrada emitida para ${seatLabel}.`
    } else {
      displayTitle = '⚡ Notificación Caerus'
      dataSummary = `Evento ${eventType} procesado.`
    }

    const eventEntry: WebhookEventLog = {
      id: String(
        event?.id ??
        parsedBody.id ??
        parsedBody.eventId ??
        `wh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      ),
      eventType,
      displayTitle,
      objectId: resourceKey,
      occurredAt: String(event?.occurredAt ?? parsedBody.occurredAt ?? new Date().toISOString()),
      receivedAt: new Date().toLocaleTimeString('es-AR'),
      dataSummary,
      verified: isVerified,
      raw: (event as unknown as Record<string, unknown>) ?? parsedBody,
    }

    const list = getWebhookList()
    list.unshift(eventEntry)
    if (list.length > 20) {
      list.pop()
    }

    console.log(`[Caerus Webhook] 🔔 Evento recibido: ${eventType} (${dataSummary})`)

    return NextResponse.json({
      received: true,
      event: eventType,
      verified: isVerified,
      processedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Caerus Webhook] Error procesando webhook:', error)
    return NextResponse.json(
      { error: 'Error procesando webhook' },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    events: getWebhookList(),
  })
}

export async function DELETE() {
  globalWebhookState.__caerusWebhooks = []
  return NextResponse.json({
    success: true,
    cleared: true,
    events: [],
  })
}
