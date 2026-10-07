import { expect, it, vi } from 'vitest'
import {
  listPendingNameReservations,
  upsertPendingNameReservation,
  removePendingNameReservation,
  updatePendingNameReservationBlock,
  PENDING_NAME_RESERVATIONS_STORAGE_KEY as KEY,
  type PendingNameReservation,
} from '../src/core/reservations.ts'
import { registrationCommitmentHex } from '../src/core/commitment.ts'
import { namehashHex } from '../src/frozen/bytes.ts'
import { id } from './helpers.ts'
class MemoryStorage {
  entries = new Map<string, string>()
  getItem(key: string): string | null {
    return this.entries.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.entries.set(key, value)
  }
}
const base = (): PendingNameReservation => {
  const node = `0x${namehashHex('aurora.dusk')}`,
    secret = '0x' + id(3),
    controller = '0x' + id(4)
  return {
    name: 'aurora.dusk',
    node,
    secret,
    controller,
    commitment: registrationCommitmentHex({
      node,
      secret,
      controller,
      label: 'aurora',
    }),
    chainId: 'dusk:1',
    directory: id(1),
    commitmentStore: id(2),
    durationYears: 2,
    committedBlockHeight: null,
    committedTxId: 'tx-commit',
    createdAt: '2026-06-20T09:00:00.000Z',
    updatedAt: '2026-06-20T09:00:00.000Z',
  }
}
it('ports reload recovery, filtering, update and removal with explicit shard/deployment scope', () => {
  const storage = new MemoryStorage(),
    r = base()
  expect(upsertPendingNameReservation(r, storage)).toEqual([r])
  expect(
    listPendingNameReservations(
      { chainId: r.chainId, controller: r.controller.toUpperCase() },
      storage,
    ),
  ).toEqual([r])
  const height = 9007199254740993n
  updatePendingNameReservationBlock(
    r,
    { committedBlockHeight: height, updatedAt: '2026-06-20T09:01:00.000Z' },
    storage,
  )
  expect(listPendingNameReservations({}, storage)[0]).toMatchObject({
    committedBlockHeight: height,
    committedTxId: 'tx-commit',
  })
  updatePendingNameReservationBlock(
    r,
    { committedBlockHeight: null, committedTxId: null },
    storage,
  )
  expect(listPendingNameReservations({}, storage)[0]).toMatchObject({
    committedBlockHeight: null,
    committedTxId: null,
  })
  expect(removePendingNameReservation(r, storage)).toEqual([])
})
it.each(['chainId', 'directory', 'commitmentStore'] as const)(
  'preserves identical commitment on another %s',
  (field) => {
    const storage = new MemoryStorage(),
      a = base(),
      b = { ...a, [field]: field === 'chainId' ? 'dusk:2' : id(7) }
    upsertPendingNameReservation(a, storage)
    upsertPendingNameReservation(b, storage)
    expect(listPendingNameReservations({}, storage)).toHaveLength(2)
    removePendingNameReservation(a, storage)
    expect(listPendingNameReservations({}, storage)).toEqual([b])
  },
)
it('upserts the same commitment and preserves a different secret for the same name', () => {
  const storage = new MemoryStorage(),
    a = base(),
    b = { ...a, secret: '0x' + id(8) }
  b.commitment = registrationCommitmentHex({ ...b, label: 'aurora' })
  upsertPendingNameReservation(a, storage)
  upsertPendingNameReservation(b, storage)
  upsertPendingNameReservation({ ...a, committedBlockHeight: 0n }, storage)
  expect(listPendingNameReservations({}, storage)).toHaveLength(2)
  expect(
    listPendingNameReservations({}, storage).find((r) => r.secret === a.secret)
      ?.committedBlockHeight,
  ).toBe(0n)
})
it('uses localStorage by default without mutating caller data', () => {
  const storage = new MemoryStorage(),
    r = base(),
    original = structuredClone(r)
  vi.stubGlobal('localStorage', storage)
  try {
    upsertPendingNameReservation(r)
    expect(listPendingNameReservations()).toEqual([r])
    expect(r).toEqual(original)
  } finally {
    vi.unstubAllGlobals()
  }
})
it.each([
  null,
  {
    getItem: () => {
      throw new Error('offline')
    },
    setItem: () => {},
  },
])('unavailable storage reads empty and blocks persistence', (storage) => {
  expect(listPendingNameReservations({}, storage)).toEqual([])
  expect(() => upsertPendingNameReservation(base(), storage)).toThrow(
    'unavailable',
  )
})
it('handles a security-blocked localStorage getter', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('blocked')
    },
  })
  try {
    expect(listPendingNameReservations()).toEqual([])
    expect(() => upsertPendingNameReservation(base())).toThrow('unavailable')
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
it('reports quota failures so the app cannot mistake a secret for persisted', () => {
  const storage = {
    getItem: () => null,
    setItem: () => {
      throw new Error('quota')
    },
  }
  expect(() => upsertPendingNameReservation(base(), storage)).toThrow(
    'write_failed',
  )
})
it.each(['{broken', '{}', '[null]', '[{"durationYears":1}]'])(
  'ignores corrupt recovery payload but never overwrites it: %s',
  (raw) => {
    const storage = new MemoryStorage()
    storage.setItem(KEY, raw)
    expect(listPendingNameReservations({}, storage)).toEqual([])
    expect(() => upsertPendingNameReservation(base(), storage)).toThrow(
      'corrupt',
    )
    expect(storage.getItem(KEY)).toBe(raw)
  },
)
it.each([
  { name: 'foo.dusk' },
  { node: id(7) },
  { secret: id(8) },
  { commitment: id(9) },
  { controller: id(0) },
  { durationYears: 1.5 },
  { durationYears: 11 },
  { committedBlockHeight: -1n },
  { createdAt: 'invalid' },
  { committedTxId: '' },
  { commitmentStore: '' },
  { directory: '' },
])('rejects malformed reservation %#', (change) =>
  expect(() =>
    upsertPendingNameReservation({ ...base(), ...change }, new MemoryStorage()),
  ).toThrow(),
)
it('sorts newest first and leaves unrelated deployments untouched', () => {
  const storage = new MemoryStorage(),
    a = base(),
    b = { ...a, commitmentStore: id(8), updatedAt: '2026-06-21T09:00:00.000Z' }
  upsertPendingNameReservation(a, storage)
  upsertPendingNameReservation(b, storage)
  expect(listPendingNameReservations({}, storage)).toEqual([b, a])
  expect(
    listPendingNameReservations({ commitmentStore: id(2) }, storage),
  ).toEqual([a])
})
