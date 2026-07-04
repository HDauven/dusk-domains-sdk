import { describe, expect, it } from 'vitest'
import {
  readReferralAttribution,
  REFERRAL_ATTRIBUTION_TTL_MS,
  writeReferralAttribution,
  type ReferralAttributionStorage,
} from './referrals'

function memoryStorage(initial: Record<string, string> = {}): ReferralAttributionStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => {
      data.delete(key)
    },
  }
}

describe('referral attribution storage', () => {
  const key = 'dusk-domains.active-referral'

  it('stores valid referral attribution with a 30 day expiry', () => {
    const storage = memoryStorage()
    const now = Date.UTC(2026, 5, 21)

    writeReferralAttribution(storage, key, ` 0x${'44'.repeat(32)} `, now)

    const raw = storage.getItem(key)
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!)).toMatchObject({
      version: 1,
      input: `0x${'44'.repeat(32)}`,
      expiresAt: now + REFERRAL_ATTRIBUTION_TTL_MS,
    })
  })

  it('reads unexpired attribution and removes expired attribution', () => {
    const storage = memoryStorage()
    const now = Date.UTC(2026, 5, 21)

    writeReferralAttribution(storage, key, `0x${'44'.repeat(32)}`, now)

    expect(readReferralAttribution(storage, key, now + REFERRAL_ATTRIBUTION_TTL_MS - 1)).toBe(`0x${'44'.repeat(32)}`)
    expect(readReferralAttribution(storage, key, now + REFERRAL_ATTRIBUTION_TTL_MS)).toBe('')
    expect(storage.getItem(key)).toBeNull()
  })

  it('clears empty, malformed, and stale values', () => {
    const storage = memoryStorage({ [key]: 'not-json' })

    expect(readReferralAttribution(storage, key)).toBe('')
    expect(storage.getItem(key)).toBeNull()

    storage.setItem(key, JSON.stringify({ version: 1, input: '', expiresAt: Date.now() + 1_000 }))
    expect(readReferralAttribution(storage, key)).toBe('')
    expect(storage.getItem(key)).toBeNull()

    writeReferralAttribution(storage, key, `0x${'44'.repeat(32)}`)
    writeReferralAttribution(storage, key, '')
    expect(storage.getItem(key)).toBeNull()
  })
})
