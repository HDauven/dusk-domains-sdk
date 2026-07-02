import { describe, expect, it } from 'vitest'
import {
  PENDING_NAME_RESERVATIONS_STORAGE_KEY,
  listPendingNameReservations,
  removePendingNameReservation,
  updatePendingNameReservationBlock,
  upsertPendingNameReservation,
  type PendingNameReservation,
} from './reservations'

class MemoryStorage {
  private readonly entries = new Map<string, string>()

  getItem(key: string) {
    return this.entries.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.entries.set(key, value)
  }
}

const baseReservation: PendingNameReservation = {
  name: 'aurora.dusk',
  node: `0x${'01'.repeat(32)}`,
  commitment: `0x${'02'.repeat(32)}`,
  secret: `0x${'03'.repeat(32)}`,
  controller: `0x${'04'.repeat(32)}`,
  ownerAddress: '244Sywxj7PreviewPublicAccount',
  chainId: 'dusk:testnet',
  durationYears: 2,
  committedBlockHeight: null,
  committedTxId: 'tx-commit',
  createdAt: '2026-06-20T09:00:00.000Z',
  updatedAt: '2026-06-20T09:00:00.000Z',
}

describe('pending name reservations', () => {
  it('stores and filters local reservations by chain and controller', () => {
    const storage = new MemoryStorage()
    upsertPendingNameReservation(baseReservation, storage)
    upsertPendingNameReservation({
      ...baseReservation,
      name: 'other.dusk',
      node: `0x${'05'.repeat(32)}`,
      commitment: `0x${'06'.repeat(32)}`,
      controller: `0x${'07'.repeat(32)}`,
    }, storage)

    expect(listPendingNameReservations({
      chainId: 'dusk:testnet',
      controller: baseReservation.controller.toUpperCase(),
    }, storage)).toEqual([baseReservation])
  })

  it('replaces an older reservation for the same name slot', () => {
    const storage = new MemoryStorage()
    upsertPendingNameReservation(baseReservation, storage)
    upsertPendingNameReservation({
      ...baseReservation,
      commitment: `0x${'08'.repeat(32)}`,
      secret: `0x${'09'.repeat(32)}`,
      updatedAt: '2026-06-20T09:01:00.000Z',
    }, storage)

    expect(listPendingNameReservations({}, storage)).toEqual([
      expect.objectContaining({
        commitment: `0x${'08'.repeat(32)}`,
        secret: `0x${'09'.repeat(32)}`,
      }),
    ])
  })

  it('updates the finalized commitment block when the indexer catches up', () => {
    const storage = new MemoryStorage()
    upsertPendingNameReservation(baseReservation, storage)

    updatePendingNameReservationBlock({
      chainId: baseReservation.chainId,
      controller: baseReservation.controller,
      commitment: baseReservation.commitment,
    }, {
      committedBlockHeight: 123,
      updatedAt: '2026-06-20T09:02:00.000Z',
    }, storage)

    expect(listPendingNameReservations({}, storage)[0]).toMatchObject({
      committedBlockHeight: 123,
      committedTxId: 'tx-commit',
      updatedAt: '2026-06-20T09:02:00.000Z',
    })
  })

  it('removes a reservation after registration completes', () => {
    const storage = new MemoryStorage()
    upsertPendingNameReservation(baseReservation, storage)

    removePendingNameReservation({
      chainId: baseReservation.chainId,
      controller: baseReservation.controller,
      node: baseReservation.node,
    }, storage)

    expect(listPendingNameReservations({}, storage)).toEqual([])
  })

  it('ignores corrupted storage payloads', () => {
    const storage = new MemoryStorage()
    storage.setItem(PENDING_NAME_RESERVATIONS_STORAGE_KEY, '{not-json')

    expect(listPendingNameReservations({}, storage)).toEqual([])
  })
})
