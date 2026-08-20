'use client'

import { useSyncExternalStore } from 'react'

export interface LlamadaSDK {
  t: number
  expresion: string
  resultado?: string
  error?: string
  ms: number
}

export interface Anotada extends LlamadaSDK {
  id: string
  accion: string
}

const TOPE = 40

let llamadas: Anotada[] = []
const suscriptores = new Set<() => void>()
let contador = 0

function avisar() {
  suscriptores.forEach((f) => f())
}

export function publicar(accion: string, respuesta: unknown): void {
  const crudas = (respuesta as { _llamadas?: LlamadaSDK[] } | null)?._llamadas
  if (!crudas?.length) return

  const nuevas = crudas.map((l) => ({ ...l, accion, id: `l${++contador}` }))
  llamadas = [...nuevas.reverse(), ...llamadas].slice(0, TOPE)
  avisar()
}

export function limpiar(): void {
  llamadas = []
  avisar()
}

function suscribir(f: () => void) {
  suscriptores.add(f)
  return () => suscriptores.delete(f)
}

const vacio: Anotada[] = []

export function useRegistro(): Anotada[] {
  return useSyncExternalStore(suscribir, () => llamadas, () => vacio)
}
