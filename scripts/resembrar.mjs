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

const env = leerEnv()
if (!env.CAERUS_API_KEY) {
  console.error('Falta CAERUS_API_KEY (en .env.local o en el entorno).')
  process.exit(1)
}

const GRUPOS = ['lista_funciones', 'productos', 'funcionhorizonte', 'funcionneon']
const deVerdad = process.argv.includes('--borrar')
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

const c = new CaerusClient({
  apiKey: env.CAERUS_API_KEY,
  ...(env.CAERUS_ENDPOINT ? { endpoint: env.CAERUS_ENDPOINT } : {}),
})

try {
  const claves = new Set()
  for (const g of GRUPOS) {
    for (let page = 0; page < 5; page++) {
      const { resources, hasNextPage } = await c
        .getResourcesByGroup(g, { page, pageSize: 100 })
        .catch(() => ({ resources: [], hasNextPage: false }))
      resources.forEach((r) => claves.add(r.key))
      if (!hasNextPage) break
    }
  }
  console.log(`Recursos del cine encontrados: ${claves.size}`)
  if (claves.size === 0) {
    console.log('Nada que hacer. Arrancá la demo y siembra sola.')
    process.exit(0)
  }
  if (!deVerdad) {
    console.log([...claves].slice(0, 12).map((k) => `  ${k}`).join('\n'))
    if (claves.size > 12) console.log(`  … y ${claves.size - 12} más`)
    console.log('\nEsto fue un ensayo. Para borrar de verdad: node scripts/resembrar.mjs --borrar')
    process.exit(0)
  }

  const { holders } = await c.listResourceHolders({ status: 'PENDING', pageSize: 300 })
  let sueltos = 0
  for (const h of holders) {
    try { await c.release(h.id); sueltos++ } catch {}
  }
  console.log(`Holders pendientes liberados: ${sueltos}`)
  await esperar(1500)

  const lista = [...claves]
  let ok = 0
  const fallidos = []
  for (let i = 0; i < lista.length; i += 10) {
    await Promise.all(
      lista.slice(i, i + 10).map((k) =>
        c.deleteResource(k).then(
          () => { ok++ },
          (e) => fallidos.push(`${k}: ${e.message.slice(0, 60)}`),
        ),
      ),
    )
    process.stdout.write(`\rBorrados ${ok}/${lista.length}`)
  }
  console.log('')
  if (fallidos.length) console.log('No se pudieron borrar:\n' + fallidos.map((f) => '  ' + f).join('\n'))
  console.log('Esperando a que se asiente el índice de grupos…')
  await esperar(8000)
  console.log('Listo. Arrancá la demo con `npm run dev` y abrí la cartelera para sembrar.')
} finally {
  c.close()
}
