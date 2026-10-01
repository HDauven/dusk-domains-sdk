import { DEFAULT_FEE_CONFIG } from '../constants.mjs'
import { numberOrNull } from '../keys.mjs'
import { normalizePrincipal } from './principals.mjs'

export function normalizeFeeConfig(value) {
  if (!value || typeof value !== 'object') return { ...DEFAULT_FEE_CONFIG }
  return {
    threeCharYearLux: Number(value.threeCharYearLux ?? value.three_char_year_lux ?? DEFAULT_FEE_CONFIG.threeCharYearLux),
    fourCharYearLux: Number(value.fourCharYearLux ?? value.four_char_year_lux ?? DEFAULT_FEE_CONFIG.fourCharYearLux),
    fivePlusYearLux: Number(value.fivePlusYearLux ?? value.five_plus_year_lux ?? DEFAULT_FEE_CONFIG.fivePlusYearLux),
    referralRewardBps: Number(value.referralRewardBps ?? value.referral_reward_bps ?? DEFAULT_FEE_CONFIG.referralRewardBps),
    renewalReferralRewardBps: Number(value.renewalReferralRewardBps ?? value.renewal_referral_reward_bps ?? DEFAULT_FEE_CONFIG.renewalReferralRewardBps),
    premiumReferralRewardBps: Number(value.premiumReferralRewardBps ?? value.premium_referral_reward_bps ?? DEFAULT_FEE_CONFIG.premiumReferralRewardBps),
    version: Number(value.version ?? DEFAULT_FEE_CONFIG.version),
    updatedAt: Number(value.updatedAt ?? value.updated_at ?? DEFAULT_FEE_CONFIG.updatedAt),
    operator: normalizePrincipal(value.operator ?? value.operator_principal ?? null)
      ?? value.operator
      ?? value.operatorAuthority
      ?? value.operator_authority
      ?? null,
    txId: value.txId ?? value.tx_id ?? null,
    blockHeight: numberOrNull(value.blockHeight ?? value.block_height),
  }
}

export function reduceFeeConfigEvent(event, current, meta) {
  const rawConfig = event.config ?? event.feeConfig ?? event.fee_config ?? event
  return {
    ...current,
    ...normalizeFeeConfig(rawConfig),
    operator: normalizePrincipal(event.operator ?? event.operator_principal ?? null)
      ?? event.operator
      ?? current.operator
      ?? null,
    txId: meta.txId ?? current.txId,
    blockHeight: meta.blockHeight ?? current.blockHeight,
  }
}
