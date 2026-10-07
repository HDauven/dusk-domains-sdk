/** Public funds required by a reviewed contract call, including its maximum gas envelope. @module */
import { lux, u64 } from '../frozen/json.ts'
export type BalancePreflightResult =
  | { ok: true; availableLux: bigint; requiredLux: bigint }
  | {
      ok: false
      availableLux: bigint | null
      requiredLux: bigint
      code: 'balance_unavailable' | 'insufficient_balance'
    }
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
export class WriteBalanceError extends Error {
  constructor(
    readonly details: Extract<BalancePreflightResult, { ok: false }>,
  ) {
    super(details.code)
  }
}
