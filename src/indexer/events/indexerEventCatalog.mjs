// Generated from indexerEventCatalog.ts by npm run build. Do not edit.
/**
 * Event type catalog for Dusk Domains indexer implementations.
 *
 * @module
 */
/** Event types emitted by the registration controller. */
export const controllerEventTypes = [
    'registration_committed',
    'registration_revealed',
];
/** Event types that describe name lifecycle and ownership changes. */
export const lifecycleEventTypes = [
    'name_registered',
    'name_renewed',
    'name_expired',
    'name_released',
    'name_owner_changed',
    'resolver_changed',
];
/** Event types emitted when resolver records are changed or cleared. */
export const resolverEventTypes = [
    'record_changed',
    'record_cleared',
];
/** Event types emitted by the reverse registry. */
export const reverseEventTypes = [
    'primary_name_changed',
];
/** Event types emitted by subdomain management operations. */
export const subnameEventTypes = [
    'subname_created',
    'subname_delegated',
    'subname_revoked',
];
/** Event types emitted by treasury intake, claims and operator changes. */
export const treasuryEventTypes = [
    'treasury_initialized',
    'treasury_operator_changed',
    'treasury_fee_received',
    'treasury_claimed',
];
/** Event types emitted by referral accrual and claims. */
export const referralEventTypes = [
    'referral_reward_accrued',
    'referral_reward_claimed',
];
/** Event types emitted when registration and renewal fee config changes. */
export const feeConfigEventTypes = [
    'fee_config_updated',
];
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
];
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
];
// Keep the TypeScript and plain-Node catalogs equally immutable.
for (const eventTypes of [
    controllerEventTypes,
    lifecycleEventTypes,
    resolverEventTypes,
    reverseEventTypes,
    subnameEventTypes,
    treasuryEventTypes,
    referralEventTypes,
    feeConfigEventTypes,
    marketplaceEventTypes,
    duskDomainsIndexedEventTypes,
])
    Object.freeze(eventTypes);
const controllerEventTypeSet = new Set(controllerEventTypes);
const lifecycleEventTypeSet = new Set(lifecycleEventTypes);
const resolverEventTypeSet = new Set(resolverEventTypes);
const reverseEventTypeSet = new Set(reverseEventTypes);
const subnameEventTypeSet = new Set(subnameEventTypes);
const treasuryEventTypeSet = new Set(treasuryEventTypes);
const referralEventTypeSet = new Set(referralEventTypes);
const feeConfigEventTypeSet = new Set(feeConfigEventTypes);
const marketplaceEventTypeSet = new Set(marketplaceEventTypes);
const duskDomainsIndexedEventTypeSet = new Set(duskDomainsIndexedEventTypes);
/** Returns true when a value is any known Dusk Domains indexed event type. */
export function isDuskDomainsIndexedEventType(value) {
    return duskDomainsIndexedEventTypeSet.has(value);
}
/** Returns true when a value is a registration-controller event type. */
export function isControllerEventType(value) {
    return controllerEventTypeSet.has(value);
}
/** Returns true when a value is a name lifecycle event type. */
export function isLifecycleEventType(value) {
    return lifecycleEventTypeSet.has(value);
}
/** Returns true when a value is a resolver record event type. */
export function isResolverEventType(value) {
    return resolverEventTypeSet.has(value);
}
/** Returns true when a value is a reverse registry event type. */
export function isReverseEventType(value) {
    return reverseEventTypeSet.has(value);
}
/** Returns true when a value is a subdomain event type. */
export function isSubnameEventType(value) {
    return subnameEventTypeSet.has(value);
}
/** Returns true when a value is a treasury event type. */
export function isTreasuryEventType(value) {
    return treasuryEventTypeSet.has(value);
}
/** Returns true when a value is a referral event type. */
export function isReferralEventType(value) {
    return referralEventTypeSet.has(value);
}
/** Returns true when a value is a fee config event type. */
export function isFeeConfigEventType(value) {
    return feeConfigEventTypeSet.has(value);
}
/** Returns true when a value is a marketplace event type. */
export function isMarketplaceEventType(value) {
    return marketplaceEventTypeSet.has(value);
}
