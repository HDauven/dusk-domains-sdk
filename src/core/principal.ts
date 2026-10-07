/** Typed frozen principals. Phoenix has no holder/claim authority in v1. @module */
import { bls12_381 } from '@noble/curves/bls12-381.js'
import { authority, contractId, fromHex, hex } from '../frozen/bytes.ts'
import type { TypedPrincipal } from '../frozen/types.ts'
export type DuskPrincipal = TypedPrincipal
export type DuskPrincipalResult =
  | {
      ok: true
      principal: TypedPrincipal
      source: 'moonlight_account' | 'contract_id'
    }
  | { ok: false; reason: 'empty' | 'invalid_account' | 'ambiguous_principal' }
export type ContractPrincipalResult =
  | { ok: true; principal: string; source: 'moonlight_account' | 'contract_id' }
  | { ok: false; reason: 'empty' | 'invalid_account' | 'ambiguous_principal' }
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
export function decodeBase58(value: string): Uint8Array | null {
  if (!value || value.length > 512) return null
  let n = 0n
  for (const c of value) {
    const digit = alphabet.indexOf(c)
    if (digit < 0) return null
    n = n * 58n + BigInt(digit)
  }
  const bytes: number[] = []
  while (n) {
    bytes.unshift(Number(n & 255n))
    n >>= 8n
  }
  let zeroes = 0
  while (value[zeroes] === '1') zeroes++
  return Uint8Array.from([...Array<number>(zeroes).fill(0), ...bytes])
}
export function encodeBase58(value: Uint8Array | readonly number[]): string {
  if (value.some((b) => !Number.isInteger(b) || b < 0 || b > 255))
    throw new RangeError('Invalid bytes')
  let n = 0n,
    out = '',
    zeroes = 0
  for (const byte of value) n = (n << 8n) + BigInt(byte)
  while (n) {
    out = alphabet[Number(n % 58n)] + out
    n /= 58n
  }
  while (zeroes < value.length && value[zeroes] === 0) zeroes++
  return '1'.repeat(zeroes) + out
}
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
  return (
    BigInt(`0x${hex(first)}`) < modulus &&
    BigInt(`0x${hex(p.bytes.slice(48))}`) < modulus
  )
}
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
export function isClaimableReferrer(
  p: TypedPrincipal | null | undefined,
): boolean {
  return (
    !!p &&
    hasClaimableReferrerShape(p) &&
    (p.kind === 'Contract' || isMoonlightEndpoint(p.bytes))
  )
}
export function contractPrincipal(id: string): TypedPrincipal {
  return { kind: 'Contract', bytes: fromHex(contractId(id), 32) }
}
export function typedPrincipalFromWalletAccount(
  account: string,
): DuskPrincipalResult {
  const value = account.trim()
  if (!value) return { ok: false, reason: 'empty' }
  if (value.startsWith('contract:')) {
    try {
      return {
        ok: true,
        principal: contractPrincipal(value.slice(9)),
        source: 'contract_id',
      }
    } catch {
      return { ok: false, reason: 'invalid_account' }
    }
  }
  if (/^(?:0x)?[a-fA-F0-9]{64}$/u.test(value))
    return { ok: false, reason: 'ambiguous_principal' }
  const bytes = decodeBase58(value)
  if (!bytes || !isMoonlightEndpoint(bytes))
    return { ok: false, reason: 'invalid_account' }
  return {
    ok: true,
    principal: { kind: 'Moonlight', bytes: Array.from(bytes) },
    source: 'moonlight_account',
  }
}
export function contractPrincipalFromWalletAccount(
  account: string,
): ContractPrincipalResult {
  const result = typedPrincipalFromWalletAccount(account)
  return result.ok
    ? { ...result, principal: `0x${hex(authority(result.principal))}` }
    : result
}
export function authorityHexFromPublicSender(sender: Uint8Array): string {
  if (!isMoonlightEndpoint(sender))
    throw new Error('Invalid Moonlight endpoint')
  return `0x${hex(authority({ kind: 'Moonlight', bytes: Array.from(sender) }))}`
}
/** Same key as the frozen projection (case-sensitive kind tag). */
export function principalKey(p: TypedPrincipal | null | undefined): string {
  return p ? `${p.kind}:${hex(p.bytes)}` : ''
}
export function principalLabel(p: TypedPrincipal | null | undefined): string {
  return p?.kind ?? ''
}
export function principalShortValue(
  p: TypedPrincipal | null | undefined,
): string {
  if (!p) return ''
  const value = hex(p.bytes)
  return `0x${value.slice(0, 8)}...${value.slice(-6)}`
}
