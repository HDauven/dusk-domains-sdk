import type { CoreFeeConfig } from '../../core/namePolicy'
import type { DuskPrincipal } from '../../core/principal'
import type { ResolverRecord, ResolverRecordKey } from '../../core/records'
import type { SubnameExpiryPolicy, SubnameRevocationPolicy } from '../../core/subnames'

export type IndexerEventMeta = {
  txId?: string
  blockHeight?: number | null
  contractId?: string | null
}

export type NameLifecycleEvent =
  | {
      type: 'name_registered'
      node: string
      label: string
      actor: string
      owner: string
      expiresAt: string
      graceEndsAt: string
      expiresAtBlockHeight?: number | null
      graceEndsAtBlockHeight?: number | null
      feeLux: number
    }
  | {
      type: 'name_renewed'
      node: string
      actor: string
      expiresAt: string
      graceEndsAt: string
      expiresAtBlockHeight?: number | null
      graceEndsAtBlockHeight?: number | null
      feeLux: number
    }
  | {
      type: 'name_expired'
      node: string
      label: string
      actor: string
      owner: string
      expiresAt: string
      graceEndsAt: string
      expiresAtBlockHeight?: number | null
      graceEndsAtBlockHeight?: number | null
      observedAt: string
    }
  | {
      type: 'name_released'
      node: string
      label: string
      actor: string
      previousOwner: string
      releasedAt: string
    }
  | {
      type: 'name_owner_changed'
      node: string
      actor: string
      previousOwner: string | null
      owner: string
      manager: string
      resolver: string
      expiresAt: string
      expiresAtBlockHeight?: number | null
    }
  | {
      type: 'resolver_changed'
      node: string
      actor: string
      resolver: string
    }

export type RegistrationControllerEvent =
  | {
      type: 'registration_committed'
      commitment: string
      controller: string
      createdAt: string
    }
  | {
      type: 'registration_revealed'
      commitment: string
      node: string
      controller: string
    }

export type ResolverRecordEvent =
  | {
      type: 'record_changed'
      node: string
      controller: string
      record: ResolverRecord
    }
  | {
      type: 'record_cleared'
      node: string
      controller: string
      key: ResolverRecordKey
    }

export type IndexedEndpoint = {
  type: ResolverRecordKey
  value: string
}

export type ReverseRegistryEvent = {
  type: 'primary_name_changed'
  endpoint: IndexedEndpoint
  controller: string
  node: string
  name: string | null
  previousName: string | null
  updatedAt: string
}

export type SubnameRegistryEvent =
  | {
      type: 'subname_created'
      parentNode: string
      node: string
      parentName: string
      name: string
      label: string
      actor: string
      owner: string
      manager: string
      resolver: string
      expiresAt: string
      parentExpiresAt: string
      expiresAtBlockHeight?: number | null
      parentExpiresAtBlockHeight?: number | null
      expiryPolicy: SubnameExpiryPolicy
      revocationPolicy: SubnameRevocationPolicy
      createdAt: string
    }
  | {
      type: 'subname_delegated'
      parentNode: string
      node: string
      name: string
      actor: string
      manager: string
      delegatedAt: string
    }
  | {
      type: 'subname_revoked'
      parentNode: string
      node: string
      name: string
      actor: string
      revokedAt: string
    }

export type TreasuryEvent =
  | {
      type: 'treasury_initialized'
      operator?: DuskPrincipal
      operatorAuthority?: string
      operatorRecipient: string
      allowedFeeSources: string[]
    }
  | {
      type: 'treasury_operator_changed'
      previousOperator?: DuskPrincipal
      operator?: DuskPrincipal
      previousOperatorAuthority?: string
      operatorAuthority?: string
      operatorRecipient: string
    }
  | {
      type: 'treasury_fee_received'
      sourceContract: string
      reason: TreasuryFeeReason
      node: string
      amountLux: number
      totalReceivedLux: number
      availableLux: number
      registrationReceivedLux: number
      renewalReceivedLux: number
      otherReceivedLux: number
    }
  | {
      type: 'treasury_claimed'
      operator?: DuskPrincipal
      operatorAuthority?: string
      operatorRecipient: string
      amountLux: number
      remainingLux: number
    }

