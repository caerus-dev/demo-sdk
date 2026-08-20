import { caerus, PLANTILLAS, type Metadata, type Resource, type ResourceHolder } from './caerus'

export const COLUMNAS = ['A', 'B', 'C', 'D', 'E', 'F'] as const
export const FILAS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

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
}

export const CATALOGO_FUNCIONES: FuncionCatalogo[] = [
  {
    id: 'horizonte',
    titulo: 'El Último Horizonte',
    horario: 'Hoy 20:30',
    posterUrl: '/posters/nebula.png',
    precioBase: 4500,
    politica: 'FAIL',
  },
  {
    id: 'neon',
    titulo: 'Lluvia de Neón',
    horario: 'Hoy 22:45',
    posterUrl: '/posters/neon-city.png',
    precioBase: 5200,
    politica: 'QUEUE',
  },
]

export interface ProductoCatalogo {
  key: string
  nombre: string
  tamanio: string
  precio: number
  stock: number
}

export const CATALOGO_PRODUCTOS: ProductoCatalogo[] = [
  { key: 'producto_pochoclos-grandes', nombre: 'Pochoclos Grandes', tamanio: 'Grande', precio: 3800, stock: 40 },
  { key: 'producto_gaseosa-cola', nombre: 'Gaseosa Cola', tamanio: '500ml', precio: 2500, stock: 60 },
  { key: 'producto_nachos-con-queso', nombre: 'Nachos con Queso', tamanio: 'Único', precio: 4200, stock: 25 },
  { key: 'producto_combo-pareja', nombre: 'Combo Pareja', tamanio: 'Para 2', precio: 8900, stock: 15 },
]

const extras = globalThis as unknown as {
  __cineExtraFunciones?: Map<string, FuncionCatalogo>
  __cineExtraProductos?: Map<string, ProductoCatalogo>
}
extras.__cineExtraFunciones ??= new Map()
extras.__cineExtraProductos ??= new Map()

function catalogoFuncion(id: string): FuncionCatalogo | undefined {
  return CATALOGO_FUNCIONES.find((f) => f.id === id) ?? extras.__cineExtraFunciones!.get(id)
}

function catalogoProducto(key: string): ProductoCatalogo | undefined {
  return CATALOGO_PRODUCTOS.find((p) => p.key === key) ?? extras.__cineExtraProductos!.get(key)
}

export function infoKey(idFuncion: string): string {
  return `info_${idFuncion}`
}

export function grupoButacas(idFuncion: string): string {
  return `funcion${idFuncion}`
}

export function butacaKey(idFuncion: string, columna: string, fila: number): string {
  return `funcion${idFuncion}_${columna}${fila}`
}

export function productoKey(slug: string): string {
  return `producto_${slug}`
}

