import type { DuskNameTxState } from '../writes/transactions'

export type BrowserWriteProofKind =
  | 'commit'
  | 'register'
  | 'set_record'
  | 'set_primary_name'
  | 'create_subname'

export type BrowserWriteProofTransaction = {
  kind: BrowserWriteProofKind
  txId: string
  status: 'executed'
  functionName: string
  recordedAt: string
}

export type BrowserWriteProofMyNamesConfirmation = {
  confirmedAt: string
  pendingReservationVisible: boolean
  revealReadinessVisible: boolean
  activeNameVisible: boolean
  verifiedPrimaryVisible: boolean
  pendingOrFailedTxStateVisible: boolean
}

export type BrowserWriteProofReservationSearchConfirmation = {
  confirmedAt: string
  searchedReservedName: boolean
  reservedByYouVisible: boolean
  resumeRegistrationVisible: boolean
  finishCtaVisible: boolean
}

export type BrowserWriteProofUiConfirmations = {
  myNames?: BrowserWriteProofMyNamesConfirmation
  reservationSearch?: BrowserWriteProofReservationSearchConfirmation
}

export type BrowserWriteProofRecord = {
  chainId: string
  name: string
  account: string
  provider: string
  updatedAt: string
  transactions: BrowserWriteProofTransaction[]
  uiConfirmations?: BrowserWriteProofUiConfirmations
}

export type BrowserWriteProofLog = {
  version: 1
  records: BrowserWriteProofRecord[]
}

export type RecordBrowserWriteProofOptions = {
  chainId: string
  name: string
  account: string
  provider?: string
  state: DuskNameTxState
  storage?: Pick<Storage, 'getItem' | 'setItem'>
  captureUrl?: string
  fetcher?: typeof fetch
  now?: () => Date
}

export type RecordBrowserWriteProofUiConfirmationOptions = {
  chainId: string
  name: string
  account: string
  provider?: string
  kind: keyof BrowserWriteProofUiConfirmations
  confirmation: Omit<BrowserWriteProofMyNamesConfirmation, 'confirmedAt'>
    | Omit<BrowserWriteProofReservationSearchConfirmation, 'confirmedAt'>
  storage?: Pick<Storage, 'getItem' | 'setItem'>
  captureUrl?: string
  fetcher?: typeof fetch
  now?: () => Date
}

export const DUSK_NAMES_WRITE_PROOF_STORAGE_KEY = 'dusk-names:browser-write-proof:v1'
