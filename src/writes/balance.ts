/** Public funds required by a reviewed contract call, including its maximum gas envelope. @module */
import { lux, u64 } from '../frozen/json.ts'
/** Result of `checkPublicBalanceForWrite`: the balance and what the write needs, and on failure why. */
export type BalancePreflightResult =
  | { ok: true; availableLux: bigint; requiredLux: bigint }
  | {
      ok: false
      availableLux: bigint | null
      requiredLux: bigint
      code: 'balance_unavailable' | 'insufficient_balance'
    }
/**
 * Check that a public balance covers a write's deposit plus its whole gas limit at `gasPrice`, in Lux.
 * An unreadable balance gives `balance_unavailable`. Throws a `RangeError` for a zero gas limit or price.
 */
export function checkPublicBalanceForWrite(args: {
  balanceLux: unknown
  depositLux: string
  gasLimit: bigint
  gasPrice: bigint
}): BalancePreflightResult {
  const limit = u64(args.gasLimit),
    price = u64(args.gasPrice)
  if (!limit || !price) throw new RangeError('Invalid gas')
  const requiredLux = BigInt(lux(args.depositLux)) + limit * price
  let availableLux: bigint
  try {
    availableLux = BigInt(lux(args.balanceLux))
  } catch {
    return {
      ok: false,
      availableLux: null,
      requiredLux,
      code: 'balance_unavailable',
    }
  }
  return availableLux >= requiredLux
    ? { ok: true, availableLux, requiredLux }
    : { ok: false, availableLux, requiredLux, code: 'insufficient_balance' }
}
/** Thrown when a balance check fails; `details` holds the result and the message is its code. */
export class WriteBalanceError extends Error {
  constructor(
    readonly details: Extract<BalancePreflightResult, { ok: false }>,
  ) {
    super(details.code)
  }
}
