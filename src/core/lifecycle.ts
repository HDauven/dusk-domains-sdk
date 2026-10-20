/** Store lifecycle and target-block-time estimates (§3). @module */
import { u64 } from '../frozen/json.ts'
/** One day in seconds; over the target block time it gives `BLOCKS_PER_DAY`. */
export const SECONDS_PER_DAY = 86_400
/** Dusk's target block time in seconds, which every height-to-time estimate here assumes. */
export const DUSK_APPROX_BLOCK_TIME_SECONDS = 10
/** Blocks in a day at the target block time. */
export const BLOCKS_PER_DAY = 8_640n
/** Blocks in one registration year: 365 days at the target block time. */
export const REGISTRATION_YEAR_BLOCKS = 3_153_600n
/** Grace period after a root's expiry, in blocks: 30 days. */
export const DEFAULT_GRACE_PERIOD_BLOCKS = 259_200n
/** Furthest a root's expiry may lie past the current height, in blocks: ten registration years. */
export const MAX_REGISTRATION_AHEAD_BLOCKS = 31_536_000n
/** Expiry and grace-end block heights of a root registration. */
export interface RegistrationLifecycle {
  expiresAt: bigint
  graceEndsAt: bigint
}
/** Where a height falls in a registration: before expiry, in grace, or past the grace end. */
export type RegistrationLifecycleStatus = 'active' | 'grace' | 'expired'
/** Blocks in `years` registration years. Throws a `RangeError` unless `years` is an integer from 1 to 10. */
export function registrationYears(years: number): bigint {
  if (!Number.isInteger(years) || years < 1 || years > 10)
    throw new RangeError('Invalid years')
  return BigInt(years) * REGISTRATION_YEAR_BLOCKS
}
/** Expiry and grace end of a registration that starts at height `startsAt` and runs `years` years. */
export function createRegistrationLifecycle(options: {
  startsAt: bigint
  years: number
}): RegistrationLifecycle {
  const expiresAt = u64(
    u64(options.startsAt) + registrationYears(options.years),
  )
  return {
    expiresAt,
    graceEndsAt: u64(expiresAt + DEFAULT_GRACE_PERIOD_BLOCKS),
  }
}
/**
 * Lifecycle after renewing for `years` from the current expiry, also during grace. Throws a
 * `RangeError` once grace has ended at `now`, for a grace end other than expiry plus
 * `DEFAULT_GRACE_PERIOD_BLOCKS`, or when the new expiry lies more than
 * `MAX_REGISTRATION_AHEAD_BLOCKS` past `now`.
 */
export function renewRegistrationLifecycle(options: {
  currentExpiresAt: bigint
  currentGraceEndsAt?: bigint
  now: bigint
  years: number
}): RegistrationLifecycle {
  const now = u64(options.now),
    expiry = u64(options.currentExpiresAt)
  const grace = u64(
    options.currentGraceEndsAt ?? expiry + DEFAULT_GRACE_PERIOD_BLOCKS,
  )
  if (grace !== u64(expiry + DEFAULT_GRACE_PERIOD_BLOCKS))
    throw new RangeError('Invalid root grace end')
  if (now >= grace) throw new RangeError('Expired')
  const result = createRegistrationLifecycle({
    startsAt: expiry,
    years: options.years,
  })
  if (result.expiresAt > u64(now + MAX_REGISTRATION_AHEAD_BLOCKS))
    throw new RangeError('Expiry horizon exceeded')
  return result
}
/** Status at height `now`: `active` before expiry, `grace` until the grace end, then `expired`. */
export function registrationLifecycleStatus(
  lifecycle: RegistrationLifecycle,
  now: bigint,
): RegistrationLifecycleStatus {
  u64(now)
  u64(lifecycle.expiresAt)
  u64(lifecycle.graceEndsAt)
  if (lifecycle.graceEndsAt < lifecycle.expiresAt)
    throw new RangeError('Invalid lifecycle')
  return now < lifecycle.expiresAt
    ? 'active'
    : now < lifecycle.graceEndsAt
      ? 'grace'
      : 'expired'
}
/** Current Unix time, rounded down to a whole second. */
export function currentUnixSeconds(): number {
  return Math.floor(Date.now() / 1000)
}
/** Relative wall-clock estimate only. Chain heights remain authoritative. */
export function blockHeightToUnixSeconds(
  height: bigint,
  currentHeight: bigint,
  nowSeconds: number,
): number {
  const delta = u64(height) - u64(currentHeight)
  const seconds = delta * BigInt(DUSK_APPROX_BLOCK_TIME_SECONDS)
  if (
    !Number.isSafeInteger(nowSeconds) ||
    seconds > BigInt(Number.MAX_SAFE_INTEGER) ||
    seconds < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw new RangeError('Unsafe block time estimate')
  const result = nowSeconds + Number(seconds)
  if (!Number.isSafeInteger(result))
    throw new RangeError('Unsafe block time estimate')
  return result
}
/**
 * Blocks that cover `seconds` at the target block time, rounded up: an estimate. Throws a
 * `RangeError` for a negative or unsafe integer.
 */
export function blocksForSeconds(seconds: number): bigint {
  if (!Number.isSafeInteger(seconds) || seconds < 0)
    throw new RangeError('Invalid seconds')
  return BigInt(Math.ceil(seconds / DUSK_APPROX_BLOCK_TIME_SECONDS))
}
