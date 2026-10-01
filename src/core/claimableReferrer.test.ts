import { describe, expect, it } from 'vitest'
import { isClaimableReferrer, typedPrincipalFromWalletAccount, type DuskPrincipal } from './principal'
import { claimableAccount } from './claimableReferrer.test-fixtures'

describe('claimable referrers', () => {
  it('accepts runtime Moonlight keys and contracts', async () => {
    const parsed = typedPrincipalFromWalletAccount(claimableAccount)
    expect(parsed.ok && await isClaimableReferrer(parsed.principal)).toBe(true)
    expect(await isClaimableReferrer({ kind: 'Contract', bytes: Array(32).fill(9) })).toBe(true)
  })

  it.each<DuskPrincipal>([
    { kind: 'Phoenix', bytes: Array(32).fill(9) },
    { kind: 'Moonlight', bytes: Array(193).fill(7) },
    { kind: 'Moonlight', bytes: Array(96).fill(7) },
    { kind: 'Moonlight', bytes: [0xc0, ...Array(95).fill(0)] },
    { kind: 'Moonlight', bytes: [0x80, ...Array(95).fill(0)] },
    { kind: 'Moonlight', bytes: [0x80, ...Array(94).fill(0), 2] },
    { kind: 'Moonlight', bytes: Array(95).fill(7) },
    { kind: 'Contract', bytes: Array(32).fill(0) },
    { kind: 'Contract', bytes: Array(31).fill(9) },
    { kind: 'Contract', bytes: Array(32).fill(256) },
    { kind: 'Contract', bytes: Array(32).fill(1.5) },
  ])('ignores principals that cannot sign as the runtime caller: %j', async (principal) => {
    expect(await isClaimableReferrer(principal)).toBe(false)
  })
})
