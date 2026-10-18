import { NextResponse } from 'next/server'
import { reiniciarCine } from '@/lib/cine'
import { clearWebhookHistory, emitWebhookEvent } from '@/lib/event-bus'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const resultado = await reiniciarCine()

    // Limpiar historial de webhooks en memoria
    clearWebhookHistory()

    // Notificar a todas las ventanas conectadas vía SSE para que actualicen sus mapas
    emitWebhookEvent({
      id: `reset_${Date.now()}`,
      eventType: 'system.reset',
      displayTitle: 'Reinicio Completo de Estado',
      resourceKey: 'all',
      occurredAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      dataSummary: `Se reiniciaron ${resultado.eliminados} recursos antiguos y se recrearon ${resultado.creados} recursos desde config/sala.json`,
      verified: true,
      raw: { resultado },
    })

    return NextResponse.json({
      success: true,
      message: 'El estado en Caerus fue reiniciado con éxito a los valores por defecto del JSON.',
      ...resultado,
    })
  } catch (error) {
    console.error('[reset] Error reiniciando estado en Caerus:', error)
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message || 'Error desconocido al reiniciar',
      },
      { status: 500 },
    )
  }
}
