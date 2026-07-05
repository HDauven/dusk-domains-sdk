import type { DuskDomainsErrorCode, DuskDomainsResult } from './sdkTypes'

export function success<T>(value: T): DuskDomainsResult<T> {
  return { ok: true, value }
}

export function failure<T>(code: DuskDomainsErrorCode, message: string): DuskDomainsResult<T> {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  }
}
