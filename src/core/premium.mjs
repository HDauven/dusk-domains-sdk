export const PREMIUM_WINDOW_DAYS = 21
export const PREMIUM_BLOCKS_PER_DAY = 8_640
export const MAX_REGISTRATION_FEE_LUX = Number.MAX_SAFE_INTEGER
export const MAX_PREMIUM_START_LUX = MAX_REGISTRATION_FEE_LUX

/** Heights determine the price; dates are estimates at the ten-second target block time. */
export function registrationPremiumSchedule({ premiumStartLux, graceEndsAtBlockHeight, currentBlockHeight, nowSeconds }) {
  const empty = { premiumLux: 0, premiumEndsAtBlockHeight: null, nextStepBlockHeight: null, premiumEndsAt: null, nextStepAt: null }
  if (!Number.isSafeInteger(premiumStartLux) || premiumStartLux < 0 || premiumStartLux > MAX_PREMIUM_START_LUX) {
    throw new RangeError('Invalid premium start price.')
  }
  if (graceEndsAtBlockHeight == null || currentBlockHeight == null || premiumStartLux === 0) return empty
  if (![graceEndsAtBlockHeight, currentBlockHeight].every(value => Number.isSafeInteger(value) && value >= 0)) {
    throw new RangeError('Invalid premium block height.')
  }
  const day = Math.floor((currentBlockHeight - graceEndsAtBlockHeight) / PREMIUM_BLOCKS_PER_DAY)
  if (day < 0 || day >= PREMIUM_WINDOW_DAYS) return empty
  const start = BigInt(premiumStartLux)
  const premiumLux = Number((start >> BigInt(day)) - (start >> BigInt(PREMIUM_WINDOW_DAYS)))
  const premiumEndsAtBlockHeight = graceEndsAtBlockHeight + PREMIUM_WINDOW_DAYS * PREMIUM_BLOCKS_PER_DAY
  const nextStepBlockHeight = graceEndsAtBlockHeight + (day + 1) * PREMIUM_BLOCKS_PER_DAY
  const dateAt = height => Number.isFinite(nowSeconds)
    ? new Date((nowSeconds + (height - currentBlockHeight) * 10) * 1_000).toISOString()
    : null
  return { premiumLux, premiumEndsAtBlockHeight, nextStepBlockHeight,
    premiumEndsAt: dateAt(premiumEndsAtBlockHeight), nextStepAt: dateAt(nextStepBlockHeight) }
}

export function validateFeeConfigPrices(config) {
  const annual = [config.threeCharYearLux, config.fourCharYearLux, config.fivePlusYearLux]
  if (!annual.every(value => Number.isSafeInteger(value) && value > 0)
      || !Number.isSafeInteger(config.premiumStartLux) || config.premiumStartLux < 0
      || BigInt(Math.max(...annual)) * 10n + BigInt(config.premiumStartLux) > BigInt(MAX_REGISTRATION_FEE_LUX)) {
    throw new RangeError('Premium plus ten-year fee exceeds the maximum.')
  }
}
