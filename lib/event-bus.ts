import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface WebhookEventLog {
  id: string
  eventType: string
  displayTitle: string
  resourceKey: string
  holderId?: string
  usuarioId?: string
  comprador?: string
  expiresAt?: string
  amount?: number
  occurredAt: string
  receivedAt: string
  dataSummary: string
  verified: boolean
  raw: Record<string, unknown>
}

type EventListener = (event: WebhookEventLog) => void

interface GlobalEventBusState {
  __caerusWebhooks?: WebhookEventLog[]
  __caerusListeners?: Set<EventListener>
}

const STORE_FILE = join(tmpdir(), 'caerus_demo_webhooks_bus.json')

const globalState = globalThis as unknown as GlobalEventBusState
globalState.__caerusWebhooks ??= []
globalState.__caerusListeners ??= new Set()

function readStoreFile(): WebhookEventLog[] {
  try {
    if (!existsSync(STORE_FILE)) return []
    const raw = readFileSync(STORE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as WebhookEventLog[]) : []
  } catch {
    return []
  }
}

function writeStoreFile(events: WebhookEventLog[]): void {
  try {
    writeFileSync(STORE_FILE, JSON.stringify(events), 'utf8')
  } catch {
    // Ignorar errores de escritura en disco temporal
  }
}

export function getWebhookHistory(): WebhookEventLog[] {
  const fromDisk = readStoreFile()
  if (fromDisk.length > 0 || (globalState.__caerusWebhooks?.length ?? 0) === 0) {
    globalState.__caerusWebhooks = fromDisk
  }
  return globalState.__caerusWebhooks!
}

export function clearWebhookHistory(): void {
  globalState.__caerusWebhooks = []
  writeStoreFile([])
}

export function emitWebhookEvent(event: WebhookEventLog): void {
  const current = readStoreFile()
  const list = [event, ...current.filter((e) => e.id !== event.id)].slice(0, 30)
  globalState.__caerusWebhooks = list
  writeStoreFile(list)

  // Notificar a todos los clientes SSE conectados en este proceso
  for (const listener of globalState.__caerusListeners!) {
    try {
      listener(event)
    } catch {
      // Ignorar errores de clientes caídos
    }
  }
}

export function subscribeToEvents(listener: EventListener): () => void {
  globalState.__caerusListeners!.add(listener)
  return () => {
    globalState.__caerusListeners!.delete(listener)
  }
}
