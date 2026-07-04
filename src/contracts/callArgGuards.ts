import type {
  CoreClearPrimaryNameRuntimeArgs,
  CoreClearRecordSenderRuntimeArgs,
  CoreCommitRuntimeArgs,
  CoreCompleteRegistrationRuntimeArgs,
  CoreCreateSubnameRuntimeArgs,
  CoreInitArgs,
  CoreMutateRecordsSenderRuntimeArgs,
  CoreRenewRuntimeArgs,
  CoreSetFeeConfigRuntimeArgs,
  CoreSetPrimaryNameRuntimeArgs,
  CoreSetRecordSenderRuntimeArgs,
  CoreSetReferralConfigRuntimeArgs,
  CoreUpdateAuthoritiesRuntimeArgs,
  TreasuryClaimAllReferralRewardsRuntimeArgs,
  TreasuryClaimReferralRewardRuntimeArgs,
  TreasuryClaimRuntimeArgs,
  TreasuryInitArgs,
  TreasuryUpdateOperatorRuntimeArgs,
} from './callTypes'
import type { DuskPrincipal } from '../core/principal'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

export function isCoreInitArgs(value: unknown): value is CoreInitArgs {
  return (
    isRecord(value) &&
    typeof value.treasuryContract === 'string' &&
    typeof value.recordSourceContract === 'string' &&
    isDuskPrincipal(value.operator) &&
    typeof value.referralRewardBps === 'number'
  )
}

export function isCoreSetReferralConfigRuntimeArgs(
  value: unknown,
): value is CoreSetReferralConfigRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.referralRewardBps === 'number'
  )
}

export function isCoreSetFeeConfigRuntimeArgs(value: unknown): value is CoreSetFeeConfigRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.threeCharYearLux === 'number' &&
    typeof value.fourCharYearLux === 'number' &&
    typeof value.fivePlusYearLux === 'number' &&
    typeof value.referralRewardBps === 'number' &&
    typeof value.renewalReferralRewardBps === 'number' &&
    typeof value.premiumReferralRewardBps === 'number'
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
    typeof value.durationYears === 'number' &&
    typeof value.feeLux === 'number' &&
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

export function isCoreRenewRuntimeArgs(value: unknown): value is CoreRenewRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.node === 'string' &&
    typeof value.durationYears === 'number' &&
    typeof value.feeLux === 'number'
  )
}

export function isCoreUpdateAuthoritiesRuntimeArgs(value: unknown): value is CoreUpdateAuthoritiesRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.node === 'string' &&
    typeof value.owner === 'string' &&
    typeof value.manager === 'string'
  )
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
    typeof value.expiresAt === 'number' &&
    typeof value.expiryPolicy === 'string' &&
    typeof value.revocationPolicy === 'string'
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
          typeof mutation.ttlSeconds === 'number'
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
    value.allowedFeeSources.every((source) => typeof source === 'string')
  )
}

export function isTreasuryUpdateOperatorRuntimeArgs(value: unknown): value is TreasuryUpdateOperatorRuntimeArgs {
  return (
    isRecord(value) &&
    isDuskPrincipal(value.operator) &&
    typeof value.operatorRecipient === 'string'
  )
}

export function isTreasuryClaimRuntimeArgs(value: unknown): value is TreasuryClaimRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.amountLux === 'number'
  )
}

export function isTreasuryClaimReferralRewardRuntimeArgs(
  value: unknown,
): value is TreasuryClaimReferralRewardRuntimeArgs {
  return (
    isRecord(value) &&
    typeof value.amountLux === 'number' &&
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
    typeof value.ttlSeconds === 'number' &&
    typeof value.visibility === 'string'
  )
}
