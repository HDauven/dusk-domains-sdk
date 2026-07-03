import { ACTIVITY_EVENT_TYPES, type ActivityEntry } from './activity'
import type { ForwardResolutionResponse } from './indexer'
import type {
  IndexedFeeConfig,
  IndexedLifecycleName,
  IndexedNameSummary,
  IndexedReferralState,
  IndexedRegistrationCommitment,
  IndexedResolverRecordHistoryEntry,
  IndexedSubname,
  IndexedTreasuryState,
} from './indexerTypes'
import type { NameResult, NameStatus, SearchIssue } from './namePolicy'
import type { ResolverRecord } from './records'

export function isNameResult(value: unknown): value is NameResult {
  return (
    isRecord(value) &&
    typeof value.canonical === 'string' &&
    typeof value.canonicalRaw === 'string' &&
    typeof value.displayName === 'string' &&
    typeof value.label === 'string' &&
    isNameStatus(value.status) &&
    typeof value.price === 'number' &&
    Array.isArray(value.issues) &&
    value.issues.every(isSearchIssue) &&
    typeof value.transactionBlocked === 'boolean'
  )
}

export function isForwardResolutionResponse(value: unknown): value is ForwardResolutionResponse {
  return (
    isRecord(value) &&
    typeof value.canonicalName === 'string' &&
    typeof value.node === 'string' &&
    Array.isArray(value.records) &&
    isRecord(value.resolver) &&
    isRecord(value.expiry) &&
    isRecord(value.cache) &&
    Array.isArray(value.warnings) &&
    Array.isArray(value.errors) &&
    (value.verificationStatus === 'unverified' || value.verificationStatus === 'forward_resolved')
  )
}

export function isIndexerHealth(value: unknown): value is {
  ok: boolean
  generatedAt: string
  source: string
  mode: string
  currentBlockHeight: number | null
  routes: string[]
  names: number
} {
  return (
    isRecord(value) &&
    typeof value.ok === 'boolean' &&
    (value.apiVersion === undefined || typeof value.apiVersion === 'string') &&
    typeof value.generatedAt === 'string' &&
    typeof value.source === 'string' &&
    typeof value.mode === 'string' &&
    (
      value.schemaVersion === undefined ||
      typeof value.schemaVersion === 'string' ||
      typeof value.schemaVersion === 'number'
    ) &&
    (
      value.eventSchemaVersion === undefined ||
      typeof value.eventSchemaVersion === 'string' ||
      typeof value.eventSchemaVersion === 'number'
    ) &&
    (
      value.readModelSchemaVersion === undefined ||
      typeof value.readModelSchemaVersion === 'string' ||
      typeof value.readModelSchemaVersion === 'number'
    ) &&
    (typeof value.currentBlockHeight === 'number' || value.currentBlockHeight === null) &&
    isNullableNumber(value.finalizedBlockHeight) &&
    isNullableNumber(value.lagBlocks) &&
    (value.eventCount === undefined || isNonNegativeInteger(value.eventCount)) &&
    Array.isArray(value.routes) &&
    value.routes.every((route) => typeof route === 'string') &&
    typeof value.names === 'number'
  )
}

export function isIndexedRegistrationCommitment(value: unknown): value is IndexedRegistrationCommitment {
  return (
    isRecord(value) &&
    typeof value.commitment === 'string' &&
    typeof value.controller === 'string' &&
    isNullableString(value.createdAt) &&
    isNullableString(value.node) &&
    (value.status === 'committed' || value.status === 'revealed') &&
    isNullableString(value.committedTxId) &&
    (typeof value.committedBlockHeight === 'number' || value.committedBlockHeight === null) &&
    isNullableString(value.revealedTxId) &&
    (typeof value.revealedBlockHeight === 'number' || value.revealedBlockHeight === null) &&
    (value.lastEventType === 'registration_committed' || value.lastEventType === 'registration_revealed')
  )
}

export function isIndexedLifecycleName(value: unknown): value is IndexedLifecycleName {
  return (
    isRecord(value) &&
    typeof value.node === 'string' &&
    typeof value.canonicalName === 'string' &&
    isNullableString(value.owner) &&
    isNullableString(value.manager) &&
    isNullableString(value.resolverId) &&
    isNullableString(value.expiresAt) &&
    isNullableString(value.graceEndsAt) &&
    isNullableNumber(value.expiresAtBlockHeight) &&
    isNullableNumber(value.graceEndsAtBlockHeight) &&
    (value.status === 'active' || value.status === 'expired' || value.status === 'released') &&
    typeof value.lastEventType === 'string'
  )
}

