import { AsyncLocalStorage } from 'node:async_hooks'
import type { SharedResourceApi } from '@caerus-dev/sdk'

export interface LlamadaSDK {
  t: number
  expresion: string
  resultado?: string
  error?: string
  ms: number
}

const almacen = new AsyncLocalStorage<LlamadaSDK[]>()

export function conRegistro<T>(llamadas: LlamadaSDK[], fn: () => Promise<T>): Promise<T> {
  return almacen.run(llamadas, fn)
}

function valor(v: unknown): string {
  if (typeof v === 'string') return `'${v}'`
  if (v === null || v === undefined) return String(v)
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v instanceof Date) return `new Date('${v.toISOString()}')`
  if (Array.isArray(v)) return `[${v.map(valor).join(', ')}]`
  if (typeof v === 'object') {
    const campos = Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== undefined)
      .map(([k, x]) => `${k}: ${valor(x)}`)
    return campos.length ? `{ ${campos.join(', ')} }` : '{}'
  }
  return String(v)
}

function argumentos(args: unknown[]): string {
  return args.filter((a) => a !== undefined).map(valor).join(', ')
}

function resumen(r: unknown): string {
  if (r === undefined || r === null) return 'ok'
  const o = r as Record<string, unknown>
  if (typeof o.status === 'string' && o.expiresAt instanceof Date) {
    const seg = Math.round((o.expiresAt.getTime() - Date.now()) / 1000)
    return `${o.status} · vence en ${seg}s · id ${String(o.id).slice(0, 8)}…`
  }
  if (typeof o.availableAmount === 'number') {
    return `${o.key} · ${o.availableAmount} disponibles · ${o.pendingCount} tomadas`
  }
  if (Array.isArray(o.holders)) return `${o.holders.length} holders`
  if (Array.isArray(o.resources)) return `${o.resources.length} recursos`
  return 'ok'
}

async function medir<T>(expresion: string, fn: () => Promise<T>): Promise<T> {
  const llamadas = almacen.getStore()
  if (!llamadas) return fn()

  const arranque = Date.now()
  try {
    const r = await fn()
    llamadas.push({ t: arranque, expresion, resultado: resumen(r), ms: Date.now() - arranque })
    return r
  } catch (e) {
    const err = e as { constructor: { name: string }; message: string }
    llamadas.push({
      t: arranque,
      expresion,
      error: `${err.constructor.name}: ${err.message}`,
      ms: Date.now() - arranque,
    })
    throw e
  }
}

export function observar(cliente: SharedResourceApi): SharedResourceApi {
  return new Proxy(cliente, {
    get(destino, prop, receptor) {
      const original = Reflect.get(destino, prop, receptor)
      if (typeof original !== 'function' || typeof prop !== 'string') return original
      if (prop === 'unitary' || prop === 'pooled') {
        return (key: string) => {
          const manejador = original.call(destino, key) as Record<string, unknown>
          return new Proxy(manejador, {
            get(m, p) {
              const f = Reflect.get(m, p)
              if (typeof f !== 'function' || typeof p !== 'string') return f
              return (...args: unknown[]) =>
                medir(`caerus.${prop}('${key}').${p}(${argumentos(args)})`, () =>
                  (f as (...a: unknown[]) => Promise<unknown>).apply(m, args),
                )
            },
          })
        }
      }
      if (prop === 'close') return original.bind(destino)
      return (...args: unknown[]) =>
        medir(`caerus.${prop}(${argumentos(args)})`, () =>
          (original as (...a: unknown[]) => Promise<unknown>).apply(destino, args),
        )
    },
  }) as SharedResourceApi
}
