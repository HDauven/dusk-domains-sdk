/** Store lifecycle and target-block-time estimates (§3). @module */
import { u64 } from '../frozen/json.ts'
export const SECONDS_PER_DAY = 86_400
export const DUSK_APPROX_BLOCK_TIME_SECONDS = 10
export const BLOCKS_PER_DAY = 8_640n
export const REGISTRATION_YEAR_BLOCKS = 3_153_600n
export const DEFAULT_GRACE_PERIOD_BLOCKS = 259_200n
export const MAX_REGISTRATION_AHEAD_BLOCKS = 31_536_000n
export interface RegistrationLifecycle {
  expiresAt: bigint
  graceEndsAt: bigint
}
export type RegistrationLifecycleStatus = 'active' | 'grace' | 'expired'
export function registrationYears(years: number): bigint {
  if (!Number.isInteger(years) || years < 1 || years > 10)
    throw new RangeError('Invalid years')
  return BigInt(years) * REGISTRATION_YEAR_BLOCKS
}
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
export function blocksForSeconds(seconds: number): bigint {
  if (!Number.isSafeInteger(seconds) || seconds < 0)
    throw new RangeError('Invalid seconds')
  return BigInt(Math.ceil(seconds / DUSK_APPROX_BLOCK_TIME_SECONDS))
}