export function slugify(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function parseButacaKey(key: string): { idFuncion: string; columna: string; fila: number } | null {
  const m = /^funcion(.+)_([A-Z])(\d+)$/.exec(key)
  return m ? { idFuncion: m[1]!, columna: m[2]!, fila: Number(m[3]) } : null
}

function tipoDeFila(fila: number): 'Estándar' | 'Premium' {
  return fila >= 7 ? 'Premium' : 'Estándar'
}

function precioDeButaca(precioBase: number, fila: number): number {
  return tipoDeFila(fila) === 'Premium' ? Math.round(precioBase * 1.5) : precioBase
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

export interface CrearFuncionInput {
  titulo: string
  horario: string
  posterUrl: string
  precioBase: number
  politica?: PoliticaButaca
}

async function plantillaEfectiva(politica: PoliticaButaca, keyDePrueba: string): Promise<{
  plantilla: string
  politica: PoliticaButaca
}> {
  if (politica !== 'QUEUE') return { plantilla: PLANTILLAS.butaca, politica: 'FAIL' }
  try {
    await caerus.createUnitary(PLANTILLAS.butacaFila, keyDePrueba, { groupKey: 'sonda_plantilla' })
    await caerus.deleteResource(keyDePrueba).catch(() => {})
    return { plantilla: PLANTILLAS.butacaFila, politica: 'QUEUE' }
  } catch (error) {
    if ((error as { code?: string }).code === 'RESOURCE_NOT_FOUND') {
      return { plantilla: PLANTILLAS.butaca, politica: 'FAIL' }
    }
    throw error
  }
}

export async function crearFuncion(
  input: CrearFuncionInput & { id?: string },
): Promise<{ id: string }> {
  const id = input.id ?? Math.random().toString(36).slice(2, 8)
  const pedida: PoliticaButaca = input.politica ?? 'FAIL'
  const { plantilla, politica } = await plantillaEfectiva(pedida, `sonda_${id}_${Date.now().toString(36)}`)

  if (!input.id) {
    extras.__cineExtraFunciones!.set(id, { ...input, id, politica })
  }
  await crearSiFalta(() =>
    caerus.createMultiple(PLANTILLAS.capacidad, infoKey(id), COLUMNAS.length * FILAS.length, {
      groupKey: GRUPO_FUNCIONES,
      ...meta({
        titulo: input.titulo,
        horario: input.horario,
        posterUrl: input.posterUrl,
        precioBase: input.precioBase,
        politica,
      }),
    }),
  )

  const butacas = COLUMNAS.flatMap((columna) => FILAS.map((fila) => ({ columna, fila })))
  await enTandas(butacas, 12, ({ columna, fila }) =>
    crearSiFalta(() =>
      caerus.createUnitary(plantilla, butacaKey(id, columna, fila), {
        groupKey: grupoButacas(id),
        ...meta({
          fila,
          columna,
          precio: precioDeButaca(input.precioBase, fila),
          tipo: tipoDeFila(fila),
        }),
      }),
    ),
  )
  return { id }
}

export interface CrearProductoInput {
  nombre: string
  tamanio: string
  precio: number
  stock: number
}

export async function crearProducto(
  input: CrearProductoInput & { key?: string },
): Promise<{ key: string }> {
  const key = input.key ?? productoKey(slugify(input.nombre))
  if (!input.key) {
    extras.__cineExtraProductos!.set(key, { ...input, key })
  }
  await crearSiFalta(() =>
    caerus.createMultiple(PLANTILLAS.producto, key, input.stock, {
      groupKey: GRUPO_PRODUCTOS,
      ...meta({ nombre: input.nombre, tamanio: input.tamanio, precio: input.precio }),
    }),
  )
  return { key }
}

const globalForSeed = globalThis as unknown as {
  __cineSeed?: Promise<void>
  __cineSeedEn?: number
}

const REVALIDAR_SEMBRADO_MS = 30_000

async function sembrar(): Promise<void> {
  const ultimo = CATALOGO_PRODUCTOS[CATALOGO_PRODUCTOS.length - 1]!
  if (await existe(ultimo.key)) return
  for (const f of CATALOGO_FUNCIONES) {
    await crearFuncion(f)
  }
  for (const p of CATALOGO_PRODUCTOS) {
    await crearProducto(p)
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

export function funcionFromResource(r: Resource): FuncionDTO {
  const id = r.key.replace(/^info_/, '')

  const m = r.metadata ?? {}
  const c = catalogoFuncion(id)
  return {
    id,
    key: r.key,
    titulo: String(m.titulo ?? c?.titulo ?? 'Sin título'),
    horario: String(m.horario ?? c?.horario ?? ''),
    posterUrl: String(m.posterUrl ?? c?.posterUrl ?? ''),
    precioBase: Number(m.precioBase ?? c?.precioBase ?? 0),
    politica: (m.politica as PoliticaButaca | undefined) ?? c?.politica ?? 'FAIL',
    butacasDisponibles: r.availableAmount,
    capacidadTotal: COLUMNAS.length * FILAS.length,
  }
}

export interface ButacaDTO {
  key: string
  fila: number
  columna: string
  precio: number
  tipo: string
  disponible: boolean
}

export function butacaFromResource(r: Resource): ButacaDTO {
  const m = r.metadata ?? {}
  const p = parseButacaKey(r.key)
  const fila = Number(m.fila ?? p?.fila ?? 0)
  const precioBase = catalogoFuncion(p?.idFuncion ?? '')?.precioBase ?? 0
  return {
    key: r.key,
    fila,
    columna: String(m.columna ?? p?.columna ?? ''),
    precio: Number(m.precio ?? precioDeButaca(precioBase, fila)),
    tipo: String(m.tipo ?? tipoDeFila(fila)),
    disponible: r.availableAmount > 0,
  }
}

export interface ProductoDTO {
  key: string
  nombre: string
  tamanio: string
  precio: number
  disponibles: number
}

export function productoFromResource(r: Resource): ProductoDTO {
  const m = r.metadata ?? {}
  const c = catalogoProducto(r.key)
  return {
    key: r.key,
    nombre: String(m.nombre ?? c?.nombre ?? r.key),
    tamanio: String(m.tamanio ?? c?.tamanio ?? ''),
    precio: Number(m.precio ?? c?.precio ?? 0),
    disponibles: r.availableAmount,
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
