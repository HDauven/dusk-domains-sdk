import type { DuskDomainTxState } from '../writes/transactions'
import { captureBrowserWriteProofLog } from './writeProofCapture'
import {
  browserWriteProofRecordKey,
  browserWriteProofUiConfirmation,
  isRealTransactionId,
  parseBrowserWriteProofLog,
  upsertProofTransaction,
} from './writeProofLog'
import type {
  BrowserWriteProofKind,
  BrowserWriteProofLog,
  BrowserWriteProofRecord,
  BrowserWriteProofTransaction,
  RecordBrowserWriteProofOptions,
  RecordBrowserWriteProofUiConfirmationOptions,
} from './writeProofTypes'
import { DUSK_DOMAINS_WRITE_PROOF_STORAGE_KEY } from './writeProofTypes'

export { captureBrowserWriteProofLog } from './writeProofCapture'
export {
  browserWriteProofTransactionsByKind,
  findBrowserWriteProofRecord,
  parseBrowserWriteProofLog,
} from './writeProofLog'
export type {
  BrowserWriteProofKind,
  BrowserWriteProofLog,
  BrowserWriteProofMyNamesConfirmation,
  BrowserWriteProofRecord,
  BrowserWriteProofReservationSearchConfirmation,
  BrowserWriteProofTransaction,
  BrowserWriteProofUiConfirmations,
  RecordBrowserWriteProofOptions,
  RecordBrowserWriteProofUiConfirmationOptions,
} from './writeProofTypes'
export { DUSK_DOMAINS_WRITE_PROOF_STORAGE_KEY } from './writeProofTypes'

const kindByFunctionName: Record<string, BrowserWriteProofKind> = {
  commit_runtime: 'commit',
  complete_registration_runtime: 'register',
  set_record_sender_runtime: 'set_record',
  mutate_records_sender_runtime: 'set_record',
  set_primary_name_runtime: 'set_primary_name',
  create_subname_runtime: 'create_subname',
}

export function recordBrowserWriteProof(options: RecordBrowserWriteProofOptions): boolean {
  const storage = options.storage ?? globalThis.localStorage
  const transaction = browserWriteProofTransactionFromState(options.state, options.now)
  if (!transaction) return false

  const chainId = options.chainId.trim()
  const name = options.name.trim().toLowerCase()
  const account = options.account.trim()
  if (!chainId || !name || !account) return false

  const log = parseBrowserWriteProofLog(storage.getItem(DUSK_DOMAINS_WRITE_PROOF_STORAGE_KEY))
  const recordKey = browserWriteProofRecordKey({ chainId, name, account })
  const existingIndex = log.records.findIndex((record) => browserWriteProofRecordKey(record) === recordKey)
  const now = transaction.recordedAt
  const provider = options.provider?.trim() || 'Dusk Wallet'
  const nextRecord: BrowserWriteProofRecord = existingIndex >= 0
    ? {
        ...log.records[existingIndex],
        provider,
        updatedAt: now,
        transactions: upsertProofTransaction(log.records[existingIndex].transactions, transaction),
      }
    : {
        chainId,
        name,
        account,
        provider,
        updatedAt: now,
        transactions: [transaction],
      }

  const records = existingIndex >= 0
    ? log.records.map((record, index) => index === existingIndex ? nextRecord : record)
    : [nextRecord, ...log.records]

  const nextLog = {
    version: 1,
    records,
  } satisfies BrowserWriteProofLog

  storage.setItem(DUSK_DOMAINS_WRITE_PROOF_STORAGE_KEY, JSON.stringify(nextLog))
  void captureBrowserWriteProofLog(options.captureUrl, nextLog, options.fetcher)
  return true
}

export function recordBrowserWriteProofUiConfirmation(options: RecordBrowserWriteProofUiConfirmationOptions): boolean {
  const storage = options.storage ?? globalThis.localStorage
  const chainId = options.chainId.trim()
  const name = options.name.trim().toLowerCase()
  const account = options.account.trim()
  if (!chainId || !name || !account) return false

  const confirmation = browserWriteProofUiConfirmation(options.kind, options.confirmation, options.now)
  if (!confirmation) return false

  const log = parseBrowserWriteProofLog(storage.getItem(DUSK_DOMAINS_WRITE_PROOF_STORAGE_KEY))
  const recordKey = browserWriteProofRecordKey({ chainId, name, account })
  const existingIndex = log.records.findIndex((record) => browserWriteProofRecordKey(record) === recordKey)
  const provider = options.provider?.trim() || 'Dusk Wallet'
  const existingRecord = existingIndex >= 0 ? log.records[existingIndex] : null
  const nextRecord: BrowserWriteProofRecord = {
    chainId,
    name,
    account,
    provider,
    updatedAt: confirmation.confirmedAt,
    transactions: existingRecord?.transactions ?? [],
    uiConfirmations: {
      ...(existingRecord?.uiConfirmations ?? {}),
      [options.kind]: confirmation,
    },
  }

  const records = existingIndex >= 0
    ? log.records.map((record, index) => index === existingIndex ? nextRecord : record)
    : [nextRecord, ...log.records]

  const nextLog = {
    version: 1,
    records,
  } satisfies BrowserWriteProofLog

  storage.setItem(DUSK_DOMAINS_WRITE_PROOF_STORAGE_KEY, JSON.stringify(nextLog))
  void captureBrowserWriteProofLog(options.captureUrl, nextLog, options.fetcher)
  return true
}

export function browserWriteProofTransactionFromState(
  state: DuskDomainTxState,
  now: () => Date = () => new Date(),
): BrowserWriteProofTransaction | null {
  if (state.status !== 'executed') return null
  const functionName = state.call?.functionName ?? ''
  const kind = kindByFunctionName[functionName]
  const txId = state.txId?.trim() ?? ''
  if (!kind || !isRealTransactionId(txId)) return null

  return {
    kind,
    txId,
    status: 'executed',
    functionName,
    recordedAt: now().toISOString(),
  }
}
