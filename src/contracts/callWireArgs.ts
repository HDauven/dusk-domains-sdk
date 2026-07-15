import { decodeBase58 } from '../core/principal'
import type { DuskPrincipal } from '../core/principal'
import type { ResolverRecord } from '../core/records'
import {
  isCoreClearPrimaryNameRuntimeArgs,
  isCoreClearRecordSenderRuntimeArgs,
  isCoreCommitRuntimeArgs,
  isCoreCompleteRegistrationRuntimeArgs,
  isCoreCreateSubnameRuntimeArgs,
  isCoreEscrowAuctionRuntimeArgs,
  isCoreEscrowFixedSaleRuntimeArgs,
  isCoreAcceptMarketplaceOfferRuntimeArgs,
  isCoreInitArgs,
  isCoreMutateRecordsSenderRuntimeArgs,
  isCoreRenewRuntimeArgs,
  isCoreSetFeeConfigRuntimeArgs,
  isCoreSetPrimaryNameRuntimeArgs,
  isCoreSetRecordSenderRuntimeArgs,
  isCoreSetReferralConfigRuntimeArgs,
  isCoreUpdateAuthoritiesRuntimeArgs,
  isDuskPrincipal,
  isMarketplaceAuctionNodeArgs,
  isMarketplaceBuyFixedSaleRuntimeArgs,
  isMarketplaceClaimRefundRuntimeArgs,
  isMarketplaceInitArgs,
  isMarketplaceOfferArgs,
  isMarketplacePlaceOfferRuntimeArgs,
  isMarketplacePlaceBidRuntimeArgs,
  isMarketplaceReadRefundArgs,
  isMarketplaceSetFeeRuntimeArgs,
  isMarketplaceUpdateOperatorRuntimeArgs,
  isRecord,
  isTreasuryClaimAllReferralRewardsRuntimeArgs,
  isTreasuryClaimReferralRewardRuntimeArgs,
  isTreasuryClaimRuntimeArgs,
  isTreasuryInitArgs,
  isTreasuryUpdateOperatorRuntimeArgs,
} from './callArgGuards'
import type {
  CoreRecordMutationInput,
  DuskDomainCallMetadata,
} from './callTypes'

