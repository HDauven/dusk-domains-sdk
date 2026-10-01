const maxSafeInteger = BigInt(Number.MAX_SAFE_INTEGER)

export function assertSafeNumericTree(value, label = 'value', key = '') {
  if (typeof value === 'number') {
    safeNonNegativeInteger(value, label)
    return
  }
  if (typeof value === 'bigint') {
    if (value < 0n || value > maxSafeInteger) throw new Error(`${label} contains an unsafe numeric value`)
    return
  }
  if (typeof value === 'string') {
    if (numericField(key) && /^\d+$/u.test(value) && BigInt(value) > maxSafeInteger) {
      throw new Error(`${label} contains an unsafe numeric value`)
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item) => assertSafeNumericTree(item, label, key))
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [childKey, item] of Object.entries(value)) {
    assertSafeNumericTree(item, label, childKey)
  }
}

export function safeNonNegativeInteger(value, label) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`${label} contains an unsafe numeric value`)
  }
  return number
}

export function checkedSafeSum(left, right, label) {
  const result = safeNonNegativeInteger(left, label) + safeNonNegativeInteger(right, label)
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${label} exceeds the JavaScript safe integer range`)
  }
  return result
}

function numericField(key) {
  return /(?:Lux|Bps|At|Block|Blocks|Height|Count|Seconds|Years|_lux|_bps|_at|_block|_blocks|_height|_count|_seconds|_years)$/u.test(key)
}
