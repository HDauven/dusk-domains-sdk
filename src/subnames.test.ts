import { describe, expect, it } from 'vitest'
import {
  canParentRevokeSubname,
  createSubnameState,
  resolveSubnameExpiresAt,
  revokeSubname,
  subnameExpiryDescription,
  subnameRevocationDescription,
} from './subnames'

describe('Dusk Names subname policy', () => {
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
      revocationPolicy: 'parent_revocable',
      status: 'active',
      revokedAt: null,
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

  it('makes parent revocation behavior explicit', () => {
    const revocable = createSubnameState({
      parentName: 'acme.dusk',
      label: 'payroll',
      owner: 'dusk1owner',
      manager: 'dusk1manager',
      resolver: `0x${'44'.repeat(32)}`,
      parentExpiresAt,
    })
    const locked = createSubnameState({
      parentName: 'acme.dusk',
      label: 'investor-relations',
      owner: 'dusk1owner',
      manager: 'dusk1manager',
      resolver: `0x${'44'.repeat(32)}`,
      parentExpiresAt,
      revocationPolicy: 'locked',
    })

    expect(canParentRevokeSubname(revocable)).toBe(true)
    expect(revokeSubname(revocable, 1_810_000_000)).toMatchObject({
      status: 'revoked',
      revokedAt: 1_810_000_000,
    })
    expect(canParentRevokeSubname(locked)).toBe(false)
    expect(() => revokeSubname(locked, 1_810_000_000)).toThrow('locked')
  })

  it('describes expiry and revocation policies for UI and docs', () => {
    expect(subnameExpiryDescription('inherits_parent')).toBe('Inherits parent expiry')
    expect(subnameExpiryDescription('fixed_before_parent')).toBe('Fixed and capped by parent expiry')
    expect(subnameRevocationDescription('parent_revocable')).toBe('Parent can revoke')
    expect(subnameRevocationDescription('locked')).toBe('Locked after creation')
  })
})
