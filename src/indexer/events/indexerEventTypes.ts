import type { CoreFeeConfig } from '../../core/namePolicy'
import type { DuskPrincipal } from '../../core/principal'
import type { ResolverRecord, ResolverRecordKey } from '../../core/records'
import type { SubnameExpiryPolicy, SubnameRevocationPolicy } from '../../core/subnames'

export type IndexerEventMeta = {
  txId?: string
  blockHeight?: number | null
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
