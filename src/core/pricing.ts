/** Registration policy estimates and directory renewal economics. Lux is decimal text. @module */
import { rootLabelStatus, RESERVED_LABELS } from './names.ts'
import {
  BLOCKS_PER_DAY,
  blockHeightToUnixSeconds,
  registrationYears,
  renewRegistrationLifecycle,
} from './lifecycle.ts'
import { u64, lux, U64_MAX } from '../frozen/json.ts'
import {
  contractId,
  equalBytes,
  hash,
  namehash,
  validateLabel,
} from '../frozen/bytes.ts'
import { canonicalBytes } from '../frozen/digests.ts'
import { wireValue } from '../frozen/wire.ts'
import type { FrozenClient } from '../frozen/client.ts'
import type {
  PolicyConfig,
  PolicyQuote,
  QuoteRequest,
  RegistrationQuote,
  QuoteRegistration,
  RenewalSchedule,
  RenewalQuote,
  Name,
} from '../frozen/types.ts'
export const LUX_PER_DUSK = 1_000_000_000n
export const MAX_REGISTRATION_FEE_LUX = 9_007_199_254_740_991n
export const PREMIUM_WINDOW_DAYS = 21
export const INITIAL_PREMIUM_LUX = '1000000000000000'
export function launchPolicyConfig(): PolicyConfig {
  return {
    config_version: 1n,
    registration_open: true,
    minimum_root_bytes: 3,
    annual_lux: [
      '150000000000',
      '150000000000',
      '150000000000',
      '50000000000',
      '10000000000',
    ],
    premium_start_lux: INITIAL_PREMIUM_LUX,
    base_referral_bps: 2000,
    premium_referral_bps: 0,
    reserved: [...RESERVED_LABELS],
    denied: [],
  }
}
export function formatLuxAsDusk(value: bigint | string): string {
  if (typeof value === 'string' && !/^-?\d+$/u.test(value))
    throw new RangeError('Invalid Lux')
  const n = BigInt(value),
    sign = n < 0n ? '-' : '',
    absolute = n < 0n ? -n : n
  const fraction = (absolute % LUX_PER_DUSK)
    .toString()
    .padStart(9, '0')
    .replace(/0+$/u, '')
  return `${sign}${absolute / LUX_PER_DUSK}${fraction ? `.${fraction}` : ''} DUSK`
}
export interface PremiumSchedule {
  premiumLux: string
  premiumEndsAtBlockHeight: bigint | null
  nextStepBlockHeight: bigint | null
  premiumEndsAt: string | null
  nextStepAt: string | null
}
export function registrationPremiumSchedule(options: {
  premiumStartLux: string
  graceEndsAtBlockHeight: bigint | null
  currentBlockHeight: bigint
  nowSeconds?: number
}): PremiumSchedule {
  const start = BigInt(lux(options.premiumStartLux)),
    height = u64(options.currentBlockHeight)
  if (start > MAX_REGISTRATION_FEE_LUX) throw new RangeError('Invalid premium')
  const empty: PremiumSchedule = {
    premiumLux: '0',
    premiumEndsAtBlockHeight: null,
    nextStepBlockHeight: null,
    premiumEndsAt: null,
    nextStepAt: null,
  }
  if (options.graceEndsAtBlockHeight === null) return empty
  const grace = u64(options.graceEndsAtBlockHeight)
  if (height < grace || start === 0n) return empty
  const day = (height - grace) / BLOCKS_PER_DAY
  if (day >= 21n) return empty
  const endHeight = grace + 21n * BLOCKS_PER_DAY,
    nextHeight = grace + (day + 1n) * BLOCKS_PER_DAY
  const end = endHeight <= U64_MAX ? endHeight : null,
    next = nextHeight <= U64_MAX ? nextHeight : null
  const date = (h: bigint | null): string | null =>
    h === null || options.nowSeconds === undefined
      ? null
      : new Date(
          blockHeightToUnixSeconds(h, height, options.nowSeconds) * 1000,
        ).toISOString()
  return {
    premiumLux: ((start >> day) - (start >> 21n)).toString(),
    premiumEndsAtBlockHeight: end,
    nextStepBlockHeight: next,
    premiumEndsAt: date(end),
    nextStepAt: date(next),
  }
}
export function validatePolicyConfig(input: PolicyConfig): PolicyConfig {
  const config = wireValue('PolicyConfig', input)
  if (
    config.config_version !== 1n ||
    config.minimum_root_bytes < 1 ||
    config.minimum_root_bytes > 63
  )
    throw new RangeError('Invalid policy config')
  for (const list of [config.reserved, config.denied]) {
    list.forEach(validateLabel)
    if (list.some((v, i) => i > 0 && v <= list[i - 1]))
      throw new RangeError('Policy lists must be sorted and unique')
  }
  for (const rate of [config.base_referral_bps, config.premium_referral_bps])
    if (rate > 3000) throw new RangeError('Invalid referral rate')
  if (
    config.annual_lux.some(
      (v) =>
        BigInt(v) * 10n + BigInt(config.premium_start_lux) >
        MAX_REGISTRATION_FEE_LUX,
    )
  )
    throw new RangeError('Policy exceeds fee cap')
  return config
}
export function referralRewardLux(
  baseLux: string,
  premiumLux: string,
  baseBps: number,
  premiumBps: number,
): string {
  const base = BigInt(lux(baseLux)),
    premium = BigInt(lux(premiumLux))
  if (
    [baseBps, premiumBps].some(
      (v) => !Number.isInteger(v) || v < 0 || v > 3000,
    ) ||
    base + premium > MAX_REGISTRATION_FEE_LUX
  )
    throw new RangeError('Invalid referral economics')
  return (
    (base * BigInt(baseBps)) / 10000n +
    (premium * BigInt(premiumBps)) / 10000n
  ).toString()
}
export interface EstimatedPolicyQuote extends PolicyQuote {
  estimate: true
  total_lux: string
}
/** Mirrors the published v1 policy. No chain availability, binding, pause or current policy check. */
export function estimateRegistrationQuote(
  configInput: PolicyConfig,
  requestInput: QuoteRequest,
): EstimatedPolicyQuote {
  const config = validatePolicyConfig(configInput),
    r = wireValue('QuoteRequest', requestInput)
  validateLabel(r.label)
  registrationYears(r.years)
  if (
    r.version !== 1 ||
    r.policy_version === 0n ||
    r.actor.every((b) => b === 0) ||
    !equalBytes(namehash(`${r.label}.dusk`), r.node)
  )
    throw new RangeError('Invalid quote request')
  const directory = contractId(r.directory),
    store = contractId(r.store)
  if (
    store === directory ||
    (r.store[0] === 1 && r.store.slice(1).every((b) => b === 0))
  )
    throw new RangeError('Invalid quote store')
  if (
    r.previous_grace_end === null
      ? r.previous_generation !== 0n
      : r.previous_generation === 0n || r.previous_grace_end > r.height
  )
    throw new RangeError('Invalid previous generation')
  const status = rootLabelStatus(r.label, config)
  const base =
    status === 'Public'
      ? (
          BigInt(config.annual_lux[Math.min(r.label.length, 5) - 1]) *
          BigInt(r.years)
        ).toString()
      : '0'
  const premium =
    status === 'Public'
      ? registrationPremiumSchedule({
          premiumStartLux: config.premium_start_lux,
          graceEndsAtBlockHeight: r.previous_grace_end,
          currentBlockHeight: r.height,
        }).premiumLux
      : '0'
  return {
    estimate: true,
    version: 1,
    request_hash: hash('duskds:quote:v1', canonicalBytes('QuoteRequest', r)),
    config_version: config.config_version,
    registration_open: config.registration_open,
    label_status: status,
    base_lux: base,
    premium_lux: premium,
    base_referral_bps: config.base_referral_bps,
    premium_referral_bps: config.premium_referral_bps,
    referral_lux: referralRewardLux(
      base,
      premium,
      config.base_referral_bps,
      config.premium_referral_bps,
    ),
    valid_until: r.height,
    total_lux: (BigInt(base) + BigInt(premium)).toString(),
  }
}
/** Store obtains and validates the selected policy contract's quote and current directory versions. */
export function quoteRegistration(
  client: FrozenClient,
  store: string,
  request: QuoteRegistration,
): Promise<RegistrationQuote> {
  return client.quoteRegistration(store, request)
}
/** Pure renewal estimate from a directory schedule and observed root; no registration policy/premium. */
export function estimateRenewalQuote(
  scheduleInput: RenewalSchedule,
  nameInput: Name,
  years: number,
  height: bigint,
): RenewalQuote {
  const schedule = wireValue('RenewalSchedule', scheduleInput),
    name = wireValue('Name', nameInput)
  validateLabel(name.label)
  if (name.subname !== null || !equalBytes(name.key.root, name.key.node))
    throw new RangeError('Renewal requires a root')
  if (
    schedule.referral_bps > 3000 ||
    schedule.annual_lux.some(
      (v) => BigInt(v) === 0n || BigInt(v) * 10n > MAX_REGISTRATION_FEE_LUX,
    )
  )
    throw new RangeError('Invalid renewal schedule')
  const lifecycle = renewRegistrationLifecycle({
    currentExpiresAt: name.expires_at,
    currentGraceEndsAt: name.grace_end,
    years,
    now: height,
  })
  const total = (
    BigInt(schedule.annual_lux[Math.min(name.label.length, 5) - 1]) *
    BigInt(years)
  ).toString()
  return {
    schedule_version: schedule.version,
    total_lux: total,
    referral_lux:
      name.referrer === null
        ? '0'
        : referralRewardLux(total, '0', schedule.referral_bps, 0),
    new_expiry: lifecycle.expiresAt,
    new_grace_end: lifecycle.graceEndsAt,
  }
}
