import { hasClaimableReferrerShape } from '../core/principal'
import type {
  CoreClearPrimaryNameRuntimeArgs,
  CoreClearRecordSenderRuntimeArgs,
  CoreCommitRuntimeArgs,
  CoreCompleteRegistrationRuntimeArgs,
  CoreCreateSubnameRuntimeArgs,
  CoreEscrowAuctionRuntimeArgs,
  CoreEscrowFixedSaleRuntimeArgs,
  CoreAcceptMarketplaceOfferRuntimeArgs,
  CoreGetNameArgs,
  CoreInitArgs,
  CoreMutateRecordsSenderRuntimeArgs,
  CorePendingCommitmentArgs,
  CoreReadPrimaryNameArgs,
  CoreReadRecordArgs,
  CoreRenewRuntimeArgs,
  RouterSetRegistrationsPausedRuntimeArgs,
  MarketplaceSetTradingPausedRuntimeArgs,
  RouterSetFeeConfigRuntimeArgs,
  CoreSetPrimaryNameRuntimeArgs,
  CoreSetRecordSenderRuntimeArgs,
  RouterSetReferralConfigRuntimeArgs,
  CoreUpdateAuthoritiesRuntimeArgs,
  CoreTakeBackSubnamesRuntimeArgs,
  DuskDomainCallMetadata,
  MarketplaceAuctionNodeArgs,
  MarketplaceFixedSaleArgs,
  MarketplaceReviewedAuctionArgs,
  MarketplaceSettleAuctionRuntimeArgs,
  MarketplaceCancelOfferRuntimeArgs,
  MarketplaceExpireOfferRuntimeArgs,

  MarketplaceBuyFixedSaleRuntimeArgs,
  MarketplaceClaimRefundRuntimeArgs,
  MarketplaceInitArgs,
  MarketplaceOfferArgs,
  MarketplacePlaceOfferRuntimeArgs,
  MarketplacePlaceBidRuntimeArgs,
  MarketplaceReadRefundArgs,
  PoolEndpointArgs,
  PoolNodeArgs,
  RouterAddPoolMemberArgs,
  RouterInitArgs,
  RouterProposeOperatorRuntimeArgs,
  RouterIssueReservedNameRuntimeArgs,
  CoreMoveRecordsRuntimeArgs,
  MarketplaceSetFeeRuntimeArgs,
  MarketplaceProposeOperatorRuntimeArgs,
  TreasuryClaimAllReferralRewardsRuntimeArgs,
  TreasuryClaimReferralRewardRuntimeArgs,
  TreasuryClaimRuntimeArgs,
  TreasuryInitArgs,
  TreasuryProposeOperatorRuntimeArgs,
} from './callTypes'

export function coreInitCall(args: CoreInitArgs): DuskDomainCallMetadata<CoreInitArgs> {
  return {
    contract: 'core',
    functionName: 'init',
    kind: 'write',
    args,
  }
}

export function routerIssueReservedNameRuntimeCall(
  args: RouterIssueReservedNameRuntimeArgs,
): DuskDomainCallMetadata<RouterIssueReservedNameRuntimeArgs> {
  return { contract: 'router', functionName: 'issue_reserved_name_runtime', kind: 'write', args }
}

export function routerSetReferralConfigRuntimeCall(
  args: RouterSetReferralConfigRuntimeArgs,
): DuskDomainCallMetadata<RouterSetReferralConfigRuntimeArgs> {
  return {
    contract: 'router',
    functionName: 'set_referral_config_runtime',
    kind: 'write',
    args,
  }
}

export function routerSetFeeConfigRuntimeCall(
  args: RouterSetFeeConfigRuntimeArgs,
): DuskDomainCallMetadata<RouterSetFeeConfigRuntimeArgs> {
  return {
    contract: 'router',
    functionName: 'set_fee_config_runtime',
    kind: 'write',
    args,
  }
}

export function coreCommitRuntimeCall(
  args: CoreCommitRuntimeArgs,
): DuskDomainCallMetadata<CoreCommitRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'commit_runtime',
    kind: 'write',
    args,
  }
}

