import { readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CaerusClient } from '@caerus-dev/sdk'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function leerEnv() {
  const env = {}
  try {
    for (const linea of readFileSync(join(raiz, '.env.local'), 'utf8').split('\n')) {
      const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(linea)
      if (m) env[m[1]] = m[2].trim()
    }
  } catch {}
  return { ...env, ...process.env }
}

const PRODUCTOS = {
  'pochoclos-grandes': { nombre: 'Pochoclos Grandes', tamanio: 'Grande', precio: 3800, stock: 40 },
  'gaseosa-cola': { nombre: 'Gaseosa Cola', tamanio: '500ml', precio: 2500, stock: 60 },
  'nachos-con-queso': { nombre: 'Nachos con Queso', tamanio: 'Único', precio: 4200, stock: 25 },
  'combo-pareja': { nombre: 'Combo Pareja', tamanio: 'Para 2', precio: 8900, stock: 15 },
}

const env = leerEnv()
if (!env.CAERUS_API_KEY) {
  console.error('Falta CAERUS_API_KEY (en .env.local o en el entorno).')
  process.exit(1)
}

const slug = process.argv.slice(2).find((a) => !a.startsWith('--'))
const hacelo = process.argv.includes('--hacelo')
const conMetadata = env.CAERUS_METADATA === 'on'
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

const c = new CaerusClient({
  apiKey: env.CAERUS_API_KEY,
  ...(env.CAERUS_ENDPOINT ? { endpoint: env.CAERUS_ENDPOINT } : {}),
})

try {
  if (!slug) {
    for (const [s, p] of Object.entries(PRODUCTOS)) {
      const actual = await c.getResource(`producto_${s}`).then((r) => r.availableAmount).catch(() => null)
      const marca = actual === null ? 'no existe' : actual === p.stock ? 'ok' : `faltan ${p.stock - actual}`
      console.log(`  ${s.padEnd(20)} ${String(actual ?? '-').padStart(3)} / ${p.stock}   ${marca}`)
    }
    console.log('\nPara reponer uno: node scripts/reponer-producto.mjs <slug> --hacelo')
    process.exit(0)
  }

  const p = PRODUCTOS[slug]
  if (!p) {
    console.error(`No conozco "${slug}". Opciones: ${Object.keys(PRODUCTOS).join(', ')}`)
    process.exit(1)
  }

  const key = `producto_${slug}`
  const actual = await c.getResource(key).then((r) => r.availableAmount).catch(() => null)
  console.log(`${key}: ${actual} / ${p.stock}`)
  if (!hacelo) {
    console.log(`\nBorraría y recrearía ${key} con ${p.stock} unidades.`)
    console.log(`Para hacerlo: node scripts/reponer-producto.mjs ${slug} --hacelo`)
    process.exit(0)
  }
  await c.deleteResource(key)
  console.log('Esperando a que se asiente el índice de grupos…')
  await esperar(9000)
  await c.createMultiple('producto', key, p.stock, {
    groupKey: 'productos',
    ...(conMetadata ? { metadata: { nombre: p.nombre, tamanio: p.tamanio, precio: p.precio } } : {}),
  })
  await esperar(6000)
  const { resources } = await c.getResourcesByGroup('productos', { pageSize: 50 })
  console.log('Candy bar:', resources.map((r) => `${r.key.replace('producto_', '')}(${r.availableAmount})`).join(', '))
} finally {
  c.close()
}
