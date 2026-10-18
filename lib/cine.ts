import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { caerus, PLANTILLAS, type Metadata, type Resource, type ResourceHolder } from './caerus'

export interface SalaConfig {
  ttlSecondsDefault?: number
  usuariosDemo?: string[]
  funciones: {
    id: string
    titulo: string
    horario: string
    posterUrl: string
    precioBase: number
    politica: 'FAIL' | 'QUEUE'
    plantilla: string
    filas: number
    columnas: string[]
  }[]
  productos: {
    key: string
    nombre: string
    tamanio: string
    precio: number
    stock: number
  }[]
}

function cargarSalaConfig(): SalaConfig {
  const rutaConfig = join(process.cwd(), 'config', 'sala.json')
  if (existsSync(rutaConfig)) {
    try {
      const data = JSON.parse(readFileSync(rutaConfig, 'utf-8'))
      return data as SalaConfig
    } catch (e) {
      console.warn('[config] Error leyendo config/sala.json, usando defaults:', e)
    }
  }
  return {
    ttlSecondsDefault: 30,
    funciones: [
      {
        id: 'horizonte',
        titulo: 'El Último Horizonte',
        horario: 'Hoy 20:30',
        posterUrl: '/posters/nebula.png',
        precioBase: 4500,
        politica: 'FAIL',
        plantilla: 'butaca',
        filas: 5,
        columnas: ['A', 'B', 'C', 'D', 'E', 'F'],
      },
      {
        id: 'neon',
        titulo: 'Lluvia de Neón',
        horario: 'Hoy 22:45',
        posterUrl: '/posters/neon-city.png',
        precioBase: 5200,
        politica: 'QUEUE',
        plantilla: 'butaca_fila',
        filas: 5,
        columnas: ['A', 'B', 'C', 'D', 'E', 'F'],
      },
    ],
    productos: [
      { key: 'producto_combo-pareja', nombre: 'Combo Pareja (2 Gaseosas + Balde)', tamanio: 'Para 2', precio: 8900, stock: 10 },
      { key: 'producto_pochoclos-grandes', nombre: 'Pochoclos Grandes', tamanio: 'Grande', precio: 3800, stock: 15 },
      { key: 'producto_nachos-con-queso', nombre: 'Nachos con Queso', tamanio: 'Único', precio: 4200, stock: 12 },
    ],
  }
}

export const SALA_CONFIG = cargarSalaConfig()
export const USUARIOS_DEMO = SALA_CONFIG.usuariosDemo ?? ['Ana García', 'Beto Pérez', 'Carlos Gómez', 'Diana Prince']

export const COLUMNAS = ['A', 'B', 'C', 'D', 'E', 'F'] as const
export const FILAS = [1, 2, 3, 4, 5] as const

export type Columna = (typeof COLUMNAS)[number]

export const GRUPO_FUNCIONES = 'lista_funciones'
export const GRUPO_PRODUCTOS = 'productos'

const METADATA_HABILITADA = process.env.CAERUS_METADATA === 'on'

export function meta(valor: Metadata): { metadata?: Metadata } {
  return METADATA_HABILITADA ? { metadata: valor } : {}
}

export type PoliticaButaca = 'FAIL' | 'QUEUE'

export interface FuncionCatalogo {
  id: string
  titulo: string
  horario: string
  posterUrl: string
  precioBase: number
  politica: PoliticaButaca
  plantilla: string
  filas: number
  columnas: readonly string[]
}

export const CATALOGO_FUNCIONES: FuncionCatalogo[] = SALA_CONFIG.funciones.map((f) => ({
  ...f,
  columnas: f.columnas,
}))

export interface ProductoCatalogo {
  key: string
  nombre: string
  tamanio: string
  precio: number
  stock: number
}

export const CATALOGO_PRODUCTOS: ProductoCatalogo[] = SALA_CONFIG.productos

export function catalogoFuncion(id: string): FuncionCatalogo | undefined {
  return CATALOGO_FUNCIONES.find((f) => f.id === id)
}

