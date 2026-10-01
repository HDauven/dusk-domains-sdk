import { blake2b } from '@noble/hashes/blake2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const PUBLIC_SENDER_KEY_BYTES = 96
const BLS_PUBLIC_KEY_BYTES = 193
// Big-endian BLS12-381 modulus, matching dusk-domains-types/src/principals.rs.
const BLS_BASE_FIELD_MODULUS = [
  0x1a, 0x01, 0x11, 0xea, 0x39, 0x7f, 0xe6, 0x9a, 0x4b, 0x1b, 0xa7, 0xb6, 0x43, 0x4b, 0xac, 0xd7,
  0x64, 0x77, 0x4b, 0x84, 0xf3, 0x85, 0x12, 0xbf, 0x67, 0x30, 0xd2, 0xa0, 0xf6, 0xb0, 0xf6, 0x24,
  0x1e, 0xab, 0xff, 0xfe, 0xb1, 0x53, 0xff, 0xff, 0xb9, 0xfe, 0xff, 0xff, 0xff, 0xff, 0xaa, 0xab,
]
const RUNTIME_AUTHORITY_DOMAIN = utf8ToBytes('dusk-domains:runtime-authority:v1')

export type DuskPrincipalKind = 'Moonlight' | 'Phoenix' | 'Contract'

export type DuskPrincipal = {
  kind: DuskPrincipalKind
  bytes: number[]
}

/** Cheap contract-equivalent encoding check; does not validate the curve or subgroup. */
export function hasClaimableReferrerShape(principal: DuskPrincipal | null | undefined): boolean {
  if (!principal) return false
  for (const byte of principal.bytes) {
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) return false
  }
  if (principal.kind === 'Contract') {
    return principal.bytes.length === 32 && principal.bytes.some((byte) => byte !== 0)
  }
  if (principal.kind !== 'Moonlight' || principal.bytes.length !== PUBLIC_SENDER_KEY_BYTES) return false
  if ((principal.bytes[0] & 0xc0) !== 0x80) return false
  return coordinateBelowModulus(principal.bytes, 0) && coordinateBelowModulus(principal.bytes, 48)
}

function coordinateBelowModulus(bytes: number[], offset: number): boolean {
  for (let index = 0; index < BLS_BASE_FIELD_MODULUS.length; index += 1) {
    const byte = offset === 0 && index === 0 ? bytes[0] & 0x1f : bytes[offset + index]
    if (byte !== BLS_BASE_FIELD_MODULUS[index]) return byte < BLS_BASE_FIELD_MODULUS[index]
  }
  return false
}

/** Fully validates runtime callers, loading BLS only for Moonlight referrals. */
export async function isClaimableReferrer(principal: DuskPrincipal | null | undefined): Promise<boolean> {
  if (!principal || !hasClaimableReferrerShape(principal)) return false
  if (principal.kind === 'Contract') return true
  const { bls12_381 } = await import('@noble/curves/bls12-381.js')
  try {
    const point = bls12_381.G2.Point.fromBytes(Uint8Array.from(principal.bytes))
    point.assertValidity()
    return !point.is0() && point.toBytes().every((byte, index) => byte === principal.bytes[index])
  } catch {
    return false
  }
}

export type ContractPrincipalResult =
  | { ok: true; principal: string; source: 'hex_principal' | 'moonlight_account' | 'contract_id' }
  | { ok: false; reason: string }

export type DuskPrincipalResult =
  | { ok: true; principal: DuskPrincipal; source: 'hex_principal' | 'moonlight_account' | 'contract_id' }
  | { ok: false; reason: string }

export function contractPrincipalFromWalletAccount(account: string): ContractPrincipalResult {
  const value = account.trim()
  if (!value) return { ok: false, reason: 'Wallet account is empty.' }

  const contractMatch = /^contract:(0x[a-fA-F0-9]{64})$/.exec(value)
  if (contractMatch) {
    return {
      ok: true,
      principal: contractMatch[1].toLowerCase(),
      source: 'contract_id',
    }
  }

  if (/^0x[a-fA-F0-9]{64}$/.test(value)) {
    return { ok: true, principal: value.toLowerCase(), source: 'hex_principal' }
  }

  const publicSender = decodeBase58(value)
  if (!publicSender) return { ok: false, reason: 'Use a valid Dusk public account.' }

  if (publicSender.length !== PUBLIC_SENDER_KEY_BYTES) {
    return {
      ok: false,
      reason: 'Use a valid Dusk public account.',
    }
  }

  return {
    ok: true,
    principal: authorityHexFromPublicSender(publicSender),
    source: 'moonlight_account',
  }
}

