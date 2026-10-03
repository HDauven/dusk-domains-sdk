import type { CoreFeeConfig } from './namePolicy'
export const PREMIUM_WINDOW_DAYS: 21
export const PREMIUM_BLOCKS_PER_DAY: 8640
export const MAX_REGISTRATION_FEE_LUX: number
export const MAX_PREMIUM_START_LUX: number
export type PremiumSchedule = {
  premiumLux: number
  premiumEndsAtBlockHeight: number | null
  nextStepBlockHeight: number | null
  premiumEndsAt: string | null
  nextStepAt: string | null
}
export function registrationPremiumSchedule(args: {
  premiumStartLux: number
  graceEndsAtBlockHeight: number | null
  currentBlockHeight: number | null
  nowSeconds?: number
}): PremiumSchedule
export function validateFeeConfigPrices(config: Pick<CoreFeeConfig, 'threeCharYearLux' | 'fourCharYearLux' | 'fivePlusYearLux' | 'premiumStartLux'>): void