export function catalogoProducto(key: string): ProductoCatalogo | undefined {
  return CATALOGO_PRODUCTOS.find((p) => p.key === key)
}

export function grupoButacas(idFuncion: string): string {
  return `funcion${idFuncion}`
}

export function butacaKey(idFuncion: string, columna: string, fila: number): string {
  return `funcion${idFuncion}_${columna}${fila}`
}

export function parseButacaKey(key: string): { idFuncion: string; columna: string; fila: number } | null {
  const m = /^funcion(.+)_([A-Z])(\d+)$/.exec(key)
  return m ? { idFuncion: m[1]!, columna: m[2]!, fila: Number(m[3]) } : null
}

async function existe(key: string): Promise<boolean> {
  try {
    await caerus.getResource(key)
    return true
  } catch {
    return false
  }
}

async function crearSiFalta(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn()
  } catch (error) {
    const { code, message } = error as { code?: string; message?: string }
    const yaExiste = code === 'CONFLICT' || /already exists/i.test(message ?? '')
    if (!yaExiste) throw error
  }
}

async function enTandas<T>(items: T[], tam: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += tam) {
    await Promise.all(items.slice(i, i + tam).map(fn))
  }
}

export async function sembrarButacaIndividual(
  f: FuncionCatalogo,
  columna: string,
  fila: number,
): Promise<void> {
  const plantilla = f.politica === 'QUEUE' ? PLANTILLAS.butacaFila : PLANTILLAS.butaca
  await crearSiFalta(() =>
    caerus.createUnitary(plantilla, butacaKey(f.id, columna, fila), {
      groupKey: grupoButacas(f.id),
      ...meta({
        fila,
        columna,
        precio: f.precioBase,
      }),
    }),
  )
}

export async function sembrarFuncion(f: FuncionCatalogo): Promise<void> {
  const butacas = f.columnas.flatMap((columna) =>
    Array.from({ length: f.filas }, (_, i) => ({ columna, fila: i + 1 })),
  )

  await enTandas(butacas, 10, ({ columna, fila }) =>
    sembrarButacaIndividual(f, columna, fila),
  )
}

export async function sembrarProducto(p: ProductoCatalogo): Promise<void> {
  await crearSiFalta(() =>
    caerus.createMultiple(PLANTILLAS.producto, p.key, p.stock, {
      groupKey: GRUPO_PRODUCTOS,
      ...meta({ nombre: p.nombre, tamanio: p.tamanio, precio: p.precio }),
    }),
  )
}

const globalForSeed = globalThis as unknown as {
  __cineSeed?: Promise<void>
  __cineSeedEn?: number
}

const REVALIDAR_SEMBRADO_MS = 30_000

async function sembrar(): Promise<void> {
  const primeraButaca = butacaKey(CATALOGO_FUNCIONES[0]?.id ?? 'horizonte', 'A', 1)
  if (await existe(primeraButaca)) return

  for (const f of CATALOGO_FUNCIONES) {
    await sembrarFuncion(f)
  }
  for (const p of CATALOGO_PRODUCTOS) {
    await sembrarProducto(p)
  }
}

export async function ensureSeed(): Promise<void> {
  const ahora = Date.now()
  const reciente = ahora - (globalForSeed.__cineSeedEn ?? 0) < REVALIDAR_SEMBRADO_MS

  if (globalForSeed.__cineSeed && reciente) return globalForSeed.__cineSeed

  globalForSeed.__cineSeedEn = ahora
  globalForSeed.__cineSeed = sembrar().catch((error) => {
    globalForSeed.__cineSeed = undefined
    globalForSeed.__cineSeedEn = 0
    throw error
  })
  return globalForSeed.__cineSeed
}

