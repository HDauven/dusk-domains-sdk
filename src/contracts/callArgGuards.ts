import { MAX_TAKE_BACK_SUBNAMES } from '../core/subnames'
import type {
  CoreClearPrimaryNameRuntimeArgs,
  CoreClearRecordSenderRuntimeArgs,
  CoreCommitRuntimeArgs,
  CoreCompleteRegistrationRuntimeArgs,
  CoreCreateSubnameRuntimeArgs,
  CoreEscrowAuctionRuntimeArgs,
  CoreEscrowFixedSaleRuntimeArgs,
  CoreAcceptMarketplaceOfferRuntimeArgs,
  CoreInitArgs,
  CoreMutateRecordsSenderRuntimeArgs,
  CoreRenewRuntimeArgs,
  RouterSetFeeConfigRuntimeArgs,
  CoreSetPrimaryNameRuntimeArgs,
  PoolEndpointArgs,
  PoolNodeArgs,
  RouterAddPoolMemberArgs,
  RouterInitArgs,
  RouterProposeOperatorRuntimeArgs,
  RouterIssueReservedNameRuntimeArgs,
  CoreSetRecordSenderRuntimeArgs,
  RouterSetReferralConfigRuntimeArgs,
  CoreUpdateAuthoritiesRuntimeArgs,
  CoreTakeBackSubnamesRuntimeArgs,
  MarketplaceAuctionNodeArgs,
  MarketplaceBuyFixedSaleRuntimeArgs,
  MarketplaceClaimRefundRuntimeArgs,
  MarketplaceInitArgs,
  MarketplaceOfferArgs,
  MarketplacePlaceOfferRuntimeArgs,
  MarketplacePlaceBidRuntimeArgs,
  MarketplaceReadRefundArgs,
  MarketplaceSetFeeRuntimeArgs,
  MarketplaceProposeOperatorRuntimeArgs,
  TreasuryClaimAllReferralRewardsRuntimeArgs,
  TreasuryClaimReferralRewardRuntimeArgs,
  TreasuryClaimRuntimeArgs,
  TreasuryInitArgs,
  TreasuryProposeOperatorRuntimeArgs,
} from './callTypes'
import type { DuskPrincipal } from '../core/principal'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function isCoreInitArgs(value: unknown): value is CoreInitArgs {
  return isRecord(value) && typeof value.router === 'string'
}

export function isRouterIssueReservedNameRuntimeArgs(value: unknown): value is RouterIssueReservedNameRuntimeArgs {
  return isRecord(value) && typeof value.node === 'string' && typeof value.label === 'string'
    && typeof value.owner === 'string' && typeof value.manager === 'string'
    && isNonNegativeSafeInteger(value.durationYears)
}

export function isRouterSetReferralConfigRuntimeArgs(
  value: unknown,
): value is RouterSetReferralConfigRuntimeArgs {
  return (
    isRecord(value) &&
    isNonNegativeSafeInteger(value.referralRewardBps)
  )
}

export function isRouterSetFeeConfigRuntimeArgs(value: unknown): value is RouterSetFeeConfigRuntimeArgs {
  return (
    isRecord(value) &&
    isNonNegativeSafeInteger(value.threeCharYearLux) &&
    isNonNegativeSafeInteger(value.fourCharYearLux) &&
    isNonNegativeSafeInteger(value.fivePlusYearLux) &&
    isNonNegativeSafeInteger(value.referralRewardBps) &&
    isNonNegativeSafeInteger(value.renewalReferralRewardBps) &&
    isNonNegativeSafeInteger(value.premiumStartLux) &&
    isNonNegativeSafeInteger(value.premiumReferralRewardBps)
  )
}

export function isCoreCompleteRegistrationRuntimeArgs(
  value: unknown,
): value is CoreCompleteRegistrationRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.commitment === 'string' &&
    typeof value.secret === 'string' &&
    typeof value.node === 'string' &&
    typeof value.label === 'string' &&
    isNonNegativeSafeInteger(value.durationYears) &&
    isNonNegativeSafeInteger(value.feeLux) &&
    Array.isArray(value.records) &&
    value.records.every(isResolverRecordArgs) &&
    (
      value.primaryEndpoint == null ||
      (
        isRecord(value.primaryEndpoint) &&
        typeof value.primaryEndpoint.endpointType === 'string' &&
        typeof value.primaryEndpoint.endpointValue === 'string'
      )
    ) &&
    (value.referrer == null || isDuskPrincipal(value.referrer))
  )
}

// Renewal authenticates the payer at runtime; owner/manager credentials are not arguments.
export function isCoreRenewRuntimeArgs(value: unknown): value is CoreRenewRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.node === 'string' &&
    isNonNegativeSafeInteger(value.durationYears) &&
    isNonNegativeSafeInteger(value.feeLux)
  )
}

export function isCoreUpdateAuthoritiesRuntimeArgs(value: unknown): value is CoreUpdateAuthoritiesRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.node === 'string' &&
    typeof value.owner === 'string' &&
    typeof value.manager === 'string' &&
    (value.clearRecords === undefined || typeof value.clearRecords === 'boolean')
  )
}

