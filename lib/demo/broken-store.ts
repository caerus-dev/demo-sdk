// Store in-memory con race conditions deliberados para la demo
// Simula un backend tradicional (ej. SQL naive o microservicio sin locks distribuidos)

export const COMPRADORES = [
  'Ana',
  'Beto',
  'Clara',
  'Diego',
  'Elena',
  'Franco',
  'Gabi',
  'Hugo',
  'Iris',
  'Juan',
  'Kari',
  'Leo',
  'Marta',
  'Nico',
  'Olivia',
  'Pablo',
  'Rosa',
  'Tomás',
  'Úrsula',
  'Valentín',
]

export type ButacaStatusBroken = 'available' | 'held' | 'booked' | 'abandoned'

export interface ButacaState {
  status: ButacaStatusBroken
  userId?: string
  userName?: string
  bookedAt?: number
  expiresAt?: number
}

export interface BookingAttempt {
  seatKey: string
  col: string
  row: number
  userId: string
  userName: string
  success: boolean
  timestamp: number
  latencyMs: number
}

interface BrokenDemoState {
  seats: Map<string, ButacaState>
  log: BookingAttempt[]
  initialized: boolean
}

// Persiste en globalThis para que viva entre peticiones HTTP y no se reinicie con cada request
const globalState = globalThis as unknown as { __brokenDemoState?: BrokenDemoState }

function getState(): BrokenDemoState {
  if (!globalState.__brokenDemoState) {
    globalState.__brokenDemoState = {
      seats: new Map(),
      log: [],
      initialized: false,
    }
  }
  return globalState.__brokenDemoState
}

export function initSeats(funcionId: string = 'horizonte'): void {
  const state = getState()
  state.seats.clear()
  state.log = []

  const COLS = ['A', 'B', 'C', 'D', 'E', 'F']
  const ROWS = [1, 2, 3, 4, 5]

  for (const r of ROWS) {
    for (const c of COLS) {
      const key = `funcion${funcionId}_${c}${r}`
      state.seats.set(key, { status: 'available' })
    }
  }
  state.initialized = true
}

export async function bookSeatBroken(
  seatKey: string,
  userId: string,
  userName: string,
): Promise<{ success: boolean; reason?: string; latencyMs: number }> {
  const state = getState()
  if (!state.initialized) {
    initSeats()
  }

  const start = Date.now()
  const m = /^funcion.+_([A-Z])(\d+)$/.exec(seatKey)
  const col = m ? m[1]! : '?'
  const row = m ? Number(m[2]) : 0

  // 1. CHECK: Lee el estado en memoria sin aislamiento ni locks
  const seat = state.seats.get(seatKey)
  if (!seat || seat.status !== 'available') {
    const latency = Date.now() - start
    state.log.push({
      seatKey,
      col,
      row,
      userId,
      userName,
      success: false,
      timestamp: Date.now(),
      latencyMs: latency,
    })
    return { success: false, reason: 'ALREADY_BOOKED', latencyMs: latency }
  }

  // 🔴 VENTANA DE VULNERABILIDAD (Check-Then-Act Gap)
  // Simula latencia I/O de base de datos relacional o servicio de pagos (60ms a 160ms)
  // Mientras este proceso duerme y cede el event loop, otros requests concurrentes
  // leen el mismo estado seat.status === 'available'.
  const delay = 60 + Math.floor(Math.random() * 100)
  await new Promise((resolve) => setTimeout(resolve, delay))

  // 2. ACT: Escribe la reserva pisando cualquier valor previo
  state.seats.set(seatKey, {
    status: 'booked',
    userId,
    userName,
    bookedAt: Date.now(),
  })

  const latency = Date.now() - start
  state.log.push({
    seatKey,
    col,
    row,
    userId,
    userName,
    success: true,
    timestamp: Date.now(),
    latencyMs: latency,
  })

  return { success: true, latencyMs: latency }
}

export function holdSeatBroken(seatKey: string, userId: string, userName: string): boolean {
  const state = getState()
  const seat = state.seats.get(seatKey)
  if (!seat || seat.status !== 'available') return false

  state.seats.set(seatKey, {
    status: 'held',
    userId,
    userName,
    bookedAt: Date.now(),
  })
  return true
}

