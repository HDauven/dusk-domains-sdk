import { expect, it } from 'vitest'
import { bls12_381 } from '@noble/curves/bls12-381.js'
import {
  applyRecordMutations,
  createRecordInput,
  createResolverRecord,
  getRecordDefinition,
  validateRecordInput,
  validateRecordValue,
  validateRecordSet,
  STATIC_RECORD_DEFINITIONS,
} from '../src/core/records.ts'
import { encodeBase58 } from '../src/core/principal.ts'
import type { RecordMutation } from '../src/frozen/types.ts'
const endpoint = bls12_381.G2.Point.BASE.toBytes()
const valid: Record<string, string> = {
  moonlight_address: encodeBase58(endpoint),
  phoenix_payment_endpoint: 'p'.repeat(32),
  dusk_contract: '0x' + '01'.repeat(32),
  dusk_asset: 'asset:one',
  evm_address: '0x' + 'ab'.repeat(20),
  'address.btc': '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  'address.eth': '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  'address.evm': '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  'address.sol': 'So11111111111111111111111111111111111111112',
  website: 'https://example.com',
  avatar: 'ipfs://abcdef',
  content_pointer: 'bafyABC',
  attestation_ref: 'urn:example:one',
  compliance_ref: 'dusk:proof',
  'text.bio': 'Hello',
  'service_endpoint.api': 'https://example.com/api',
  'custom.💡': 'anything',
}
it('covers every conventional key', () =>
  expect(
    STATIC_RECORD_DEFINITIONS.map((d) => d.key).every((key) => key in valid),
  ).toBe(true))
it.each(Object.entries(valid))('validates/encodes record %s', (key, value) => {
  expect(validateRecordValue(key, value)).toEqual([])
  const record = createResolverRecord(key, value, 9007199254740993n)
  expect(record.updated_at).toBe(9007199254740993n)
  expect(getRecordDefinition(key)?.maxBytes).toBe(512)
  expect(record.value.length).toBeGreaterThan(0)
  expect(() => validateRecordSet([record], record.updated_at)).not.toThrow()
})
it.each(Object.keys(valid))(
  'rejects empty and oversized convention values for %s',
  (key) => {
    expect(validateRecordValue(key, '')).not.toEqual([])
    expect(validateRecordValue(key, 'x'.repeat(513))).not.toEqual([])
  },
)
it('encodes primary forward data as 96 endpoint bytes, never Base58 text', () =>
  expect(
    createRecordInput('moonlight_address', valid.moonlight_address).value,
  ).toEqual(Array.from(endpoint)))
it('encodes contract IDs as bytes; keeps input and observed record shapes separate', () => {
  expect(createRecordInput('dusk_contract', valid.dusk_contract)).toEqual({
    key: 'dusk_contract',
    value: Array(32).fill(1),
    ttl_seconds: 300n,
  })
  expect(createRecordInput('website', valid.website)).not.toHaveProperty(
    'updated_at',
  )
})
// Ported BIP-173/BIP-350, Base58Check and EIP-55 cases from 0.2.0 records.test.ts.
it.each([
  '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
  '3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy',
  'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
  'BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4',
  'bc1sw50qgdz25j',
])('accepts Bitcoin vector %s', (value) =>
  expect(validateRecordValue('address.btc', value)).toEqual([]),
)
it.each([
  '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb',
  '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfN0',
  'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn',
  '2N2JD6wb56AfK4tfmM6PwdVmoYk2dCKf4Br',
  'tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7',
  'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5',
  'bC1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
  'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kemeawh',
  'BC1SW50QA3JX3S',
  'bc1rw5uspcuh',
  'bc1pw5dgrnzv',
  'bc1gmk9yu',
])('rejects Bitcoin vector %s', (value) =>
  expect(validateRecordValue('address.btc', value)).toContain(
    'invalid_address',
  ),
)
it.each(['address.eth', 'address.evm'])(
  'normalizes and checks EIP-55 %s',
  (key) => {
    const checksum = valid['address.eth']
    expect(
      new TextDecoder().decode(
        Uint8Array.from(createRecordInput(key, checksum.toLowerCase()).value),
      ),
    ).toBe(checksum)
    for (const value of [
      checksum.replace('A', 'a'),
      checksum.slice(0, -1),
      checksum + '0',
      checksum.replace('5', 'g'),
      checksum.slice(2),
    ])
      expect(validateRecordValue(key, value)).toContain('invalid_address')
  },
)
it.each([
  '1'.repeat(31),
  '1'.repeat(33),
  'z'.repeat(44),
  '0'.repeat(32),
  'So1111111111111111111111111111111111111111O',
])('rejects Solana vector %s', (value) =>
  expect(validateRecordValue('address.sol', value)).toContain(
    'invalid_address',
  ),
)
it('accepts the 32 zero-byte Solana address', () =>
  expect(validateRecordValue('address.sol', '1'.repeat(32))).toEqual([]))