export function isCoreTakeBackSubnamesRuntimeArgs(value: unknown): value is CoreTakeBackSubnamesRuntimeArgs {
  return isCoreUpdateAuthoritiesRuntimeArgs(value) && 'nodes' in value
    && Array.isArray(value.nodes) && value.nodes.length > 0 && value.nodes.length <= MAX_TAKE_BACK_SUBNAMES
    && value.nodes.every((node: unknown) => typeof node === 'string')
    && new Set(value.nodes.map((node: string) => node.toLowerCase().replace(/^0x/u, ''))).size === value.nodes.length
}

export function isCoreCreateSubnameRuntimeArgs(value: unknown): value is CoreCreateSubnameRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.parentNode === 'string' &&
    typeof value.node === 'string' &&
    typeof value.parentName === 'string' &&
    typeof value.name === 'string' &&
    typeof value.label === 'string' &&
    typeof value.owner === 'string' &&
    typeof value.manager === 'string' &&
    isNonNegativeSafeInteger(value.expiresAt) &&
    typeof value.expiryPolicy === 'string'
  )
}

export function isCoreCommitRuntimeArgs(value: unknown): value is CoreCommitRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.commitment === 'string'
  )
}

export function isCoreSetRecordSenderRuntimeArgs(value: unknown): value is CoreSetRecordSenderRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.node === 'string' &&
    isResolverRecordArgs(value.record)
  )
}

export function isCoreClearRecordSenderRuntimeArgs(value: unknown): value is CoreClearRecordSenderRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.node === 'string' &&
    typeof value.key === 'string'
  )
}

export function isCoreMutateRecordsSenderRuntimeArgs(value: unknown): value is CoreMutateRecordsSenderRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.node === 'string' &&
    Array.isArray(value.mutations) &&
    value.mutations.every((mutation) => (
      isRecord(mutation) &&
      typeof mutation.key === 'string' &&
      (
        (
          mutation.action === 'set' &&
          typeof mutation.value === 'string' &&
          isNonNegativeSafeInteger(mutation.ttlSeconds)
        ) ||
        mutation.action === 'clear'
      )
    ))
  )
}

export function isCoreSetPrimaryNameRuntimeArgs(value: unknown): value is CoreSetPrimaryNameRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.endpointType === 'string' &&
    typeof value.endpointValue === 'string' &&
    typeof value.node === 'string' &&
    typeof value.name === 'string'
  )
}

export function isCoreClearPrimaryNameRuntimeArgs(value: unknown): value is CoreClearPrimaryNameRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.endpointType === 'string' &&
    typeof value.endpointValue === 'string'
  )
}

export function isTreasuryInitArgs(value: unknown): value is TreasuryInitArgs {
  return (
    isRecord(value) &&
    isDuskPrincipal(value.operator) &&
    typeof value.operatorRecipient === 'string' &&
    Array.isArray(value.allowedFeeSources) &&
    value.allowedFeeSources.every((source) => typeof source === 'string') &&
    typeof value.router === 'string'
  )
}

export function isCoreEscrowFixedSaleRuntimeArgs(value: unknown): value is CoreEscrowFixedSaleRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.node === 'string' &&
    typeof value.marketplaceContract === 'string' &&
    typeof value.name === 'string' &&
    isNonNegativeSafeInteger(value.priceLux) &&
    (value.privateBuyer == null || typeof value.privateBuyer === 'string') &&
    isNonNegativeSafeInteger(value.expiresAt) &&
    typeof value.sellerRecipient === 'string'
  )
}

export function isCoreEscrowAuctionRuntimeArgs(value: unknown): value is CoreEscrowAuctionRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.node === 'string' &&
    typeof value.marketplaceContract === 'string' &&
    typeof value.name === 'string' &&
    isNonNegativeSafeInteger(value.reservePriceLux) &&
    isNonNegativeSafeInteger(value.durationBlocks) &&
    typeof value.sellerRecipient === 'string'
  )
}

export function isCoreAcceptMarketplaceOfferRuntimeArgs(
  value: unknown,
): value is CoreAcceptMarketplaceOfferRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.node === 'string' &&
    typeof value.marketplaceContract === 'string' &&
    typeof value.buyerAuthority === 'string' &&
    isNonNegativeSafeInteger(value.expectedAmountLux) &&
    isNonNegativeSafeInteger(value.expectedOfferId) && value.expectedOfferId > 0 &&
    isNonNegativeSafeInteger(value.expectedFeeBps) && value.expectedFeeBps <= 1_000 &&
    typeof value.sellerRecipient === 'string'
  )
}

export function isTreasuryProposeOperatorRuntimeArgs(value: unknown): value is TreasuryProposeOperatorRuntimeArgs {
  return (
    isRecord(value) &&
    isDuskPrincipal(value.operator) &&
    typeof value.operatorRecipient === 'string'
  )
}