export function abandonSeatBroken(seatKey: string): boolean {
  const state = getState()
  const seat = state.seats.get(seatKey)
  if (!seat || seat.status !== 'held') return false

  // En el sistema tradicional, el usuario abandona pero la butaca queda bloqueada indefinidamente
  state.seats.set(seatKey, {
    ...seat,
    status: 'abandoned',
  })
  return true
}

export function confirmSeatBroken(seatKey: string): boolean {
  const state = getState()
  const seat = state.seats.get(seatKey)
  if (!seat || (seat.status !== 'held' && seat.status !== 'available')) return false

  state.seats.set(seatKey, {
    ...seat,
    status: 'booked',
  })
  return true
}

export function releaseSeatBroken(seatKey: string): boolean {
  const state = getState()
  state.seats.set(seatKey, {
    status: 'available',
  })
  return true
}

export interface DoubleBookingDetail {
  seatKey: string
  col: string
  row: number
  bookedBy: string[]
  count: number
}

export interface BrokenMetrics {
  totalAttempts: number
  successfulBookings: number
  failedBookings: number
  doubleBookedSeats: number
  doubleBookings: DoubleBookingDetail[]
  affectedUsers: number
  totalRevenueLostEst: number
  abandonedBlockedSeats: number
  abandonedSeatsList: string[]
}

export function getConflictMetrics(): BrokenMetrics {
  const state = getState()

  const successByKey = new Map<string, BookingAttempt[]>()
  for (const item of state.log.filter((l) => l.success)) {
    const list = successByKey.get(item.seatKey) || []
    list.push(item)
    successByKey.set(item.seatKey, list)
  }

  const doubleBookings: DoubleBookingDetail[] = []
  for (const [seatKey, attempts] of successByKey.entries()) {
    if (attempts.length > 1) {
      doubleBookings.push({
        seatKey,
        col: attempts[0]!.col,
        row: attempts[0]!.row,
        bookedBy: attempts.map((a) => a.userName),
        count: attempts.length,
      })
    }
  }

  doubleBookings.sort((a, b) => (a.row === b.row ? a.col.localeCompare(b.col) : a.row - b.row))

  const affectedUsersSet = new Set<string>()
  for (const item of doubleBookings) {
    item.bookedBy.forEach((u) => affectedUsersSet.add(u))
  }

  // Contar asientos en estado 'abandoned'
  const abandonedSeatsList: string[] = []
  for (const [key, s] of state.seats.entries()) {
    if (s.status === 'abandoned') {
      const m = /^funcion.+_([A-Z])(\d+)$/.exec(key)
      abandonedSeatsList.push(m ? `${m[1]}${m[2]}` : key)
    }
  }

  return {
    totalAttempts: state.log.length,
    successfulBookings: state.log.filter((l) => l.success).length,
    failedBookings: state.log.filter((l) => !l.success).length,
    doubleBookedSeats: doubleBookings.length,
    doubleBookings,
    affectedUsers: affectedUsersSet.size,
    totalRevenueLostEst: doubleBookings.reduce((sum, d) => sum + (d.count - 1) * 4500, 0),
    abandonedBlockedSeats: abandonedSeatsList.length,
    abandonedSeatsList,
  }
}

export function getAllSeatsMap(): Record<string, ButacaState & { isDoubleBooked?: boolean; buyers?: string[] }> {
  const state = getState()
  if (!state.initialized) {
    initSeats()
  }

  const metrics = getConflictMetrics()
  const doubleMap = new Map<string, string[]>()
  for (const d of metrics.doubleBookings) {
    doubleMap.set(d.seatKey, d.bookedBy)
  }

  const result: Record<string, ButacaState & { isDoubleBooked?: boolean; buyers?: string[] }> = {}
  for (const [key, val] of state.seats.entries()) {
    const buyers = doubleMap.get(key)
    result[key] = {
      ...val,
      isDoubleBooked: Boolean(buyers && buyers.length > 1),
      buyers: buyers ?? (val.userName ? [val.userName] : []),
    }
  }
  return result
}

export function resetBrokenStore(funcionId: string = 'horizonte'): void {
  const state = getState()
  state.seats.clear()
  state.log = []
  state.initialized = false
  initSeats(funcionId)
}