export type TreasuryFeeReason = 'registration' | 'renewal' | 'other'

export type ReferralEvent =
  | {
      type: 'referral_reward_accrued'
      referrer: DuskPrincipal | string
      buyer: DuskPrincipal | string
      amountLux: number
      claimableLux: number
      claimedLux: number
      referralCount: number
    }
  | {
      type: 'referral_reward_claimed'
      referrer: DuskPrincipal | string
      recipient?: string
      amountLux: number
      remainingLux: number
      claimedLux: number
      referralCount: number
    }

export type FeeConfigEvent = {
  type: 'fee_config_updated'
  operator: DuskPrincipal | string
  previousConfig?: CoreFeeConfig
  config: CoreFeeConfig
}

export type MarketplaceEvent =
  | {
      type: 'marketplace_initialized'
      coreContract: string
      treasuryContract: string
      marketplaceAuthority: string
      operator: string
      feeBps: number
    }
  | {
      type: 'marketplace_config_updated'
      operator: string
      previousOperator: string
      previousFeeBps: number
      feeBps: number
      updatedAtBlockHeight: number
    }
  | {
      type: 'domain_fixed_sale_opened'
      node: string
      name: string
      sellerAuthority: string
      priceLux: number
      privateBuyer: string | null
      feeBps: number
      expiresAtBlockHeight: number
      openedAtBlockHeight: number
    }
  | {
      type: 'domain_fixed_sale_closed'
      node: string
      sellerAuthority: string
      expired: boolean
      domainExpired: boolean
      closedAtBlockHeight: number
    }
  | {
      type: 'domain_fixed_sale_filled'
      node: string
      name: string
      sellerAuthority: string
      buyerAuthority: string
      grossAmountLux: number
      protocolFeeLux: number
      sellerProceedsLux: number
      filledAtBlockHeight: number
    }
  | {
      type: 'domain_auction_created'
      node: string
      name: string
      sellerAuthority: string
      reservePriceLux: number
      durationBlocks: number
      startDeadlineBlockHeight: number
      feeBps: number
      createdAtBlockHeight: number
    }
  | {
      type: 'domain_bid_placed'
      node: string
      bidderAuthority: string
      amountLux: number
      previousBidderAuthority: string | null
      previousBidLux: number
      startBlock: number
      endBlock: number
      started: boolean
      extended: boolean
      bidCount: number
      placedAtBlockHeight: number
    }
  | {
      type: 'domain_auction_cancelled'
      node: string
      sellerAuthority: string
      expired: boolean
      domainExpired: boolean
      cancelledAtBlockHeight: number
    }
  | {
      type: 'domain_auction_settled'
      node: string
      name: string
      sellerAuthority: string
      winnerAuthority: string | null
      grossAmountLux: number
      protocolFeeLux: number
      sellerProceedsLux: number
      domainExpired: boolean
      settledAtBlockHeight: number
    }
  | {
      type: 'domain_offer_placed'
      node: string
      buyerAuthority: string
      amountLux: number
      feeBps: number
      expiresAtBlockHeight: number
      placedAtBlockHeight: number
    }
  | {
      type: 'domain_offer_closed'
      node: string
      buyerAuthority: string
      amountLux: number
      expired: boolean
      closedAtBlockHeight: number
    }
  | {
      type: 'domain_offer_accepted'
      node: string
      sellerAuthority: string
      buyerAuthority: string
      grossAmountLux: number
      protocolFeeLux: number
      sellerProceedsLux: number
      acceptedAtBlockHeight: number
    }
  | {
      type: 'marketplace_refund_claimed'
      authority: string
      recipient: string
      amountLux: number
      claimedAtBlockHeight: number
    }