export function typedPrincipalFromWalletAccount(account: string): DuskPrincipalResult {
  const value = account.trim()
  if (!value) return { ok: false, reason: 'Wallet account is empty.' }

  const contractMatch = /^contract:(0x[a-fA-F0-9]{64})$/.exec(value)
  if (contractMatch) {
    return {
      ok: true,
      principal: {
        kind: 'Contract',
        bytes: Array.from(hexToBytes32(contractMatch[1], 'contract principal')),
      },
      source: 'contract_id',
    }
  }

  if (/^0x[a-fA-F0-9]{64}$/.test(value)) {
    return {
      ok: true,
      principal: {
        kind: 'Phoenix',
        bytes: Array.from(hexToBytes32(value, 'principal')),
      },
      source: 'hex_principal',
    }
  }

  const publicSender = decodeBase58(value)
  if (!publicSender || !isMoonlightPublicKeyLength(publicSender.length)) {
    return { ok: false, reason: 'Use a valid Dusk public account.' }
  }

  return {
    ok: true,
    principal: {
      kind: 'Moonlight',
      bytes: Array.from(publicSender),
    },
    source: 'moonlight_account',
  }
}

export function principalKey(principal: DuskPrincipal | null | undefined): string {
  if (!principal) return ''
  return `${principal.kind.toLowerCase()}:${bytesToHex(Uint8Array.from(principal.bytes))}`
}

export function principalLabel(principal: DuskPrincipal | null | undefined): string {
  if (!principal) return '-'
  if (principal.kind === 'Moonlight') return 'Moonlight wallet'
  if (principal.kind === 'Contract') return 'Contract'
  return 'Direct principal'
}

export function principalShortValue(principal: DuskPrincipal | null | undefined): string {
  if (!principal) return '-'
  const hex = `0x${bytesToHex(Uint8Array.from(principal.bytes))}`
  return `${hex.slice(0, 10)}...${hex.slice(-6)}`
}

export function authorityHexFromPublicSender(publicSender: Uint8Array): string {
  if (publicSender.length !== PUBLIC_SENDER_KEY_BYTES) {
    throw new Error(`Dusk public sender keys must be ${PUBLIC_SENDER_KEY_BYTES} bytes.`)
  }

  const material = new Uint8Array(RUNTIME_AUTHORITY_DOMAIN.length + publicSender.length)
  material.set(RUNTIME_AUTHORITY_DOMAIN)
  material.set(publicSender, RUNTIME_AUTHORITY_DOMAIN.length)
  return `0x${bytesToHex(blake2b(material, { dkLen: 32 }))}`
}

function isMoonlightPublicKeyLength(length: number): boolean {
  return length === PUBLIC_SENDER_KEY_BYTES || length === BLS_PUBLIC_KEY_BYTES
}

function hexToBytes32(value: string, label: string): Uint8Array {
  const normalized = value.trim().toLowerCase()
  if (!/^0x[a-f0-9]{64}$/.test(normalized)) {
    throw new Error(`${label} must be a 32-byte hex string.`)
  }
  const bytes = new Uint8Array(32)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(2 + index * 2, 4 + index * 2), 16)
  }
  return bytes
}

export function decodeBase58(value: string): Uint8Array | null {
  const bytes: number[] = []
  const digits: number[] = []

  for (const character of value) {
    let carry = BASE58_ALPHABET.indexOf(character)
    if (carry < 0) return null
    if (carry === 0 && bytes.length === 0 && digits.length === 0) bytes.push(0)

    for (let index = 0; index < digits.length || carry > 0; index += 1) {
      const current = (digits[index] ?? 0) * 58 + carry
      digits[index] = current & 0xff
      carry = current >> 8
    }
  }

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    bytes.push(digits[index])
  }

  return new Uint8Array(bytes)
}

export function encodeBase58(value: Uint8Array | number[]): string {
  const source = value instanceof Uint8Array ? value : Uint8Array.from(value)
  const digits = [0]

  for (const byte of source) {
    let carry = byte
    for (let index = 0; index < digits.length; index += 1) {
      carry += digits[index] << 8
      digits[index] = carry % 58
      carry = Math.floor(carry / 58)
    }
    while (carry > 0) {
      digits.push(carry % 58)
      carry = Math.floor(carry / 58)
    }
  }

  for (const byte of source) {
    if (byte === 0) digits.push(0)
    else break
  }

  return digits.reverse().map((digit) => BASE58_ALPHABET[digit]).join('')
}
