import { blake2b } from '@noble/hashes/blake2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const PUBLIC_SENDER_KEY_BYTES = 96
const BLS_PUBLIC_KEY_BYTES = 193
const RUNTIME_AUTHORITY_DOMAIN = utf8ToBytes('dusk-domains:runtime-authority:v1')

export type DuskPrincipalKind = 'Moonlight' | 'Phoenix' | 'Contract'

export type DuskPrincipal = {
  kind: DuskPrincipalKind
  bytes: number[]
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
