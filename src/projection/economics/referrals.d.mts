import type { IndexedReferralState, IndexerEventMeta, ReferralEvent } from '../../indexer/indexerTypes'
import type { ProjectionState } from '../state.mjs'

export function emptyReferralState(referrer?: string | null, supported?: boolean): IndexedReferralState
export function normalizeReferralStateMap(value: unknown): Map<string, IndexedReferralState>
export function referralStateFor(store: Pick<ProjectionState, 'referralRewardsSupported' | 'referralsByReferrer'>, referrer: string | null): IndexedReferralState
export function applyReferralEvent(store: ProjectionState, event: ReferralEvent, meta: IndexerEventMeta): IndexedReferralState
