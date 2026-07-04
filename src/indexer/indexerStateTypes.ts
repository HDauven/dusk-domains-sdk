import type { CoreFeeConfig } from '../core/namePolicy'
import type { DuskPrincipal } from '../core/principal'
import type { ResolverRecord } from '../core/records'
import type { SubnameExpiryPolicy, SubnameRevocationPolicy, SubnameStatus } from '../core/subnames'
import type {
  IndexedEndpoint,
  NameLifecycleEvent,
  RegistrationControllerEvent,
  ResolverRecordEvent,
  ReverseRegistryEvent,
  SubnameRegistryEvent,
  TreasuryEvent,
  TreasuryFeeReason,
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
  amountLux: number
  remainingLux: number
  txId: string | null
  blockHeight: number | null
}

export type IndexedTreasuryState = {
  initialized: boolean
  operator: DuskPrincipal | null
  operatorAuthority: string | null
  operatorRecipient: string | null
  allowedFeeSources: string[]
  totalReceivedLux: number
  availableLux: number
  registrationReceivedLux: number
  renewalReceivedLux: number
  otherReceivedLux: number
  referralClaimableLux: number
  referralClaimedLux: number
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
  amountLux: number
  kind: 'accrual' | 'claim'
  counterparty: string | null
}

export type IndexedReferralState = {
  supported: boolean
  referrer: string | null
  claimableLux: number
  claimedLux: number
  referralCount: number
  recentActivity: IndexedReferralActivity[]
}

export type IndexedLifecycleName = {
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
  parentExpiresAt: string
  expiresAtBlockHeight?: number | null
  parentExpiresAtBlockHeight?: number | null
  expiryPolicy: SubnameExpiryPolicy
  revocationPolicy: SubnameRevocationPolicy
  status: SubnameStatus
  createdAt: string
  revokedAt: string | null
  lastEventType: SubnameRegistryEvent['type']
  txId: string | null
  blockHeight: number | null
}