export function coreCompleteRegistrationRuntimeCall(
  args: CoreCompleteRegistrationRuntimeArgs,
): DuskDomainCallMetadata<CoreCompleteRegistrationRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'complete_registration_runtime',
    kind: 'write',
    args: { ...args, referrer: hasClaimableReferrerShape(args.referrer) ? args.referrer : null },
  }
}

/** Any direct Moonlight payer can renew a root before grace ends, including a contract-owned name outside marketplace escrow. */
export function coreRenewRuntimeCall(
  args: CoreRenewRuntimeArgs,
): DuskDomainCallMetadata<CoreRenewRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'renew_runtime',
    kind: 'write',
    args,
  }
}

/** Change authorities, optionally clearing this name's identity with clearRecords (default false). */
export function coreUpdateAuthoritiesRuntimeCall(
  args: CoreUpdateAuthoritiesRuntimeArgs,
): DuskDomainCallMetadata<CoreUpdateAuthoritiesRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'update_authorities_runtime',
    kind: 'write',
    args,
  }
}

export function coreEscrowFixedSaleRuntimeCall(
  args: CoreEscrowFixedSaleRuntimeArgs,
): DuskDomainCallMetadata<CoreEscrowFixedSaleRuntimeArgs> {
  return { contract: 'core', functionName: 'escrow_fixed_sale_runtime', kind: 'write', args }
}

export function coreEscrowAuctionRuntimeCall(
  args: CoreEscrowAuctionRuntimeArgs,
): DuskDomainCallMetadata<CoreEscrowAuctionRuntimeArgs> {
  return { contract: 'core', functionName: 'escrow_auction_runtime', kind: 'write', args }
}

export function coreAcceptMarketplaceOfferRuntimeCall(
  args: CoreAcceptMarketplaceOfferRuntimeArgs,
): DuskDomainCallMetadata<CoreAcceptMarketplaceOfferRuntimeArgs> {
  return { contract: 'core', functionName: 'accept_marketplace_offer_runtime', kind: 'write', args }
}

export function coreSetRecordSenderRuntimeCall(
  args: CoreSetRecordSenderRuntimeArgs,
): DuskDomainCallMetadata<CoreSetRecordSenderRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'set_record_sender_runtime',
    kind: 'write',
    args,
  }
}

export function coreClearRecordSenderRuntimeCall(
  args: CoreClearRecordSenderRuntimeArgs,
): DuskDomainCallMetadata<CoreClearRecordSenderRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'clear_record_sender_runtime',
    kind: 'write',
    args,
  }
}

export function coreMutateRecordsSenderRuntimeCall(
  args: CoreMutateRecordsSenderRuntimeArgs,
): DuskDomainCallMetadata<CoreMutateRecordsSenderRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'mutate_records_sender_runtime',
    kind: 'write',
    args,
  }
}

export function coreSetPrimaryNameRuntimeCall(
  args: CoreSetPrimaryNameRuntimeArgs,
): DuskDomainCallMetadata<CoreSetPrimaryNameRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'set_primary_name_runtime',
    kind: 'write',
    args,
  }
}

export function coreClearPrimaryNameRuntimeCall(
  args: CoreClearPrimaryNameRuntimeArgs,
): DuskDomainCallMetadata<CoreClearPrimaryNameRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'clear_primary_name_runtime',
    kind: 'write',
    args,
  }
}

export function coreCreateSubnameRuntimeCall(
  args: CoreCreateSubnameRuntimeArgs,
): DuskDomainCallMetadata<CoreCreateSubnameRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'create_subname_runtime',
    kind: 'write',
    args,
  }
}

/** Reassign through an active ancestor; changing its owner or manager clears that subname's identity. */
export const coreReassignSubnameRuntimeCall = coreUpdateAuthoritiesRuntimeCall

