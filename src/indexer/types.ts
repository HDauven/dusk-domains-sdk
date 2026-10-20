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
/** Version of the indexer HTTP API this client speaks, the `apiVersion` of every response. */
export const INDEXER_API_VERSION = 1
/** The block an indexer response was read at: its height and hash. */
export interface IndexerSnapshot {
  height: bigint
  blockHash: string
}
/** Envelope of every indexer response: API version, chain, directory, snapshot, and the data. */
export interface IndexerResponse<T> {
  apiVersion: 1
  chainId: string
  directory: string
  snapshot: IndexerSnapshot
  data: T
}
/** One page of a list; `nextCursor` is `null` on the last page. */
export interface IndexerPage<T> {
  items: T[]
  nextCursor: string | null
}
/**
 * Paging options: the cursor from the previous page, the page size (1 to 100, 50 by default), an
 * abort signal, and the block hash to pin the list to.
 */
export interface IndexerPageParams {
  cursor?: string
  limit?: number
  signal?: AbortSignal
  blockHash?: string
}
/** A name and the store that holds it, as `getNamesPage` lists them. */
export interface IndexedName {
  store: string
  name: Name
}
/** A by-name answer from the indexer: the store, the name's key, and what the store's read returns for it. */
export interface IndexedNameResource<T> {
  store: string
  key: NameKey
  value: T
}
/** `getNameState` data: the store's `get_name` answer from projected state. */
export type IndexedNameState = IndexedNameResource<Located<NameView>>
/** `getRecords` data: the store's `read_records` answer from projected state. */
export type IndexedRecords = IndexedNameResource<Located<RecordsView>>
/** `getSubnames` data: one page of the store's `children` answer from projected state. */
export type IndexedChildren = IndexedNameResource<Located<Children>>
/** Raw mapping, including stale or unauthorized identity; not a verified primary. */
export interface IndexedPrimary {
  store: string
  endpoint: number[]
  value: PrimaryView | null
}
/** `getCommitment` data: the commitment a store holds under `key`, or `null`. */
export interface IndexedCommitment {
  store: string
  key: CommitmentKey
  value: Commitment | null
}
/** `getMove` data: the store's `move_status` answer for a move ID, or `null`. */
export interface IndexedMove {
  store: string
  id: number[]
  value: MoveStatus | null
}
/** `getImport` data: the store's `import_status` answer for a move ID, or `null`. */
export interface IndexedImport {
  store: string
  id: number[]
  value: ImportStatus | null
}
/** An order and its marketplace, as `getOrdersPage` lists them. */
export interface IndexedOrder {
  market: string
  order: Order
}
/** `getRefund` data: an account's refund at a marketplace, or `null`. */
export interface IndexedRefund {
  market: string
  authority: number[]
  value: Refund | null
}
/** `getReferralState` data: a beneficiary's referral row, or `null`. */
export interface IndexedReferral {
  beneficiary: TypedPrincipal
  value: ReferralRow | null
}
/** `getPolicy` data: a policy's configuration. */
export interface IndexedPolicy {
  policy: string
  config: PolicyConfig
}
/** `getTransaction` data: a transaction's height, block hash and whether it succeeded. */
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
/** `getHealth` data: whether the index is complete, its finalized height and its lag in blocks. */
export interface IndexerHealth {
  complete: boolean
  finalizedHeight: bigint
  lagBlocks: bigint
}
/** `getVault` data: the vault funds the projection accounts for, not the runtime surplus. */
export type IndexedVault = ProjectionState['vault']
/** `getDirectory` data: the projected directory configuration. */
export type IndexedDirectory = DirectoryConfig
/** `getRenewalSchedule` data: the directory's renewal schedule. */
export type IndexedRenewalSchedule = RenewalSchedule
/** Same as `Forward`: a moved root's link to the store it moved to. */
export type IndexedForward = Forward
/** `getCooldowns` data: the store's `move_cooldowns` answer from projected state. */
export type IndexedCooldowns = IndexedNameResource<Located<MoveCooldowns>>
/** `getHome` data: where a root lives, as the store's `home` answers. */
export interface IndexedHome {
  store: string
  root: number[]
  value: Home
}