export async function reiniciarCine(): Promise<{ eliminados: number; creados: number }> {
  // 1. Liberar holders activos en curso (PENDING y QUEUED)
  for (const status of ['PENDING', 'QUEUED'] as const) {
    try {
      const { holders } = await caerus.listResourceHolders({ status, pageSize: 300 })
      await Promise.allSettled(holders.map((h) => caerus.release(h.id)))
    } catch {
    }
  }

  await new Promise((r) => setTimeout(r, 500))

  let eliminados = 0
  let creados = 0

  // 2. Revisar todas las butacas del catálogo en Redis (no solo las que devuelve Postgres)
  // y borrar únicamente las que fueron usadas (availableAmount !== 1 o pendingCount !== 0)
  // o las que quedaron desincronizadas respecto a Postgres.
  for (const f of CATALOGO_FUNCIONES) {
    const pgResources = await caerus
      .getResourcesByGroup(grupoButacas(f.id), { pageSize: 200 })
      .then((res) => res.resources)
      .catch(() => [] as Resource[])
    const enPostgres = new Set(pgResources.map((r) => r.key))

    const coords = f.columnas.flatMap((columna) =>
      Array.from({ length: f.filas }, (_, i) => ({
        columna,
        fila: i + 1,
        key: butacaKey(f.id, columna, i + 1),
      })),
    )

    const paraRecrear: Array<{ columna: string; fila: number; key: string; existiaEnRedis: boolean }> = []

    await enTandas(coords, 15, async (item) => {
      const redisRes = await caerus.getResource(item.key).catch(() => null)
      if (!redisRes) {
        paraRecrear.push({ ...item, existiaEnRedis: false })
        return
      }
      if (
        redisRes.availableAmount !== 1 ||
        (redisRes.pendingCount ?? 0) !== 0 ||
        !enPostgres.has(item.key)
      ) {
        paraRecrear.push({ ...item, existiaEnRedis: true })
      }
    })

    const paraBorrar = paraRecrear.filter((x) => x.existiaEnRedis)
    if (paraBorrar.length > 0) {
      await enTandas(paraBorrar, 10, async (item) => {
        try {
          await caerus.deleteResource(item.key)
          eliminados++
        } catch {
          // Si quedó algún holder bloqueando el recurso, liberarlo y reintentar
          try {
            const { holders } = await caerus.listResourceHolders({
              resourceKey: item.key,
              pageSize: 50,
            })
            await Promise.allSettled(
              holders
                .filter((h) => h.status === 'PENDING' || h.status === 'QUEUED')
                .map((h) => caerus.release(h.id)),
            )
            await caerus.deleteResource(item.key)
            eliminados++
          } catch {}
        }
      })

      // Esperar a que RabbitMQ (onResourceDeleted) asiente las eliminaciones en Postgres
      // antes de volver a crear las claves para evitar la condición de carrera delete vs create.
      await new Promise((r) => setTimeout(r, 2500))
    }

    if (paraRecrear.length > 0) {
      await enTandas(paraRecrear, 10, async (item) => {
        await sembrarButacaIndividual(f, item.columna, item.fila)
        creados++
      })
    }
  }

  // 3. Restaurar stock de productos del candy bar mediante updateResource (sin borrar/recrear)
  for (const p of CATALOGO_PRODUCTOS) {
    try {
      const actual = await caerus.getResource(p.key).catch(() => null)
      if (!actual) {
        await sembrarProducto(p)
        creados++
      } else {
        const delta = p.stock - actual.availableAmount
        if (delta !== 0) {
          await caerus.updateResource(p.key, delta, {
            idempotencyKey: `reset:${p.key}:${Date.now()}`,
          })
        }
      }
    } catch {
    }
  }

  // Resetear caché en memoria
  globalForSeed.__cineSeed = undefined
  globalForSeed.__cineSeedEn = 0

  return { eliminados, creados }
}

export interface FuncionDTO {
  id: string
  key: string
  titulo: string
  horario: string
  posterUrl: string
  precioBase: number
  butacasDisponibles: number
  capacidadTotal: number
  politica: PoliticaButaca
}