export function coreRemoveSubnameRuntimeCall(args: PoolNodeArgs): DuskDomainCallMetadata<PoolNodeArgs> {
  return { contract: 'core', functionName: 'remove_subname_runtime', kind: 'write', args }
}

export function coreTakeBackSubnamesRuntimeCall(args: CoreTakeBackSubnamesRuntimeArgs): DuskDomainCallMetadata<CoreTakeBackSubnamesRuntimeArgs> {
  return { contract: 'core', functionName: 'take_back_subnames_runtime', kind: 'write', args }
}

export function corePruneSubnameRuntimeCall(args: PoolNodeArgs): DuskDomainCallMetadata<PoolNodeArgs> {
  return { contract: 'core', functionName: 'prune_subname_runtime', kind: 'write', args }
}

export function coreRegistrationPremiumCall(args: CoreGetNameArgs): DuskDomainCallMetadata<CoreGetNameArgs> {
  return { contract: 'core', functionName: 'registration_premium', kind: 'read', args }
}

export function coreGetNameCall(args: CoreGetNameArgs): DuskDomainCallMetadata<CoreGetNameArgs> {
  return {
    contract: 'core',
    functionName: 'get_name',
    kind: 'read',
    args,
  }
}

export function coreReadRecordCall(args: CoreReadRecordArgs): DuskDomainCallMetadata<CoreReadRecordArgs> {
  return {
    contract: 'core',
    functionName: 'read_record',
    kind: 'read',
    args,
  }
}

export function coreReadPrimaryNameCall(args: CoreReadPrimaryNameArgs): DuskDomainCallMetadata<CoreReadPrimaryNameArgs> {
  return {
    contract: 'core',
    functionName: 'read_primary_name',
    kind: 'read',
    args,
  }
}

export function corePendingCommitmentCall(
  args: CorePendingCommitmentArgs,
): DuskDomainCallMetadata<CorePendingCommitmentArgs> {
  return {
    contract: 'core',
    functionName: 'pending_commitment',
    kind: 'read',
    args,
  }
}

export function routerInitCall(args: RouterInitArgs): DuskDomainCallMetadata<RouterInitArgs> {
  return {
    contract: 'router',
    functionName: 'init',
    kind: 'write',
    args,
  }
}

/** Appends a registry. It becomes the only one that creates new root names. */
export function routerAddRegistryRuntimeCall(
  args: RouterAddPoolMemberArgs,
): DuskDomainCallMetadata<RouterAddPoolMemberArgs> {
  return {
    contract: 'router',
    functionName: 'add_registry_runtime',
    kind: 'write',
    args,
  }
}

/** Appends a resolver. It takes new records once the newest resolver before it is full. */
export function routerAddResolverRuntimeCall(
  args: RouterAddPoolMemberArgs,
): DuskDomainCallMetadata<RouterAddPoolMemberArgs> {
  return {
    contract: 'router',
    functionName: 'add_resolver_runtime',
    kind: 'write',
    args,
  }
}

export function routerProposeOperatorRuntimeCall(
  args: RouterProposeOperatorRuntimeArgs,
): DuskDomainCallMetadata<RouterProposeOperatorRuntimeArgs> {
  return {
    contract: 'router',
    functionName: 'propose_operator_runtime',
    kind: 'write',
    args,
  }
}

export function routerAcceptOperatorRuntimeCall(): DuskDomainCallMetadata<undefined> {
  return { contract: 'router', functionName: 'accept_operator_runtime', kind: 'write', args: undefined }
}

export function routerCancelOperatorRuntimeCall(): DuskDomainCallMetadata<undefined> {
  return { contract: 'router', functionName: 'cancel_operator_runtime', kind: 'write', args: undefined }
}

export function routerFeeConfigCall(): DuskDomainCallMetadata<undefined> {
  return {
    contract: 'router',
    functionName: 'fee_config',
    kind: 'read',
    args: undefined,
  }
}

/** The registry that creates new root names. */
export function routerActiveRegistryCall(): DuskDomainCallMetadata<undefined> {
  return {
    contract: 'router',
    functionName: 'active_registry',
    kind: 'read',
    args: undefined,
  }
}

