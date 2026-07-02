import { describe, expect, it } from 'vitest'
import {
  authorityHexFromPublicSender,
  contractPrincipalFromWalletAccount,
  decodeBase58,
  principalLabel,
  typedPrincipalFromWalletAccount,
} from './principal'

describe('Dusk Names contract principal helpers', () => {
  it('passes through local 32-byte principals', () => {
    expect(contractPrincipalFromWalletAccount(`0x${'AB'.repeat(32)}`)).toEqual({
      ok: true,
      principal: `0x${'ab'.repeat(32)}`,
      source: 'hex_principal',
    })
  })

  it('accepts explicit contract principals for contract-owned domains', () => {
    expect(contractPrincipalFromWalletAccount(`contract:0x${'CD'.repeat(32)}`)).toEqual({
      ok: true,
      principal: `0x${'cd'.repeat(32)}`,
      source: 'contract_id',
    })
  })

  it('labels direct principal bytes without implying a wallet type', () => {
    const parsed = typedPrincipalFromWalletAccount(`0x${'AB'.repeat(32)}`)

    expect(parsed).toMatchObject({ ok: true, source: 'hex_principal' })
    expect(principalLabel(parsed.ok ? parsed.principal : null)).toBe('Direct principal')
  })

  it('decodes base58 public account IDs into contract authorities', () => {
    const publicSender = new Uint8Array(96)
    publicSender.fill(7)
    const encoded = encodeBase58(publicSender)

    expect(contractPrincipalFromWalletAccount(encoded)).toEqual({
      ok: true,
      principal: authorityHexFromPublicSender(publicSender),
      source: 'moonlight_account',
    })
  })

  it('rejects base58 values that are not public account keys', () => {
    expect(contractPrincipalFromWalletAccount('2')).toMatchObject({
      ok: false,
      reason: 'Use a valid Dusk public account.',
    })
  })

  it('decodes base58 leading zeroes', () => {
    expect(Array.from(decodeBase58('1') ?? [])).toEqual([0])
    expect(Array.from(decodeBase58('12') ?? [])).toEqual([0, 1])
  })
})

function encodeBase58(bytes: Uint8Array) {
  const digits: number[] = []
  let output = ''

  for (const byte of bytes) {
    let carry = byte
    if (carry === 0 && output.length === 0) output += '1'

    for (let index = 0; index < digits.length || carry > 0; index += 1) {
      const current = (digits[index] ?? 0) * 256 + carry
      digits[index] = current % 58
      carry = Math.floor(current / 58)
    }
  }

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    output += '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[digits[index]]
  }

  return output
}
