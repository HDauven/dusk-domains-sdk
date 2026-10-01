import { expect, it, vi } from 'vitest'
import { hasClaimableReferrerShape, isClaimableReferrer, typedPrincipalFromWalletAccount } from './principal'
import { claimableAccount, referrerShapeVectors } from './claimableReferrer.test-fixtures'

const bls = vi.hoisted(() => ({ loads: 0 }))
vi.mock('@noble/curves/bls12-381.js', async (importOriginal) => {
  bls.loads += 1
  return await importOriginal()
})

it('loads BLS only when a Moonlight referral needs full validation', async () => {
  expect(bls.loads).toBe(0)
  for (const { principal, shape } of referrerShapeVectors) {
    expect(hasClaimableReferrerShape(principal)).toBe(shape)
    if (!shape) expect(await isClaimableReferrer(principal)).toBe(false)
  }
  expect(await isClaimableReferrer(null)).toBe(false)
  expect(await isClaimableReferrer({ kind: 'Contract', bytes: Array(32).fill(9) })).toBe(true)
  expect(await isClaimableReferrer({ kind: 'Phoenix', bytes: Array(32).fill(9) })).toBe(false)
  expect(await isClaimableReferrer({ kind: 'Moonlight', bytes: Array(193).fill(7) })).toBe(false)
  expect(bls.loads).toBe(0)

  const parsed = typedPrincipalFromWalletAccount(claimableAccount)
  expect(parsed.ok && await isClaimableReferrer(parsed.principal)).toBe(true)
  expect(await isClaimableReferrer({ kind: 'Moonlight', bytes: [0x80, ...Array(95).fill(0)] })).toBe(false)
  expect(bls.loads).toBe(1)
})
