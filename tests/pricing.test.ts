import { expect, it } from 'vitest'
import {
  estimateRegistrationQuote,
  launchPolicyConfig,
  registrationPremiumSchedule,
  validatePolicyConfig,
  referralRewardLux,
  estimateRenewalQuote,
  formatLuxAsDusk,
  PREMIUM_WINDOW_DAYS,
} from '../src/core/pricing.ts'
import { RESERVED_LABELS } from '../src/core/names.ts'
import { namehash, hex, nameKey } from '../src/frozen/bytes.ts'
import { bytes, sample } from './helpers.ts'
import type { QuoteRequest } from '../src/frozen/types.ts'
const request = (label = 'example'): QuoteRequest => ({
  version: 1,
  directory: bytes(1),
  store: bytes(4),
  node: namehash(`${label}.dusk`),
  label,
  actor: bytes(5),
  years: 1,
  height: 1000n,
  previous_generation: 0n,
  previous_grace_end: null,
  policy_version: 1n,
})
// Port of policy/src/tests.rs: every tier/year and every premium-day boundary.
for (const [label, annual, status] of [
  ['a', 0n, 'Denied'],
  ['ab', 0n, 'Denied'],
  ['abc', 150000000000n, 'Public'],
  ['abcd', 50000000000n, 'Public'],
  ['abcde', 10000000000n, 'Public'],
  ['x'.repeat(63), 10000000000n, 'Public'],
] as const)
  for (let years = 1; years <= 10; years++)
    it(`policy ${label.length}-byte tier, ${years} years`, () => {
      const q = estimateRegistrationQuote(launchPolicyConfig(), {
        ...request(label),
        years,
      })
      expect(q).toMatchObject({
        estimate: true,
        label_status: status,
        base_lux: (annual * BigInt(years)).toString(),
        premium_lux: '0',
        referral_lux: ((annual * BigInt(years)) / 5n).toString(),
        valid_until: 1000n,
      })
    })
for (let day = 0; day <= 22; day++)
  for (const offset of [0n, 1n, 8639n])
    it(`premium day ${day}, offset ${offset}`, () => {
      const height = 1000n + BigInt(day) * 8640n + offset
      const q = estimateRegistrationQuote(launchPolicyConfig(), {
        ...request(),
        height,
        previous_generation: 7n,
        previous_grace_end: 1000n,
      })
      const expected =
        day < 21 ? (1000000000000000n >> BigInt(day)) - 476837158n : 0n
      expect(q.premium_lux).toBe(expected.toString())
      expect(q.referral_lux).toBe('2000000000')
      const schedule = registrationPremiumSchedule({
        premiumStartLux: '1000000000000000',
        currentBlockHeight: height,
        graceEndsAtBlockHeight: 1000n,
        nowSeconds: 1000,
      })
      expect(schedule.premiumLux).toBe(expected.toString())
      expect(schedule.nextStepBlockHeight).toBe(
        day < 21 ? 1000n + BigInt(day + 1) * 8640n : null,
      )
      expect(schedule.premiumEndsAtBlockHeight).toBe(day < 21 ? 182440n : null)
      if (day < 21)
        expect(schedule.nextStepAt).toBe(
          new Date((1000 + Number(8640n - offset) * 10) * 1000).toISOString(),
        )
    })