export function toDuskDomainWireArgs(call: DuskDomainCallMetadata): unknown {
  const callKey = `${call.contract}.${call.functionName}`
  const args = call.args

  if (args === undefined) {
    if (noArgDuskDomainCalls.has(callKey) || !knownDuskDomainCalls.has(callKey)) return undefined
    throw invalidKnownCallArgs(call)
  }
  if (call.contract === 'core' && call.functionName === 'init' && isCoreInitArgs(args)) {
    return {
      treasury_contract: bytes32(args.treasuryContract, 'treasuryContract'),
      record_source_contract: bytes32(args.recordSourceContract, 'recordSourceContract'),
      operator: principal(args.operator, 'operator'),
      referral_reward_bps: args.referralRewardBps,
    }
  }
  if (
    call.contract === 'core' &&
    call.functionName === 'set_referral_config_runtime' &&
    isCoreSetReferralConfigRuntimeArgs(args)
  ) {
    return {
      referral_reward_bps: args.referralRewardBps,
    }
  }
  if (
    call.contract === 'core' &&
    call.functionName === 'set_fee_config_runtime' &&
    isCoreSetFeeConfigRuntimeArgs(args)
  ) {
    return {
      three_char_year_lux: args.threeCharYearLux,
      four_char_year_lux: args.fourCharYearLux,
      five_plus_year_lux: args.fivePlusYearLux,
      referral_reward_bps: args.referralRewardBps,
      renewal_referral_reward_bps: args.renewalReferralRewardBps,
      premium_referral_reward_bps: args.premiumReferralRewardBps,
    }
  }
  if (call.contract === 'core' && call.functionName === 'commit_runtime' && isCoreCommitRuntimeArgs(args)) {
    return {
      commitment: bytes32(args.commitment, 'commitment'),
    }
  }
  if (
    call.contract === 'core' &&
    call.functionName === 'complete_registration_runtime' &&
    isCoreCompleteRegistrationRuntimeArgs(args)
  ) {
    return {
      commitment: bytes32(args.commitment, 'commitment'),
      secret: bytes32(args.secret, 'secret'),
      node: bytes32(args.node, 'node'),
      label: args.label,
      duration_years: args.durationYears,
      fee_lux: args.feeLux,
      records: args.records.map(recordValue),
      primary_endpoint: args.primaryEndpoint
        ? endpoint(args.primaryEndpoint.endpointType, args.primaryEndpoint.endpointValue)
        : null,
      referrer: args.referrer ? principal(args.referrer, 'referrer') : null,
    }
  }
  if (call.contract === 'core' && call.functionName === 'renew_runtime' && isCoreRenewRuntimeArgs(args)) {
    return {
      node: bytes32(args.node, 'node'),
      duration_years: args.durationYears,
      fee_lux: args.feeLux,
    }
  }
  if (
    call.contract === 'core' &&
    call.functionName === 'update_authorities_runtime' &&
    isCoreUpdateAuthoritiesRuntimeArgs(args)
  ) {
    return {
      node: bytes32(args.node, 'node'),
      owner: bytes32(args.owner, 'owner'),
      manager: bytes32(args.manager, 'manager'),
    }
  }
  if (
    call.contract === 'core' &&
    call.functionName === 'escrow_fixed_sale_runtime' &&
    isCoreEscrowFixedSaleRuntimeArgs(args)
  ) {
    return {
      node: bytes32(args.node, 'node'),
      marketplace_contract: bytes32(args.marketplaceContract, 'marketplaceContract'),
      name: args.name,
      price_lux: args.priceLux,
      private_buyer: args.privateBuyer ? bytes32(args.privateBuyer, 'privateBuyer') : null,
      expires_at: args.expiresAt,
      seller_recipient: moonlightPublicKeyBytes(args.sellerRecipient, 'sellerRecipient'),
    }
  }
  if (
    call.contract === 'core' &&
    call.functionName === 'escrow_auction_runtime' &&
    isCoreEscrowAuctionRuntimeArgs(args)
  ) {
    return {
      node: bytes32(args.node, 'node'),
      marketplace_contract: bytes32(args.marketplaceContract, 'marketplaceContract'),
      name: args.name,
      reserve_price_lux: args.reservePriceLux,
      duration_blocks: args.durationBlocks,
      seller_recipient: moonlightPublicKeyBytes(args.sellerRecipient, 'sellerRecipient'),
    }
  }
  if (
    call.contract === 'core' &&
    call.functionName === 'accept_marketplace_offer_runtime' &&
    isCoreAcceptMarketplaceOfferRuntimeArgs(args)
  ) {
    return {
      node: bytes32(args.node, 'node'),
      marketplace_contract: bytes32(args.marketplaceContract, 'marketplaceContract'),
      buyer_authority: bytes32(args.buyerAuthority, 'buyerAuthority'),
      seller_recipient: moonlightPublicKeyBytes(args.sellerRecipient, 'sellerRecipient'),
    }
  }
  if (
    call.contract === 'core' &&
    call.functionName === 'set_record_sender_runtime' &&
    isCoreSetRecordSenderRuntimeArgs(args)
  ) {
    return {
      node: bytes32(args.node, 'node'),
      record: recordValue(args.record),
    }
  }
  if (
    call.contract === 'core' &&
    call.functionName === 'clear_record_sender_runtime' &&
    isCoreClearRecordSenderRuntimeArgs(args)
  ) {
    return {
      node: bytes32(args.node, 'node'),
      key: args.key,
    }
  }
  if (
    call.contract === 'core' &&
    call.functionName === 'mutate_records_sender_runtime' &&
    isCoreMutateRecordsSenderRuntimeArgs(args)
  ) {
    return {
      node: bytes32(args.node, 'node'),
      mutations: args.mutations.map(recordMutation),
    }
  }
  if (call.contract === 'core' && call.functionName === 'set_primary_name_runtime' && isCoreSetPrimaryNameRuntimeArgs(args)) {
    return {
      endpoint: endpoint(args.endpointType, args.endpointValue),
      node: bytes32(args.node, 'node'),
      name: args.name,
    }
  }
  if (call.contract === 'core' && call.functionName === 'clear_primary_name_runtime' && isCoreClearPrimaryNameRuntimeArgs(args)) {
    return {
      endpoint: endpoint(args.endpointType, args.endpointValue),
    }
  }
  if (call.contract === 'core' && call.functionName === 'create_subname_runtime' && isCoreCreateSubnameRuntimeArgs(args)) {
    return {
      parent_node: bytes32(args.parentNode, 'parentNode'),
      node: bytes32(args.node, 'node'),
      parent_name: args.parentName,
      name: args.name,
      label: args.label,
      owner: bytes32(args.owner, 'owner'),
      manager: bytes32(args.manager, 'manager'),
      expires_at: args.expiresAt,
      expiry_policy: subnameExpiryPolicy(args.expiryPolicy),
      revocation_policy: subnameRevocationPolicy(args.revocationPolicy),
    }
  }
  if (call.contract === 'core' && call.functionName === 'get_name' && isRecord(args)) {
    return {
      node: bytes32(String(args.node), 'node'),
    }
  }
  if (call.contract === 'core' && call.functionName === 'read_record' && isRecord(args)) {
    return {
      node: bytes32(String(args.node), 'node'),
      key: String(args.key),
    }
  }
  if (call.contract === 'core' && call.functionName === 'read_primary_name' && isRecord(args)) {
    return {
      endpoint: endpoint(String(args.endpointType), String(args.endpointValue)),
    }
  }
  if (call.contract === 'core' && call.functionName === 'pending_commitment' && isRecord(args)) {
    return {
      commitment: bytes32(String(args.commitment), 'commitment'),
    }
  }
  if (call.contract === 'treasury' && call.functionName === 'init' && isTreasuryInitArgs(args)) {
    return {
      operator: principal(args.operator, 'operator'),
      operator_recipient: moonlightPublicKeyBytes(args.operatorRecipient),
      allowed_fee_sources: args.allowedFeeSources.map((source) => bytes32(source, 'allowedFeeSource')),
    }
  }
  if (
    call.contract === 'treasury' &&
    call.functionName === 'update_operator_runtime' &&
    isTreasuryUpdateOperatorRuntimeArgs(args)
  ) {
    return {
      operator: principal(args.operator, 'operator'),
      operator_recipient: moonlightPublicKeyBytes(args.operatorRecipient),
    }
  }
  if (call.contract === 'treasury' && call.functionName === 'claim_runtime' && isTreasuryClaimRuntimeArgs(args)) {
    return {
      amount_lux: args.amountLux,
    }
  }
  if (
    call.contract === 'treasury' &&
    call.functionName === 'claim_referral_reward_runtime' &&
    isTreasuryClaimReferralRewardRuntimeArgs(args)
  ) {
    return {
      amount_lux: args.amountLux,
      recipient: moonlightPublicKeyBytes(args.recipient),
    }
  }
  if (
    call.contract === 'treasury' &&
    call.functionName === 'claim_all_referral_rewards_runtime' &&
    isTreasuryClaimAllReferralRewardsRuntimeArgs(args)
  ) {
    return {
      recipient: moonlightPublicKeyBytes(args.recipient),
    }
  }
  if (call.contract === 'marketplace' && call.functionName === 'init' && isMarketplaceInitArgs(args)) {
    return {
      core_contract: bytes32(args.coreContract, 'coreContract'),
      treasury_contract: bytes32(args.treasuryContract, 'treasuryContract'),
      marketplace_authority: bytes32(args.marketplaceAuthority, 'marketplaceAuthority'),
      operator: bytes32(args.operator, 'operator'),
      fee_bps: args.feeBps,
    }
  }
  if (
    call.contract === 'marketplace' &&
    call.functionName === 'set_fee_runtime' &&
    isMarketplaceSetFeeRuntimeArgs(args)
  ) {
    return { fee_bps: args.feeBps }
  }
  if (
    call.contract === 'marketplace' &&
    call.functionName === 'update_operator_runtime' &&
    isMarketplaceUpdateOperatorRuntimeArgs(args)
  ) {
    return { operator: bytes32(args.operator, 'operator') }
  }
  if (
    call.contract === 'marketplace' &&
    call.functionName === 'buy_fixed_sale_runtime' &&
    isMarketplaceBuyFixedSaleRuntimeArgs(args)
  ) {
    return {
      node: bytes32(args.node, 'node'),
      buyer_manager: args.buyerManager ? bytes32(args.buyerManager, 'buyerManager') : null,
    }
  }
  if (
    call.contract === 'marketplace' &&
    call.functionName === 'place_bid_runtime' &&
    isMarketplacePlaceBidRuntimeArgs(args)
  ) {
    return {
      node: bytes32(args.node, 'node'),
      amount_lux: args.amountLux,
      bidder_manager: args.bidderManager ? bytes32(args.bidderManager, 'bidderManager') : null,
    }
  }
  if (
    call.contract === 'marketplace' &&
    (
      call.functionName === 'cancel_auction_runtime' ||
      call.functionName === 'expire_auction_runtime' ||
      call.functionName === 'settle_auction_runtime' ||
      call.functionName === 'cancel_fixed_sale_runtime' ||
      call.functionName === 'expire_fixed_sale_runtime' ||
      call.functionName === 'cancel_offer_runtime' ||
      call.functionName === 'read_fixed_sale' ||
      call.functionName === 'read_auction'
    ) &&
    isMarketplaceAuctionNodeArgs(args)
  ) {
    return {
      node: bytes32(args.node, 'node'),
    }
  }
  if (
    call.contract === 'marketplace' &&
    call.functionName === 'place_offer_runtime' &&
    isMarketplacePlaceOfferRuntimeArgs(args)
  ) {
    return {
      node: bytes32(args.node, 'node'),
      amount_lux: args.amountLux,
      expires_at: args.expiresAt,
      buyer_manager: args.buyerManager ? bytes32(args.buyerManager, 'buyerManager') : null,
    }
  }
  if (
    call.contract === 'marketplace' &&
    (call.functionName === 'expire_offer_runtime' || call.functionName === 'read_offer') &&
    isMarketplaceOfferArgs(args)
  ) {
    return {
      node: bytes32(args.node, 'node'),
      buyer_authority: bytes32(args.buyerAuthority, 'buyerAuthority'),
    }
  }
  if (
    call.contract === 'marketplace' &&
    call.functionName === 'claim_refund_runtime' &&
    isMarketplaceClaimRefundRuntimeArgs(args)
  ) {
    return {}
  }
  if (
    call.contract === 'marketplace' &&
    call.functionName === 'read_refund' &&
    isMarketplaceReadRefundArgs(args)
  ) {
    return { authority: bytes32(args.authority, 'authority') }
  }

  if (knownDuskDomainCalls.has(callKey)) {
    throw invalidKnownCallArgs(call)
  }

  return args
}

