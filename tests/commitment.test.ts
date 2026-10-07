import { expect, it, vi } from 'vitest'
import {
  createRegistrationSecret,
  registrationCommitmentHex,
  registrationCommitWindow,
} from '../src/core/commitment.ts'
const input = {
  node: 'c22c0382c415688f74626049c8edbffdca5db46ec602666e39c54df6c8c093ea',
  controller: '03'.repeat(32),
  label: 'example',
  secret: '08'.repeat(32),
}
it('matches frozen_wire.rs commitment exactly', () =>
  expect(registrationCommitmentHex(input)).toBe(
    '0x85a10ce017576b1113d81dd8098cb523287b2647bdb6156408b805386e19c29b',
  ))
it.each(['node', 'controller', 'secret'] as const)(
  'rejects malformed %s',
  (field) =>
    expect(() =>
      registrationCommitmentHex({ ...input, [field]: 'ff' }),
    ).toThrow(),
)
it.each(['EXAMPLE', ' example', 'foo', 'example.dusk'])(
  'refuses mismatched/case-folded label %s',
  (label) =>
    expect(() => registrationCommitmentHex({ ...input, label })).toThrow(),
)
it('creates a secure 32-byte secret without a non-cryptographic fallback', () => {
  expect(createRegistrationSecret()).toMatch(/^0x[0-9a-f]{64}$/)
  expect(createRegistrationSecret()).not.toBe(createRegistrationSecret())
  vi.stubGlobal('crypto', undefined)
  try {
    expect(() => createRegistrationSecret()).toThrow('randomness')
  } finally {
    vi.unstubAllGlobals()
  }
})
it.each([
  [-1n, 'future', 6n, 8641n],
  [0n, 'waiting', 5n, 8640n],
  [4n, 'waiting', 1n, 8636n],
  [5n, 'ready', 0n, 8635n],
  [8639n, 'ready', 0n, 1n],
  [8640n, 'ready', 0n, 0n],
  [8641n, 'stale', 0n, 0n],
])(
  'commit reveal age %s matches store inclusive bounds',
  (age, status, waitBlocks, staleInBlocks) =>
    expect(registrationCommitWindow(100n, 100n + age)).toEqual({
      status,
      waitBlocks,
      staleInBlocks,
    }),
)
it.each([
  [null, 100n],
  [0n, null],
  [undefined, undefined],
])('missing observation %s/%s is distinct from zero', (committed, current) =>
  expect(registrationCommitWindow(committed, current).status).toBe('missing'),
)
it('recognizes genesis commitments and rejects invalid heights', () => {
  expect(registrationCommitWindow(0n, 5n).status).toBe('ready')
  expect(() => registrationCommitWindow(-1n, 0n)).toThrow()
})
it('rejects malformed byte material instead of silently truncating it', async () => {
  const { commitmentHash, childNode } = await import('../src/frozen/bytes.ts')
  expect(() =>
    commitmentHash(Array(32).fill(256), 'example', Array(32).fill(0)),
  ).toThrow()
  expect(() => childNode([1], 'child')).toThrow()
})