export function isActivityEntry(value: unknown): value is ActivityEntry {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    ACTIVITY_EVENT_TYPES.includes(value.eventType as ActivityEntry['eventType']) &&
    typeof value.node === 'string' &&
    typeof value.name === 'string' &&
    typeof value.actor === 'string' &&
    typeof value.timestamp === 'string' &&
    (typeof value.blockHeight === 'number' || value.blockHeight === null) &&
    (value.txId === undefined || typeof value.txId === 'string') &&
    (value.target === undefined || typeof value.target === 'string')
  )
}

export function isIndexedNameSummary(value: unknown): value is IndexedNameSummary {
  const summary = value as Partial<IndexedNameSummary>
  return (
    isRecord(value) &&
    isIndexedLifecycleName(value) &&
    Array.isArray(summary.records) &&
    summary.records.every(isResolverRecord) &&
    isNullableString(summary.primaryName) &&
    (
      summary.primaryStatus === 'verified' ||
      summary.primaryStatus === 'missing' ||
      summary.primaryStatus === 'mismatch' ||
      summary.primaryStatus === 'no_address'
    ) &&
    isNonNegativeInteger(summary.subnameCount) &&
    isNonNegativeInteger(summary.activityCount)
  )
}

export function isResolverRecord(value: unknown): value is ResolverRecord {
  return (
    isRecord(value) &&
    typeof value.key === 'string' &&
    typeof value.value === 'string' &&
    (value.visibility === 'public' || value.visibility === 'sensitive_public') &&
    typeof value.updatedAt === 'string' &&
    typeof value.ttlSeconds === 'number'
  )
}

export function isIndexedResolverRecordHistoryEntry(value: unknown): value is IndexedResolverRecordHistoryEntry {
  return (
    isRecord(value) &&
    typeof value.node === 'string' &&
    typeof value.key === 'string' &&
    (value.action === 'set' || value.action === 'clear') &&
    (value.record === null || isResolverRecord(value.record)) &&
    (value.previousRecord === null || isResolverRecord(value.previousRecord)) &&
    typeof value.controller === 'string' &&
    typeof value.updatedAt === 'string' &&
    isNullableString(value.txId) &&
    isNullableNumber(value.blockHeight) &&
    isNullableNumber(value.eventIndex) &&
    (value.eventType === 'record_changed' || value.eventType === 'record_cleared')
  )
}

export function isIndexedSubname(value: unknown): value is IndexedSubname {
  return (
    isRecord(value) &&
    typeof value.parentNode === 'string' &&
    typeof value.node === 'string' &&
    typeof value.parentName === 'string' &&
    typeof value.name === 'string' &&
    typeof value.label === 'string' &&
    typeof value.owner === 'string' &&
    typeof value.manager === 'string' &&
    typeof value.resolver === 'string' &&
    typeof value.expiresAt === 'string' &&
    typeof value.parentExpiresAt === 'string' &&
    isNullableNumber(value.expiresAtBlockHeight) &&
    isNullableNumber(value.parentExpiresAtBlockHeight) &&
    (value.expiryPolicy === 'inherits_parent' || value.expiryPolicy === 'fixed_before_parent') &&
    (value.revocationPolicy === 'parent_revocable' || value.revocationPolicy === 'locked') &&
    (value.status === 'active' || value.status === 'revoked' || value.status === 'expired') &&
    typeof value.createdAt === 'string' &&
    isNullableString(value.revokedAt) &&
    typeof value.lastEventType === 'string' &&
    isNullableString(value.txId) &&
    (typeof value.blockHeight === 'number' || value.blockHeight === null)
  )
}