it.each(RESERVED_LABELS)(
  'reserved quote %s has no economic components',
  (label) =>
    expect(
      estimateRegistrationQuote(launchPolicyConfig(), request(label)),
    ).toMatchObject({
      label_status: 'Reserved',
      base_lux: '0',
      premium_lux: '0',
      referral_lux: '0',
    }),
)
it('preserves policy precedence, closed quotes, free fees and separately floored referrals', () => {
  const c = {
    ...launchPolicyConfig(),
    reserved: ['a', 'bridge'],
    denied: ['bridge'],
    registration_open: false,
    annual_lux: Array(5).fill('3'),
    premium_start_lux: '7',
    base_referral_bps: 3000,
    premium_referral_bps: 3000,
  }
  expect(estimateRegistrationQuote(c, request('a')).label_status).toBe(
    'Reserved',
  )
  expect(estimateRegistrationQuote(c, request('bridge')).label_status).toBe(
    'Denied',
  )
  expect(
    estimateRegistrationQuote(c, {
      ...request(),
      previous_generation: 1n,
      previous_grace_end: 1000n,
    }),
  ).toMatchObject({
    registration_open: false,
    base_lux: '3',
    premium_lux: '7',
    referral_lux: '2',
  })
  expect(
    estimateRegistrationQuote(
      { ...c, annual_lux: Array(5).fill('0'), premium_start_lux: '0' },
      request(),
    ).total_lux,
  ).toBe('0')
})
it.each([
  { config_version: 2n },
  { minimum_root_bytes: 0 },
  { minimum_root_bytes: 64 },
  { base_referral_bps: 3001 },
  { premium_referral_bps: 3001 },
  { reserved: ['z', 'a'] },
  { denied: ['a', 'a'] },
  { reserved: ['UPPER'] },
  { annual_lux: Array(5).fill('900719925474100') },
])('rejects invalid published config %#', (change) =>
  expect(() =>
    validatePolicyConfig({ ...launchPolicyConfig(), ...change }),
  ).toThrow(),
)
it.each([
  { version: 2 },
  { store: bytes(0) },
  { store: bytes(1) },
  { node: bytes(0) },
  { years: 0 },
  { years: 11 },
  { years: 1.5 },
  { actor: bytes(0) },
  { previous_generation: 1n },
  { previous_grace_end: 0n },
  { previous_generation: 1n, previous_grace_end: 1001n },
])('rejects invalid local request %#', (change) =>
  expect(() =>
    estimateRegistrationQuote(launchPolicyConfig(), {
      ...request(),
      ...change,
    }),
  ).toThrow(),
)
it('bounds max fee exactly', () => {
  const config = launchPolicyConfig()
  config.premium_start_lux = (
    9007199254740991n -
    150000000000n * 10n
  ).toString()
  expect(() => validatePolicyConfig(config)).not.toThrow()
  config.premium_start_lux = (BigInt(config.premium_start_lux) + 1n).toString()
  expect(() => validatePolicyConfig(config)).toThrow()
})
it('uses the protocol quote-hash golden', () => {
  const q = estimateRegistrationQuote(launchPolicyConfig(), {
    ...request(),
    store: bytes(2),
    actor: bytes(3),
    height: 18446744073709551615n,
    policy_version: 18446744073709551615n,
  })
  expect(hex(q.request_hash)).toBe(
    'ddcbdd662030bb8aba212e462b2bde9373397f4d29ebfd53640a141b0d632160',
  )
})
it('keeps unavailable roots/fresh roots out of the premium schedule', () => {
  expect(PREMIUM_WINDOW_DAYS).toBe(21)
  for (const grace of [null, 1001n])
    expect(
      registrationPremiumSchedule({
        premiumStartLux: '1000000000000000',
        currentBlockHeight: 1000n,
        graceEndsAtBlockHeight: grace,
      }).premiumLux,
    ).toBe('0')
})
it.each([
  ['0', '0 DUSK'],
  ['1', '0.000000001 DUSK'],
  ['1000000000', '1 DUSK'],
  ['1234500000', '1.2345 DUSK'],
  ['-1', '-0.000000001 DUSK'],
  ['18446744073709551615', '18446744073.709551615 DUSK'],
])('formats exact Lux %s', (lux, dusk) =>
  expect(formatLuxAsDusk(lux)).toBe(dusk),
)
it('rejects malformed Lux and invalid referrals', () => {
  expect(() => formatLuxAsDusk('1.2')).toThrow()
  expect(() => referralRewardLux('1', '1', 3001, 0)).toThrow()
  expect(referralRewardLux('3', '7', 3000, 3000)).toBe('2')
})
it.each([1, 2, 3, 4, 5, 63])(
  'renews all structural label lengths %s using the directory table',
  (length) => {
    const n = sample('Name')
    n.label = 'a'.repeat(length)
    n.key = nameKey(`${n.label}.dusk`)
    n.subname = null
    n.expires_at = 100n
    n.grace_end = 259300n
    n.referrer = null
    const schedule = {
      version: 9n,
      effective_at: 0n,
      annual_lux: ['11', '22', '33', '44', '55'],
      referral_bps: 1000,
    }
    const q = estimateRenewalQuote(schedule, n, 2, 101n)
    expect(q).toEqual({
      schedule_version: 9n,
      total_lux: (
        BigInt(schedule.annual_lux[Math.min(length, 5) - 1]) * 2n
      ).toString(),
      referral_lux: '0',
      new_expiry: 6307300n,
      new_grace_end: 6566500n,
    })
    n.referrer = { kind: 'Contract', bytes: bytes(7) }
    expect(estimateRenewalQuote(schedule, n, 2, 101n).referral_lux).toBe(
      (BigInt(q.total_lux) / 10n).toString(),
    )
  },
)
it('quotes released roots at u64 maximum without overflowing an estimated future schedule', () => {
  const height = 18446744073709551615n
  const q = estimateRegistrationQuote(launchPolicyConfig(), {
    ...request(),
    height,
    previous_generation: 1n,
    previous_grace_end: height,
  })
  expect(q.premium_lux).toBe('999999523162842')
  expect(
    registrationPremiumSchedule({
      premiumStartLux: '1000000000000000',
      currentBlockHeight: height,
      graceEndsAtBlockHeight: height,
    }),
  ).toMatchObject({
    premiumLux: '999999523162842',
    nextStepBlockHeight: null,
    premiumEndsAtBlockHeight: null,
  })
})
