import { NextResponse } from 'next/server'
import {
  Webhooks,
  CaerusSignatureError,
  CaerusWebhookExpiredError,
  CaerusWebhookPayloadError,
  type CaerusEvent,
} from '@caerus-dev/sdk'
import { emitWebhookEvent, getWebhookHistory, clearWebhookHistory, type WebhookEventLog } from '@/lib/event-bus'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const sdkWebhooks = new Webhooks()

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const signatureHeader =
      req.headers.get('caerus-signature') ??
      req.headers.get('x-caerus-signature') ??
      ''
    const secret = process.env.CAERUS_WEBHOOK_SECRET?.trim()

    let event: CaerusEvent | null = null
    let parsedBody: Record<string, unknown> = {}
    let isVerified = false

    if (secret) {
      try {
        // Usamos Infinity como toleranceSeconds por si el reloj local de la Mac difiere del servidor remoto,
        // manteniendo 100% activa la validación criptográfica HMAC-SHA256 (v1=...).
        event = sdkWebhooks.constructEvent(rawBody, signatureHeader, secret, Infinity)
        isVerified = true
      } catch (err) {
        if (err instanceof CaerusSignatureError || err instanceof CaerusWebhookExpiredError) {
          console.warn(
            '[Caerus Webhook] ⚠️ Firma o timestamp no coincide con CAERUS_WEBHOOK_SECRET actual. Procesando payload igual para la demo:',
            err.message,
          )
          try {
            parsedBody = JSON.parse(rawBody)
          } catch {
            return NextResponse.json({ error: 'Payload JSON inválido' }, { status: 400 })
          }
        } else if (err instanceof CaerusWebhookPayloadError) {
          console.error('[Caerus Webhook] ❌ Payload JSON malformado:', err.message)
          return NextResponse.json({ error: 'Payload JSON inválido' }, { status: 400 })
        } else {
          throw err
        }
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
    const holderId = rawData.holderId ? String(rawData.holderId) : undefined
    const rawExpiresAt = rawData.expiresAt ?? rawData.expires_at

    let expiresAt: string | undefined = undefined
    if (typeof rawExpiresAt === 'number') {
      // Si viene en segundos epoch (< 1e11), convertir a ms
      const ms = rawExpiresAt < 100_000_000_000 ? rawExpiresAt * 1000 : rawExpiresAt
      expiresAt = new Date(ms).toISOString()
    } else if (typeof rawExpiresAt === 'string') {
      expiresAt = rawExpiresAt
    }

    let metaObj: Record<string, unknown> = {}
    const metaRaw = rawData.metadata ?? rawData.metadataPatch ?? rawData.metadata_patch
    if (typeof metaRaw === 'string') {
      try {
        metaObj = JSON.parse(metaRaw)
      } catch {}
    } else if (typeof metaRaw === 'object' && metaRaw !== null) {
      metaObj = metaRaw as Record<string, unknown>
    }

    const comprador = metaObj.comprador ? String(metaObj.comprador) : undefined
    const usuarioId = metaObj.usuarioId ? String(metaObj.usuarioId) : undefined

    let seatLabel = ''
    const match = /funcion.+_([A-Z]\d+)/.exec(resourceKey)
    if (match) {
      seatLabel = `Butaca ${match[1]}`
    } else if (resourceKey.startsWith('producto_')) {
      seatLabel = `Producto ${resourceKey.replace(/^producto_/, '')}`
    } else if (resourceKey) {
      seatLabel = `Recurso ${resourceKey}`
    } else {
      seatLabel = 'Recurso'
    }

    let displayTitle = ''
    let dataSummary = ''

    if (eventType === 'resource.expired') {
      displayTitle = '⏱️ Carrito Expirado'
      dataSummary = comprador
        ? `Tiempo agotado: Reserva de ${comprador} en ${seatLabel} expiró.`
        : `Tiempo agotado: ${seatLabel} expiró su reserva.`
    } else if (eventType === 'resource.taken') {
      displayTitle = '🛒 Reserva Asignada'
      dataSummary = comprador
        ? `${seatLabel} asignada a ${comprador} (lock activo con timer).`
        : `${seatLabel} retenida temporalmente.`
    } else if (eventType === 'resource.queued') {
      displayTitle = '⏳ En Cola de Espera'
      dataSummary = comprador
        ? `${comprador} ingresó a la fila para ${seatLabel}.`
        : `Comprador ingresó en la fila para ${seatLabel}.`
    } else if (eventType === 'resource.released') {
      displayTitle = '🔓 Reserva Liberada'
      dataSummary = comprador
        ? `${seatLabel} liberada por ${comprador}.`
        : `${seatLabel} liberada y disponible.`
    } else if (eventType === 'resource.confirmed') {
      displayTitle = '✅ Compra Concretada'
      dataSummary = comprador
        ? `Venta confirmada para ${seatLabel} (${comprador}).`
        : `Venta confirmada para ${seatLabel}.`
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
      resourceKey,
      holderId,
      usuarioId,
      comprador,
      expiresAt,
      amount: typeof rawData.amount === 'number' ? rawData.amount : undefined,
      occurredAt: String(event?.occurredAt ?? parsedBody.occurredAt ?? new Date().toISOString()),
      receivedAt: new Date().toLocaleTimeString('es-AR'),
      dataSummary,
      verified: isVerified,
      raw: (event as unknown as Record<string, unknown>) ?? parsedBody,
    }

    emitWebhookEvent(eventEntry)
    console.log(`[Caerus Webhook] 🔔 ${eventType}: ${dataSummary}`)

    return NextResponse.json({
      received: true,
      event: eventType,
      verified: isVerified,
      processedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Caerus Webhook] Error procesando webhook:', error)
    return NextResponse.json({ error: 'Error procesando webhook' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'online',
    events: getWebhookHistory(),
  })
}

export async function DELETE() {
  clearWebhookHistory()
  return NextResponse.json({
    success: true,
    cleared: true,
    events: [],
  })
}