/** The pool registry that holds a name, if any does. */
export function routerLocateNameCall(args: PoolNodeArgs): DuskDomainCallMetadata<PoolNodeArgs> {
  return {
    contract: 'router',
    functionName: 'locate_name',
    kind: 'read',
    args,
  }
}

/** The registries that hold a primary name for an address. At most one does once writes settle. */
export function routerLocatePrimaryCall(args: PoolEndpointArgs): DuskDomainCallMetadata<PoolEndpointArgs> {
  return {
    contract: 'router',
    functionName: 'locate_primary',
    kind: 'read',
    args,
  }
}

/** The resolver that takes new records, if it still has room. */
export function routerActiveResolverCall(): DuskDomainCallMetadata<undefined> {
  return {
    contract: 'router',
    functionName: 'active_resolver',
    kind: 'read',
    args: undefined,
  }
}

export function routerConfigCall(): DuskDomainCallMetadata<undefined> {
  return {
    contract: 'router',
    functionName: 'config',
    kind: 'read',
    args: undefined,
  }
}

export function coreRouterCall(): DuskDomainCallMetadata<undefined> {
  return {
    contract: 'core',
    functionName: 'router',
    kind: 'read',
    args: undefined,
  }
}

/** Moves a name's records into the resolver that takes new records, so they can grow again. */
export function coreMoveRecordsRuntimeCall(
  args: CoreMoveRecordsRuntimeArgs,
): DuskDomainCallMetadata<CoreMoveRecordsRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'move_records_runtime',
    kind: 'write',
    args,
  }
}

export function coreHoldsNameCall(args: PoolNodeArgs): DuskDomainCallMetadata<PoolNodeArgs> {
  return {
    contract: 'core',
    functionName: 'holds_name',
    kind: 'read',
    args,
  }
}

export function coreHoldsPrimaryCall(args: PoolEndpointArgs): DuskDomainCallMetadata<PoolEndpointArgs> {
  return {
    contract: 'core',
    functionName: 'holds_primary',
    kind: 'read',
    args,
  }
}

/** Where a name's records live: the resolver and the slot epoch. */
export function coreRecordSlotCall(args: PoolNodeArgs): DuskDomainCallMetadata<PoolNodeArgs> {
  return {
    contract: 'core',
    functionName: 'record_slot',
    kind: 'read',
    args,
  }
}

export function coreAcceptsNewNamesCall(): DuskDomainCallMetadata<undefined> {
  return {
    contract: 'core',
    functionName: 'accepts_new_names',
    kind: 'read',
    args: undefined,
  }
}

export function treasuryInitCall(args: TreasuryInitArgs): DuskDomainCallMetadata<TreasuryInitArgs> {
  return {
    contract: 'treasury',
    functionName: 'init',
    kind: 'write',
    args,
  }
}

export function treasuryProposeOperatorRuntimeCall(
  args: TreasuryProposeOperatorRuntimeArgs,
): DuskDomainCallMetadata<TreasuryProposeOperatorRuntimeArgs> {
  return {
    contract: 'treasury',
    functionName: 'propose_operator_runtime',
    kind: 'write',
    args,
  }
}

export function treasuryAcceptOperatorRuntimeCall(): DuskDomainCallMetadata<undefined> {
  return { contract: 'treasury', functionName: 'accept_operator_runtime', kind: 'write', args: undefined }
}

export function treasuryCancelOperatorRuntimeCall(): DuskDomainCallMetadata<undefined> {
  return { contract: 'treasury', functionName: 'cancel_operator_runtime', kind: 'write', args: undefined }
}

export function treasuryClaimRuntimeCall(
  args: TreasuryClaimRuntimeArgs,
): DuskDomainCallMetadata<TreasuryClaimRuntimeArgs> {
  return {
    contract: 'treasury',
    functionName: 'claim_runtime',
    kind: 'write',
    args,
  }
}

