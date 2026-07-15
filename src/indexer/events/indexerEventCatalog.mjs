/**
 * Event type catalog for Dusk Domains indexer implementations.
 *
 * @module
 */

export const controllerEventTypes = Object.freeze([
  'registration_committed',
  'registration_revealed',
])

export const lifecycleEventTypes = Object.freeze([
  'name_registered',
  'name_renewed',
  'name_expired',
  'name_released',
  'name_owner_changed',
  'resolver_changed',
])

export const resolverEventTypes = Object.freeze([
  'record_changed',
  'record_cleared',
])

export const reverseEventTypes = Object.freeze([
  'primary_name_changed',
])

export const subnameEventTypes = Object.freeze([
  'subname_created',
  'subname_delegated',
  'subname_revoked',
])

export const treasuryEventTypes = Object.freeze([
  'treasury_initialized',
  'treasury_operator_changed',
  'treasury_fee_received',
  'treasury_claimed',
])

export const referralEventTypes = Object.freeze([
  'referral_reward_accrued',
  'referral_reward_claimed',
])

export const feeConfigEventTypes = Object.freeze([
  'fee_config_updated',
])

export const marketplaceEventTypes = Object.freeze([
  'marketplace_initialized',
  'marketplace_config_updated',
  'domain_fixed_sale_opened',
  'domain_fixed_sale_closed',
  'domain_fixed_sale_filled',
  'domain_auction_created',
  'domain_bid_placed',
  'domain_auction_cancelled',
  'domain_auction_settled',
  'domain_offer_placed',
  'domain_offer_closed',
  'domain_offer_accepted',
  'marketplace_refund_claimed',
])

export const duskDomainsIndexedEventTypes = Object.freeze([
  ...controllerEventTypes,
  ...lifecycleEventTypes,
  ...resolverEventTypes,
  ...reverseEventTypes,
  ...subnameEventTypes,
  ...treasuryEventTypes,
  ...referralEventTypes,
  ...feeConfigEventTypes,
  ...marketplaceEventTypes,
])

const controllerEventTypeSet = new Set(controllerEventTypes)
const lifecycleEventTypeSet = new Set(lifecycleEventTypes)
const resolverEventTypeSet = new Set(resolverEventTypes)
const reverseEventTypeSet = new Set(reverseEventTypes)
const subnameEventTypeSet = new Set(subnameEventTypes)
const treasuryEventTypeSet = new Set(treasuryEventTypes)
const referralEventTypeSet = new Set(referralEventTypes)
const feeConfigEventTypeSet = new Set(feeConfigEventTypes)
const marketplaceEventTypeSet = new Set(marketplaceEventTypes)
const duskDomainsIndexedEventTypeSet = new Set(duskDomainsIndexedEventTypes)

export function isDuskDomainsIndexedEventType(value) {
  return duskDomainsIndexedEventTypeSet.has(value)
}

export function isControllerEventType(value) {
  return controllerEventTypeSet.has(value)
}

export function isLifecycleEventType(value) {
  return lifecycleEventTypeSet.has(value)
}

export function isResolverEventType(value) {
  return resolverEventTypeSet.has(value)
}

export function isReverseEventType(value) {
  return reverseEventTypeSet.has(value)
}

export function isSubnameEventType(value) {
  return subnameEventTypeSet.has(value)
}

export function isTreasuryEventType(value) {
  return treasuryEventTypeSet.has(value)
}

export function isReferralEventType(value) {
  return referralEventTypeSet.has(value)
}

export function isFeeConfigEventType(value) {
  return feeConfigEventTypeSet.has(value)
}

export function isMarketplaceEventType(value) {
  return marketplaceEventTypeSet.has(value)
}
