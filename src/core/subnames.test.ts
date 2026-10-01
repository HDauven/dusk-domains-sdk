import { describe, expect, it } from 'vitest'
import {
  createSubnameState,
  resolveSubnameExpiresAt,
  subnameExpiryDescription,
} from './subnames'

describe('Dusk Domains subname policy', () => {
  const parentExpiresAt = 1_830_000_000

  it('creates normalized subname state with parent-inherited expiry by default', () => {
    const subname = createSubnameState({
      parentName: 'ACME.DUSK',
      label: 'Settlement',
      owner: 'dusk1owner',
      manager: 'dusk1manager',
      resolver: `0x${'11'.repeat(32)}`,
      parentExpiresAt,
      createdAt: 1_800_000_000,
    })

    expect(subname).toMatchObject({
      parentName: 'acme.dusk',
      label: 'settlement',
      name: 'settlement.acme.dusk',
      owner: 'dusk1owner',
      manager: 'dusk1manager',
      expiresAt: parentExpiresAt,
      expiryPolicy: 'inherits_parent',
      status: 'active',
    })
    expect(subname.node).toMatch(/^0x[0-9a-f]{64}$/)
    expect(subname.parentNode).toMatch(/^0x[0-9a-f]{64}$/)
  })

  it('caps requested fixed expiry at the parent expiry', () => {
    expect(resolveSubnameExpiresAt({
      parentExpiresAt,
      requestedExpiresAt: parentExpiresAt + 500,
    })).toBe(parentExpiresAt)

    expect(createSubnameState({
      parentName: 'acme.dusk',
      label: 'bond-2028',
      owner: 'dusk1owner',
      manager: 'dusk1manager',
      resolver: `0x${'22'.repeat(32)}`,
      parentExpiresAt,
      requestedExpiresAt: parentExpiresAt - 500,
    })).toMatchObject({
      expiresAt: parentExpiresAt - 500,
      expiryPolicy: 'fixed_before_parent',
    })
  })

  it('rejects invalid labels through name normalization', () => {
    expect(() => createSubnameState({
      parentName: 'acme.dusk',
      label: 'xy',
      owner: 'dusk1owner',
      manager: 'dusk1manager',
      resolver: `0x${'33'.repeat(32)}`,
      parentExpiresAt,
    })).toThrow('Labels shorter than 3 characters are reserved.')

    expect(() => createSubnameState({
      parentName: 'acme.dusk',
      label: 'payroll_emea',
      owner: 'dusk1owner',
      manager: 'dusk1manager',
      resolver: `0x${'33'.repeat(32)}`,
      parentExpiresAt,
    })).toThrow('Use lowercase letters, numbers, or interior hyphens.')
  })

  it('describes expiry policies for UI and docs', () => {
    expect(subnameExpiryDescription('inherits_parent')).toBe('Inherits parent expiry')
    expect(subnameExpiryDescription('fixed_before_parent')).toBe('Fixed and capped by parent expiry')
  })
})

it('allows reserved labels beneath ordinary and operator-issued names', () => {
  for (const parentName of ['alice.dusk', 'wallet.dusk']) {
    for (const label of ['docs', 'wallet', 'support']) {
      expect(createSubnameState({ parentName, label, owner: 'current-owner', manager: 'manager', resolver: 'resolver', parentExpiresAt: 1000 }))
        .toMatchObject({ name: `${label}.${parentName}`, owner: 'current-owner' })
    }
  }
})
