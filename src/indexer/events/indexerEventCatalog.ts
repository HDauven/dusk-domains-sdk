/**
 * Event type catalog for Dusk Domains indexer implementations.
 *
 * @module
 */

/** Event types emitted by the registration controller. */
export const controllerEventTypes = [
  'registration_committed',
  'registration_revealed',
] as const

/** Event types that describe name lifecycle and ownership changes. */
export const lifecycleEventTypes = [
  'name_registered',
  'name_renewed',
  'name_expired',
  'name_released',
  'name_owner_changed',
  'resolver_changed',
] as const

/** Event types emitted when resolver records are changed or cleared. */
export const resolverEventTypes = [
  'record_changed',
  'record_cleared',
] as const

/** Event types emitted by the reverse registry. */
export const reverseEventTypes = [
  'primary_name_changed',
] as const

/** Event types emitted by subdomain management operations. */
export const subnameEventTypes = [
  'subname_created',
  'subname_delegated',
  'subname_revoked',
] as const

/** Event types emitted by treasury intake, claims and operator changes. */
export const treasuryEventTypes = [
  'treasury_initialized',
  'treasury_operator_changed',
  'treasury_fee_received',
  'treasury_claimed',
] as const

/** Event types emitted by referral accrual and claims. */
export const referralEventTypes = [
  'referral_reward_accrued',
  'referral_reward_claimed',
] as const

/** Event types emitted when registration and renewal fee config changes. */
export const feeConfigEventTypes = [
  'fee_config_updated',
] as const

/** Event types emitted by the optional Dusk Domains marketplace. */
export const marketplaceEventTypes = [
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
] as const

/** All event types known to the public Dusk Domains indexer schema. */
export const duskDomainsIndexedEventTypes = [
  ...controllerEventTypes,
  ...lifecycleEventTypes,
  ...resolverEventTypes,
  ...reverseEventTypes,
  ...subnameEventTypes,
  ...treasuryEventTypes,
  ...referralEventTypes,
  ...feeConfigEventTypes,
  ...marketplaceEventTypes,
] as const

const controllerEventTypeSet = new Set<string>(controllerEventTypes)
const lifecycleEventTypeSet = new Set<string>(lifecycleEventTypes)
const resolverEventTypeSet = new Set<string>(resolverEventTypes)
const reverseEventTypeSet = new Set<string>(reverseEventTypes)
const subnameEventTypeSet = new Set<string>(subnameEventTypes)
const treasuryEventTypeSet = new Set<string>(treasuryEventTypes)
const referralEventTypeSet = new Set<string>(referralEventTypes)
const feeConfigEventTypeSet = new Set<string>(feeConfigEventTypes)
const marketplaceEventTypeSet = new Set<string>(marketplaceEventTypes)
const duskDomainsIndexedEventTypeSet = new Set<string>(duskDomainsIndexedEventTypes)

/** Returns true when a value is any known Dusk Domains indexed event type. */
export function isDuskDomainsIndexedEventType(value: string): boolean {
  return duskDomainsIndexedEventTypeSet.has(value)
}

/** Returns true when a value is a registration-controller event type. */
export function isControllerEventType(value: string): boolean {
  return controllerEventTypeSet.has(value)
}

/** Returns true when a value is a name lifecycle event type. */
export function isLifecycleEventType(value: string): boolean {
  return lifecycleEventTypeSet.has(value)
}

/** Returns true when a value is a resolver record event type. */
export function isResolverEventType(value: string): boolean {
  return resolverEventTypeSet.has(value)
}

/** Returns true when a value is a reverse registry event type. */
export function isReverseEventType(value: string): boolean {
  return reverseEventTypeSet.has(value)
}

/** Returns true when a value is a subdomain event type. */
export function isSubnameEventType(value: string): boolean {
  return subnameEventTypeSet.has(value)
}

/** Returns true when a value is a treasury event type. */
export function isTreasuryEventType(value: string): boolean {
  return treasuryEventTypeSet.has(value)
}

/** Returns true when a value is a referral event type. */
export function isReferralEventType(value: string): boolean {
  return referralEventTypeSet.has(value)
}

/** Returns true when a value is a fee config event type. */
export function isFeeConfigEventType(value: string): boolean {
  return feeConfigEventTypeSet.has(value)
}

/** Returns true when a value is a marketplace event type. */
export function isMarketplaceEventType(value: string): boolean {
  return marketplaceEventTypeSet.has(value)
}
