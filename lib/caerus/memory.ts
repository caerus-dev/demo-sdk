import type {
  CreateResourceOptions,
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
import { ConflictError, ValidationError } from './errors'

interface InternalResource {
  id: string
  key: string
  templateId: string
  availableAmount: number
  pendingCount: number
  groupKey?: string
  metadata?: Metadata
  createdAt: number
}

interface InternalHolder {
  id: string
  resourceId: string
  resourceKey: string
  status: ResourceHolderStatus
  amount: number
  expiresAt: number
  metadata?: Metadata
  createdAt: number
}

interface EngineState {
  resourcesByKey: Map<string, InternalResource>
  resourcesById: Map<string, InternalResource>
  holders: Map<string, InternalHolder>
  idempotency: Map<string, string>
  sweepTimer: ReturnType<typeof setInterval> | null
  seq: number
}

const DEFAULT_TTL_SECONDS = 120
const TERMINAL: ResourceHolderStatus[] = ['CONFIRMED', 'RELEASED', 'EXPIRED']

const globalForCaerus = globalThis as unknown as { __caerusState?: EngineState }

function getState(): EngineState {
  if (!globalForCaerus.__caerusState) {
    globalForCaerus.__caerusState = {
      resourcesByKey: new Map(),
      resourcesById: new Map(),
      holders: new Map(),
      idempotency: new Map(),
      sweepTimer: null,
      seq: 0,
    }
  }
  return globalForCaerus.__caerusState
}

function nextId(prefix: string): string {
  const state = getState()
  state.seq += 1
  return `${prefix}_${Date.now().toString(36)}_${state.seq.toString(36)}`
}

function toResource(r: InternalResource): Resource {
  return {
    id: r.id,
    key: r.key,
    templateId: r.templateId,
    availableAmount: r.availableAmount,
    pendingCount: r.pendingCount,
    groupKey: r.groupKey,
    metadata: r.metadata,
  }
}

function toHolder(h: InternalHolder): ResourceHolder {
  return {
    id: h.id,
    resourceId: h.resourceId,
    status: h.status,
    amount: h.amount,
    expiresAt: new Date(h.expiresAt),
    metadata: h.metadata,
  }
}

function sweepExpired(): void {
  const state = getState()
  const now = Date.now()
  for (const h of state.holders.values()) {
    if (h.status === 'PENDING' && h.expiresAt <= now) {
      h.status = 'EXPIRED'
      const resource = state.resourcesById.get(h.resourceId)
      if (resource) {
        resource.availableAmount += h.amount
        resource.pendingCount = Math.max(0, resource.pendingCount - h.amount)
      }
    }
  }
}

function ensureSweep(): void {
  const state = getState()
  if (state.sweepTimer) return

  const timer = setInterval(sweepExpired, 1000)
  if (typeof (timer as { unref?: () => void }).unref === 'function') {
    ;(timer as { unref?: () => void }).unref?.()
  }
  state.sweepTimer = timer
}

function performTake(resourceKey: string, amount: number, options?: TakeOptions): ResourceHolder {
  ensureSweep()
  sweepExpired()

  const state = getState()
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new ValidationError(`La cantidad debe ser un entero positivo, recibí: ${amount}`)
  }
  if (options?.idempotencyKey) {
    const existingId = state.idempotency.get(options.idempotencyKey)
    if (existingId) {
      const existing = state.holders.get(existingId)
      if (existing) return toHolder(existing)
    }
  }

  const resource = state.resourcesByKey.get(resourceKey)
  if (!resource) {
    throw new ValidationError(`No existe un recurso con la clave "${resourceKey}"`)
  }
  if (resource.availableAmount < amount) {
    throw new ConflictError(
      `Sin stock suficiente en "${resourceKey}": pediste ${amount}, hay ${resource.availableAmount}`,
    )
  }
  resource.availableAmount -= amount
  resource.pendingCount += amount

  const ttlSeconds = options?.ttlSeconds ?? DEFAULT_TTL_SECONDS
  const holder: InternalHolder = {
    id: nextId('holder'),
    resourceId: resource.id,
    resourceKey: resource.key,
    status: 'PENDING',
    amount,
    expiresAt: Date.now() + ttlSeconds * 1000,
    metadata: options?.metadata,
    createdAt: Date.now(),
  }
  state.holders.set(holder.id, holder)
  if (options?.idempotencyKey) {
    state.idempotency.set(options.idempotencyKey, holder.id)
  }
  return toHolder(holder)
}

