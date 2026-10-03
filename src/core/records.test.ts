import { describe, expect, it } from 'vitest'
import { createResolverRecord, getRecordDefinition, validateRecordValue, type ResolverRecordKey } from './records'
import { recordMutationPlan } from './recordDrafts'

const checksum = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'

describe('cross-chain address records', () => {
  it.each([
    ['address.btc', 'Bitcoin address'],
    ['address.eth', 'Ethereum address'],
    ['address.sol', 'Solana address'],
    ['address.evm', 'EVM address'],
  ] as const)('defines %s as a public payment record', (key, label) => {
    expect(getRecordDefinition(key)).toMatchObject({
      label, visibility: 'public', eligibleForPrimaryName: false, eligibleForDefaultDuskRecipient: false,
    })
  })

  // BIP-173 / BIP-350 SegWit vectors and mainnet P2PKH / P2SH addresses.
  it.each([
    '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
    'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
    'BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4',
    'bc1sw50qgdz25j',
  ])('accepts mainnet Bitcoin address %s', value => {
    expect(validateRecordValue('address.btc', value)).toEqual([])
    expect(createResolverRecord('address.btc', value).value).toBe(value.toLowerCase().startsWith('bc1') ? value.toLowerCase() : value)
  })

  it.each([
    '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb', // Bad Base58Check checksum.
    '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfN0',
    'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn', // Testnet.
    '2N2JD6wb56AfK4tfmM6PwdVmoYk2dCKf4Br',
    'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7',
    'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5',
    'bC1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', // Mixed case.
    'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kemeawh', // v0 with Bech32m.
    'BC1SW50QA3JX3S', // v16 with Bech32, not Bech32m.
    'bc1rw5uspcuh', // Witness program too short.
    'bc1pw5dgrnzv', // Incorrect checksum variant.
    'bc1gmk9yu', // Empty witness program.
    '',
  ])('rejects invalid or non-mainnet Bitcoin address %s', value => {
    expect(validateRecordValue('address.btc', value).length).toBeGreaterThan(0)
  })

  it.each(['address.eth', 'address.evm'] as const)('checks and normalizes EIP-55 for %s', key => {
    for (const value of [checksum, checksum.toLowerCase(), '0x52908400098527886E0F7030069857D2E4169EE7', '0xde709f2102306220921060314715629080e2fb77']) {
      expect(validateRecordValue(key, value)).toEqual([])
    }
    expect(createResolverRecord(key, checksum.toLowerCase()).value).toBe(checksum)
    expect(recordMutationPlan([key], [], { [key]: checksum.toLowerCase() }).mutations).toEqual([
      { action: 'set', key, value: checksum, ttlSeconds: 300 },
    ])
    for (const value of [checksum.replace('A', 'a'), checksum.slice(0, -1), `${checksum}0`, checksum.replace('5', 'g'), checksum.slice(2)]) {
      expect(validateRecordValue(key, value).length).toBeGreaterThan(0)
      expect(() => createResolverRecord(key, value)).toThrow()
    }
  })

  it('accepts 32-byte Solana addresses including leading zeroes', () => {
    for (const value of ['So11111111111111111111111111111111111111112', '11111111111111111111111111111111']) {
      expect(createResolverRecord('address.sol', value).value).toBe(value)
    }
    for (const value of ['1'.repeat(31), '1'.repeat(33), 'z'.repeat(44), '0'.repeat(32), 'So1111111111111111111111111111111111111111O', '']) {
      expect(validateRecordValue('address.sol', value).length).toBeGreaterThan(0)
    }
  })

  it('keeps DuskEVM separate and rejects uncurated address keys', () => {
    expect(getRecordDefinition('evm_address')?.label).toBe('DuskEVM Address')
    expect(createResolverRecord('evm_address', checksum.toLowerCase()).value).toBe(checksum.toLowerCase())
    expect(getRecordDefinition('address.unknown' as ResolverRecordKey)).toBeUndefined()
  })
})
