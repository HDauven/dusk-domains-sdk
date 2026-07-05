import {
  decodedDuskDomainContext,
  isRuntimeBoundDuskDomainWrite,
  prepareDuskDomainContractCall,
  writeDuskDomainContract,
  type DuskConnectAppLike,
  type DuskDomainCallMetadata,
  type DuskDomainContractMap,
  type DuskDomainDecodedContext,
} from '../contracts/calls'

export type DuskDomainTxStatus =
  | 'preparing'
  | 'awaiting_approval'
  | 'submitted'
  | 'executing'
  | 'executed'
  | 'failed'
  | 'rejected'
  | 'timeout'

export type DuskDomainTxState = {
  status: DuskDomainTxStatus
  context: DuskDomainDecodedContext
  call?: DuskDomainTxCall
  txId?: string
  message?: string
  result?: unknown
}

const busyDuskDomainTxStatuses = new Set<DuskDomainTxStatus>([
  'preparing',
  'awaiting_approval',
  'submitted',
  'executing',
])

export function isDuskDomainTxBusy(txState: DuskDomainTxState | null | undefined): boolean {
  return txState ? busyDuskDomainTxStatuses.has(txState.status) : false
}

export type DuskDomainTxCall = {
  contract: DuskDomainCallMetadata['contract']
  functionName: string
}

export type DuskTxHandleLike = {
  id?: string
  hash?: string
  transactionHash?: string
  status?: string
  wait?: () => Promise<unknown>
  waitExecuted?: () => Promise<unknown>
  result?: Promise<unknown>
  onStatus?: (handler: (status: unknown) => void) => (() => void) | void
  subscribe?: (handler: (status: unknown) => void) => (() => void) | void
  on?: (event: string, handler: (status: unknown) => void) => (() => void) | void
}

export type SubmitDuskDomainWriteOptions = {
  onUpdate?: (state: DuskDomainTxState) => void
  timeoutMs?: number
  contracts?: DuskDomainContractMap
  call?: DuskDomainTxCall
  allowUnsafePreviewCall?: boolean
}

export async function submitDuskDomainWrite(
  app: DuskConnectAppLike,
  call: DuskDomainCallMetadata,
  options: SubmitDuskDomainWriteOptions = {},
): Promise<DuskDomainTxState> {
  const context = decodedDuskDomainContext(call, options.contracts)
  const txCall = txCallFrom(call)
  try {
    emit(options, { status: 'preparing', context, call: txCall })
    if (!options.allowUnsafePreviewCall && !isRuntimeBoundDuskDomainWrite(call)) {
      throw new Error('This action cannot be submitted safely from the browser yet.')
    }
    const preparedCall = await prepareDuskDomainContractCall(app, call, options.contracts)

    emit(options, { status: 'awaiting_approval', context, call: txCall })
    const result = await writeDuskDomainContract(app, call, preparedCall, options.contracts)

    if (isTxHandleLike(result)) {
      return await trackDuskDomainTransaction(result, context, { ...options, call: txCall })
    }

    const executed = {
      status: 'executed',
      context,
      call: txCall,
      txId: txIdFrom(result),
      result,
    } satisfies DuskDomainTxState
    emit(options, executed)
    return executed
  } catch (error) {
    const failed = failedTxState(error, context, undefined, txCall)
    emit(options, failed)
    return failed
  }
}

export async function trackDuskDomainTransaction(
  handle: DuskTxHandleLike,
  context: DuskDomainDecodedContext,
  options: SubmitDuskDomainWriteOptions = {},
): Promise<DuskDomainTxState> {
  let unsubscribe: (() => void) | undefined
  let latestTxId = txIdFrom(handle)
  const submitted: DuskDomainTxState = {
    status: normalizeTxStatus(handle.status) ?? 'submitted',
    context,
    call: options.call,
    txId: latestTxId,
  }
  emit(options, submitted)
  let lastStatus = submitted.status

  if (isTerminalTxStatus(submitted.status)) {
    return submitted
  }

  try {
    unsubscribe = subscribeToHandle(handle, (status) => {
      const nextStatus = normalizeTxStatus(status) ?? 'executing'
      latestTxId = txIdFrom(status) ?? latestTxId ?? txIdFrom(handle)
      if (nextStatus === lastStatus) return
      lastStatus = nextStatus
      emit(options, {
        status: nextStatus,
        context,
        call: options.call,
        txId: latestTxId,
        message: txMessageFrom(status),
        result: status,
      })
    })

    const result = await waitWithTimeout(waitForHandle(handle), options.timeoutMs)
    latestTxId = txIdFrom(result) ?? latestTxId ?? txIdFrom(handle)
    const finalStatus = finalStatusFromWaitResult(result, lastStatus)
    const executed = {
      status: finalStatus,
      context,
      call: options.call,
      txId: latestTxId,
      message: finalStatus === 'executed' ? undefined : txMessageFrom(result),
      result,
    } satisfies DuskDomainTxState
    emit(options, executed)
    return executed
  } catch (error) {
    const failed = failedTxState(error, context, latestTxId ?? txIdFrom(handle), options.call)
    emit(options, failed)
    return failed
  } finally {
    unsubscribe?.()
  }
}

