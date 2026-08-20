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

const FUNCIONES = {
  horizonte: { titulo: 'El Último Horizonte', horario: 'Hoy 20:30', posterUrl: '/posters/nebula.png', precioBase: 4500 },
  neon: { titulo: 'Lluvia de Neón', horario: 'Hoy 22:45', posterUrl: '/posters/neon-city.png', precioBase: 5200 },
}
const CAPACIDAD = 54

const [idFuncion, asiento] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const hacelo = process.argv.includes('--hacelo')
const m = /^([A-F])(\d)$/.exec(asiento ?? '')

if (!FUNCIONES[idFuncion] || !m) {
  console.error('Uso: node scripts/liberar-vendida.mjs <funcion> <butaca> [--hacelo]')
  console.error(`  funcion: ${Object.keys(FUNCIONES).join(' | ')}`)
  console.error('  butaca:  A1 … F9')
  process.exit(1)
}

const env = leerEnv()
if (!env.CAERUS_API_KEY) {
  console.error('Falta CAERUS_API_KEY (en .env.local o en el entorno).')
  process.exit(1)
}

const [, columna, filaTxt] = m
const fila = Number(filaTxt)
const f = FUNCIONES[idFuncion]
const esPremium = fila >= 7
const butacaKey = `funcion${idFuncion}_${columna}${fila}`
const infoKeyF = `info_${idFuncion}`
const conMetadata = env.CAERUS_METADATA === 'on'
const meta = (v) => (conMetadata ? { metadata: v } : {})
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

const c = new CaerusClient({
  apiKey: env.CAERUS_API_KEY,
  ...(env.CAERUS_ENDPOINT ? { endpoint: env.CAERUS_ENDPOINT } : {}),
})

try {
  const estado = await c.getResource(butacaKey).then((r) => `av=${r.availableAmount}`).catch((e) => e.message)
  console.log(`${butacaKey}  ->  ${estado}`)
  if (!hacelo) {
    console.log(`\nBorraría y recrearía ${butacaKey} y ${infoKeyF} (capacidad ${CAPACIDAD}).`)
    console.log(`Para hacerlo: node scripts/liberar-vendida.mjs ${idFuncion} ${asiento} --hacelo`)
    process.exit(0)
  }
  await c.deleteResource(butacaKey).catch((e) => console.log(`  ${butacaKey}: ${e.message.slice(0, 60)}`))
  await c.deleteResource(infoKeyF).catch((e) => console.log(`  ${infoKeyF}: ${e.message.slice(0, 60)}`))
  console.log('Esperando a que se asiente el índice de grupos…')
  await esperar(9000)
  await c.createUnitary('butaca', butacaKey, {
    groupKey: `funcion${idFuncion}`,
    ...meta({
      fila,
      columna,
      precio: esPremium ? Math.round(f.precioBase * 1.5) : f.precioBase,
      tipo: esPremium ? 'Premium' : 'Estándar',
    }),
  })
  await c.createMultiple('funcion_capacidad', infoKeyF, CAPACIDAD, {
    groupKey: 'lista_funciones',
    ...meta({ titulo: f.titulo, horario: f.horario, posterUrl: f.posterUrl, precioBase: f.precioBase }),
  })
  await esperar(6000)
  const { resources } = await c.getResourcesByGroup('lista_funciones', { pageSize: 50 })
  console.log('Cartelera:', resources.map((r) => `${r.key}(${r.availableAmount})`).join(', '))
  console.log(`${asiento} libre de nuevo.`)
} finally {
  c.close()
}
