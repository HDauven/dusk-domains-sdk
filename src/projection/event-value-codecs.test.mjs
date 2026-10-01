import { describe, expect, it } from 'vitest'
import {
  bytesToBase58,
  bytesToHex,
  bytesToUtf8,
  endpointKindToRecordKey,
  enumValue,
  feeConfigFromEvent,
  lifecycleValueToIso,
  numberOrNull,
  numericBlockHeight,
  principalFromEvent,
  treasuryReasonName,
  withHexPrefix,
} from '../projection.mjs'

describe('event value codecs', () => {
  it('normalizes record endpoint kinds to record keys', () => {
    expect(endpointKindToRecordKey('MoonlightAddress')).toBe('moonlight_address')
    expect(endpointKindToRecordKey('PhoenixPaymentEndpoint')).toBe('phoenix_payment_endpoint')
    expect(endpointKindToRecordKey('DuskContract')).toBe('dusk_contract')
    expect(endpointKindToRecordKey('EvmAddress')).toBe('evm_address')
    expect(endpointKindToRecordKey('CustomEndpoint')).toBe('custom_endpoint')
    expect(endpointKindToRecordKey(null)).toBe('moonlight_address')
  })

  it('normalizes primitive encoded values', () => {
    expect(bytesToHex([0, 15, 255])).toBe('0x000fff')
    expect(bytesToHex('abcd')).toBe('0xabcd')
    expect(withHexPrefix('0xabcd')).toBe('0xabcd')
    expect(withHexPrefix('abcd')).toBe('0xabcd')
    expect(bytesToUtf8([97, 117, 114, 111, 114, 97])).toBe('aurora')
    expect(bytesToUtf8('aurora')).toBe('aurora')
    expect(bytesToBase58([1, 2, 3])).toBe('Ldp')
  })

  it('normalizes enum-like values and treasury reasons', () => {
    expect(enumValue('Locked')).toBe('Locked')
    expect(enumValue({ FixedBeforeParent: null })).toBe('FixedBeforeParent')
    expect(treasuryReasonName(1)).toBe('registration')
    expect(treasuryReasonName(2)).toBe('renewal')
    expect(treasuryReasonName(9)).toBe('other')
  })

  it('normalizes principals from typed and legacy event shapes', () => {
    expect(principalFromEvent({
      kind: 'Moonlight',
      bytes: [1, 2, 3],
    })).toEqual({
      kind: 'Moonlight',
      bytes: [1, 2, 3],
    })
    expect(principalFromEvent(null, [4, 5, 6])).toEqual({
      kind: 'Phoenix',
      bytes: [4, 5, 6],
    })
    expect(principalFromEvent(null)).toBeNull()
  })

  it('normalizes fee config values', () => {
    expect(feeConfigFromEvent({
      three_char_year_lux: 1,
      four_char_year_lux: 2,
      five_plus_year_lux: 3,
      referral_reward_bps: 4,
      renewal_referral_reward_bps: 5,
      premium_referral_reward_bps: 6,
      version: 7,
      updated_at: 8,
    })).toEqual({
      threeCharYearLux: 1,
      fourCharYearLux: 2,
      fivePlusYearLux: 3,
      referralRewardBps: 4,
      renewalReferralRewardBps: 5,
      premiumReferralRewardBps: 6,
      version: 7,
      updatedAt: 8,
    })
  })

  it('normalizes lifecycle and block height values', () => {
    expect(lifecycleValueToIso(105, '2026-06-27T12:00:00.000Z', 10, 100)).toBe('2026-06-27T12:00:50.000Z')
    expect(lifecycleValueToIso(1_789_999_999, '2026-06-27T12:00:00.000Z', 10, 1_789_999_999)).toBe('2026-06-27T12:00:00.000Z')
    expect(lifecycleValueToIso(95, '2026-06-27T12:00:00.000Z', 10, 100)).toBe('2026-06-27T11:59:10.000Z')
    expect(lifecycleValueToIso(105, '2026-06-27T12:00:00.000Z', 10)).toBeNull()
    expect(lifecycleValueToIso(Number.MAX_SAFE_INTEGER, '2026-06-27T12:00:00.000Z', 10, 0)).toBeNull()
    expect(lifecycleValueToIso(0, '2026-06-27T12:00:00.000Z', 10)).toBeNull()
    expect(lifecycleValueToIso(5, 'not-a-date', 10)).toBeNull()
    expect(numberOrNull('7')).toBe(7)
    expect(numberOrNull('nope')).toBeNull()
    expect(numericBlockHeight(0)).toBe(0)
    expect(numericBlockHeight(-1)).toBeNull()
  })
})
