/** Versioned HTTP read model built from the frozen projection. @module */
import type { ProjectionState } from '../frozen/projection.ts'
import type { CommittedEvent } from '../frozen/journal.ts'
import type {
  Name,
  NameKey,
  Located,
  NameView,
  RecordsView,
  PrimaryView,
  Commitment,
  CommitmentKey,
  Children,
  MoveStatus,
  ImportStatus,
  Order,
  Refund,
  RenewalSchedule,
  PolicyConfig,
  DirectoryConfig,
  ReferralRow,
  TypedPrincipal,
  Forward,
  MoveCooldowns,
  Home,
} from '../frozen/types.ts'
export const INDEXER_API_VERSION = 1
export interface IndexerSnapshot {
  height: bigint
  blockHash: string
}
export interface IndexerResponse<T> {
  apiVersion: 1
  chainId: string
  directory: string
  snapshot: IndexerSnapshot
  data: T
}
export interface IndexerPage<T> {
  items: T[]
  nextCursor: string | null
}
export interface IndexerPageParams {
  cursor?: string
  limit?: number
  signal?: AbortSignal
  blockHash?: string
}
export interface IndexedName {
  store: string
  name: Name
}
export interface IndexedNameResource<T> {
  store: string
  key: NameKey
  value: T
}
export type IndexedNameState = IndexedNameResource<Located<NameView>>
export type IndexedRecords = IndexedNameResource<Located<RecordsView>>
export type IndexedChildren = IndexedNameResource<Located<Children>>
export interface IndexedPrimary {
  store: string
  endpoint: number[]
  value: PrimaryView | null
}
export interface IndexedCommitment {
  store: string
  key: CommitmentKey
  value: Commitment | null
}
export interface IndexedMove {
  store: string
  id: number[]
  value: MoveStatus | null
}
export interface IndexedImport {
  store: string
  id: number[]
  value: ImportStatus | null
}
export interface IndexedOrder {
  market: string
  order: Order
}
export interface IndexedRefund {
  market: string
  authority: number[]
  value: Refund | null
}
export interface IndexedReferral {
  beneficiary: TypedPrincipal
  value: ReferralRow | null
}
export interface IndexedPolicy {
  policy: string
  config: PolicyConfig
}
export interface IndexedTransaction {
  id: string
  height: bigint
  blockHash: string
  success: boolean
}
/** Committed protocol effects only. Labels/descriptions are application-owned. */
export interface IndexedEvent {
  transactionId: string
  event: CommittedEvent
}
export interface IndexerHealth {
  complete: boolean
  finalizedHeight: bigint
  lagBlocks: bigint
}
export type IndexedVault = ProjectionState['vault']
export type IndexedDirectory = DirectoryConfig
export type IndexedRenewalSchedule = RenewalSchedule
export type IndexedForward = Forward
export type IndexedCooldowns = IndexedNameResource<Located<MoveCooldowns>>
export interface IndexedHome {
  store: string
  root: number[]
  value: Home
}
