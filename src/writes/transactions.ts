/** Dusk Connect submission/execution states without presentation copy. @module */
import type { FrozenCall } from '../frozen/calls.ts'
import type { ConnectApp } from '../wallet/duskConnectApp.ts'
export type DuskDomainTxStatus =
  | 'preparing'
  | 'awaiting_approval'
  | 'submitted'
  | 'executing'
  | 'executed'
  | 'failed'
  | 'rejected'
  | 'timeout'
export interface DuskDomainTxState {
  status: DuskDomainTxStatus
  call: { contractId: string; functionName: string }
  txId?: string
  result?: unknown
  error?: unknown
}
export type TransactionState = DuskDomainTxState
export interface DuskTxHandleLike {
  hash?: string
  id?: string
  status?: string
  wait?: () => Promise<unknown>
  waitExecuted?: () => Promise<unknown>
  onStatus?: (callback: (status: unknown) => void) => (() => void) | void
}
export interface SubmitDuskDomainWriteOptions {
  onUpdate?: (state: DuskDomainTxState) => void
  timeoutMs?: number
}
export function isDuskDomainTxBusy(
  state: DuskDomainTxState | null | undefined,
): boolean {
  return (
    !!state &&
    ['preparing', 'awaiting_approval', 'submitted', 'executing'].includes(
      state.status,
    )
  )
}
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null
}
function txId(value: unknown): string | undefined {
  const r = object(value)
  const id = r?.hash ?? r?.id ?? r?.transactionHash
  return typeof id === 'string' && id ? id : undefined
}
function failed(value: unknown, depth = 0): boolean {
  const r = object(value)
  if (!r || depth > 8) return false
  if (
    r.ok === false ||
    r.success === false ||
    r.reverted === true ||
    r.err ||
    r.error
  )
    return true
  const payload = object(r.event)?.payload
  if (ArrayBuffer.isView(payload)) {
    try {
      if (failed(JSON.parse(new TextDecoder().decode(payload)), depth + 1))
        return true
    } catch {
      /* non-JSON event */
    }
  }
  return failed(r.receipt, depth + 1)
}
function status(value: unknown): DuskDomainTxStatus | undefined {
  const s = typeof value === 'string' ? value : object(value)?.status
  const normalized = typeof s === 'string' ? s.toLowerCase() : undefined
  if (normalized === 'timeout' || normalized === 'rejected') return normalized
  if (failed(value)) return 'failed'
  if (!normalized) return undefined
  return [
    'submitted',
    'executing',
    'executed',
    'failed',
    'rejected',
    'timeout',
  ].includes(normalized)
    ? (normalized as DuskDomainTxStatus)
    : undefined
}
function terminal(s: DuskDomainTxStatus): boolean {
  return ['executed', 'failed', 'rejected', 'timeout'].includes(s)
}
export async function trackDuskDomainTransaction(
  handle: DuskTxHandleLike,
  call: DuskDomainTxState['call'],
  options: SubmitDuskDomainWriteOptions = {},
): Promise<DuskDomainTxState> {
  const timeoutMs = options.timeoutMs ?? 60_000
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1)
    throw new RangeError('Invalid transaction timeout')
  let latest: DuskDomainTxState = {
    status: status(handle) ?? 'submitted',
    call,
    txId: txId(handle),
  }
  let unsubscribe: (() => void) | undefined,
    timer: ReturnType<typeof setTimeout> | undefined,
    done = false
  let resolveTerminal: (update: unknown) => void = () => {}
  const terminalUpdate = new Promise<unknown>((resolve) => {
    resolveTerminal = resolve
  })
  const emit = (state: DuskDomainTxState): void => {
    latest = state
    options.onUpdate?.(state)
  }
  emit(latest)
  if (terminal(latest.status)) return latest
  try {
    unsubscribe =
      handle.onStatus?.((update) => {
        if (done || terminal(latest.status)) return
        const next = status(update)
        if (next) {
          emit({
            ...latest,
            status: next,
            txId: txId(update) ?? latest.txId,
            result: update,
          })
          if (terminal(next)) resolveTerminal(update)
        }
      }) ?? undefined
    const wait = handle.wait ?? handle.waitExecuted
    // A submitted hash alone never proves successful execution.
    if (!wait && !handle.onStatus) return latest
    if (terminal(latest.status)) return latest
    const result = await Promise.race([
      ...(wait ? [wait.call(handle)] : []),
      terminalUpdate,
      new Promise<unknown>((resolve) => {
        timer = setTimeout(() => resolve({ status: 'timeout' }), timeoutMs)
      }),
    ])
    const observed = status(result)
    // A failure event cannot be overwritten by an incomplete/successful wait payload.
    const finalStatus = terminal(latest.status)
      ? latest.status
      : (observed ?? latest.status)
    emit({
      ...latest,
      status: finalStatus,
      txId: txId(result) ?? latest.txId,
      result,
    })
    return latest
  } catch (error) {
    emit({
      ...latest,
      status: object(error)?.code === 4001 ? 'rejected' : 'failed',
      error,
    })
    return latest
  } finally {
    done = true
    clearTimeout(timer)
    unsubscribe?.()
  }
}
export async function submitDuskDomainWrite(
  app: ConnectApp,
  call: FrozenCall,
  options: SubmitDuskDomainWriteOptions = {},
): Promise<DuskDomainTxState> {
  const context = {
    contractId: call.contractId,
    functionName: call.functionName,
  }
  const emit = (status: DuskDomainTxStatus): void =>
    options.onUpdate?.({ status, call: context })
  try {
    emit('preparing')
    // This is a review preview. submit independently rebuilds and checks funds before signing.
    await app.prepare(call)
    emit('awaiting_approval')
    const result = await app.submit(call)
    if (!object(result) || !txId(result))
      throw new Error('Missing transaction identifier')
    return await trackDuskDomainTransaction(
      result as DuskTxHandleLike,
      context,
      options,
    )
  } catch (error) {
    const state: DuskDomainTxState = {
      status: object(error)?.code === 4001 ? 'rejected' : 'failed',
      call: context,
      error,
    }
    options.onUpdate?.(state)
    return state
  }
}
