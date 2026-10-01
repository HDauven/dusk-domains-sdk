import type { DuskDomainsIndexedEventApplication } from '../../indexer/indexerKit'
import type { IndexedLifecycleName, IndexedMarketplaceConfig, IndexerEventMeta, MarketplaceEvent } from '../../indexer/indexerTypes'
import type { ProjectionState } from '../state.mjs'

export function applyMarketplaceEvent(store: ProjectionState, event: MarketplaceEvent, meta: IndexerEventMeta, fallbackTimestamp: string | null): DuskDomainsIndexedEventApplication
export function emptyMarketplaceConfig(): IndexedMarketplaceConfig
export function marketplaceOfferKey(node: string, buyerAuthority: string): string
export function marketplaceOrderIsEscrowed(name: IndexedLifecycleName | null | undefined, marketplaceContractId: string | null): boolean
