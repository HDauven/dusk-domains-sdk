import type { CoreFeeConfig } from '../core/namePolicy'
import type { DuskPrincipal } from '../core/principal'
import type { ResolverRecord } from '../core/records'
import type { SubnameRevocationPolicy } from '../core/subnames'

export type DuskDomainContractKey = 'core' | 'treasury' | 'marketplace' | 'router'
export type DuskDomainRequiredContractKey = 'core' | 'treasury' | 'router'

export type DuskDomainContractPreset = {
  contractId: string
  driverUrl: string
  name: string
  methodSigs: Record<string, string>
}

export type DuskDomainContractMap =
  & Record<DuskDomainRequiredContractKey, DuskDomainContractPreset>
  & Partial<Record<'marketplace', DuskDomainContractPreset>>

export type DuskDomainCallKind = 'read' | 'write'

export type DuskDomainCallMetadata<TArgs = unknown> = {
  contract: DuskDomainContractKey
  functionName: string
  kind: DuskDomainCallKind
  args: TArgs
  /** Sends a core call to a specific pool registry. Every registry shares the core driver. */
  contractId?: string
}

export type DuskDomainDecodedContext = {
  title: string
  description: string
  fields: Array<{
    label: string
    value: string
  }>
}

export type DuskDataDriverLike = {
  encodeInputFn: (fnName: string, json: string) => Uint8Array
  decodeOutputFn: (fnName: string, rkyvBytes: Uint8Array) => unknown
}

export type DuskConnectAppLike = {
  readContract: (params: {
    contract: DuskDomainContractPreset
    functionName: string
    args?: unknown
    decodedContext?: DuskDomainDecodedContext
  }) => Promise<unknown>
  prepareContractCall: (params: {
    contract: DuskDomainContractPreset
    functionName: string
    args?: unknown
    deposit?: string
    decodedContext?: DuskDomainDecodedContext
  }) => Promise<unknown>
  writeContract: (params: {
    contract: DuskDomainContractPreset
    functionName: string
    args?: unknown
    deposit?: string
    decodedContext?: DuskDomainDecodedContext
    preparedCall?: unknown
  }) => Promise<unknown>
}

/** A pool registry only needs its router; the router supplies treasury, marketplace and fees. */
export type CoreInitArgs = {
  router: string
}

export type RouterInitArgs = {
  operator: DuskPrincipal
  treasury: string
  /** Null when the deployment runs without a marketplace. */
  marketplace: string | null
  referralRewardBps: number
}

export type RouterAddPoolMemberArgs = {
  member: string
}

export type RouterSetOperatorRuntimeArgs = {
  operator: DuskPrincipal
}

/** A name the pool is asked about: `router.locate_name`, `core.holds_name`, `core.record_slot`. */
export type PoolNodeArgs = {
  node: string
}

/** An address the pool is asked about: `router.locate_primary`, `core.holds_primary`. */
export type PoolEndpointArgs = {
  endpointType: string
  endpointValue: string
}

export type CoreMoveRecordsRuntimeArgs = {
  node: string
}

export type RouterSetReferralConfigRuntimeArgs = {
  referralRewardBps: number
}

export type RouterSetFeeConfigRuntimeArgs = Omit<CoreFeeConfig, 'version' | 'updatedAt'>

export type CoreCommitRuntimeArgs = {
  commitment: string
}

export type CoreCompleteRegistrationRuntimeArgs = {
  commitment: string
  secret: string
  node: string
  label: string
  durationYears: number
  feeLux: number
  records: ResolverRecord[]
  primaryEndpoint?: {
    endpointType: string
    endpointValue: string
  } | null
  referrer?: DuskPrincipal | null
}

export type CoreRenewRuntimeArgs = {
  node: string
  durationYears: number
  feeLux: number
}

export type CoreUpdateAuthoritiesRuntimeArgs = {
  node: string
  owner: string
  manager: string
}

export type CoreEscrowFixedSaleRuntimeArgs = {
  node: string
  marketplaceContract: string
  name: string
  priceLux: number
  privateBuyer?: string | null
  expiresAt: number
  sellerRecipient: string
}

export type CoreEscrowAuctionRuntimeArgs = {
  node: string
  marketplaceContract: string
  name: string
  reservePriceLux: number
  durationBlocks: number
  sellerRecipient: string
}

export type CoreAcceptMarketplaceOfferRuntimeArgs = {
  node: string
  marketplaceContract: string
  buyerAuthority: string
  sellerRecipient: string
}

export type CoreSetRecordSenderRuntimeArgs = {
  node: string
  record: ResolverRecord
}

export type CoreClearRecordSenderRuntimeArgs = {
  node: string
  key: string
}

export type CoreRecordMutationInput =
  | {
      action: 'set'
      key: string
      value: string
      ttlSeconds: number
    }
  | {
      action: 'clear'
      key: string
    }

export type CoreMutateRecordsSenderRuntimeArgs = {
  node: string
  mutations: CoreRecordMutationInput[]
}

export type CoreSetPrimaryNameRuntimeArgs = {
  endpointType: string
  endpointValue: string
  node: string
  name: string
}

export type CoreClearPrimaryNameRuntimeArgs = {
  endpointType: string
  endpointValue: string
}

export type CoreCreateSubnameRuntimeArgs = {
  parentNode: string
  node: string
  parentName: string
  name: string
  label: string
  owner: string
  manager: string
  expiresAt: number
  expiryPolicy: string
  revocationPolicy: SubnameRevocationPolicy
}

export type CoreGetNameArgs = {
  node: string
}

export type CorePendingCommitmentArgs = {
  commitment: string
}

export type CoreReadRecordArgs = {
  node: string
  key: string
}

export type CoreReadPrimaryNameArgs = {
  endpointType: string
  endpointValue: string
}

export type TreasuryInitArgs = {
  operator: DuskPrincipal
  operatorRecipient: string
  allowedFeeSources: string[]
  /** Registries in this router's pool may pay fees and accrue referral rewards. */
  router: string
}

export type TreasuryUpdateOperatorRuntimeArgs = {
  operator: DuskPrincipal
  operatorRecipient: string
}

export type TreasuryClaimRuntimeArgs = {
  amountLux: number
}

export type TreasuryClaimReferralRewardRuntimeArgs = {
  amountLux: number
  recipient: string
}

export type TreasuryClaimAllReferralRewardsRuntimeArgs = {
  recipient: string
}

export type MarketplaceInitArgs = {
  router: string
  treasuryContract: string
  marketplaceAuthority: string
  operator: string
  feeBps: number
}

export type MarketplaceSetFeeRuntimeArgs = {
  feeBps: number
}

export type MarketplaceUpdateOperatorRuntimeArgs = {
  operator: string
}

export type MarketplaceBuyFixedSaleRuntimeArgs = {
  node: string
  priceLux: number
  buyerManager?: string | null
}

export type MarketplacePlaceBidRuntimeArgs = {
  node: string
  amountLux: number
  bidderManager?: string | null
}

export type MarketplaceAuctionNodeArgs = {
  node: string
}

export type MarketplacePlaceOfferRuntimeArgs = {
  node: string
  amountLux: number
  expiresAt: number
  buyerManager?: string | null
}

export type MarketplaceOfferArgs = {
  node: string
  buyerAuthority: string
}

export type MarketplaceClaimRefundRuntimeArgs = Record<string, never>

export type MarketplaceReadRefundArgs = {
  authority: string
}
