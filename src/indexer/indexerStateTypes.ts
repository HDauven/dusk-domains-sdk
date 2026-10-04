import type { CoreFeeConfig } from '../core/namePolicy'
import type { DuskPrincipal } from '../core/principal'
import type { ResolverRecord } from '../core/records'
import type { SubnameExpiryPolicy, SubnameStatus } from '../core/subnames'
import type {
  IndexedEndpoint,
  NameLifecycleEvent,
  RegistrationControllerEvent,
  ResolverRecordEvent,
  ReverseRegistryEvent,
  SubnameRegistryEvent,
  TreasuryEvent,
  TreasuryFeeReason,
  MarketplaceEvent,
} from './events/indexerEventTypes'

export type IndexedFeeConfig = CoreFeeConfig & {
  operator: DuskPrincipal | string | null
  txId: string | null
  blockHeight: number | null
}

export type IndexedTreasuryClaim = {
  operator: DuskPrincipal | null
  operatorAuthority?: string
  operatorRecipient: string
  amountLux: number | string
  remainingLux: number | string
  txId: string | null
  blockHeight: number | null
}

export type IndexedTreasuryState = {
  pendingOperator: DuskPrincipal | null
  pendingOperatorRecipient: string | null
  initialized: boolean
  operator: DuskPrincipal | null
  operatorAuthority: string | null
  operatorRecipient: string | null
  allowedFeeSources: string[]
  totalReceivedLux: number | string
  availableLux: number | string
  premiumReceivedLux?: number | string
  premiumAccountingError?: string | null
  registrationReceivedLux: number | string
  renewalReceivedLux: number | string
  otherReceivedLux: number | string
  referralClaimableLux: number | string
  referralClaimedLux: number | string
  referralCount: number
  lastFeeSourceContract: string | null
  lastFeeReason: TreasuryFeeReason | null
  lastFeeNode: string | null
  lastEventType: TreasuryEvent['type'] | null
  txId: string | null
  blockHeight: number | null
  claims: IndexedTreasuryClaim[]
}

export type IndexedReferralActivity = {
  txId: string | null
  blockHeight: number | null
  amountLux: number | string
  kind: 'accrual' | 'claim'
  counterparty: string | null
}

export type IndexedReferralState = {
  supported: boolean
  referrer: string | null
  claimableLux: number | string
  claimedLux: number | string
  referralCount: number
  recentActivity: IndexedReferralActivity[]
}

export type NamespaceSummary = { descendantCount: number; heldByOthersCount: number }
export type NamespaceAncestor = { node: string; name: string; owner: string; manager: string; expiresAtBlockHeight: number | null }
export type IndexedNamespace = NamespaceSummary & { subnames: IndexedSubname[]; ancestors: NamespaceAncestor[] }

export type IndexedLifecycleName = {
  registrationPremiumLux?: number
  premiumLux?: number
  premiumEndsAt?: string | null
  premiumEndsAtBlockHeight?: number | null
  premiumNextStepAt?: string | null
  premiumNextStepBlockHeight?: number | null
  namespacePurchase?: { seller: string; buyer: string } | null
  namespace?: IndexedNamespace
  /** Provenance of this registration; retained through renewal and transfer. */
  issuedAsReserved?: boolean
  reservedIssuance?: {
    operator: DuskPrincipal
    registry: string
    issuedAt: string
    issuedAtBlockHeight: number | null
  } | null
  node: string
  canonicalName: string
  owner: string | null
  manager: string | null
  resolverId: string | null
  expiresAt: string | null
  graceEndsAt: string | null
  expiresAtBlockHeight?: number | null
  graceEndsAtBlockHeight?: number | null
  status: 'active' | 'expired' | 'released'
  lastEventType: NameLifecycleEvent['type']
}

export type IndexedNameSummary = IndexedLifecycleName & {
  records: ResolverRecord[]
  primaryName?: string | null
  primaryStatus?: 'verified' | 'missing' | 'mismatch' | 'no_address'
  subnameCount: number
  activityCount: number
}

export type IndexedResolverRecordSet = {
  node: string
  records: ResolverRecord[]
  lastController: string
  lastUpdatedAt: string | null
  lastEventType: ResolverRecordEvent['type']
}

