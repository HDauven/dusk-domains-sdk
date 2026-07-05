import type {
  BrowserWriteProofKind,
  BrowserWriteProofLog,
  BrowserWriteProofMyNamesConfirmation,
  BrowserWriteProofRecord,
  BrowserWriteProofReservationSearchConfirmation,
  BrowserWriteProofTransaction,
  BrowserWriteProofUiConfirmations,
  RecordBrowserWriteProofUiConfirmationOptions,
} from './writeProofTypes'

export function parseBrowserWriteProofLog(value: unknown): BrowserWriteProofLog {
  const parsed = typeof value === 'string'
    ? safeJsonParse(value)
    : value
  const records = Array.isArray((parsed as BrowserWriteProofLog | null)?.records)
    ? (parsed as BrowserWriteProofLog).records
    : []

  return {
    version: 1,
    records: records
      .map(normalizeBrowserWriteProofRecord)
      .filter((record): record is BrowserWriteProofRecord => Boolean(record)),
  }
}

export function findBrowserWriteProofRecord(
  log: BrowserWriteProofLog,
  options: { name?: string | null; account?: string | null; chainId?: string | null } = {},
): BrowserWriteProofRecord | null {
  const name = options.name?.trim().toLowerCase()
  const account = options.account?.trim()
  const chainId = options.chainId?.trim()
  return log.records.find((record) => (
    (!name || record.name === name)
    && (!account || record.account === account)
    && (!chainId || record.chainId === chainId)
  )) ?? null
}

export function browserWriteProofTransactionsByKind(record: BrowserWriteProofRecord | null): Partial<Record<BrowserWriteProofKind, string>> {
  const transactions = Object.create(null) as Partial<Record<BrowserWriteProofKind, string>>
  for (const transaction of record?.transactions ?? []) {
    if (!transactions[transaction.kind]) transactions[transaction.kind] = transaction.txId
  }
  return transactions
}

export function browserWriteProofUiConfirmation(
  kind: keyof BrowserWriteProofUiConfirmations,
  confirmation: RecordBrowserWriteProofUiConfirmationOptions['confirmation'],
  now: () => Date = () => new Date(),
) {
  if (kind === 'myNames' && isMyNamesConfirmationInput(confirmation)) {
    return {
      ...confirmation,
      confirmedAt: now().toISOString(),
    } satisfies BrowserWriteProofMyNamesConfirmation
  }
  if (kind === 'reservationSearch' && isReservationSearchConfirmationInput(confirmation)) {
    return {
      ...confirmation,
      confirmedAt: now().toISOString(),
    } satisfies BrowserWriteProofReservationSearchConfirmation
  }
  return null
}

export function upsertProofTransaction(
  transactions: BrowserWriteProofTransaction[],
  transaction: BrowserWriteProofTransaction,
) {
  return [
    transaction,
    ...transactions.filter((existing) => existing.kind !== transaction.kind && existing.txId !== transaction.txId),
  ]
}

export function browserWriteProofRecordKey(record: Pick<BrowserWriteProofRecord, 'chainId' | 'name' | 'account'>) {
  return `${record.chainId}\n${record.name.toLowerCase()}\n${record.account}`
}

export function isRealTransactionId(value: string) {
  return /^(?:0x)?[0-9a-f]{64}$/iu.test(value) && !/^(?:0x)?0{64}$/iu.test(value)
}

function normalizeBrowserWriteProofRecord(value: unknown): BrowserWriteProofRecord | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Partial<BrowserWriteProofRecord>
  const chainId = typeof record.chainId === 'string' ? record.chainId.trim() : ''
  const name = typeof record.name === 'string' ? record.name.trim().toLowerCase() : ''
  const account = typeof record.account === 'string' ? record.account.trim() : ''
  const provider = typeof record.provider === 'string' && record.provider.trim() ? record.provider.trim() : 'Dusk Wallet'
  const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt : new Date(0).toISOString()
  const uiConfirmations = normalizeBrowserWriteProofUiConfirmations(record.uiConfirmations)
  if (!chainId || !name || !account) return null

  return {
    chainId,
    name,
    account,
    provider,
    updatedAt,
    transactions: Array.isArray(record.transactions)
      ? record.transactions
          .map(normalizeBrowserWriteProofTransaction)
          .filter((transaction): transaction is BrowserWriteProofTransaction => Boolean(transaction))
      : [],
    ...(uiConfirmations ? { uiConfirmations } : {}),
  }
}

