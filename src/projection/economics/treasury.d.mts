import type { IndexedTreasuryState, IndexerEventMeta, ReferralEvent, TreasuryEvent } from '../../indexer/indexerTypes'

export function emptyTreasuryState(): IndexedTreasuryState
export function normalizeTreasuryState(value: unknown): IndexedTreasuryState
export function reduceTreasuryEvent(event: TreasuryEvent, current: IndexedTreasuryState, meta: IndexerEventMeta): IndexedTreasuryState
export function reduceTreasuryReferralReserve(event: ReferralEvent, current: IndexedTreasuryState): IndexedTreasuryState
export function reduceTreasuryReferralClaim(event: ReferralEvent, current: IndexedTreasuryState): IndexedTreasuryState
