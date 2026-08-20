import { CaerusClient, type SharedResourceApi } from '@caerus-dev/sdk'
import { MotorEnMemoria } from './memory'
import { CaerusError, ConflictError, ValidationError, caerusErrorCode } from './errors'
import { observar } from './registro'

export { CaerusError, ConflictError, ValidationError, caerusErrorCode }
export type { CaerusErrorCode } from './errors'
export { conRegistro, type LlamadaSDK } from './registro'

export type {
  ConfirmOptions,
  CreateResourceOptions,
  GetResourcesByGroupOptions,
  ListResourceHoldersOptions,
  Metadata,
  PooledResource,
  Resource,
  ResourceHolder,
  ResourceHolderPage,
  ResourceHolderStatus,
  ResourcePage,
  SharedResourceApi,
  TakeOptions,
  UnitaryResource,
  UpdateResourceOptions,
} from '@caerus-dev/sdk'

export type CaerusApi = SharedResourceApi

export const PLANTILLAS = {
  butaca: process.env.CAERUS_TEMPLATE_BUTACA ?? 'butaca',
  butacaFila: process.env.CAERUS_TEMPLATE_BUTACA_FILA ?? 'butaca_fila',
  capacidad: process.env.CAERUS_TEMPLATE_CAPACIDAD ?? 'funcion_capacidad',
  producto: process.env.CAERUS_TEMPLATE_PRODUCTO ?? 'producto',
} as const

const apiKey = process.env.CAERUS_API_KEY?.trim()

export const MOTOR: 'caerus' | 'memoria' = apiKey ? 'caerus' : 'memoria'

const globalForCaerus = globalThis as unknown as { __caerusCliente?: SharedResourceApi }

function crearCliente(): SharedResourceApi {
  if (!apiKey) {
    console.log('[caerus] Sin CAERUS_API_KEY: la demo corre contra el motor en memoria.')
    return new MotorEnMemoria()
  }
  const endpoint = process.env.CAERUS_ENDPOINT?.trim()
  console.log(`[caerus] Conectado al motor desplegado${endpoint ? ` (${endpoint})` : ''}.`)
  return new CaerusClient({ apiKey, ...(endpoint ? { endpoint } : {}) })
}

export const caerus: SharedResourceApi = globalForCaerus.__caerusCliente ?? observar(crearCliente())
if (!globalForCaerus.__caerusCliente) {
  globalForCaerus.__caerusCliente = caerus
}