export type IndexedResolverRecordHistoryEntry = {
  node: string
  key: string
  action: 'set' | 'clear'
  record: ResolverRecord | null
  previousRecord: ResolverRecord | null
  controller: string
  updatedAt: string
  txId: string | null
  blockHeight: number | null
  eventIndex: number | null
  eventType: ResolverRecordEvent['type']
}

export type IndexedRegistrationCommitment = {
  commitment: string
  controller: string
  createdAt: string | null
  node: string | null
  status: 'committed' | 'revealed'
  committedTxId: string | null
  committedBlockHeight: number | null
  revealedTxId: string | null
  revealedBlockHeight: number | null
  lastEventType: RegistrationControllerEvent['type']
}

export type IndexedReversePrimaryName = {
  key: string
  endpoint: IndexedEndpoint
  controller: string
  node: string
  name: string | null
  previousName: string | null
  updatedAt: string
  status: 'set' | 'cleared'
  txId: string | null
  blockHeight: number | null
  lastEventType: ReverseRegistryEvent['type']
}

export type IndexedSubname = {
  parentNode: string
  node: string
  parentName: string
  name: string
  label: string
  owner: string
  manager: string
  resolver: string
  expiresAt: string
  graceEndsAt?: string | null
  parentExpiresAt: string
  expiresAtBlockHeight?: number | null
  graceEndsAtBlockHeight?: number | null
  parentExpiresAtBlockHeight?: number | null
  expiryPolicy: SubnameExpiryPolicy
  status: SubnameStatus
  createdAt: string
  lastEventType: SubnameRegistryEvent['type']
  txId: string | null
  blockHeight: number | null
}

export type IndexedMarketplaceConfig = {
  tradingPaused: boolean
  pendingOperator: string | null
  initialized: boolean
  router: string | null
  treasuryContract: string | null
  marketplaceAuthority: string | null
  operator: string | null
  feeBps: number
  updatedAtBlockHeight: number | null
  txId: string | null
  blockHeight: number | null
}

export type IndexedMarketplaceFixedSale = {
  saleId: number
  namespace?: NamespaceSummary
  node: string
  name: string
  sellerAuthority: string
  priceLux: number
  privateBuyer: string | null
  feeBps: number
  expiresAtBlockHeight: number
  openedAtBlockHeight: number
  marketplaceContractId: string | null
  escrowed: boolean
  txId: string | null
  blockHeight: number | null
  lastEventType: MarketplaceEvent['type']
}

export type IndexedMarketplaceBid = {
  bidderAuthority: string
  amountLux: number
  placedAtBlockHeight: number
}

export type IndexedMarketplaceAuction = {
  auctionId: number
  namespace?: NamespaceSummary
  node: string
  name: string
  sellerAuthority: string
  reservePriceLux: number
  durationBlocks: number
  startDeadlineBlockHeight: number
  feeBps: number
  startBlockHeight: number | null
  endBlockHeight: number | null
  highestBid: IndexedMarketplaceBid | null
  bidCount: number
  createdAtBlockHeight: number
  marketplaceContractId: string | null
  escrowed: boolean
  txId: string | null
  blockHeight: number | null
  lastEventType: MarketplaceEvent['type']
}

export type IndexedMarketplaceOffer = {
  node: string
  name: string
  buyerAuthority: string
  amountLux: number
  feeBps: number
  expiresAtBlockHeight: number
  placedAtBlockHeight: number
  txId: string | null
  blockHeight: number | null
  lastEventType: MarketplaceEvent['type']
}

export type IndexedMarketplaceRefund = {
  authority: string
  recipient: string | null
  amountLux: number
  lastEventType: MarketplaceEvent['type']
  txId: string | null
  blockHeight: number | null
}

/** The contract pool as the router's events describe it. Members are in the order they joined. */
export type IndexedPoolState = {
  registrationsPaused: boolean
  pendingOperator: DuskPrincipal | null
  initialized: boolean
  router: string | null
  operator: DuskPrincipal | null
  treasury: string | null
  marketplace: string | null
  registries: string[]
  resolvers: string[]
  txId: string | null
  blockHeight: number | null
}
