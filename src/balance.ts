export const LUX_PER_DUSK = 1_000_000_000n
export const DEFAULT_WRITE_NETWORK_FEE_LUX = 200_000_000n

export type BalancePreflightResult =
  | { ok: true; availableLux: bigint; requiredLux: bigint }
  | { ok: false; availableLux: bigint | null; requiredLux: bigint; message: string }

export function parseLuxString(value: string): bigint | null {
  if (!/^\d+$/.test(value)) return null
  return BigInt(value)
}

export function formatLuxAsDusk(value: bigint) {
  const sign = value < 0n ? '-' : ''
  const absolute = value < 0n ? -value : value
  const whole = absolute / LUX_PER_DUSK
  const fraction = absolute % LUX_PER_DUSK

  if (fraction === 0n) return `${sign}${whole.toString()} DUSK`

  const fractional = fraction.toString().padStart(9, '0').replace(/0+$/, '')
  return `${sign}${whole.toString()}.${fractional} DUSK`
}

export function checkPublicBalanceForWrite(args: {
  balanceLux: string
  action: string
  transactionCount?: number
  networkFeeLux?: bigint
  extraRequiredLux?: bigint
}): BalancePreflightResult {
  const requestedTransactionCount = args.transactionCount ?? 1
  const transactionCount = Number.isFinite(requestedTransactionCount)
    ? Math.max(1, Math.trunc(requestedTransactionCount))
    : 1
  const networkFeeLux = args.networkFeeLux ?? DEFAULT_WRITE_NETWORK_FEE_LUX
  const extraRequiredLux = args.extraRequiredLux ?? 0n
  const requiredLux = networkFeeLux * BigInt(transactionCount) + extraRequiredLux
  const availableLux = parseLuxString(args.balanceLux)

  if (availableLux === null) {
    return {
      ok: false,
      availableLux,
      requiredLux,
      message: 'Could not read the wallet public balance.',
    }
  }

  if (availableLux < requiredLux) {
    return {
      ok: false,
      availableLux,
      requiredLux,
      message: `Insufficient public DUSK for ${args.action}. Available: ${formatLuxAsDusk(availableLux)}. Required: ${formatLuxAsDusk(requiredLux)}.`,
    }
  }

  return { ok: true, availableLux, requiredLux }
}