it.each(['website', 'service_endpoint.api', 'avatar', 'content_pointer'])(
  'rejects invalid URL conventions %s',
  (key) => {
    for (const value of [
      'http://example.com',
      'javascript:alert(1)',
      'https://a:b@example.com',
      'https://ex ample.com',
    ])
      expect(validateRecordValue(key, value)).not.toEqual([])
  },
)
it.each(['text.bio', 'text.name'])(
  'rejects blank/control text in %s',
  (key) => {
    for (const v of ['   ', 'abc\n', '\u007f'])
      expect(validateRecordValue(key, v)).toContain('invalid_text')
  },
)
it.each(['attestation_ref', 'compliance_ref'])(
  'rejects opaque references without a supported scheme %s',
  (key) =>
    expect(validateRecordValue(key, 'not a ref')).toContain(
      'invalid_reference',
    ),
)
it('accepts all bounded raw keys and binary data without convention restrictions', () => {
  expect(
    validateRecordInput({
      key: '\u0000anything💡',
      value: [0, 255],
      ttl_seconds: 1n,
    }).value,
  ).toEqual([0, 255])
  expect(
    validateRecordInput({ key: 'website', value: [0], ttl_seconds: 1n }).value,
  ).toEqual([0])
})
it.each([
  ['a'.repeat(64), true],
  ['a'.repeat(65), false],
  ['é'.repeat(32), true],
  ['é'.repeat(33), false],
  ['', false],
  ['\ud800', false],
] as const)('enforces UTF-8 key bound %j', (key, valid) => {
  const call = () => validateRecordInput({ key, value: [1], ttl_seconds: 1n })
  if (valid) expect(call).not.toThrow()
  else expect(call).toThrow()
})
it.each([0, 1, 512, 513])('raw value byte length %s', (length) => {
  const call = () =>
    validateRecordInput({
      key: 'any',
      value: Array(length).fill(1),
      ttl_seconds: 1n,
    })
  if (length >= 1 && length <= 512) expect(call).not.toThrow()
  else expect(call).toThrow()
})
it.each([0n, 1n, 86400n, 86401n, -1n])('TTL edge %s', (ttl_seconds) => {
  const call = () =>
    validateRecordInput({ key: 'any', value: [1], ttl_seconds })
  if (ttl_seconds >= 1n && ttl_seconds <= 86400n) expect(call).not.toThrow()
  else expect(call).toThrow()
})
it('counts UTF-8 value bytes and requires block timestamps', () => {
  expect(
    createResolverRecord('text.bio', 'é'.repeat(256), 3n).value,
  ).toHaveLength(512)
  expect(() => createResolverRecord('text.bio', 'é'.repeat(257), 3n)).toThrow()
  expect(() =>
    createResolverRecord('text.bio', 'a', '2026-01-01' as never),
  ).toThrow()
})
const set = (key: string, length = 1): RecordMutation => ({
  action: 'Set',
  key,
  value: Array(length).fill(1),
  ttl_seconds: 300n,
})
it('simulates idempotent clear, replacement and UTF-8 sorting without mutating its inputs', () => {
  const old = createResolverRecord('text.old', 'old', 10n),
    keep = createResolverRecord('text.keep', 'keep', 9n)
  const input = [old, keep],
    original = structuredClone(input)
  const result = applyRecordMutations(
    input,
    [
      { action: 'Clear', key: 'missing', value: [], ttl_seconds: 0n },
      set('text.old'),
      set('text.a'),
    ],
    20n,
  )
  expect(input).toEqual(original)
  expect(result.map((r) => r.key)).toEqual(['text.a', 'text.keep', 'text.old'])
  expect(result.map((r) => r.updated_at)).toEqual([20n, 9n, 20n])
})
it.each([0, 1, 8, 9])('mutation count edge %s', (count) => {
  const call = () =>
    applyRecordMutations(
      [],
      Array.from({ length: count }, (_, i) => set('k' + i)),
      1n,
    )
  if (count >= 1 && count <= 8) expect(call).not.toThrow()
  else expect(call).toThrow()
})
it('validates duplicate keys, clear encoding, aggregate byte bound and atomicity', () => {
  expect(() => applyRecordMutations([], [set('a'), set('a')], 1n)).toThrow(
    'duplicate',
  )
  expect(() =>
    applyRecordMutations(
      [],
      [{ action: 'Clear', key: 'a', value: [1], ttl_seconds: 0n }],
      1n,
    ),
  ).toThrow('clear')
  expect(() =>
    applyRecordMutations(
      [],
      [{ action: 'Clear', key: 'a', value: [], ttl_seconds: 1n }],
      1n,
    ),
  ).toThrow('clear')
  const mutations = Array.from({ length: 8 }, (_, i) => set(String(i), 511))
  expect(applyRecordMutations([], mutations, 1n)).toHaveLength(8) // exactly 4096 bytes
  mutations[7].value.push(1)
  expect(() => applyRecordMutations([], mutations, 1n)).toThrow('payload')
})
it('enforces full-set count, distinct keys, timestamp and resulting count', () => {
  const rows = Array.from({ length: 16 }, (_, i) =>
    createResolverRecord(`text.${i}`, 'a', 1n),
  )
  expect(validateRecordSet(rows, 1n)).toHaveLength(16)
  expect(() => applyRecordMutations(rows, [set('extra')], 1n)).toThrow('count')
  expect(() => validateRecordSet([rows[0], rows[0]], 1n)).toThrow('duplicate')
  expect(() => validateRecordSet(rows, 0n)).toThrow('future')
})