const noArgDuskDomainCalls = new Set([
  'core.fee_config',
  'treasury.claim_all_runtime',
  'treasury.read_state',
  'marketplace.read_config',
])

const knownDuskDomainCalls = new Set([
  'core.init',
  'core.set_referral_config_runtime',
  'core.set_fee_config_runtime',
  'core.commit_runtime',
  'core.complete_registration_runtime',
  'core.renew_runtime',
  'core.update_authorities_runtime',
  'core.escrow_fixed_sale_runtime',
  'core.escrow_auction_runtime',
  'core.accept_marketplace_offer_runtime',
  'core.set_record_sender_runtime',
  'core.clear_record_sender_runtime',
  'core.mutate_records_sender_runtime',
  'core.set_primary_name_runtime',
  'core.clear_primary_name_runtime',
  'core.create_subname_runtime',
  'core.get_name',
  'core.read_record',
  'core.read_primary_name',
  'core.pending_commitment',
  'core.fee_config',
  'treasury.init',
  'treasury.update_operator_runtime',
  'treasury.claim_runtime',
  'treasury.claim_all_runtime',
  'treasury.claim_referral_reward_runtime',
  'treasury.claim_all_referral_rewards_runtime',
  'treasury.read_state',
  'marketplace.init',
  'marketplace.set_fee_runtime',
  'marketplace.update_operator_runtime',
  'marketplace.buy_fixed_sale_runtime',
  'marketplace.cancel_fixed_sale_runtime',
  'marketplace.expire_fixed_sale_runtime',
  'marketplace.place_bid_runtime',
  'marketplace.cancel_auction_runtime',
  'marketplace.expire_auction_runtime',
  'marketplace.settle_auction_runtime',
  'marketplace.place_offer_runtime',
  'marketplace.cancel_offer_runtime',
  'marketplace.expire_offer_runtime',
  'marketplace.claim_refund_runtime',
  'marketplace.read_config',
  'marketplace.read_fixed_sale',
  'marketplace.read_auction',
  'marketplace.read_offer',
  'marketplace.read_refund',
])

