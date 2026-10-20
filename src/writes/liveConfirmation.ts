/** Bounded indexer confirmation. A submitted transaction is not yet projected state. @module */
import type { DuskDomainsIndexerClient } from '../indexer/client.ts'
/**
 * Options for `waitForIndexerConfirmation`: the check, the attempts (20 by default), the delay between
 * them (1000 ms by default), an abort signal and a custom wait.
 */
export interface IndexerConfirmationOptions {
  check: () => Promise<boolean>
  attempts?: number
  delayMs?: number
  signal?: AbortSignal
  wait?: (delayMs: number, signal?: AbortSignal) => Promise<void>
}
/**
 * Outcome of a confirmation wait: whether the check passed, the attempts used, and the error of the
 * last attempt if it threw.
 */
export interface IndexerConfirmationResult {
  confirmed: boolean
  attempts: number
  error: unknown | null
}
async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted()
  await new Promise<void>((resolve, reject) => {
    const abort = (): void => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      reject(signal?.reason)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, ms)
    signal?.addEventListener('abort', abort, { once: true })
  })
}
/**
 * Run `check` until it returns true, up to `attempts` times with `delayMs` between them. Running out is
 * `confirmed: false`, not success; an abort throws.
 */
export async function waitForIndexerConfirmation(
  options: IndexerConfirmationOptions,
): Promise<IndexerConfirmationResult> {
  const attempts = options.attempts ?? 20,
    delayMs = options.delayMs ?? 1000
  if (
    !Number.isSafeInteger(attempts) ||
    attempts < 1 ||
    !Number.isSafeInteger(delayMs) ||
    delayMs < 0
  )
    throw new RangeError('Invalid confirmation bounds')
  let error: unknown | null = null
  for (let attempt = 1; attempt <= attempts; attempt++) {
    options.signal?.throwIfAborted()
    try {
      if (await options.check()) {
        options.signal?.throwIfAborted()
        return { confirmed: true, attempts: attempt, error: null }
      }
      error = null
    } catch (cause) {
      options.signal?.throwIfAborted()
      error = cause
    }
    if (attempt < attempts)
      await (options.wait ?? delay)(delayMs, options.signal)
  }
  return { confirmed: false, attempts, error }
}
/** Indexer must only expose transactions on its current canonical branch; confirmation is not finality. */
export function waitForIndexerWrite(
  client: DuskDomainsIndexerClient,
  txId: string,
  options: Omit<IndexerConfirmationOptions, 'check'> & {
    check?: IndexerConfirmationOptions['check']
  } = {},
): Promise<IndexerConfirmationResult> {
  return waitForIndexerConfirmation({
    ...options,
    check: async () => {
      const { data, snapshot } = await client.getTransaction(
        txId,
        options.signal,
      )
      if (!data) return false
      if (!data.success) throw new Error('Transaction reverted')
      if (
        snapshot.height < data.height ||
        (snapshot.height === data.height &&
          snapshot.blockHash !== data.blockHash)
      )
        throw new Error('Inconsistent transaction snapshot')
      return options.check ? options.check() : true
    },
  })
}
