import { expect, it } from 'vitest'
import {
  normalizeNameInput,
  validateName,
  analyzeName,
  rootLabelStatus,
  RESERVED_LABELS,
} from '../src/core/names.ts'
import { namehashHex, nameKey } from '../src/frozen/bytes.ts'
import { sample } from './helpers.ts'
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
it.each(RESERVED_LABELS)(
  'launch root %s is reserved while structure remains valid',
  (label) => {
    expect(rootLabelStatus(label)).toBe('Reserved')
    expect(validateName(label)).toMatchObject({
      ok: true,
      rootEligibility: 'Reserved',
    })
    expect(analyzeName(label).status).toBe('reserved')
    expect(analyzeName(`${label}.example`).status).toBe('subname')
  },
)
it.each([
  ['a', 'Denied'],
  ['ab', 'Denied'],
  ['abc', 'Public'],
  ['walletx', 'Public'],
])('policy owns minimum and exact reserved matching for %s', (label, status) =>
  expect(rootLabelStatus(label)).toBe(status),
)
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