export function treasuryClaimAllRuntimeCall(): DuskDomainCallMetadata<undefined> {
  return {
    contract: 'treasury',
    functionName: 'claim_all_runtime',
    kind: 'write',
    args: undefined,
  }
}

export function treasuryClaimReferralRewardRuntimeCall(
  args: TreasuryClaimReferralRewardRuntimeArgs,
): DuskDomainCallMetadata<TreasuryClaimReferralRewardRuntimeArgs> {
  return {
    contract: 'treasury',
    functionName: 'claim_referral_reward_runtime',
    kind: 'write',
    args,
  }
}

export function treasuryClaimAllReferralRewardsRuntimeCall(
  args: TreasuryClaimAllReferralRewardsRuntimeArgs,
): DuskDomainCallMetadata<TreasuryClaimAllReferralRewardsRuntimeArgs> {
  return {
    contract: 'treasury',
    functionName: 'claim_all_referral_rewards_runtime',
    kind: 'write',
    args,
  }
}

export function marketplaceInitCall(args: MarketplaceInitArgs): DuskDomainCallMetadata<MarketplaceInitArgs> {
  return {
    contract: 'marketplace',
    functionName: 'init',
    kind: 'write',
    args,
  }
}

export function marketplaceSetFeeRuntimeCall(
  args: MarketplaceSetFeeRuntimeArgs,
): DuskDomainCallMetadata<MarketplaceSetFeeRuntimeArgs> {
  return { contract: 'marketplace', functionName: 'set_fee_runtime', kind: 'write', args }
}

export function marketplaceProposeOperatorRuntimeCall(
  args: MarketplaceProposeOperatorRuntimeArgs,
): DuskDomainCallMetadata<MarketplaceProposeOperatorRuntimeArgs> {
  return { contract: 'marketplace', functionName: 'propose_operator_runtime', kind: 'write', args }
}

export function marketplaceAcceptOperatorRuntimeCall(): DuskDomainCallMetadata<undefined> {
  return { contract: 'marketplace', functionName: 'accept_operator_runtime', kind: 'write', args: undefined }
}

export function marketplaceCancelOperatorRuntimeCall(): DuskDomainCallMetadata<undefined> {
  return { contract: 'marketplace', functionName: 'cancel_operator_runtime', kind: 'write', args: undefined }
}

export function marketplaceBuyFixedSaleRuntimeCall(
  args: MarketplaceBuyFixedSaleRuntimeArgs,
): DuskDomainCallMetadata<MarketplaceBuyFixedSaleRuntimeArgs> {
  return { contract: 'marketplace', functionName: 'buy_fixed_sale_runtime', kind: 'write', args }
}

export function marketplaceCancelFixedSaleRuntimeCall(
  args: MarketplaceFixedSaleArgs,
): DuskDomainCallMetadata<MarketplaceFixedSaleArgs> {
  return { contract: 'marketplace', functionName: 'cancel_fixed_sale_runtime', kind: 'write', args }
}

export function marketplaceExpireFixedSaleRuntimeCall(
  args: MarketplaceFixedSaleArgs,
): DuskDomainCallMetadata<MarketplaceFixedSaleArgs> {
  return { contract: 'marketplace', functionName: 'expire_fixed_sale_runtime', kind: 'write', args }
}

export function marketplacePlaceBidRuntimeCall(
  args: MarketplacePlaceBidRuntimeArgs,
): DuskDomainCallMetadata<MarketplacePlaceBidRuntimeArgs> {
  return {
    contract: 'marketplace',
    functionName: 'place_bid_runtime',
    kind: 'write',
    args,
  }
}

export function marketplaceCancelAuctionRuntimeCall(
  args: MarketplaceReviewedAuctionArgs,
): DuskDomainCallMetadata<MarketplaceReviewedAuctionArgs> {
  return {
    contract: 'marketplace',
    functionName: 'cancel_auction_runtime',
    kind: 'write',
    args,
  }
}

