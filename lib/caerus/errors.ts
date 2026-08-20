export type CaerusErrorCode = 'CAERUS' | 'CONFLICT' | 'VALIDATION'

export class CaerusError extends Error {
  readonly code: CaerusErrorCode = 'CAERUS'
  readonly isCaerusError = true
  constructor(message: string) {
    super(message)
    this.name = 'CaerusError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class ConflictError extends CaerusError {
  readonly code = 'CONFLICT'
  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

export class ValidationError extends CaerusError {
  readonly code = 'VALIDATION'
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

const CODIGOS_DEL_SDK: Record<string, CaerusErrorCode> = {
  CONFLICT: 'CONFLICT',
  VALIDATION: 'VALIDATION',
  RESOURCE_NOT_FOUND: 'VALIDATION',
  AUTHENTICATION: 'CAERUS',
  TIMEOUT: 'CAERUS',
  UNKNOWN: 'CAERUS',
}

export function caerusErrorCode(error: unknown): CaerusErrorCode | null {
  if (!error || typeof error !== 'object') return null
  if ((error as { isCaerusError?: boolean }).isCaerusError) {
    return (error as CaerusError).code
  }

  const code = (error as { code?: unknown }).code
  if (error instanceof Error && typeof code === 'string' && code in CODIGOS_DEL_SDK) {
    return CODIGOS_DEL_SDK[code]!
  }
  return null
}
