import type { CoreFeeConfig } from '../../core/namePolicy'
import type { DuskPrincipal } from '../../core/principal'
import type { ResolverRecord, ResolverRecordKey } from '../../core/records'
import type { SubnameExpiryPolicy } from '../../core/subnames'

export type IndexerEventMeta = {
  eventId?: string
  observedAt?: string
  eventIndex?: number
  observedBlockHeight?: number | null
  source?: string
  contractKey?: string
  timeSource?: string
  txId?: string | null
  blockHeight?: number | null
  contractId?: string | null
}

export type NameLifecycleEvent =
  | {
      type: 'reserved_name_issued'
      node: string
      label: string
      actor: string
      owner: string
      manager: string
      registry: string
      operator: DuskPrincipal
      issuedAt: string
      issuedAtBlockHeight: number | null
    }
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
      createdAt: string
    }
  | {
      type: 'subname_pruned'
      parentNode: string
      node: string
      name: string
      actor: string
      prunedAt: string
    }

export type TreasuryEvent =
  | {
      type: 'treasury_operator_proposed'
      operator: DuskPrincipal
      pendingOperator: DuskPrincipal
      pendingOperatorRecipient: string
    }
  | {
      type: 'treasury_operator_cancelled'
      operator: DuskPrincipal
    }
  | {
      type: 'treasury_initialized'
      operator?: DuskPrincipal
      operatorAuthority?: string
      operatorRecipient: string
      allowedFeeSources: string[]
      router?: string
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
      type: 'trading_paused_changed'
      paused: boolean
      operator: string
      updatedAtBlockHeight: number
    }
  | {
      type: 'marketplace_operator_proposed'
      operator: string
      pendingOperator: string
    }
  | {
      type: 'marketplace_operator_cancelled'
      operator: string
    }
  | {
      type: 'marketplace_operator_changed'
      operator: string
      previousOperator: string
    }
  | {
      type: 'marketplace_initialized'
      router: string
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

export type PoolMemberKind = 'registry' | 'resolver'

export type PoolEvent =
  | {
      type: 'registrations_paused_changed'
      paused: boolean
      operator: DuskPrincipal
      updatedAtBlockHeight: number
    }
  | {
      type: 'router_operator_proposed'
      operator: DuskPrincipal
      pendingOperator: DuskPrincipal
    }
  | {
      type: 'router_operator_cancelled'
      operator: DuskPrincipal
    }
  | {
      type: 'router_initialized'
      operator: DuskPrincipal
      treasury: string
      /** All zeros when the deployment has no marketplace. */
      marketplace: string
      feeConfig: CoreFeeConfig
    }
  | {
      type: 'pool_member_added'
      kind: PoolMemberKind
      member: string
      index: number
      operator: DuskPrincipal
    }
  | {
      type: 'router_operator_changed'
      previousOperator: DuskPrincipal
      operator: DuskPrincipal
    }
  | {
      type: 'records_moved'
      node: string
      controller: string
      fromResolver: string
      toResolver: string
      recordCount: number
    }