export function slugify(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function productoKey(slug: string): string {
  return `producto_${slug}`
}

export async function crearFuncion(input: {
  id?: string
  titulo: string
  horario: string
  posterUrl: string
  precioBase: number
  politica?: PoliticaButaca
  filas?: number
  columnas?: string[]
}): Promise<{ id: string }> {
  const id = input.id ?? Math.random().toString(36).slice(2, 8)
  const politica = input.politica ?? 'FAIL'
  const f: FuncionCatalogo = {
    id,
    titulo: input.titulo,
    horario: input.horario,
    posterUrl: input.posterUrl,
    precioBase: input.precioBase,
    politica,
    plantilla: politica === 'QUEUE' ? PLANTILLAS.butacaFila : PLANTILLAS.butaca,
    filas: input.filas ?? 5,
    columnas: input.columnas ?? COLUMNAS,
  }
  await sembrarFuncion(f)
  return { id }
}

export async function crearProducto(input: {
  key?: string
  nombre: string
  tamanio: string
  precio: number
  stock: number
}): Promise<{ key: string }> {
  const key = input.key ?? productoKey(slugify(input.nombre))
  const p: ProductoCatalogo = {
    key,
    nombre: input.nombre,
    tamanio: input.tamanio,
    precio: input.precio,
    stock: input.stock,
  }
  await sembrarProducto(p)
  return { key }
}

export interface ButacaDTO {
  key: string
  fila: number
  columna: string
  precio: number
  disponible: boolean
  estado: 'DISPONIBLE' | 'EN_CARRITO' | 'CONFIRMADA'
  comprador?: string
  usuarioId?: string
}

export function butacaFromResource(r: Resource, holderConfirmado?: ResourceHolder): ButacaDTO {
  const m = r.metadata ?? {}
  const p = parseButacaKey(r.key)
  const fila = Number(m.fila ?? p?.fila ?? 0)
  const precioBase = catalogoFuncion(p?.idFuncion ?? '')?.precioBase ?? 0
  const disponible = r.availableAmount > 0
  const pending = r.pendingCount ?? 0
  const estado: ButacaDTO['estado'] = disponible
    ? 'DISPONIBLE'
    : pending > 0
    ? 'EN_CARRITO'
    : 'CONFIRMADA'

  const hMeta = (holderConfirmado?.metadata ?? {}) as Record<string, unknown>

  return {
    key: r.key,
    fila,
    columna: String(m.columna ?? p?.columna ?? ''),
    precio: Number(m.precio ?? precioBase),
    disponible,
    estado,
    comprador: hMeta.comprador ? String(hMeta.comprador) : undefined,
    usuarioId: hMeta.usuarioId ? String(hMeta.usuarioId) : undefined,
  }
}

export async function obtenerButacasFuncion(idFuncion: string): Promise<ButacaDTO[]> {
  const f = catalogoFuncion(idFuncion)

  const [resourcesRes, holdersRes] = await Promise.all([
    caerus
      .getResourcesByGroup(grupoButacas(idFuncion), { pageSize: 200 })
      .catch(() => ({ resources: [] as Resource[] })),
    caerus
      .listResourceHolders({ status: 'CONFIRMED', pageSize: 300 })
      .catch(() => ({ holders: [] as ResourceHolder[] })),
  ])

  const pgResourcePorKey = new Map<string, Resource>()
  const pgKeyPorId = new Map<string, string>()
  for (const r of resourcesRes.resources) {
    pgResourcePorKey.set(r.key, r)
    pgKeyPorId.set(r.id, r.key)
  }

  const holderPorButacaKey = new Map<string, ResourceHolder>()
  for (const h of holdersRes.holders) {
    const metaKey = (h.metadata as Record<string, unknown> | undefined)?.butacaKey
    const bKey = typeof metaKey === 'string' && metaKey ? metaKey : pgKeyPorId.get(h.resourceId)
    if (bKey && !holderPorButacaKey.has(bKey)) {
      holderPorButacaKey.set(bKey, h)
    }
  }

  if (!f) {
    return resourcesRes.resources
      .map((r) => butacaFromResource(r, holderPorButacaKey.get(r.key)))
      .sort((a, b) => {
        if (a.columna !== b.columna) return a.columna.localeCompare(b.columna)
        return a.fila - b.fila
      })
  }

  const coords = f.columnas.flatMap((columna) =>
    Array.from({ length: f.filas }, (_, i) => ({
      columna,
      fila: i + 1,
      key: butacaKey(idFuncion, columna, i + 1),
    })),
  )

  const resultados = new Map<string, Resource>()

  await enTandas(coords, 15, async (item) => {
    let redisRes = await caerus.getResource(item.key).catch(() => null)
    if (!redisRes) {
      await sembrarButacaIndividual(f, item.columna, item.fila).catch(() => {})
      redisRes = await caerus.getResource(item.key).catch(() => null)
    } else if (
      redisRes.availableAmount === 0 &&
      (redisRes.pendingCount ?? 0) === 0 &&
      !holderPorButacaKey.has(item.key)
    ) {
      const pgRes = pgResourcePorKey.get(item.key)
      const haceMs = Date.now() - (redisRes.updatedAt?.getTime() ?? 0)
      // Si la butaca en Redis figura en 0 sin pendientes ni compra confirmada,
      // y en Postgres no existe o figura libre (desfase de un reset previo), auto-repararla:
      if (!pgRes || (pgRes.availableAmount > 0 && haceMs > 4000)) {
        try {
          await caerus.deleteResource(item.key)
          await new Promise((r) => setTimeout(r, 1500))
          await sembrarButacaIndividual(f, item.columna, item.fila)
          redisRes = await caerus.getResource(item.key).catch(() => redisRes)
        } catch {}
      }
    }

    if (redisRes) {
      resultados.set(item.key, redisRes)
    } else if (pgResourcePorKey.has(item.key)) {
      resultados.set(item.key, pgResourcePorKey.get(item.key)!)
    }
  })

  return coords
    .map((item) => {
      const r = resultados.get(item.key)
      if (!r) {
        return {
          key: item.key,
          fila: item.fila,
          columna: item.columna,
          precio: f.precioBase,
          disponible: true,
          estado: 'DISPONIBLE' as const,
        }
      }
      return butacaFromResource(r, holderPorButacaKey.get(item.key))
    })
    .sort((a, b) => {
      if (a.columna !== b.columna) return a.columna.localeCompare(b.columna)
      return a.fila - b.fila
    })
}

export interface ProductoDTO {
  key: string
  nombre: string
  tamanio: string
  precio: number
  disponibles: number
  pendientes: number
  capacidadTotal: number
}

export function productoFromResource(r: Resource): ProductoDTO {
  const m = r.metadata ?? {}
  const c = catalogoProducto(r.key)
  const pending = r.pendingCount ?? 0
  return {
    key: r.key,
    nombre: String(m.nombre ?? c?.nombre ?? r.key),
    tamanio: String(m.tamanio ?? c?.tamanio ?? ''),
    precio: Number(m.precio ?? c?.precio ?? 0),
    disponibles: r.availableAmount,
    pendientes: pending,
    capacidadTotal: r.availableAmount + pending,
  }
}

export interface HolderDTO {
  id: string
  resourceId: string
  resourceKey?: string
  etiqueta?: string
  status: ResourceHolder['status']
  amount: number
  expiresAt: string
  metadata: Record<string, unknown>
}

export function holderToDTO(
  h: ResourceHolder,
  ref?: { resourceKey: string; etiqueta: string },
): HolderDTO {
  return {
    id: h.id,
    resourceId: h.resourceId,
    resourceKey: ref?.resourceKey,
    etiqueta: ref?.etiqueta,
    status: h.status,
    amount: h.amount,
    expiresAt: h.expiresAt.toISOString(),
    metadata: h.metadata ?? {},
  }
}