export function isIndexedTreasuryState(value: unknown): value is IndexedTreasuryState {
  return (
    isRecord(value) &&
    typeof value.initialized === 'boolean' &&
    (value.operator === null || value.operator === undefined || isDuskPrincipal(value.operator)) &&
    isNullableString(value.operatorAuthority) &&
    isNullableString(value.operatorRecipient) &&
    Array.isArray(value.allowedFeeSources) &&
    value.allowedFeeSources.every((source) => typeof source === 'string') &&
    isNonNegativeInteger(value.totalReceivedLux) &&
    isNonNegativeInteger(value.availableLux) &&
    isNonNegativeInteger(value.registrationReceivedLux) &&
    isNonNegativeInteger(value.renewalReceivedLux) &&
    isNonNegativeInteger(value.otherReceivedLux) &&
    isNonNegativeInteger(value.referralClaimableLux) &&
    isNonNegativeInteger(value.referralClaimedLux) &&
    isNonNegativeInteger(value.referralCount) &&
    isNullableString(value.lastFeeSourceContract) &&
    (value.lastFeeReason === 'registration' || value.lastFeeReason === 'renewal' || value.lastFeeReason === 'other' || value.lastFeeReason === null) &&
    isNullableString(value.lastFeeNode) &&
    (
      value.lastEventType === 'treasury_initialized' ||
      value.lastEventType === 'treasury_operator_changed' ||
      value.lastEventType === 'treasury_fee_received' ||
      value.lastEventType === 'treasury_claimed' ||
      value.lastEventType === null
    ) &&
    isNullableString(value.txId) &&
    (typeof value.blockHeight === 'number' || value.blockHeight === null) &&
    Array.isArray(value.claims) &&
    value.claims.every(isIndexedTreasuryClaim)
  )
}

export function isIndexedReferralState(value: unknown): value is IndexedReferralState {
  return (
    isRecord(value) &&
    typeof value.supported === 'boolean' &&
    isNullableString(value.referrer) &&
    isNonNegativeInteger(value.claimableLux) &&
    isNonNegativeInteger(value.claimedLux) &&
    isNonNegativeInteger(value.referralCount) &&
    Array.isArray(value.recentActivity) &&
    value.recentActivity.every((activity) => (
      isRecord(activity) &&
      isNullableString(activity.txId) &&
      (typeof activity.blockHeight === 'number' || activity.blockHeight === null) &&
      isNonNegativeInteger(activity.amountLux) &&
      (activity.kind === 'accrual' || activity.kind === 'claim') &&
      isNullableString(activity.counterparty)
    ))
  )
}

export function isIndexedFeeConfig(value: unknown): value is IndexedFeeConfig {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.threeCharYearLux) &&
    isNonNegativeInteger(value.fourCharYearLux) &&
    isNonNegativeInteger(value.fivePlusYearLux) &&
    isNonNegativeInteger(value.referralRewardBps) &&
    isNonNegativeInteger(value.renewalReferralRewardBps) &&
    isNonNegativeInteger(value.premiumReferralRewardBps) &&
    isNonNegativeInteger(value.version) &&
    isNonNegativeInteger(value.updatedAt) &&
    (value.operator === null || typeof value.operator === 'string' || isDuskPrincipal(value.operator)) &&
    isNullableString(value.txId) &&
    (typeof value.blockHeight === 'number' || value.blockHeight === null)
  )
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object')
}

function isIndexedTreasuryClaim(value: unknown) {
  return (
    isRecord(value) &&
    (value.operator === null || value.operator === undefined || isDuskPrincipal(value.operator)) &&
    (typeof value.operatorAuthority === 'string' || value.operatorAuthority === undefined) &&
    typeof value.operatorRecipient === 'string' &&
    isNonNegativeInteger(value.amountLux) &&
    isNonNegativeInteger(value.remainingLux) &&
    isNullableString(value.txId) &&
    (typeof value.blockHeight === 'number' || value.blockHeight === null)
  )
}

function isDuskPrincipal(value: unknown) {
  return (
    isRecord(value) &&
    (value.kind === 'Moonlight' || value.kind === 'Phoenix' || value.kind === 'Contract') &&
    Array.isArray(value.bytes) &&
    value.bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  )
}

function isNameStatus(value: unknown): value is NameStatus {
  return value === 'available' || value === 'registered' || value === 'reserved' || value === 'invalid'
}

function isSearchIssue(value: unknown): value is SearchIssue {
  return (
    isRecord(value) &&
    (value.tone === 'danger' || value.tone === 'warning' || value.tone === 'info') &&
    typeof value.text === 'string'
  )
}

function isNonNegativeInteger(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0
}

function isNullableString(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}

function isNullableNumber(value: unknown): value is number | null | undefined {
  return typeof value === 'number' || value === null || value === undefined
}