export function marketplaceExpireAuctionRuntimeCall(
  args: MarketplaceReviewedAuctionArgs,
): DuskDomainCallMetadata<MarketplaceReviewedAuctionArgs> {
  return {
    contract: 'marketplace',
    functionName: 'expire_auction_runtime',
    kind: 'write',
    args,
  }
}

export function marketplaceSettleAuctionRuntimeCall(
  args: MarketplaceSettleAuctionRuntimeArgs,
): DuskDomainCallMetadata<MarketplaceSettleAuctionRuntimeArgs> {
  return {
    contract: 'marketplace',
    functionName: 'settle_auction_runtime',
    kind: 'write',
    args,
  }
}

export function marketplacePlaceOfferRuntimeCall(
  args: MarketplacePlaceOfferRuntimeArgs,
): DuskDomainCallMetadata<MarketplacePlaceOfferRuntimeArgs> {
  return { contract: 'marketplace', functionName: 'place_offer_runtime', kind: 'write', args }
}

export function marketplaceCancelOfferRuntimeCall(
  args: MarketplaceCancelOfferRuntimeArgs,
): DuskDomainCallMetadata<MarketplaceCancelOfferRuntimeArgs> {
  return { contract: 'marketplace', functionName: 'cancel_offer_runtime', kind: 'write', args }
}

export function marketplaceExpireOfferRuntimeCall(
  args: MarketplaceExpireOfferRuntimeArgs,
): DuskDomainCallMetadata<MarketplaceExpireOfferRuntimeArgs> {
  return { contract: 'marketplace', functionName: 'expire_offer_runtime', kind: 'write', args }
}

export function marketplaceClaimRefundRuntimeCall(): DuskDomainCallMetadata<MarketplaceClaimRefundRuntimeArgs> {
  return {
    contract: 'marketplace',
    functionName: 'claim_refund_runtime',
    kind: 'write',
    args: {},
  }
}

export function marketplaceReadConfigCall(): DuskDomainCallMetadata<undefined> {
  return { contract: 'marketplace', functionName: 'read_config', kind: 'read', args: undefined }
}

export function marketplaceReadFixedSaleCall(
  args: MarketplaceAuctionNodeArgs,
): DuskDomainCallMetadata<MarketplaceAuctionNodeArgs> {
  return { contract: 'marketplace', functionName: 'read_fixed_sale', kind: 'read', args }
}

export function marketplaceReadAuctionCall(
  args: MarketplaceAuctionNodeArgs,
): DuskDomainCallMetadata<MarketplaceAuctionNodeArgs> {
  return {
    contract: 'marketplace',
    functionName: 'read_auction',
    kind: 'read',
    args,
  }
}

export function marketplaceReadOfferCall(
  args: MarketplaceOfferArgs,
): DuskDomainCallMetadata<MarketplaceOfferArgs> {
  return { contract: 'marketplace', functionName: 'read_offer', kind: 'read', args }
}

export function marketplaceReadRefundCall(
  args: MarketplaceReadRefundArgs,
): DuskDomainCallMetadata<MarketplaceReadRefundArgs> {
  return {
    contract: 'marketplace',
    functionName: 'read_refund',
    kind: 'read',
    args,
  }
}

export function treasuryReadStateCall(): DuskDomainCallMetadata<undefined> {
  return {
    contract: 'treasury',
    functionName: 'read_state',
    kind: 'read',
    args: undefined,
  }
}

export function routerSetRegistrationsPausedRuntimeCall(args: RouterSetRegistrationsPausedRuntimeArgs): DuskDomainCallMetadata<RouterSetRegistrationsPausedRuntimeArgs> {
  return { contract: 'router', functionName: 'set_registrations_paused_runtime', kind: 'write', args }
}

export function marketplaceSetTradingPausedRuntimeCall(args: MarketplaceSetTradingPausedRuntimeArgs): DuskDomainCallMetadata<MarketplaceSetTradingPausedRuntimeArgs> {
  return { contract: 'marketplace', functionName: 'set_trading_paused_runtime', kind: 'write', args }
}
