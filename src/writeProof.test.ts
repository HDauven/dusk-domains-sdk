import { describe, expect, it } from 'vitest'
import {
  DUSK_NAMES_WRITE_PROOF_STORAGE_KEY,
  browserWriteProofTransactionsByKind,
  captureBrowserWriteProofLog,
  findBrowserWriteProofRecord,
  parseBrowserWriteProofLog,
  recordBrowserWriteProof,
  recordBrowserWriteProofUiConfirmation,
} from './writeProof'

describe('browser write proof ledger', () => {
  it('records executed browser writes by proof kind without showing them in UI state', () => {
    const storage = new MemoryStorage()
    const txId = `0x${'11'.repeat(32)}`

    expect(recordBrowserWriteProof({
      chainId: 'dusk:3',
      name: 'Aurora.Dusk',
      account: '244Sywxj7Proof',
      provider: 'Dusk Wallet',
      storage,
      now: () => new Date('2026-06-20T10:00:00.000Z'),
      state: {
        status: 'executed',
        txId,
        context: { title: 'Reserve aurora.dusk', description: '', fields: [] },
        call: { contract: 'core', functionName: 'commit_runtime' },
      },
    })).toBe(true)

    const log = parseBrowserWriteProofLog(storage.getItem(DUSK_NAMES_WRITE_PROOF_STORAGE_KEY))
    const record = findBrowserWriteProofRecord(log, {
      chainId: 'dusk:3',
      name: 'aurora.dusk',
      account: '244Sywxj7Proof',
    })

    expect(record).toMatchObject({
      chainId: 'dusk:3',
      name: 'aurora.dusk',
      account: '244Sywxj7Proof',
      provider: 'Dusk Wallet',
      updatedAt: '2026-06-20T10:00:00.000Z',
    })
    expect(browserWriteProofTransactionsByKind(record)).toEqual({
      commit: txId,
    })
  })

  it('ignores failed, unknown, and placeholder transaction states', () => {
    const storage = new MemoryStorage()
    const base = {
      chainId: 'dusk:3',
      name: 'aurora.dusk',
      account: '244Sywxj7Proof',
      storage,
    }

    expect(recordBrowserWriteProof({
      ...base,
      state: {
        status: 'failed',
        txId: `0x${'11'.repeat(32)}`,
        context: { title: 'Reserve aurora.dusk', description: '', fields: [] },
        call: { contract: 'core', functionName: 'commit_runtime' },
      },
    })).toBe(false)
    expect(recordBrowserWriteProof({
      ...base,
      state: {
        status: 'executed',
        txId: 'installed-wallet-smoke',
        context: { title: 'Reserve aurora.dusk', description: '', fields: [] },
        call: { contract: 'core', functionName: 'commit_runtime' },
      },
    })).toBe(false)
    expect(recordBrowserWriteProof({
      ...base,
      state: {
        status: 'executed',
        txId: `0x${'22'.repeat(32)}`,
        context: { title: 'Authorize', description: '', fields: [] },
        call: { contract: 'core', functionName: 'unknown_runtime' },
      },
    })).toBe(false)

    expect(storage.getItem(DUSK_NAMES_WRITE_PROOF_STORAGE_KEY)).toBeNull()
  })

  it('keeps the latest transaction for each proof kind', () => {
    const storage = new MemoryStorage()
    for (const suffix of ['11', '22']) {
      recordBrowserWriteProof({
        chainId: 'dusk:3',
        name: 'aurora.dusk',
        account: '244Sywxj7Proof',
        storage,
        state: {
          status: 'executed',
          txId: `0x${suffix.repeat(32)}`,
          context: { title: 'Set address', description: '', fields: [] },
          call: { contract: 'core', functionName: 'mutate_records_sender_runtime' },
        },
      })
    }

    const record = findBrowserWriteProofRecord(parseBrowserWriteProofLog(
      storage.getItem(DUSK_NAMES_WRITE_PROOF_STORAGE_KEY),
    ), { name: 'aurora.dusk' })

    expect(record?.transactions).toHaveLength(1)
    expect(browserWriteProofTransactionsByKind(record)).toEqual({
      set_record: `0x${'22'.repeat(32)}`,
    })
  })

  it('records browser UI confirmations alongside transaction evidence', () => {
    const storage = new MemoryStorage()
    const base = {
      chainId: 'dusk:3',
      name: 'aurora.dusk',
      account: '244Sywxj7Proof',
      provider: 'Dusk Wallet',
      storage,
    }

    expect(recordBrowserWriteProof({
      ...base,
      now: () => new Date('2026-06-20T10:00:00.000Z'),
      state: {
        status: 'executed',
        txId: `0x${'11'.repeat(32)}`,
        context: { title: 'Reserve aurora.dusk', description: '', fields: [] },
        call: { contract: 'core', functionName: 'commit_runtime' },
      },
    })).toBe(true)
    expect(recordBrowserWriteProofUiConfirmation({
      ...base,
      kind: 'myNames',
      now: () => new Date('2026-06-20T10:01:00.000Z'),
      confirmation: {
        pendingReservationVisible: true,
        revealReadinessVisible: true,
        activeNameVisible: true,
        verifiedPrimaryVisible: true,
        pendingOrFailedTxStateVisible: true,
      },
    })).toBe(true)
    expect(recordBrowserWriteProofUiConfirmation({
      ...base,
      kind: 'reservationSearch',
      now: () => new Date('2026-06-20T10:02:00.000Z'),
      confirmation: {
        searchedReservedName: true,
        reservedByYouVisible: true,
        resumeRegistrationVisible: true,
        finishCtaVisible: true,
      },
    })).toBe(true)

    const record = findBrowserWriteProofRecord(parseBrowserWriteProofLog(
      storage.getItem(DUSK_NAMES_WRITE_PROOF_STORAGE_KEY),
    ), { name: 'aurora.dusk' })

    expect(record).toMatchObject({
      updatedAt: '2026-06-20T10:02:00.000Z',
      transactions: [
        { kind: 'commit', txId: `0x${'11'.repeat(32)}` },
      ],
      uiConfirmations: {
        myNames: {
          confirmedAt: '2026-06-20T10:01:00.000Z',
          pendingReservationVisible: true,
          verifiedPrimaryVisible: true,
        },
        reservationSearch: {
          confirmedAt: '2026-06-20T10:02:00.000Z',
          finishCtaVisible: true,
        },
      },
    })
  })

  it('mirrors the internal ledger to an optional capture endpoint without changing UI state', async () => {
    const calls: Array<{ url: unknown; init: RequestInit | undefined }> = []
    const fetcher = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url, init })
      return { ok: true } as Response
    }) as typeof fetch

    const ok = await captureBrowserWriteProofLog('http://127.0.0.1:8798/write-proof', {
      version: 1,
      records: [{
        chainId: 'dusk:3',
        name: 'aurora.dusk',
        account: '244Sywxj7Proof',
        provider: 'Dusk Wallet',
        updatedAt: '2026-06-20T10:00:00.000Z',
        transactions: [{
          kind: 'commit',
          txId: `0x${'11'.repeat(32)}`,
          status: 'executed',
          functionName: 'commit_runtime',
          recordedAt: '2026-06-20T10:00:00.000Z',
        }],
      }],
    }, fetcher)

    expect(ok).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      url: 'http://127.0.0.1:8798/write-proof',
      init: {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        keepalive: true,
      },
    })
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
      version: 1,
      records: [{ name: 'aurora.dusk' }],
    })
  })
})

class MemoryStorage {
  #values = new Map<string, string>()

  getItem(key: string) {
    return this.#values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.#values.set(key, value)
  }
}
