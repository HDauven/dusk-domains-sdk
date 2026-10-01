import type { ActivityEntry } from '../indexer/activity'
import type { ResolverRecord } from '../core/records'
import type { DuskDomainsIndexedEvent, DuskDomainsIndexedEventApplication } from '../indexer/indexerKit'
import type {
  IndexedFeeConfig, IndexedLifecycleName, IndexedMarketplaceAuction, IndexedMarketplaceConfig,
  IndexedMarketplaceFixedSale, IndexedMarketplaceOffer, IndexedMarketplaceRefund, IndexedPoolState,
  IndexedReferralState, IndexedRegistrationCommitment, IndexedResolverRecordHistoryEntry,
  IndexedReversePrimaryName, IndexedSubname, IndexedTreasuryState, IndexerEventMeta,
} from '../indexer/indexerTypes'

/** Mutable projection state; callers may derive filtered read views without changing this state. */
export type ProjectionState = {
  namesByNode: Map<string, IndexedLifecycleName>
  recordsByNode: Map<string, ResolverRecord[]>
  recordsByNodeKey: Map<string, ResolverRecord>
  recordHistoryByNode: Map<string, IndexedResolverRecordHistoryEntry[]>
  recordHistoryByNodeKey: Map<string, IndexedResolverRecordHistoryEntry[]>
  activityByNode: Map<string, ActivityEntry[]>
  reverseByEndpoint: Map<string, IndexedReversePrimaryName & { primaryName: string | null }>
  reverseKeysByNode: Map<string, Set<string>>
  subnamesByNode: Map<string, IndexedSubname & { canonicalName: string }>
  subnamesByParent: Map<string, IndexedSubname[]>
  subnamesByCanonical: Map<string, IndexedSubname>
  commitmentsById: Map<string, IndexedRegistrationCommitment>
  commitmentsByKey: Map<string, IndexedRegistrationCommitment>
  controllersByNode: Map<string, Set<string>>
  marketplaceFixedSalesByNode: Map<string, IndexedMarketplaceFixedSale>
  marketplaceAuctionsByNode: Map<string, IndexedMarketplaceAuction>
  marketplaceOffersByKey: Map<string, IndexedMarketplaceOffer>
  marketplaceRefundsByAuthority: Map<string, IndexedMarketplaceRefund>
  marketplaceConfig: IndexedMarketplaceConfig | null
  treasuryState: IndexedTreasuryState
  feeConfig: IndexedFeeConfig
  poolState: IndexedPoolState
  referralsByReferrer: Map<string, IndexedReferralState>
  referralRewardsSupported: boolean
}

export function createProjectionState(): ProjectionState
/** Applies one normalized event; the caller supplies journal identity, ordering and observation time. */
export function applyProjectionEvent(
  state: ProjectionState,
  event: DuskDomainsIndexedEvent,
  meta?: IndexerEventMeta,
  fallbackTimestamp?: string | null,
): DuskDomainsIndexedEventApplication | undefined
