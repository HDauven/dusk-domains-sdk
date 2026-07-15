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
  CoreSetFeeConfigRuntimeArgs,
  CoreSetPrimaryNameRuntimeArgs,
  CoreSetRecordSenderRuntimeArgs,
  CoreSetReferralConfigRuntimeArgs,
  CoreUpdateAuthoritiesRuntimeArgs,
  DuskDomainCallMetadata,
  MarketplaceAuctionNodeArgs,
  MarketplaceBuyFixedSaleRuntimeArgs,
  MarketplaceClaimRefundRuntimeArgs,
  MarketplaceInitArgs,
  MarketplaceOfferArgs,
  MarketplacePlaceOfferRuntimeArgs,
  MarketplacePlaceBidRuntimeArgs,
  MarketplaceReadRefundArgs,
  MarketplaceSetFeeRuntimeArgs,
  MarketplaceUpdateOperatorRuntimeArgs,
  TreasuryClaimAllReferralRewardsRuntimeArgs,
  TreasuryClaimReferralRewardRuntimeArgs,
  TreasuryClaimRuntimeArgs,
  TreasuryInitArgs,
  TreasuryUpdateOperatorRuntimeArgs,
} from './callTypes'

export function coreInitCall(args: CoreInitArgs): DuskDomainCallMetadata<CoreInitArgs> {
  return {
    contract: 'core',
    functionName: 'init',
    kind: 'write',
    args,
  }
}

export function coreSetReferralConfigRuntimeCall(
  args: CoreSetReferralConfigRuntimeArgs,
): DuskDomainCallMetadata<CoreSetReferralConfigRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'set_referral_config_runtime',
    kind: 'write',
    args,
  }
}

export function coreSetFeeConfigRuntimeCall(
  args: CoreSetFeeConfigRuntimeArgs,
): DuskDomainCallMetadata<CoreSetFeeConfigRuntimeArgs> {
  return {
    contract: 'core',
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
    args,
  }
}

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

export function coreFeeConfigCall(): DuskDomainCallMetadata<undefined> {
  return {
    contract: 'core',
    functionName: 'fee_config',
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

export function treasuryUpdateOperatorRuntimeCall(
  args: TreasuryUpdateOperatorRuntimeArgs,
): DuskDomainCallMetadata<TreasuryUpdateOperatorRuntimeArgs> {
  return {
    contract: 'treasury',
    functionName: 'update_operator_runtime',
    kind: 'write',
    args,
  }
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

export function marketplaceUpdateOperatorRuntimeCall(
  args: MarketplaceUpdateOperatorRuntimeArgs,
): DuskDomainCallMetadata<MarketplaceUpdateOperatorRuntimeArgs> {
  return { contract: 'marketplace', functionName: 'update_operator_runtime', kind: 'write', args }
}

export function marketplaceBuyFixedSaleRuntimeCall(
  args: MarketplaceBuyFixedSaleRuntimeArgs,
): DuskDomainCallMetadata<MarketplaceBuyFixedSaleRuntimeArgs> {
  return { contract: 'marketplace', functionName: 'buy_fixed_sale_runtime', kind: 'write', args }
}

export function marketplaceCancelFixedSaleRuntimeCall(
  args: MarketplaceAuctionNodeArgs,
): DuskDomainCallMetadata<MarketplaceAuctionNodeArgs> {
  return { contract: 'marketplace', functionName: 'cancel_fixed_sale_runtime', kind: 'write', args }
}

export function marketplaceExpireFixedSaleRuntimeCall(
  args: MarketplaceAuctionNodeArgs,
): DuskDomainCallMetadata<MarketplaceAuctionNodeArgs> {
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
  args: MarketplaceAuctionNodeArgs,
): DuskDomainCallMetadata<MarketplaceAuctionNodeArgs> {
  return {
    contract: 'marketplace',
    functionName: 'cancel_auction_runtime',
    kind: 'write',
    args,
  }
}

export function marketplaceExpireAuctionRuntimeCall(
  args: MarketplaceAuctionNodeArgs,
): DuskDomainCallMetadata<MarketplaceAuctionNodeArgs> {
  return {
    contract: 'marketplace',
    functionName: 'expire_auction_runtime',
    kind: 'write',
    args,
  }
}

export function marketplaceSettleAuctionRuntimeCall(
  args: MarketplaceAuctionNodeArgs,
): DuskDomainCallMetadata<MarketplaceAuctionNodeArgs> {
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
  args: MarketplaceAuctionNodeArgs,
): DuskDomainCallMetadata<MarketplaceAuctionNodeArgs> {
  return { contract: 'marketplace', functionName: 'cancel_offer_runtime', kind: 'write', args }
}

export function marketplaceExpireOfferRuntimeCall(
  args: MarketplaceOfferArgs,
): DuskDomainCallMetadata<MarketplaceOfferArgs> {
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
