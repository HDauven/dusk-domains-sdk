/**
 * Event type catalog for Dusk Domains indexer implementations.
 *
 * @module
 */

export const controllerEventTypes: readonly string[]
export const lifecycleEventTypes: readonly string[]
export const resolverEventTypes: readonly string[]
export const reverseEventTypes: readonly string[]
export const subnameEventTypes: readonly string[]
export const treasuryEventTypes: readonly string[]
export const referralEventTypes: readonly string[]
export const feeConfigEventTypes: readonly string[]
export const duskDomainsIndexedEventTypes: readonly string[]

export function isDuskDomainsIndexedEventType(value: string): boolean
export function isControllerEventType(value: string): boolean
export function isLifecycleEventType(value: string): boolean
export function isResolverEventType(value: string): boolean
export function isReverseEventType(value: string): boolean
export function isSubnameEventType(value: string): boolean
export function isTreasuryEventType(value: string): boolean
export function isReferralEventType(value: string): boolean
export function isFeeConfigEventType(value: string): boolean