export class MotorEnMemoria implements SharedResourceApi {
  async createUnitary(
    templateName: string,
    key: string,
    options?: CreateResourceOptions,
  ): Promise<Resource> {
    return this.createResource(templateName, key, 1, options)
  }

  async createMultiple(
    templateName: string,
    key: string,
    availableAmount: number,
    options?: CreateResourceOptions,
  ): Promise<Resource> {
    if (!Number.isInteger(availableAmount) || availableAmount < 0) {
      throw new ValidationError(`availableAmount debe ser un entero >= 0, recibí: ${availableAmount}`)
    }
    return this.createResource(templateName, key, availableAmount, options)
  }
  private createResource(
    templateName: string,
    key: string,
    availableAmount: number,
    options?: CreateResourceOptions,
  ): Resource {
    const state = getState()
    if (state.resourcesByKey.has(key)) {
      throw new ConflictError(`Ya existe un recurso con la clave "${key}"`)
    }
    const resource: InternalResource = {
      id: nextId('res'),
      key,
      templateId: templateName,
      availableAmount,
      pendingCount: 0,
      groupKey: options?.groupKey,
      metadata: options?.metadata,
      createdAt: Date.now(),
    }
    state.resourcesByKey.set(key, resource)
    state.resourcesById.set(resource.id, resource)
    return toResource(resource)
  }
  unitary(key: string): UnitaryResource {
    return {
      key,
      take: async (options?: TakeOptions) => performTake(key, 1, options),
    }
  }
  pooled(key: string): PooledResource {
    return {
      key,
      take: async (options?: TakeOptions) => performTake(key, 1, options),
      takeMany: async (amount: number, options?: TakeOptions) => performTake(key, amount, options),
    }
  }

  async confirm(resourceHolderId: string, options?: { metadata?: Metadata }): Promise<ResourceHolder> {
    sweepExpired()
    const state = getState()
    const holder = state.holders.get(resourceHolderId)
    if (!holder) {
      throw new ValidationError(`No existe el holder "${resourceHolderId}"`)
    }
    if (TERMINAL.includes(holder.status)) {
      throw new ConflictError(
        `No se puede confirmar un holder en estado ${holder.status}`,
      )
    }
    holder.status = 'CONFIRMED'
    const resource = state.resourcesById.get(holder.resourceId)
    if (resource) {
      resource.pendingCount = Math.max(0, resource.pendingCount - holder.amount)
    }
    if (options?.metadata) {
      holder.metadata = { ...holder.metadata, ...options.metadata }
    }
    return toHolder(holder)
  }

  async release(resourceHolderId: string): Promise<void> {
    sweepExpired()
    const state = getState()
    const holder = state.holders.get(resourceHolderId)
    if (!holder) {
      throw new ValidationError(`No existe el holder "${resourceHolderId}"`)
    }
    if (TERMINAL.includes(holder.status)) {
      throw new ConflictError(`No se puede liberar un holder en estado ${holder.status}`)
    }
    holder.status = 'RELEASED'
    const resource = state.resourcesById.get(holder.resourceId)
    if (resource) {
      resource.availableAmount += holder.amount
      resource.pendingCount = Math.max(0, resource.pendingCount - holder.amount)
    }
  }

