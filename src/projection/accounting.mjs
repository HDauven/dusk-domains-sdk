// Keep existing small balances numeric; large totals cross JSON boundaries as decimal Lux.
export function accountingLux(value) {
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || value < 0)) {
    throw new Error('Accounting contains an unsafe numeric value')
  }
  if (!['number', 'bigint', 'string'].includes(typeof value) || !/^\d+$/.test(String(value))) {
    throw new Error('Accounting requires non-negative integer Lux')
  }
  const lux = BigInt(value)
  return lux <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(lux) : lux.toString()
}

export function sumAccountingLux(left, right) {
  return accountingLux(BigInt(accountingLux(left)) + BigInt(accountingLux(right)))
}

export function subtractAccountingLux(left, right) {
  const remaining = BigInt(accountingLux(left)) - BigInt(accountingLux(right))
  return accountingLux(remaining > 0n ? remaining : 0n)
}
