import { expect, it, vi } from 'vitest'
import { checkPublicBalanceForWrite } from '../src/writes/balance.ts'
import { createDuskDomainsConnectApp } from '../src/wallet/duskConnectApp.ts'
import { buildCall } from '../src/frozen/calls.ts'
import {
  trackDuskDomainTransaction,
  submitDuskDomainWrite,
  isDuskDomainTxBusy,
} from '../src/writes/transactions.ts'
import {
  waitForIndexerConfirmation,
  waitForIndexerWrite,
} from '../src/writes/liveConfirmation.ts'
import { createDuskDomainsIndexerClient } from '../src/indexer/client.ts'
import { stringifyJson } from '../src/frozen/json.ts'
import { bytes, id, release } from './helpers.ts'
it.each([
  ['119', false],
  ['120', true],
  ['121', true],
  ['invalid', false],
  [null, false],
])('checks balance %s against deposit plus gas', (balanceLux, ok) =>
  expect(
    checkPublicBalanceForWrite({
      balanceLux,
      depositLux: '100',
      gasLimit: 10n,
      gasPrice: 2n,
    }),
  ).toMatchObject({ ok, requiredLux: 120n }),
)
it.each(['0', 'invalid', null])(
  'prevents wallet submit for unusable balance %s',
  async (value) => {
    const calls: string[] = [],
      app = createDuskDomainsConnectApp(
        {
          request: async (method) => {
            calls.push(method)
            return method === 'dusk_chainId'
              ? 'dusk:1'
              : method === 'dusk_getPublicBalance'
                ? { value }
                : { median: '1' }
          },
        },
        await release(),
      )
    await expect(
      app.submit(buildCall('store', id(4), 'commit', { hash: bytes(3) })),
    ).rejects.toThrow()
    expect(calls).not.toContain('dusk_sendTransaction')
  },
)
it('checks chain again after balance and never sends across a switch', async () => {
  let checks = 0
  const send = vi.fn(),
    app = createDuskDomainsConnectApp(
      {
        request: async (method) => {
          if (method === 'dusk_chainId')
            return ++checks < 4 ? 'dusk:1' : 'dusk:2'
          if (method === 'dusk_getPublicBalance')
            return { value: '18446744073709551615' }
          if (method === 'dusk_estimateGas') return { median: '1' }
          send()
          return { hash: 'tx' }
        },
      },
      await release(),
    )
  await expect(
    app.submit(buildCall('store', id(4), 'commit', { hash: bytes(3) })),
  ).rejects.toThrow('dusk:1')
  expect(send).not.toHaveBeenCalled()
})
const call = { contractId: id(4), functionName: 'commit' }
it('does not treat a submitted hash or unknown wait result as executed', async () => {
  expect((await trackDuskDomainTransaction({ hash: 'tx' }, call)).status).toBe(
    'submitted',
  )
  expect(
    (
      await trackDuskDomainTransaction(
        { hash: 'tx', wait: async () => ({ hash: 'tx' }) },
        call,
      )
    ).status,
  ).toBe('submitted')
})
it.each(['executed', 'failed', 'timeout', 'rejected'] as const)(
  'tracks explicit terminal state %s and unsubscribes',
  async (status) => {
    const unsubscribe = vi.fn(),
      onUpdate = vi.fn()
    const result = await trackDuskDomainTransaction(
      {
        hash: 'tx',
        onStatus: (callback) => {
          callback({ status: 'executing' })
          return unsubscribe
        },
        wait: async () => ({ status, hash: 'tx' }),
      },
      call,
      { onUpdate },
    )
    expect(result.status).toBe(status)
    expect(unsubscribe).toHaveBeenCalledOnce()
  },
)
it.each([
  { status: 'executed', ok: false },
  { status: 'executed', receipt: { error: 'revert' } },
  {
    status: 'executed',
    event: { payload: new TextEncoder().encode('{"err":"revert"}') },
  },
])('detects reverted Connect receipt %#', async (result) =>
  expect(
    (
      await trackDuskDomainTransaction(
        { hash: 'tx', wait: async () => result },
        call,
      )
    ).status,
  ).toBe('failed'),
)
it('retains subscription failure over a later nominal success', async () => {
  const result = await trackDuskDomainTransaction(
    {
      hash: 'tx',
      onStatus: (callback) => {
        callback({ status: 'failed' })
      },
      wait: async () => ({ status: 'executed' }),
    },
    call,
  )
  expect(result.status).toBe('failed')
})
it('times out a stalled execution and cleans up observers', async () => {
  const unsubscribe = vi.fn()
  expect(
    (
      await trackDuskDomainTransaction(
        {
          hash: 'tx',
          onStatus: () => unsubscribe,
          wait: async () => new Promise(() => {}),
        },
        call,
        { timeoutMs: 5 },
      )
    ).status,
  ).toBe('timeout')
  expect(unsubscribe).toHaveBeenCalledOnce()
})
it('submit exposes preparing/approval/submitted states and structured wallet rejection', async () => {
  const updates: string[] = [],
    action = buildCall('store', id(4), 'commit', { hash: bytes(3) })
  const app = {
    prepare: async () => ({}) as never,
    submit: async () => ({ hash: 'tx' }),
  }
  expect(
    (
      await submitDuskDomainWrite(app, action, {
        onUpdate: (s) => updates.push(s.status),
      })
    ).status,
  ).toBe('submitted')
  expect(updates).toEqual(['preparing', 'awaiting_approval', 'submitted'])
  app.submit = async () => {
    throw { code: 4001 }
  }
  expect((await submitDuskDomainWrite(app, action)).status).toBe('rejected')
})
it.each([
  'preparing',
  'awaiting_approval',
  'submitted',
  'executing',
  'executed',
  'failed',
  'rejected',
  'timeout',
] as const)('classifies busy state %s', (status) =>
  expect(isDuskDomainTxBusy({ status, call })).toBe(
    ['preparing', 'awaiting_approval', 'submitted', 'executing'].includes(
      status,
    ),
  ),
)
it('waits for indexed state without extra sleeps after success', async () => {
  let count = 0
  const wait = vi.fn(async () => {})
  expect(
    await waitForIndexerConfirmation({
      check: async () => ++count === 3,
      attempts: 5,
      wait,
    }),
  ).toEqual({ confirmed: true, attempts: 3, error: null })
  expect(wait).toHaveBeenCalledTimes(2)
})
it('bounds failed polling and preserves the last transport error', async () => {
  const error = new Error('offline'),
    wait = vi.fn(async () => {})
  expect(
    await waitForIndexerConfirmation({
      check: async () => {
        throw error
      },
      attempts: 2,
      wait,
    }),
  ).toEqual({ confirmed: false, attempts: 2, error })
  expect(wait).toHaveBeenCalledOnce()
})
it('aborts indexer confirmation without calling check', async () => {
  const check = vi.fn()
  await expect(
    waitForIndexerConfirmation({
      check,
      signal: AbortSignal.abort(new Error('stop')),
    }),
  ).rejects.toThrow('stop')
  expect(check).not.toHaveBeenCalled()
})
it('waits for the exact transaction in the canonical projection and rejects reverts', async () => {
  let data: unknown = null
  const client = createDuskDomainsIndexerClient({
    baseUrl: 'https://indexer.invalid',
    chainId: 'dusk:1',
    directory: id(1),
    fetch: async () =>
      new Response(
        stringifyJson({
          apiVersion: 1,
          chainId: 'dusk:1',
          directory: id(1),
          snapshot: { height: 100n, blockHash: 'head' },
          data,
        }),
      ),
  })
  const check = vi.fn(async () => true)
  expect(
    (await waitForIndexerWrite(client, 'tx', { attempts: 1, check })).confirmed,
  ).toBe(false)
  expect(check).not.toHaveBeenCalled()
  data = { id: 'tx', height: 100n, blockHash: 'head', success: true }
  expect(
    (await waitForIndexerWrite(client, 'tx', { attempts: 1, check })).confirmed,
  ).toBe(true)
  data = { ...(data as object), success: false }
  expect(
    (await waitForIndexerWrite(client, 'tx', { attempts: 1 })).confirmed,
  ).toBe(false)
})
it('settles subscription-only handles and stops a hanging waiter on a terminal event', async () => {
  for (const wait of [undefined, async () => new Promise(() => {})]) {
    const unsubscribe = vi.fn()
    const state = await trackDuskDomainTransaction(
      {
        hash: 'tx',
        wait,
        onStatus: (callback) => {
          queueMicrotask(() => callback({ status: 'executed', hash: 'tx' }))
          return unsubscribe
        },
      },
      call,
      { timeoutMs: 100 },
    )
    expect(state.status).toBe('executed')
    expect(unsubscribe).toHaveBeenCalledOnce()
  }
})
it.each(['timeout', 'rejected'] as const)(
  'preserves explicit %s even when Connect reports ok:false',
  async (status) => {
    const result = await trackDuskDomainTransaction(
      { hash: 'tx', wait: async () => ({ status, ok: false, error: status }) },
      call,
    )
    expect(result.status).toBe(status)
  },
)