  async extend(resourceHolderId: string, extraMs: number): Promise<ResourceHolder> {
    sweepExpired()
    const state = getState()
    const holder = state.holders.get(resourceHolderId)
    if (!holder) {
      throw new ValidationError(`No existe el holder "${resourceHolderId}"`)
    }
    if (holder.status !== 'PENDING' && holder.status !== 'QUEUED') {
      throw new ConflictError(`No se puede extender un holder en estado ${holder.status}`)
    }
    holder.expiresAt += extraMs
    return toHolder(holder)
  }

  async getResourceHolder(resourceHolderId: string): Promise<ResourceHolder> {
    sweepExpired()
    const state = getState()
    const holder = state.holders.get(resourceHolderId)
    if (!holder) {
      throw new ValidationError(`No existe el holder "${resourceHolderId}"`)
    }
    return toHolder(holder)
  }

  async getResource(key: string): Promise<Resource> {
    sweepExpired()
    const state = getState()
    const resource = state.resourcesByKey.get(key)
    if (!resource) {
      throw new ValidationError(`No existe un recurso con la clave "${key}"`)
    }
    return toResource(resource)
  }

  async getResourcesByGroup(
    groupKey: string,
    options?: { page?: number; pageSize?: number },
  ): Promise<ResourcePage> {
    sweepExpired()
    const state = getState()
    const page = Math.max(1, options?.page ?? 1)
    const pageSize = Math.max(1, options?.pageSize ?? 100)

    const all = [...state.resourcesByKey.values()]
      .filter((r) => r.groupKey === groupKey)
      .sort((a, b) => a.createdAt - b.createdAt || a.key.localeCompare(b.key))

    const start = (page - 1) * pageSize
    const slice = all.slice(start, start + pageSize)
    return {
      resources: slice.map(toResource),
      hasNextPage: start + pageSize < all.length,
    }
  }

  async listResourceHolders(options?: {
    resourceKey?: string
    status?: ResourceHolderStatus
    sort?: 'NEWEST_FIRST' | 'OLDEST_FIRST'
    page?: number
    pageSize?: number
  }): Promise<ResourceHolderPage> {
    sweepExpired()
    const state = getState()
    const page = Math.max(1, options?.page ?? 1)
    const pageSize = Math.max(1, options?.pageSize ?? 50)
    const sort = options?.sort ?? 'NEWEST_FIRST'

    let all = [...state.holders.values()]
    if (options?.resourceKey) {
      all = all.filter((h) => h.resourceKey === options.resourceKey)
    }
    if (options?.status) {
      all = all.filter((h) => h.status === options.status)
    }
    all.sort((a, b) =>
      sort === 'NEWEST_FIRST' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
    )

    const start = (page - 1) * pageSize
    const slice = all.slice(start, start + pageSize)
    return {
      holders: slice.map(toHolder),
      hasNextPage: start + pageSize < all.length,
    }
  }

  async updateResource(
    key: string,
    deltaAmount: number,
    options?: UpdateResourceOptions,
  ): Promise<Resource> {
    sweepExpired()
    const state = getState()
    const resource = state.resourcesByKey.get(key)
    if (!resource) {
      throw new ValidationError(`No existe un recurso con la clave "${key}"`)
    }
    if (resource.availableAmount + deltaAmount < 0) {
      throw new ConflictError(
        `El ajuste dejaría "${key}" en negativo: hay ${resource.availableAmount}, pediste ${deltaAmount}`,
      )
    }
    resource.availableAmount += deltaAmount
    if (options?.groupKey !== undefined) resource.groupKey = options.groupKey
    if (options?.metadata !== undefined) resource.metadata = options.metadata
    return toResource(resource)
  }

  async deleteResource(key: string): Promise<void> {
    sweepExpired()
    const state = getState()
    const resource = state.resourcesByKey.get(key)
    if (!resource) {
      throw new ValidationError(`No existe un recurso con la clave "${key}"`)
    }
    if (resource.pendingCount > 0) {
      throw new ConflictError(`"${key}" tiene holders activos y no se puede borrar`)
    }
    state.resourcesByKey.delete(key)
    state.resourcesById.delete(resource.id)
  }
  close(): void {
  }
}