export function isTreasuryClaimRuntimeArgs(value: unknown): value is TreasuryClaimRuntimeArgs {
  return (
    isRecord(value) &&
    isNonNegativeSafeInteger(value.amountLux)
  )
}

export function isTreasuryClaimReferralRewardRuntimeArgs(
  value: unknown,
): value is TreasuryClaimReferralRewardRuntimeArgs {
  return (
    isRecord(value) &&
    isNonNegativeSafeInteger(value.amountLux) &&
    typeof value.recipient === 'string'
  )
}

export function isTreasuryClaimAllReferralRewardsRuntimeArgs(
  value: unknown,
): value is TreasuryClaimAllReferralRewardsRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.recipient === 'string'
  )
}

export function isMarketplaceInitArgs(value: unknown): value is MarketplaceInitArgs {
  return (
    isRecord(value) &&
    typeof value.router === 'string' &&
    typeof value.treasuryContract === 'string' &&
    typeof value.marketplaceAuthority === 'string' &&
    typeof value.operator === 'string' &&
    isNonNegativeSafeInteger(value.feeBps)
  )
}

export function isMarketplaceSetFeeRuntimeArgs(value: unknown): value is MarketplaceSetFeeRuntimeArgs {
  return isRecord(value) && isNonNegativeSafeInteger(value.feeBps)
}

export function isMarketplaceProposeOperatorRuntimeArgs(
  value: unknown,
): value is MarketplaceProposeOperatorRuntimeArgs {
  return isRecord(value) && typeof value.operator === 'string'
}

export function isMarketplaceBuyFixedSaleRuntimeArgs(
  value: unknown,
): value is MarketplaceBuyFixedSaleRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.node === 'string' &&
    isNonNegativeSafeInteger(value.priceLux) &&
    (value.buyerManager == null || typeof value.buyerManager === 'string')
  )
}

export function isMarketplaceAuctionNodeArgs(
  value: unknown,
): value is MarketplaceAuctionNodeArgs {
  return isRecord(value) && typeof value.node === 'string'
}

export function isMarketplacePlaceBidRuntimeArgs(
  value: unknown,
): value is MarketplacePlaceBidRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.node === 'string' &&
    isNonNegativeSafeInteger(value.amountLux) &&
    (
      value.bidderManager == null ||
      typeof value.bidderManager === 'string'
    )
  )
}

export function isMarketplacePlaceOfferRuntimeArgs(
  value: unknown,
): value is MarketplacePlaceOfferRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.node === 'string' &&
    isNonNegativeSafeInteger(value.amountLux) &&
    isNonNegativeSafeInteger(value.expiresAt) &&
    (value.buyerManager == null || typeof value.buyerManager === 'string')
  )
}

export function isMarketplaceOfferArgs(value: unknown): value is MarketplaceOfferArgs {
  return (
    isRecord(value) &&
    typeof value.node === 'string' &&
    typeof value.buyerAuthority === 'string'
  )
}

export function isMarketplaceClaimRefundRuntimeArgs(
  value: unknown,
): value is MarketplaceClaimRefundRuntimeArgs {
  return isRecord(value) && Object.keys(value).length === 0
}

export function isMarketplaceReadRefundArgs(value: unknown): value is MarketplaceReadRefundArgs {
  return isRecord(value) && typeof value.authority === 'string'
}

export function isDuskPrincipal(value: unknown): value is DuskPrincipal {
  return (
    isRecord(value) &&
    (value.kind === 'Moonlight' || value.kind === 'Phoenix' || value.kind === 'Contract') &&
    Array.isArray(value.bytes) &&
    value.bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  )
}

function isResolverRecordArgs(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    typeof value.value === 'string' &&
    typeof value.updatedAt === 'string' &&
    isNonNegativeSafeInteger(value.ttlSeconds) &&
    typeof value.visibility === 'string'
  )
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

export function isPoolNodeArgs(value: unknown): value is PoolNodeArgs {
  return isRecord(value) && typeof value.node === 'string'
}

export function isPoolEndpointArgs(value: unknown): value is PoolEndpointArgs {
  return isRecord(value) && typeof value.endpointType === 'string' && typeof value.endpointValue === 'string'
}

export function isRouterInitArgs(value: unknown): value is RouterInitArgs {
  return (
    isRecord(value) &&
    isDuskPrincipal(value.operator) &&
    typeof value.treasury === 'string' &&
    (value.marketplace === null || typeof value.marketplace === 'string') &&
    (value.premiumStartLux === undefined || isNonNegativeSafeInteger(value.premiumStartLux)) &&
    isNonNegativeSafeInteger(value.referralRewardBps)
  )
}

export function isRouterAddPoolMemberArgs(value: unknown): value is RouterAddPoolMemberArgs {
  return isRecord(value) && typeof value.member === 'string'
}

export function isRouterProposeOperatorRuntimeArgs(value: unknown): value is RouterProposeOperatorRuntimeArgs {
  return isRecord(value) && isDuskPrincipal(value.operator)
}

export function isPauseRuntimeArgs(value: unknown): value is { paused: boolean } {
  return isRecord(value) && typeof value.paused === 'boolean'
}
