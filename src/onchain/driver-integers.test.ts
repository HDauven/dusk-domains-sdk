import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { createDuskDomainsOnChainClient } from './sdkOnChain'
import { decodeFeeConfig, decodeNameResponse, decodePendingCommitmentResponse, decodePrimaryNameResponse, decodeRecordResponse } from './sdkOnChainDecoders'

// Captured with the protocol's scripts/capture-driver-integers.mjs: Rust RKYV
// fixtures decoded by built Forge WASM drivers (dusk-data-driver 0.3.1) via @dusk/w3sper (JSON.parse).
const fixture = JSON.parse(readFileSync(new URL('../projection/test-fixtures/driver-integers.json', import.meta.url), 'utf8'))
const node = Array(32).fill(1)

it.each([fixture.premium, fixture.zeroPremium, 123, 0, String(Number.MAX_SAFE_INTEGER)])('reads the scalar u64 premium %s', async value => {
  const client = createDuskDomainsOnChainClient({ read: { read: async () => ({ fnName: 'registration_premium', output: value }) } })
  expect(await client.getRegistrationPremium('aurora.dusk')).toEqual({ ok: true, value: Number(value) })
})

it.each(['9007199254740992', '18446744073709551615', Number.MAX_SAFE_INTEGER + 1, -1, 1.5, '-1', '1.5', '1e3', '+1', ' 1', '', null, true])('rejects an invalid or unsafe scalar u64 premium %s', async value => {
  const client = createDuskDomainsOnChainClient({ read: { read: async () => value } })
  expect(await client.getRegistrationPremium('aurora.dusk')).toMatchObject({ ok: false, error: { code: 'contract_read_failed', message: expect.stringContaining('invalid price') } })
})

const outputs: [string, (value: unknown) => unknown, object][] = [
  ['name lifecycle', value => decodeNameResponse(value, 'aurora.dusk'), { node, record: {
    label: 'aurora', owner: node, manager: node, lifecycle: { expires_at: 12345, grace_ends_at: 14937 }, referrer: null,
  } }],
  ['record metadata', value => decodeRecordResponse(value, 'website'), { record: {
    key: 'website', value: 'https://dusk.domains', ttl_seconds: 300, updated_at: 2001,
  } }],
  ['primary metadata', decodePrimaryNameResponse, { endpoint: { kind: 'EvmAddress', value: '0x' + '11'.repeat(20) },
    record: { name: 'aurora.dusk', node, updated_at: 3001 } }],
  ['commitment metadata', decodePendingCommitmentResponse, { commitment: node, pending: { controller: node, created_at: 4001 } }],
  ['fee configuration', decodeFeeConfig, { three_char_year_lux: 150000000000, four_char_year_lux: 50000000000,
    five_plus_year_lux: 10000000000, referral_reward_bps: 2000, renewal_referral_reward_bps: 1000,
    premium_referral_reward_bps: 0, premium_start_lux: 1000000000000000, version: 1, updated_at: 5001 }],
]

it.each(outputs)('accepts every integer as a decimal string in %s output', (_label, decode, payload) => {
  // Upstream's nested integer serializer changes u64 fields; byte arrays remain bytes.
  const strings = JSON.parse(JSON.stringify(payload, function (key, value) {
    return typeof value === 'number' && !Array.isArray(this) ? String(value) : value
  }))
  const numeric = decode(payload)
  expect(numeric).toMatchObject({ ok: true })
  expect(decode(strings)).toEqual(numeric)
})

it.each(['9007199254740992', '-1', '1.5', '', '1e3'])('rejects malformed or unsafe nested integers %s', value => {
  expect(decodeNameResponse({ node, record: { label: 'aurora', owner: node, manager: node,
    lifecycle: { expires_at: value, grace_ends_at: '14937' } } }, null)).toMatchObject({ ok: false, error: { code: 'contract_read_failed' } })
  expect(decodeFeeConfig({ ...outputs[4]![2], version: value })).toMatchObject({ ok: false, error: { code: 'contract_read_failed' } })
})