function invalidKnownCallArgs(call: DuskDomainCallMetadata) {
  return new Error(`Invalid Dusk Domains ${call.contract}.${call.functionName} arguments for contract calls.`)
}

function bytes32(value: string, label: string) {
  const hex = value.startsWith('0x') ? value.slice(2) : value
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`${label} must be a 32-byte hex string for DuskDS contract calls.`)
  }
  return Array.from({ length: 32 }, (_, index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16))
}

function utf8(value: string) {
  return Array.from(new TextEncoder().encode(value))
}

function moonlightPublicKeyBytes(value: string, label = 'operatorRecipient') {
  const decoded = decodeBase58(value)
  if (!decoded || decoded.length !== 96) {
    throw new Error(`${label} must be a Dusk public account address for contract calls.`)
  }
  return Array.from(decoded)
}

function principal(value: DuskPrincipal, label: string) {
  if (!isDuskPrincipal(value)) {
    throw new Error(`${label} must be a typed Dusk principal.`)
  }
  if (value.kind === 'Moonlight' && value.bytes.length !== 96 && value.bytes.length !== 193) {
    throw new Error(`${label} Moonlight principal must be a Dusk public key.`)
  }
  if ((value.kind === 'Phoenix' || value.kind === 'Contract') && value.bytes.length !== 32) {
    throw new Error(`${label} ${value.kind} principal must be 32 bytes.`)
  }
  if (value.bytes.every((byte) => byte === 0)) {
    throw new Error(`${label} principal cannot be empty.`)
  }
  return {
    kind: value.kind,
    bytes: [...value.bytes],
  }
}

