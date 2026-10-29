import { expect, it } from 'vitest'
import {
  normalizeNameInput,
  validateName,
  rootLabelStatus,
  LAUNCH_NAME_POLICY,
  RESERVED_LABELS,
} from '../src/core/names.ts'
import { analyzeName } from '../src/core/name-status.ts'
import { namehashHex, nameKey } from '../src/frozen/bytes.ts'
import { sample } from './helpers.ts'
const reserved = [
  'admin', 'airdrop', 'autholykos', 'bridge', 'citadel', 'claim', 'connect',
  'docs', 'dusk', 'duskdomains', 'duskds', 'duskevm', 'duskfoundation',
  'dusknetwork', 'duskwallet', 'exchange', 'explorer', 'faucet', 'foundation',
  'gamo', 'george', 'grants', 'hdauven', 'hedger', 'hein', 'heindauven', 'help',
  'helpdesk', 'human', 'mainnet', 'moana', 'mocello', 'mochavi', 'moderator', 'moonlight',
  'neotamandua', 'nocturne-standards', 'npex', 'official', 'phoenix', 'piecrust',
  'pieswap', 'provisioner', 'rannier', 'refund', 'rusk', 'security', 'seppia',
  'sozu', 'staking', 'support', 'tdi', 'team', 'testnet', 'thomas', 'tminus',
  'trade', 'verify', 'wallet', 'webwallet', 'zedger',
]
it('pins the exact launch reserved list', () => {
  expect(RESERVED_LABELS).toEqual(reserved)
})
it.each([
  ['  ALIce  ', 'alice.dusk'],
  ['ALICE.DUSK', 'alice.dusk'],
  ['', ''],
  ['  ', ''],
  ['a.b', 'a.b.dusk'],
  ['\u212a', '\u212a.dusk'],
])('normalizes input %j to %j with ASCII-only case folding', (input, result) =>
  expect(normalizeNameInput(input)).toBe(result),
)
it.each([
  'a',
  'ab',
  'abc',
  'a--b',
  'a0-9',
  '0',
  'z'.repeat(63),
  'a.b.c.d.dusk',
  Array(4).fill('a'.repeat(63)).join('.') + '.dusk',
])('accepts frozen structure %s', (name) =>
  expect(validateName(name).ok).toBe(true),
)
it.each([
  '-abc',
  'abc-',
  'a_b',
  'a b',
  'é',
  '💡',
  'a'.repeat(64),
  '.abc',
  'abc..dusk',
  'abc.dusk.',
  'a.b.c.d.e.dusk',
  'a\u0000',
  '\u212a',
])('rejects frozen structure %j', (name) =>
  expect(validateName(name).ok).toBe(false),
)
it.each(reserved)(
  'launch root %s is reserved while structure remains valid',
  (label) => {
    expect(rootLabelStatus(label)).toBe('Reserved')
    expect(validateName(label)).toMatchObject({
      ok: true,
      rootEligibility: 'Reserved',
    })
    expect(analyzeName(label)).toMatchObject({ status: 'reserved', canRegister: false })
    expect(analyzeName(label, { current: null, height: 100n })).toMatchObject({
      status: 'reserved',
      canRegister: false,
    })
    expect(analyzeName(`${label}.example`).status).toBe('subname')
  },
)
it.each([
  ['a', 'Public'],
  ['ab', 'Public'],
  ['abc', 'Public'],
  ['walletx', 'Public'],
])('policy owns minimum and exact reserved matching for %s', (label, status) =>
  expect(rootLabelStatus(label)).toBe(status),
)
it('takes launch roots from 1 character: a 1- or 2-character root is available unless observed', () => {
  expect(LAUNCH_NAME_POLICY.minimum_root_bytes).toBe(1)
  for (const label of ['x', 'ab']) {
    expect(validateName(label)).toMatchObject({ ok: true, rootEligibility: 'Public' })
    expect(analyzeName(label, { current: null, height: 100n })).toMatchObject({ status: 'available', canRegister: true })
  }
  // A policy with a higher minimum still decides for itself.
  expect(rootLabelStatus('ab', { ...LAUNCH_NAME_POLICY, minimum_root_bytes: 3 })).toBe('Denied')
})
it('honors denied/reserved/minimum precedence for replacement policy', () => {
  const p = {
    minimum_root_bytes: 20,
    denied: ['wallet'],
    reserved: ['a', 'wallet'],
  }
  expect(rootLabelStatus('wallet', p)).toBe('Denied')
  expect(rootLabelStatus('a', p)).toBe('Reserved')
  expect(rootLabelStatus('example', p)).toBe('Denied')
})
it('does not invent availability or hardcoded registrations', () => {
  expect(analyzeName('acme').status).toBe('unchecked')
  expect(analyzeName('acme', { current: null, height: 100n })).toMatchObject({
    status: 'available',
    canRegister: true,
  })
  expect(() => analyzeName('acme', { current: null })).toThrow()
})
it.each([
  [99n, 'registered'],
  [100n, 'grace'],
  [199n, 'grace'],
  [200n, 'available'],
])('analyzes observed lifecycle at %s', (height, status) => {
  const current = sample('NameView')
  current.name.key = nameKey('example.dusk')
  current.name.expires_at = 100n
  current.name.grace_end = 200n
  expect(analyzeName('example', { current, height }).status).toBe(status)
})
it('binds observed name to spelling', () =>
  expect(() =>
    analyzeName('wrong', { current: sample('NameView'), height: 0n }),
  ).toThrow())
it('hashes the protocol root vector, not normalized UI input', () => {
  expect(namehashHex('example.dusk')).toBe(
    'c22c0382c415688f74626049c8edbffdca5db46ec602666e39c54df6c8c093ea',
  )
  expect(() => namehashHex('EXAMPLE.dusk')).toThrow()
})