export function createPreviewDuskTxHandle(options: {
  txId: string
  delayMs?: number
  finalStatus?: 'executed' | 'failed' | 'rejected'
  errorMessage?: string
}): DuskTxHandleLike {
  const delayMs = options.delayMs ?? 260
  const finalStatus = options.finalStatus ?? 'executed'

  return {
    id: options.txId,
    status: 'submitted',
    async wait() {
      await new Promise((resolve) => globalThis.setTimeout(resolve, delayMs))
      if (finalStatus === 'failed') throw new Error(options.errorMessage ?? 'Transaction failed.')
      if (finalStatus === 'rejected') throw new Error(options.errorMessage ?? 'Wallet approval rejected.')
      return { id: options.txId, status: finalStatus }
    },
  }
}

function emit(options: SubmitDuskDomainWriteOptions, state: DuskDomainTxState) {
  options.onUpdate?.(state)
}

function failedTxState(error: unknown, context: DuskDomainDecodedContext, txId?: string, call?: DuskDomainTxCall) {
  return {
    status: isTimeout(error) ? 'timeout' : isRejected(error) ? 'rejected' : 'failed',
    context,
    call,
    txId,
    message: error instanceof Error ? error.message : String(error),
  } satisfies DuskDomainTxState
}

function txCallFrom(call: DuskDomainCallMetadata): DuskDomainTxCall {
  return {
    contract: call.contract,
    functionName: call.functionName,
  }
}

function isTxHandleLike(value: unknown): value is DuskTxHandleLike {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<DuskTxHandleLike>
  return Boolean(
    candidate.wait
    || candidate.waitExecuted
    || candidate.result
    || candidate.onStatus
    || candidate.subscribe
    || candidate.on
    || candidate.id
    || candidate.hash,
  )
}

function subscribeToHandle(handle: DuskTxHandleLike, handler: (status: unknown) => void) {
  if (handle.onStatus) return handle.onStatus(handler) ?? undefined
  if (handle.subscribe) return handle.subscribe(handler) ?? undefined
  if (handle.on) return handle.on('status', handler) ?? handle.on('change', handler) ?? undefined
  return undefined
}

async function waitForHandle(handle: DuskTxHandleLike) {
  if (handle.wait) return await handle.wait()
  if (handle.waitExecuted) return await handle.waitExecuted()
  if (handle.result) return await handle.result
  return handle
}

function normalizeTxStatus(status: unknown): DuskDomainTxStatus | null {
  const value = typeof status === 'string'
    ? status
    : status && typeof status === 'object' && 'status' in status && typeof status.status === 'string'
      ? status.status
      : ''

  const normalized = value.toLowerCase().replaceAll('-', '_')
  if (normalized === 'prepared') return 'preparing'
  if (normalized === 'approval' || normalized === 'awaiting_approval' || normalized === 'waiting_for_signature') {
    return 'awaiting_approval'
  }
  if (normalized === 'submitted' || normalized === 'broadcast') return 'submitted'
  if (normalized === 'pending' || normalized === 'confirming' || normalized === 'executing') return 'executing'
  if (normalized === 'executed' || normalized === 'confirmed' || normalized === 'success') return 'executed'
  if (normalized === 'failed' || normalized === 'error') return 'failed'
  if (normalized === 'rejected' || normalized === 'denied') return 'rejected'
  if (normalized === 'timeout' || normalized === 'timed_out') return 'timeout'
  return null
}

function finalStatusFromWaitResult(result: unknown, lastStatus: DuskDomainTxStatus): DuskDomainTxStatus {
  const resultStatus = normalizeTxStatus(result)
  if (isTerminalTxStatus(resultStatus)) return resultStatus
  if (isTerminalTxStatus(lastStatus)) return lastStatus
  return 'executed'
}

function isTerminalTxStatus(status: DuskDomainTxStatus | null): status is DuskDomainTxStatus {
  return status === 'executed'
    || status === 'failed'
    || status === 'rejected'
    || status === 'timeout'
}

function txMessageFrom(value: unknown) {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  for (const key of ['error', 'message', 'reason']) {
    const message = record[key]
    if (typeof message === 'string' && message.trim()) return message
  }
  const receipt = record.receipt
  if (receipt && typeof receipt === 'object') {
    return txMessageFrom(receipt)
  }
  return undefined
}

async function waitWithTimeout<T>(promise: Promise<T>, timeoutMs: number | undefined) {
  if (!timeoutMs) return await promise

  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = globalThis.setTimeout(() => reject(new TxTimeoutError(timeoutMs)), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId)
  }
}

function isRejected(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /reject|denied|cancel/i.test(message)
}

function isTimeout(error: unknown) {
  return error instanceof TxTimeoutError
}

function txIdFrom(value: unknown) {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  for (const key of ['id', 'hash', 'transactionHash', 'txHash']) {
    const txId = record[key]
    if (typeof txId === 'string' && txId) return txId
  }
  return undefined
}

class TxTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Transaction did not settle within ${timeoutMs}ms.`)
  }
}