function recordValue(record: ResolverRecord) {
  return {
    key: record.key,
    value: recordBytes(record.key, record.value),
    ttl_seconds: record.ttlSeconds,
    updated_at: unixSecondsFromIso(record.updatedAt),
  }
}

function recordMutation(mutation: CoreRecordMutationInput) {
  if (mutation.action === 'set') {
    return {
      action: 'Set',
      key: mutation.key,
      value: recordBytes(mutation.key, mutation.value),
      ttl_seconds: mutation.ttlSeconds,
    }
  }
  return {
    action: 'Clear',
    key: mutation.key,
    value: [],
    ttl_seconds: 0,
  }
}

function endpoint(endpointType: string, endpointValue: string) {
  return {
    kind: endpointKind(endpointType),
    value: endpointType === 'moonlight_address'
      ? moonlightPublicKeyBytes(endpointValue, 'Dusk Public Address')
      : utf8(endpointValue),
  }
}

function recordBytes(key: string, value: string) {
  return key === 'moonlight_address'
    ? moonlightPublicKeyBytes(value, 'Dusk Public Address')
    : utf8(value)
}

function endpointKind(endpointType: string) {
  if (endpointType === 'moonlight_address') return 'MoonlightAddress'
  if (endpointType === 'phoenix_payment_endpoint') return 'PhoenixPaymentEndpoint'
  if (endpointType === 'dusk_contract') return 'DuskContract'
  if (endpointType === 'dusk_asset') return 'DuskAsset'
  if (endpointType === 'evm_address') return 'EvmAddress'
  throw new Error(`Unsupported typed endpoint for DuskDS contract calls: ${endpointType}`)
}

function subnameExpiryPolicy(value: string) {
  if (value === 'inherits_parent' || value === 'InheritsParent') return 'InheritsParent'
  if (value === 'fixed_before_parent' || value === 'FixedBeforeParent') return 'FixedBeforeParent'
  throw new Error(`Unsupported subname expiry policy: ${value}`)
}

function subnameRevocationPolicy(value: string) {
  if (value === 'parent_revocable' || value === 'ParentRevocable') return 'ParentRevocable'
  if (value === 'locked' || value === 'Locked') return 'Locked'
  throw new Error(`Unsupported subname revocation policy: ${value}`)
}

function unixSecondsFromIso(value: string) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid ISO timestamp for DuskDS contract calls: ${value}`)
  }
  return Math.floor(timestamp / 1000)
}
