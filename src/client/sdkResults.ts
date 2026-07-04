import type { DuskNamesErrorCode, DuskNamesResult } from './sdkTypes'

export function success<T>(value: T): DuskNamesResult<T> {
  return { ok: true, value }
}

export function failure<T>(code: DuskNamesErrorCode, message: string): DuskNamesResult<T> {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  }
}
