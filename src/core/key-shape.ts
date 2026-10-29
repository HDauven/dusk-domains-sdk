/** The shape of a principal's bytes, checked as the protocol checks it before it decodes a key. @module */
import type { TypedPrincipal } from '../frozen/types.ts'
/** Big-endian bytes as a number. */
const big = (bytes: readonly number[]): bigint =>
  BigInt(`0x${bytes.map((b) => b.toString(16).padStart(2, '0')).join('')}`)
/** Mirrors the cheap referrer check in principals.rs; not a curve or subgroup proof. */
export function hasClaimableReferrerShape(
  p: TypedPrincipal | null | undefined,
): boolean {
  if (!p || !p.bytes.every((b) => Number.isInteger(b) && b >= 0 && b <= 255))
    return false
  if (p.kind === 'Contract')
    return p.bytes.length === 32 && p.bytes.some((b) => b !== 0)
  if (
    p.kind !== 'Moonlight' ||
    p.bytes.length !== 96 ||
    (p.bytes[0] & 0xc0) !== 0x80
  )
    return false
  const modulus = BigInt(
    '0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab',
  )
  const first = [...p.bytes.slice(0, 48)]
  first[0] &= 0x1f
  return big(first) < modulus && big(p.bytes.slice(48)) < modulus
}
