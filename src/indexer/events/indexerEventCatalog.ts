/**
 * Event type catalog for Dusk Domains indexer implementations.
 *
 * @module
 */

export const controllerEventTypes = [
  'registration_committed',
  'registration_revealed',
] as const

export const lifecycleEventTypes = [
  'name_registered',
  'name_renewed',
  'name_expired',
  'name_released',
  'name_owner_changed',
  'resolver_changed',
] as const

export const resolverEventTypes = [
  'record_changed',
  'record_cleared',
] as const

export const reverseEventTypes = [
  'primary_name_changed',
] as const

export const subnameEventTypes = [
  'subname_created',
  'subname_delegated',
  'subname_revoked',
] as const

export const treasuryEventTypes = [
  'treasury_initialized',
  'treasury_operator_changed',
  'treasury_fee_received',
  'treasury_claimed',
] as const

export const referralEventTypes = [
  'referral_reward_accrued',
  'referral_reward_claimed',
] as const

export const feeConfigEventTypes = [
  'fee_config_updated',
] as const

export const duskDomainsIndexedEventTypes = [
  ...controllerEventTypes,
  ...lifecycleEventTypes,
  ...resolverEventTypes,
  ...reverseEventTypes,
  ...subnameEventTypes,
  ...treasuryEventTypes,
  ...referralEventTypes,
  ...feeConfigEventTypes,
] as const

const controllerEventTypeSet = new Set<string>(controllerEventTypes)
const lifecycleEventTypeSet = new Set<string>(lifecycleEventTypes)
const resolverEventTypeSet = new Set<string>(resolverEventTypes)
const reverseEventTypeSet = new Set<string>(reverseEventTypes)
const subnameEventTypeSet = new Set<string>(subnameEventTypes)
const treasuryEventTypeSet = new Set<string>(treasuryEventTypes)
const referralEventTypeSet = new Set<string>(referralEventTypes)
const feeConfigEventTypeSet = new Set<string>(feeConfigEventTypes)
const duskDomainsIndexedEventTypeSet = new Set<string>(duskDomainsIndexedEventTypes)

export function isDuskDomainsIndexedEventType(value: string): boolean {
  return duskDomainsIndexedEventTypeSet.has(value)
}

export function isControllerEventType(value: string): boolean {
  return controllerEventTypeSet.has(value)
}

export function isLifecycleEventType(value: string): boolean {
  return lifecycleEventTypeSet.has(value)
}

export function isResolverEventType(value: string): boolean {
  return resolverEventTypeSet.has(value)
}

export function isReverseEventType(value: string): boolean {
  return reverseEventTypeSet.has(value)
}

export function isSubnameEventType(value: string): boolean {
  return subnameEventTypeSet.has(value)
}

export function isTreasuryEventType(value: string): boolean {
  return treasuryEventTypeSet.has(value)
}

export function isReferralEventType(value: string): boolean {
  return referralEventTypeSet.has(value)
}

export function isFeeConfigEventType(value: string): boolean {
  return feeConfigEventTypeSet.has(value)
}
