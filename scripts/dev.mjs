import { spawn } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dirCerts = join(raiz, 'certs')
const env = { ...process.env }

if (existsSync(dirCerts)) {
  const pems = readdirSync(dirCerts).filter(
    (f) => (f.endsWith('.pem') || f.endsWith('.crt')) && !f.startsWith('.'),
  )
  if (pems.length > 0) {
    const bundle = join(dirCerts, '.bundle.pem')
    writeFileSync(bundle, pems.map((f) => readFileSync(join(dirCerts, f), 'utf8').trim()).join('\n') + '\n')
    env.NODE_EXTRA_CA_CERTS = bundle
    console.log(`[certs] Confiando además en: ${pems.join(', ')}`)
  }
}

if (!existsSync(dirCerts)) mkdirSync(dirCerts, { recursive: true })

const next = join(raiz, 'node_modules', 'next', 'dist', 'bin', 'next')

spawn(process.execPath, [next, 'dev', ...process.argv.slice(2)], { stdio: 'inherit', env })
  .on('exit', (code) => process.exit(code ?? 0))
