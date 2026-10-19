/**
 * Showcase del SDK de Caerus (@caerus-dev/sdk)
 * 
 * Este módulo centraliza todas las operaciones contra el motor Caerus.
 * Diseñado para ser limpio, auto-documentado y fácil de mostrar durante la demo.
 */

import {
  caerus,
  PLANTILLAS,
  type ConfirmOptions,
  type CreateResourceOptions,
  type GetResourcesByGroupOptions,
  type ListResourceHoldersOptions,
  type Metadata,
  type Resource,
  type ResourceHolder,
  type ResourceHolderPage,
  type ResourcePage,
  type TakeOptions,
  type UpdateResourceOptions,
} from './index'

export { caerus, PLANTILLAS }

// ============================================================================
// 1. GESTIÓN DE BUTACAS (Recurso UNITARIO: o todo o nada, con cola opcional)
// ============================================================================

/**
 * Toma una butaca específica.
 * Según la plantilla asignada en Caerus:
 * - FAIL: Si está tomada, lanza ConflictError (409).
 * - QUEUE: Si está tomada, entra en la cola FIFO y devuelve holder en estado QUEUED.
 */
export async function reservarButaca(
  butacaKey: string,
  options: {
    ttlSeconds?: number
    idempotencyKey?: string
    metadata?: Metadata
  } = {},
): Promise<ResourceHolder> {
  return caerus.unitary(butacaKey).take({
    ttlSeconds: options.ttlSeconds,
    idempotencyKey: options.idempotencyKey,
    metadata: options.metadata,
  })
}

// ============================================================================
// 2. GESTIÓN DE CANDY BAR (Recurso MÚLTIPLE / POOLED: stock compartido)
// ============================================================================

/**
 * Toma N unidades de un producto del candy bar.
 * Caerus opera de forma estrictamente atómica: si pides 3 y hay 2,
 * falla la operación completa sin reservas parciales.
 */
export async function reservarProducto(
  productoKey: string,
  cantidad: number,
  options: {
    ttlSeconds?: number
    idempotencyKey?: string
    metadata?: Metadata
  } = {},
): Promise<ResourceHolder> {
  return caerus.pooled(productoKey).takeMany(cantidad, {
    ttlSeconds: options.ttlSeconds,
    idempotencyKey: options.idempotencyKey,
    metadata: options.metadata,
  })
}

// ============================================================================
// 3. CICLO DE VIDA DEL HOLDER: Confirmar, Liberar y Extender
// ============================================================================

/**
 * Confirma la compra y pasa el holder a estado terminal CONFIRMED.
 * Guarda en metadata el comprador y monto final.
 */
export async function confirmarReserva(
  holderId: string,
  options?: ConfirmOptions,
): Promise<ResourceHolder> {
  return caerus.confirm(holderId, options)
}

/**
 * Libera inmediatamente la reserva activa, devolviendo el stock al motor.
 * Si había clientes en cola (QUEUE), Caerus promueve automáticamente al siguiente.
 */
export async function liberarReserva(holderId: string): Promise<void> {
  return caerus.release(holderId)
}

/**
 * Otorga tiempo extra de retención a un carrito activo.
 */
export async function extenderReserva(
  holderId: string,
  extraMilliseconds: number,
): Promise<ResourceHolder> {
  return caerus.extend(holderId, extraMilliseconds)
}

// ============================================================================
// 4. CONSULTAS DE ESTADO Y TELEMETRÍA (Lecturas en tiempo real)
// ============================================================================

/**
 * Obtiene el recurso y su stock disponible directamente del motor (Redis).
 */
export async function obtenerRecurso(resourceKey: string): Promise<Resource> {
  return caerus.getResource(resourceKey)
}

/**
 * Obtiene un holder por su ID para verificar su estado (PENDING, QUEUED, etc).
 */
export async function obtenerHolder(holderId: string): Promise<ResourceHolder> {
  return caerus.getResourceHolder(holderId)
}

/**
 * Lista holders filtrados por estado o recurso.
 */
export async function listarHolders(
  options: ListResourceHoldersOptions = {},
): Promise<ResourceHolderPage> {
  return caerus.listResourceHolders(options)
}

/**
 * Lista todos los recursos pertenecientes a un grupo (ej. sala "neon").
 */
export async function listarRecursosPorGrupo(
  groupKey: string,
  options: GetResourcesByGroupOptions = {},
): Promise<ResourcePage> {
  return caerus.getResourcesByGroup(groupKey, options)
}

// ============================================================================
// 5. ADMINISTRACIÓN / BACKOFFICE (Crear, Actualizar y Borrar Recursos)
// ============================================================================

/**
 * Crea una butaca unitaria en Caerus asociada a una plantilla y a su grupo de función.
 */
export async function crearButaca(
  plantilla: string,
  key: string,
  groupKey: string,
  metadata?: Metadata,
): Promise<Resource> {
  return caerus.createUnitary(plantilla, key, {
    groupKey,
    metadata,
  })
}

/**
 * Crea un producto de stock compartido (Candy Bar) en Caerus.
 */
export async function crearProductoMultiple(
  plantilla: string,
  key: string,
  stockInicial: number,
  groupKey: string,
  metadata?: Metadata,
): Promise<Resource> {
  return caerus.createMultiple(plantilla, key, stockInicial, {
    groupKey,
    metadata,
  })
}

/**
 * Ajusta el stock de un producto (reposición o ajuste de inventario).
 */
export async function actualizarStock(
  key: string,
  delta: number,
  options?: UpdateResourceOptions,
): Promise<Resource> {
  return caerus.updateResource(key, delta, options)
}

/**
 * Elimina un recurso del motor.
 */
export async function eliminarRecurso(key: string): Promise<void> {
  return caerus.deleteResource(key)
}
