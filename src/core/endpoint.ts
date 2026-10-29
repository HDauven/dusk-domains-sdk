/** A Moonlight key checked on the curve. It is the one module that loads BLS12-381. @module */
import { bls12_381 } from '@noble/curves/bls12-381.js'
import { hasClaimableReferrerShape } from './key-shape.ts'
/** Full canonical compressed BLS endpoint check, matching validate_endpoint. */
export function isMoonlightEndpoint(
  bytes: readonly number[] | Uint8Array,
): boolean {
  if (
    !hasClaimableReferrerShape({ kind: 'Moonlight', bytes: Array.from(bytes) })
  )
    return false
  try {
    const point = bls12_381.G2.Point.fromBytes(Uint8Array.from(bytes))
    point.assertValidity()
    return !point.is0() && point.toBytes().every((b, i) => b === bytes[i])
  } catch {
    return false
  }
}
