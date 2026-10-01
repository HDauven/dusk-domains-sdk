import { describe, expect, it } from 'vitest'
import { hasClaimableReferrerShape, isClaimableReferrer } from '../index'
import { referrerShapeVectors } from './claimableReferrer.test-fixtures'

describe('claimable referrer shape', () => {
  it.each(referrerShapeVectors)('matches the contract shape check: $name', ({ principal, shape }) => {
    expect(hasClaimableReferrerShape(principal)).toBe(shape)
  })

  it.each([-1, 256, 1.5, NaN])('rejects non-byte JS values: %s', (byte) => {
    expect(hasClaimableReferrerShape({ kind: 'Moonlight', bytes: [0x80, ...Array(94).fill(0), byte] })).toBe(false)
  })

  it.each([0, 2])('leaves curve and subgroup validation to the async predicate: %s', async (lastByte) => {
    const principal = { kind: 'Moonlight' as const, bytes: [0x80, ...Array(94).fill(0), lastByte] }
    expect(hasClaimableReferrerShape(principal)).toBe(true)
    expect(await isClaimableReferrer(principal)).toBe(false)
  })
})