function normalizeBrowserWriteProofUiConfirmations(value: unknown): BrowserWriteProofUiConfirmations | null {
  if (!value || typeof value !== 'object') return null
  const confirmations = value as Partial<BrowserWriteProofUiConfirmations>
  const myNames = normalizeMyNamesConfirmation(confirmations.myNames)
  const reservationSearch = normalizeReservationSearchConfirmation(confirmations.reservationSearch)
  if (!myNames && !reservationSearch) return null
  return {
    ...(myNames ? { myNames } : {}),
    ...(reservationSearch ? { reservationSearch } : {}),
  }
}

function normalizeMyNamesConfirmation(value: unknown): BrowserWriteProofMyNamesConfirmation | null {
  if (!value || typeof value !== 'object') return null
  const confirmation = value as Partial<BrowserWriteProofMyNamesConfirmation>
  const confirmedAt = typeof confirmation.confirmedAt === 'string' ? confirmation.confirmedAt : ''
  if (!confirmedAt || !Number.isFinite(Date.parse(confirmedAt))) return null
  if (!isMyNamesConfirmationInput(confirmation)) return null
  return {
    confirmedAt,
    pendingReservationVisible: confirmation.pendingReservationVisible,
    revealReadinessVisible: confirmation.revealReadinessVisible,
    activeNameVisible: confirmation.activeNameVisible,
    verifiedPrimaryVisible: confirmation.verifiedPrimaryVisible,
    pendingOrFailedTxStateVisible: confirmation.pendingOrFailedTxStateVisible,
  }
}

function normalizeReservationSearchConfirmation(value: unknown): BrowserWriteProofReservationSearchConfirmation | null {
  if (!value || typeof value !== 'object') return null
  const confirmation = value as Partial<BrowserWriteProofReservationSearchConfirmation>
  const confirmedAt = typeof confirmation.confirmedAt === 'string' ? confirmation.confirmedAt : ''
  if (!confirmedAt || !Number.isFinite(Date.parse(confirmedAt))) return null
  if (!isReservationSearchConfirmationInput(confirmation)) return null
  return {
    confirmedAt,
    searchedReservedName: confirmation.searchedReservedName,
    reservedByYouVisible: confirmation.reservedByYouVisible,
    resumeRegistrationVisible: confirmation.resumeRegistrationVisible,
    finishCtaVisible: confirmation.finishCtaVisible,
  }
}

function isMyNamesConfirmationInput(value: unknown): value is Omit<BrowserWriteProofMyNamesConfirmation, 'confirmedAt'> {
  const confirmation = value as Partial<BrowserWriteProofMyNamesConfirmation> | null
  return Boolean(
    confirmation
    && typeof confirmation.pendingReservationVisible === 'boolean'
    && typeof confirmation.revealReadinessVisible === 'boolean'
    && typeof confirmation.activeNameVisible === 'boolean'
    && typeof confirmation.verifiedPrimaryVisible === 'boolean'
    && typeof confirmation.pendingOrFailedTxStateVisible === 'boolean',
  )
}

function isReservationSearchConfirmationInput(value: unknown): value is Omit<BrowserWriteProofReservationSearchConfirmation, 'confirmedAt'> {
  const confirmation = value as Partial<BrowserWriteProofReservationSearchConfirmation> | null
  return Boolean(
    confirmation
    && typeof confirmation.searchedReservedName === 'boolean'
    && typeof confirmation.reservedByYouVisible === 'boolean'
    && typeof confirmation.resumeRegistrationVisible === 'boolean'
    && typeof confirmation.finishCtaVisible === 'boolean',
  )
}

function normalizeBrowserWriteProofTransaction(value: unknown): BrowserWriteProofTransaction | null {
  if (!value || typeof value !== 'object') return null
  const transaction = value as Partial<BrowserWriteProofTransaction>
  const kind = typeof transaction.kind === 'string' && isBrowserWriteProofKind(transaction.kind)
    ? transaction.kind
    : null
  const txId = typeof transaction.txId === 'string' ? transaction.txId.trim() : ''
  const functionName = typeof transaction.functionName === 'string' ? transaction.functionName.trim() : ''
  const recordedAt = typeof transaction.recordedAt === 'string' ? transaction.recordedAt : new Date(0).toISOString()
  if (!kind || !isRealTransactionId(txId)) return null

  return {
    kind,
    txId,
    status: 'executed',
    functionName,
    recordedAt,
  }
}

function isBrowserWriteProofKind(value: string): value is BrowserWriteProofKind {
  return ['commit', 'register', 'set_record', 'set_primary_name', 'create_subname'].includes(value)
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}
