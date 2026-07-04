import { describe, expect, it } from 'vitest'
import {
  waitForConfirmedIndexerRefresh,
  waitForIndexerConfirmation,
} from './liveConfirmation'

describe('waitForIndexerConfirmation', () => {
  it('returns as soon as the indexer condition is true', async () => {
    let calls = 0

    const result = await waitForIndexerConfirmation({
      description: 'record update',
      attempts: 3,
      delayMs: 0,
      check: async () => {
        calls += 1
        return true
      },
    })

    expect(result).toEqual({
      confirmed: true,
      attempts: 1,
      description: 'record update',
      error: null,
    })
    expect(calls).toBe(1)
  })

  it('retries until the indexer catches up', async () => {
    let calls = 0

    const result = await waitForIndexerConfirmation({
      description: 'primary name',
      attempts: 4,
      delayMs: 1,
      wait: async () => undefined,
      check: async () => {
        calls += 1
        return calls === 3
      },
    })

    expect(result.confirmed).toBe(true)
    expect(result.attempts).toBe(3)
    expect(calls).toBe(3)
  })

  it('reports an unconfirmed write after all attempts are exhausted', async () => {
    const result = await waitForIndexerConfirmation({
      description: 'registration',
      attempts: 2,
      delayMs: 0,
      check: async () => false,
    })

    expect(result).toMatchObject({
      confirmed: false,
      attempts: 2,
      description: 'registration',
      error: null,
    })
  })

  it('preserves the last indexer error when confirmation never succeeds', async () => {
    let calls = 0

    const result = await waitForIndexerConfirmation({
      description: 'subname',
      attempts: 2,
      delayMs: 0,
      check: async () => {
        calls += 1
        throw new Error(`indexer ${calls}`)
      },
    })

    expect(result).toMatchObject({
      confirmed: false,
      attempts: 2,
      description: 'subname',
      error: 'indexer 2',
    })
  })

  it('requires a successful canonical refresh after indexer confirmation', async () => {
    const result = await waitForConfirmedIndexerRefresh({
      description: 'record update',
      attempts: 2,
      delayMs: 0,
      check: async () => true,
      refresh: async () => true,
    })

    expect(result).toMatchObject({
      confirmed: true,
      indexerConfirmed: true,
      refreshed: true,
      attempts: 1,
      error: null,
    })
  })

  it('does not report final confirmation when the refresh fails', async () => {
    const result = await waitForConfirmedIndexerRefresh({
      description: 'primary name',
      attempts: 2,
      delayMs: 0,
      check: async () => true,
      refresh: async () => false,
    })

    expect(result).toMatchObject({
      confirmed: false,
      indexerConfirmed: true,
      refreshed: false,
      attempts: 1,
      error: null,
    })
  })

  it('preserves refresh errors after indexer confirmation', async () => {
    const result = await waitForConfirmedIndexerRefresh({
      description: 'subname',
      attempts: 2,
      delayMs: 0,
      check: async () => true,
      refresh: async () => {
        throw new Error('refresh failed')
      },
    })

    expect(result).toMatchObject({
      confirmed: false,
      indexerConfirmed: true,
      refreshed: false,
      attempts: 1,
      error: 'refresh failed',
    })
  })

  it('skips refresh when the indexer never confirms the write', async () => {
    let refreshes = 0
    const result = await waitForConfirmedIndexerRefresh({
      description: 'registration',
      attempts: 2,
      delayMs: 0,
      check: async () => false,
      refresh: async () => {
        refreshes += 1
        return true
      },
    })

    expect(result).toMatchObject({
      confirmed: false,
      indexerConfirmed: false,
      refreshed: false,
      attempts: 2,
      error: null,
    })
    expect(refreshes).toBe(0)
  })
})
