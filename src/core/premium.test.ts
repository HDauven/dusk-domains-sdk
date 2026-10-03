import { expect, it } from 'vitest'
import { DEFAULT_FEE_CONFIG, quoteRegistration, referralRewardLux, registrationFeeLux, registrationPremiumSchedule, validateFeeConfigPrices } from './namePolicy'
import { coreCompleteRegistrationRuntimeCall, coreRegistrationPremiumCall, routerInitCall, routerSetFeeConfigRuntimeCall, toDuskDomainWireArgs } from '../contracts/calls'
import { createDuskDomainsOnChainClient } from '../onchain/sdkOnChain'
import { normalizeObservedEvent, createLifecycleEventProjector } from '../projection.mjs'
import { decodeFeeConfig } from '../onchain/sdkOnChainDecoders'

const start = 1_000_000_000_000_000
const grace = 10_000
const node = `0x${'01'.repeat(32)}`

it.each([0, 1, 10, 20, 21, 30])('quotes the exact premium and next boundary on day %s', day => {
  const height = grace + day * 8_640
  const quote = quoteRegistration('aurora.dusk', 10, DEFAULT_FEE_CONFIG, { graceEndsAtBlockHeight: grace, currentBlockHeight: height, nowSeconds: 1_000 })
  const premium = day < 21 ? Number((BigInt(start) >> BigInt(day)) - (BigInt(start) >> 21n)) : 0
  expect(quote.premiumLux).toBe(premium)
  expect(quote.baseLux).toBe(100_000_000_000)
  expect(quote.totalLux).toBe(100_000_000_000 + premium)
  expect(quote.nextStepBlockHeight).toBe(day < 21 ? height + 8_640 : null)
  expect(quote.nextStepAt).toBe(day < 21 ? new Date((1_000 + 86_400) * 1_000).toISOString() : null)
  const call = coreCompleteRegistrationRuntimeCall({ commitment: node, secret: node, node, label: 'aurora', durationYears: 10, feeLux: quote.totalLux, records: [], primaryEndpoint: null, referrer: null })
  expect(toDuskDomainWireArgs(call)).toMatchObject({ fee_lux: quote.totalLux })
})

it('keeps the price for a full day and drops exactly at the boundary', () => {
  const quote = (height: number) => registrationPremiumSchedule({ premiumStartLux: start, graceEndsAtBlockHeight: grace, currentBlockHeight: height })
  expect(quote(grace + 8_639).premiumLux).toBe(quote(grace).premiumLux)
  expect(quote(grace + 8_640).premiumLux).toBeLessThan(quote(grace + 8_639).premiumLux)
  expect(quote(grace - 1).premiumLux).toBe(0)
})

it('excludes fresh roots, disabled premiums, reserved issuance and subnames', () => {
  const timing = { currentBlockHeight: grace, graceEndsAtBlockHeight: null }
  expect(quoteRegistration('aurora', 1, DEFAULT_FEE_CONFIG, timing).premiumLux).toBe(0)
  expect(quoteRegistration('aurora', 1, { ...DEFAULT_FEE_CONFIG, premiumStartLux: 0 }, { ...timing, graceEndsAtBlockHeight: grace }).premiumLux).toBe(0)
  expect(registrationFeeLux('aurora', 1, DEFAULT_FEE_CONFIG)).toBe(10_000_000_000)
  expect(() => quoteRegistration('wallet.dusk', 1, DEFAULT_FEE_CONFIG, timing)).toThrow('unreserved root')
  expect(() => quoteRegistration('pay.aurora.dusk', 1, DEFAULT_FEE_CONFIG, timing)).toThrow('unreserved root')
})

it('bounds the premium plus the largest ten-year base fee', () => {
  const limit = Number.MAX_SAFE_INTEGER - DEFAULT_FEE_CONFIG.threeCharYearLux * 10
  expect(() => validateFeeConfigPrices({ ...DEFAULT_FEE_CONFIG, premiumStartLux: limit })).not.toThrow()
  expect(() => validateFeeConfigPrices({ ...DEFAULT_FEE_CONFIG, premiumStartLux: limit + 1 })).toThrow('maximum')
})

it('encodes and decodes the premium fee configuration and deployment default', () => {
  const call = routerSetFeeConfigRuntimeCall(DEFAULT_FEE_CONFIG)
  const wire = toDuskDomainWireArgs(call) as object
  expect(wire).toMatchObject({ premium_start_lux: start })
  expect(decodeFeeConfig({ ...wire, version: 1, updated_at: 0 })).toEqual({ ok: true, value: DEFAULT_FEE_CONFIG })
  expect(toDuskDomainWireArgs(routerInitCall({ operator: { kind: 'Contract', bytes: Array(32).fill(1) }, treasury: node, marketplace: null, referralRewardBps: 2_000 }))).toMatchObject({ premium_start_lux: start })
})

it('reads the premium through the core entrypoint', async () => {
  const client = createDuskDomainsOnChainClient({ read: { read: async call => {
    expect(call).toMatchObject({ functionName: 'registration_premium', kind: 'read' })
    return '999999523162842'
  } } })
  expect(await client.getRegistrationPremium('aurora.dusk')).toEqual({ ok: true, value: 999_999_523_162_842 })
  expect(toDuskDomainWireArgs(coreRegistrationPremiumCall({ node }))).toEqual({ node: Array(32).fill(1) })
})

it('decodes the charged premium and accumulates premium income without changing registration income', () => {
  const normalized = normalizeObservedEvent({ contract: { key: 'core', contractId: node }, observedAt: '2026-10-03T00:00:00.000Z', eventName: 'name_registered', event: { node: Array(32).fill(1), label: 'aurora', actor: Array(32).fill(2), owner: Array(32).fill(2), expires_at: 100, grace_ends_at: 200, fee_lux: 110, premium_lux: 100 } })
  expect(normalized.event).toMatchObject({ type: 'name_registered', premiumLux: 100, feeLux: 110 })
  const projector = createLifecycleEventProjector()
  projector.apply(normalized.event)
  projector.apply({ ...normalized.event, premiumLux: 50, feeLux: 60 })
  expect(projector.getNameByNode(node)).toMatchObject({ registrationPremiumLux: 50 })
  expect(projector.getTreasuryState()).toMatchObject({ premiumReceivedLux: 150, registrationReceivedLux: 0 })
})

it('applies separate referral shares to the base and premium with exact Lux rounding', () => {
  const premium = start - Number(BigInt(start) >> 21n)
  const base = 150_000_000_001
  expect(referralRewardLux(base + premium, DEFAULT_FEE_CONFIG, premium)).toBe(30_000_000_000)
  expect(referralRewardLux(base + premium, { ...DEFAULT_FEE_CONFIG, premiumReferralRewardBps: 1_000 }, premium))
    .toBe(30_000_000_000 + Number(BigInt(premium) * 1_000n / 10_000n))
})
