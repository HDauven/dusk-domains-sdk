import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FEE_CONFIG,
  OFFICIAL_NAME_PROFILES,
  analyzeName,
  annualPrice,
  durationPrice,
  registrationFeeLux,
} from './namePolicy'

const requiredOfficialNames = [
  'bridge.dusk',
  'wallet.dusk',
  'explorer.dusk',
  'docs.dusk',
  'grants.dusk',
  'staking.dusk',
  'faucet.dusk',
  'support.dusk',
] as const

describe('Dusk Names official ecosystem policy', () => {
  it('preconfigures required official names as sale-locked profiles', () => {
    expect(OFFICIAL_NAME_PROFILES.map((profile) => profile.name)).toEqual(requiredOfficialNames)
    expect(OFFICIAL_NAME_PROFILES.every((profile) => profile.saleLocked)).toBe(true)
    expect(OFFICIAL_NAME_PROFILES.every((profile) => profile.records.length > 0)).toBe(true)
  })

  it('blocks public registration for official names before launch', () => {
    for (const name of requiredOfficialNames) {
      expect(analyzeName(name)).toMatchObject({
        canonical: name,
        status: 'reserved',
        transactionBlocked: true,
      })
    }
  })

  it('explicitly configures or withholds required official records', () => {
    const docs = OFFICIAL_NAME_PROFILES.find((profile) => profile.name === 'docs.dusk')
    const bridge = OFFICIAL_NAME_PROFILES.find((profile) => profile.name === 'bridge.dusk')

    expect(docs?.records).toContainEqual({
      key: 'website',
      status: 'configured',
      value: 'https://docs.dusk.network',
    })
    expect(bridge?.records.find((record) => record.key === 'dusk_contract')).toMatchObject({
      status: 'withheld',
    })
  })

  it('warns on official-name lookalikes using the full official registry', () => {
    expect(analyzeName('wallet-help.dusk').issues.map((issue) => issue.text)).toContain(
      'Possible official-name lookalike. The official name is wallet.dusk.',
    )
    expect(analyzeName('supportdesk.dusk').issues.map((issue) => issue.text)).toContain(
      'Possible official-name lookalike. The official name is support.dusk.',
    )
  })

  it('keeps invalid-name copy user-facing instead of implementation-facing', () => {
    const messages = [
      ...analyzeName('UPPER_CASE.dusk').issues.map((issue) => issue.text),
      ...analyzeName('ab.dusk').issues.map((issue) => issue.text),
      ...analyzeName(`${'a'.repeat(64)}.dusk`).issues.map((issue) => issue.text),
    ]

    expect(messages).toContain('Use lowercase letters, numbers, or interior hyphens.')
    expect(messages).toContain('Labels shorter than 3 characters are reserved.')
    expect(messages).toContain('Names must be 63 characters or shorter.')
    expect(messages.join(' ')).not.toMatch(/ASCII|MVP|local/i)
  })

  it('prices multi-year registration linearly', () => {
    expect(annualPrice('abc')).toBe(150)
    expect(annualPrice('dawn')).toBe(50)
    expect(annualPrice('alice')).toBe(10)
    expect(durationPrice(10, 1)).toBe(10)
    expect(durationPrice(10, 3)).toBe(30)
    expect(durationPrice(10, 5)).toBe(50)
    expect(durationPrice(50, 3)).toBe(150)
    expect(durationPrice(150, 3)).toBe(450)
    expect(registrationFeeLux('dawn', 3)).toBe(150_000_000_000)
    expect(registrationFeeLux('abc', 1, {
      ...DEFAULT_FEE_CONFIG,
      threeCharYearLux: 175_000_000_000,
    })).toBe(175_000_000_000)
  })
})
