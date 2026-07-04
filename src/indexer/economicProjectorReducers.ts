import { DEFAULT_FEE_CONFIG } from '../core/namePolicy'
import type { DuskPrincipal } from '../core/principal'
import { principalKey } from '../core/principal'
import type {
  FeeConfigEvent,
  IndexedFeeConfig,
  IndexedReferralState,
  IndexedTreasuryState,
  IndexerEventMeta,
  ReferralEvent,
  TreasuryEvent,
} from './indexerTypes'

export function emptyTreasuryState(): IndexedTreasuryState {
  return {
    initialized: false,
    operator: null,
    operatorAuthority: null,
    operatorRecipient: null,
    allowedFeeSources: [],
    totalReceivedLux: 0,
    availableLux: 0,
    registrationReceivedLux: 0,
    renewalReceivedLux: 0,
    otherReceivedLux: 0,
    referralClaimableLux: 0,
    referralClaimedLux: 0,
    referralCount: 0,
    lastFeeSourceContract: null,
    lastFeeReason: null,
    lastFeeNode: null,
    lastEventType: null,
    txId: null,
    blockHeight: null,
    claims: [],
  }
}

export function reduceTreasuryState(
  event: TreasuryEvent,
  current: IndexedTreasuryState,
  meta: IndexerEventMeta,
): IndexedTreasuryState {
  if (event.type === 'treasury_initialized') {
    const operator = event.operator ?? legacyPhoenixPrincipal(event.operatorAuthority ?? '')
    return {
      ...current,
      initialized: true,
      operator,
      operatorAuthority: event.operatorAuthority ?? principalKey(operator),
      operatorRecipient: event.operatorRecipient,
      allowedFeeSources: [...event.allowedFeeSources],
      lastEventType: event.type,
      txId: meta.txId ?? current.txId,
      blockHeight: meta.blockHeight ?? current.blockHeight,
    }
  }

  if (event.type === 'treasury_operator_changed') {
    const operator = event.operator ?? legacyPhoenixPrincipal(event.operatorAuthority ?? '')
    return {
      ...current,
      operator,
      operatorAuthority: event.operatorAuthority ?? principalKey(operator),
      operatorRecipient: event.operatorRecipient,
      lastEventType: event.type,
      txId: meta.txId ?? current.txId,
      blockHeight: meta.blockHeight ?? current.blockHeight,
    }
  }

  if (event.type === 'treasury_fee_received') {
    return {
      ...current,
      totalReceivedLux: event.totalReceivedLux,
      availableLux: event.availableLux,
      registrationReceivedLux: event.registrationReceivedLux,
      renewalReceivedLux: event.renewalReceivedLux,
      otherReceivedLux: event.otherReceivedLux,
      lastFeeSourceContract: event.sourceContract,
      lastFeeReason: event.reason,
      lastFeeNode: event.node,
      lastEventType: event.type,
      txId: meta.txId ?? current.txId,
      blockHeight: meta.blockHeight ?? current.blockHeight,
    }
  }

  const operator = event.operator ?? legacyPhoenixPrincipal(event.operatorAuthority ?? '')
  return {
    ...current,
    operator,
    operatorAuthority: event.operatorAuthority ?? principalKey(operator),
    operatorRecipient: event.operatorRecipient,
    availableLux: event.remainingLux,
    lastEventType: event.type,
    txId: meta.txId ?? current.txId,
    blockHeight: meta.blockHeight ?? current.blockHeight,
    claims: [
      {
        operator,
        operatorAuthority: event.operatorAuthority ?? principalKey(operator),
        operatorRecipient: event.operatorRecipient,
        amountLux: event.amountLux,
        remainingLux: event.remainingLux,
        txId: meta.txId ?? null,
        blockHeight: meta.blockHeight ?? null,
      },
      ...current.claims,
    ].slice(0, 12),
  }
}

export function reduceTreasuryReferralReserve(
  event: ReferralEvent,
  current: IndexedTreasuryState,
): IndexedTreasuryState {
  if (event.type !== 'referral_reward_accrued') return current

  return {
    ...current,
    availableLux: Math.max(0, current.availableLux - event.amountLux),
    referralClaimableLux: current.referralClaimableLux + event.amountLux,
    referralCount: current.referralCount + 1,
  }
}

export function reduceTreasuryReferralClaim(
  event: ReferralEvent,
  current: IndexedTreasuryState,
): IndexedTreasuryState {
  if (event.type !== 'referral_reward_claimed') return current

  return {
    ...current,
    referralClaimableLux: Math.max(0, current.referralClaimableLux - event.amountLux),
    referralClaimedLux: current.referralClaimedLux + event.amountLux,
  }
}

export function emptyReferralState(referrer: string | null = null, supported = false): IndexedReferralState {
  return {
    supported,
    referrer,
    claimableLux: 0,
    claimedLux: 0,
    referralCount: 0,
    recentActivity: [],
  }
}

export function emptyFeeConfig(): IndexedFeeConfig {
  return {
    ...DEFAULT_FEE_CONFIG,
    operator: null,
    txId: null,
    blockHeight: null,
  }
}

export function reduceFeeConfig(
  event: FeeConfigEvent,
  current: IndexedFeeConfig,
  meta: IndexerEventMeta,
): IndexedFeeConfig {
  return {
    ...DEFAULT_FEE_CONFIG,
    ...event.config,
    operator: event.operator ?? current.operator,
    txId: meta.txId ?? current.txId,
    blockHeight: meta.blockHeight ?? current.blockHeight,
  }
}

export function reduceReferralState(
  event: ReferralEvent,
  current: IndexedReferralState,
  meta: IndexerEventMeta,
): IndexedReferralState {
  if (event.type === 'referral_reward_accrued') {
    const referrer = referralKey(event.referrer)
    return {
      supported: true,
      referrer,
      claimableLux: event.claimableLux,
      claimedLux: event.claimedLux,
      referralCount: event.referralCount,
      recentActivity: [
        {
          txId: meta.txId ?? null,
          blockHeight: meta.blockHeight ?? null,
          amountLux: event.amountLux,
          kind: 'accrual' as const,
          counterparty: referralKey(event.buyer),
        },
        ...current.recentActivity,
      ].slice(0, 12),
    }
  }

  return {
    supported: true,
    referrer: referralKey(event.referrer),
    claimableLux: event.remainingLux,
    claimedLux: event.claimedLux,
    referralCount: event.referralCount,
    recentActivity: [
      {
        txId: meta.txId ?? null,
        blockHeight: meta.blockHeight ?? null,
        amountLux: event.amountLux,
        kind: 'claim' as const,
        counterparty: null,
      },
      ...current.recentActivity,
    ].slice(0, 12),
  }
}

export function referralKey(referrer: string | DuskPrincipal) {
  return typeof referrer === 'string' ? normalizePrincipalKey(referrer.trim().toLowerCase()) : principalKey(referrer)
}

function normalizePrincipalKey(value: string) {
  return value.replace(/^(moonlight|phoenix|contract):0x([0-9a-f]+)$/u, '$1:$2')
}

function legacyPhoenixPrincipal(value: string): DuskPrincipal | null {
  const normalized = value.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(normalized)) return null
  return {
    kind: 'Phoenix',
    bytes: Array.from({ length: 32 }, (_, index) => Number.parseInt(normalized.slice(2 + index * 2, 4 + index * 2), 16)),
  }
}
