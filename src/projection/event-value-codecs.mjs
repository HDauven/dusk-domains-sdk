export function endpointKindToRecordKey(kind) {
  if (kind === 'MoonlightAddress') return 'moonlight_address'
  if (kind === 'PhoenixPaymentEndpoint') return 'phoenix_payment_endpoint'
  if (kind === 'DuskContract') return 'dusk_contract'
  if (kind === 'EvmAddress') return 'evm_address'
  return String(kind ?? 'moonlight_address').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

export function treasuryReasonName(reason) {
  const value = Number(reason)
  if (value === 1) return 'registration'
  if (value === 2) return 'renewal'
  return 'other'
}

export function enumValue(value) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') return Object.keys(value)[0]
  return value
}

export function bytesToHex(value) {
  if (typeof value === 'string') return withHexPrefix(value)
  if (!Array.isArray(value)) return null
  return `0x${value.map((byte) => Number(byte).toString(16).padStart(2, '0')).join('')}`
}

export function principalFromEvent(value, legacyBytes = null) {
  if (value && typeof value === 'object' && typeof value.kind === 'string' && Array.isArray(value.bytes)) {
    return {
      kind: value.kind,
      bytes: value.bytes.map((byte) => Number(byte)),
    }
  }
  if (Array.isArray(legacyBytes)) {
    return {
      kind: 'Phoenix',
      bytes: legacyBytes.map((byte) => Number(byte)),
    }
  }
  return null
}

export function feeConfigFromEvent(value) {
  return {
    threeCharYearLux: Number(value?.three_char_year_lux ?? 0),
    fourCharYearLux: Number(value?.four_char_year_lux ?? 0),
    fivePlusYearLux: Number(value?.five_plus_year_lux ?? 0),
    referralRewardBps: Number(value?.referral_reward_bps ?? 0),
    renewalReferralRewardBps: Number(value?.renewal_referral_reward_bps ?? 0),
    premiumReferralRewardBps: Number(value?.premium_referral_reward_bps ?? 0),
    version: Number(value?.version ?? 0),
    updatedAt: Number(value?.updated_at ?? 0),
  }
}

export function bytesToUtf8(value) {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return null
  return new TextDecoder().decode(Uint8Array.from(value))
}

export function bytesToBase58(value) {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return null
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let digits = [0]
  for (const byte of value) {
    let carry = Number(byte)
    for (let index = 0; index < digits.length; index += 1) {
      carry += digits[index] << 8
      digits[index] = carry % 58
      carry = Math.floor(carry / 58)
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = Math.floor(carry / 58)
    }
  }
  for (const byte of value) {
    if (Number(byte) === 0) digits.push(0)
    else break
  }
  return digits.reverse().map((digit) => alphabet[digit]).join('')
}

export function lifecycleValueToIso(value, observedAt, targetBlockSeconds, observedBlockHeight = null) {
  if (value == null || observedBlockHeight == null) return null
  const height = Number(value)
  const anchor = Number(observedBlockHeight)
  if (!Number.isSafeInteger(height) || height <= 0 || !Number.isSafeInteger(anchor) || anchor < 0) return null
  if (!Number.isFinite(targetBlockSeconds) || targetBlockSeconds <= 0) return null
  // An estimate anchored to observation time, never an absolute height used as a duration.
  const date = new Date(Date.parse(observedAt) + (height - anchor) * targetBlockSeconds * 1_000)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

export function numberOrNull(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

export function numericBlockHeight(value) {
  if (value === null || value === undefined) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

export function withHexPrefix(value) {
  if (!value) return null
  return String(value).startsWith('0x') ? String(value) : `0x${String(value)}`
}
