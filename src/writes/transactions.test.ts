import { describe, expect, it } from 'vitest'
import {
  coreCompleteRegistrationRuntimeCall,
  coreSetRecordSenderRuntimeCall,
  type DuskConnectAppLike,
  type DuskDomainCallMetadata,
} from '../contracts/calls'
import { createPreviewDuskTxHandle, submitDuskDomainWrite, trackDuskDomainTransaction, type DuskDomainTxState } from './transactions'

const call = coreSetRecordSenderRuntimeCall({
  node: `0x${'08'.repeat(32)}`,
  record: {
    key: 'website',
    value: 'https://dusk.domains',
    visibility: 'public',
    updatedAt: '2026-06-17T00:00:00.000Z',
    ttlSeconds: 3600,
  },
})

describe('Dusk Domains transaction lifecycle helpers', () => {
  it('prepares, writes, and tracks a Dusk Connect style transaction handle', async () => {
    const updates: DuskDomainTxState[] = []
    const app: DuskConnectAppLike = {
      async readContract() {
        throw new Error('unused')
      },
      async prepareContractCall(params) {
        return { ...params, prepared: true }
      },
      async writeContract(params) {
        expect(params.preparedCall).toMatchObject({ prepared: true })
        expect(params.decodedContext).toMatchObject({ title: 'Update website' })
        return createPreviewDuskTxHandle({ txId: 'tx-preview-1', delayMs: 0 })
      },
    }

    await expect(submitDuskDomainWrite(app, call, { onUpdate: (state) => updates.push(state) })).resolves.toMatchObject({
      status: 'executed',
      txId: 'tx-preview-1',
    })

    expect(updates.map((state) => state.status)).toEqual([
      'preparing',
      'awaiting_approval',
      'submitted',
      'executed',
    ])
    expect(updates.map((state) => state.call)).toEqual([
      { contract: 'core', functionName: 'set_record_sender_runtime' },
      { contract: 'core', functionName: 'set_record_sender_runtime' },
      { contract: 'core', functionName: 'set_record_sender_runtime' },
      { contract: 'core', functionName: 'set_record_sender_runtime' },
    ])
  })

  it('passes registration deposits through prepare and write calls', async () => {
    const paidCall = coreCompleteRegistrationRuntimeCall({
      commitment: `0x${'31'.repeat(32)}`,
      secret: `0x${'03'.repeat(32)}`,
      node: `0x${'07'.repeat(32)}`,
      label: 'aurora',
      durationYears: 1,
      feeLux: 50_000_000_000,
      records: [],
      primaryEndpoint: null,
    })
    const deposits: Array<string | undefined> = []
    const app: DuskConnectAppLike = {
      async readContract() {
        throw new Error('unused')
      },
      async prepareContractCall(params) {
        deposits.push(params.deposit)
        return { ...params, prepared: true }
      },
      async writeContract(params) {
        deposits.push(params.deposit)
        expect(params.preparedCall).toMatchObject({ prepared: true })
        return createPreviewDuskTxHandle({ txId: 'tx-paid-1', delayMs: 0 })
      },
    }

    await expect(submitDuskDomainWrite(app, paidCall)).resolves.toMatchObject({
      status: 'executed',
      txId: 'tx-paid-1',
    })
    expect(deposits).toEqual(['50000000000', '50000000000'])
  })

  it('blocks legacy actor-bound writes by default before wallet preparation', async () => {
    const updates: DuskDomainTxState[] = []
    let prepared = false
    let written = false
    const app: DuskConnectAppLike = {
      async readContract() {
        throw new Error('unused')
      },
      async prepareContractCall() {
        prepared = true
        return { prepared: true }
      },
      async writeContract() {
        written = true
        return createPreviewDuskTxHandle({ txId: 'tx-unsafe', delayMs: 0 })
      },
    }
    const unsafeCall: DuskDomainCallMetadata = {
      contract: 'core',
      functionName: 'set_record',
      kind: 'write',
      args: { node: `0x${'08'.repeat(32)}` },
    }

    await expect(submitDuskDomainWrite(app, unsafeCall, { onUpdate: (state) => updates.push(state) })).resolves.toMatchObject({
      status: 'failed',
      message: 'This action cannot be submitted safely from the browser yet.',
    })

    expect(prepared).toBe(false)
    expect(written).toBe(false)
    expect(updates.map((state) => state.status)).toEqual(['preparing', 'failed'])
  })

  it('rejects caller-mislabeled runtime-bound calls by default before wallet preparation', async () => {
    const updates: DuskDomainTxState[] = []
    let prepared = false
    const app: DuskConnectAppLike = {
      async readContract() {
        throw new Error('unused')
      },
      async prepareContractCall() {
        prepared = true
        return { prepared: true }
      },
      async writeContract() {
        throw new Error('unused')
      },
    }
    const mislabeledCall: DuskDomainCallMetadata = {
      contract: 'core',
      functionName: 'init',
      kind: 'read',
      args: {},
    }

    await expect(submitDuskDomainWrite(app, mislabeledCall, { onUpdate: (state) => updates.push(state) })).resolves.toMatchObject({
      status: 'failed',
      message: 'This action cannot be submitted safely from the browser yet.',
    })

    expect(prepared).toBe(false)
    expect(updates.map((state) => state.status)).toEqual(['preparing', 'failed'])
  })

  it('requires an explicit unsafe preview opt-out before submitting non-runtime debug calls', async () => {
    let prepared = false
    let written = false
    const app: DuskConnectAppLike = {
      async readContract() {
        throw new Error('unused')
      },
      async prepareContractCall(params) {
        prepared = true
        return { ...params, prepared: true }
      },
      async writeContract() {
        written = true
        return createPreviewDuskTxHandle({ txId: 'tx-debug-unsafe', delayMs: 0 })
      },
    }
    const unsafeCall: DuskDomainCallMetadata = {
      contract: 'core',
      functionName: 'set_record',
      kind: 'write',
      args: { node: `0x${'08'.repeat(32)}` },
    }

    await expect(submitDuskDomainWrite(app, unsafeCall, {
      allowUnsafePreviewCall: true,
    })).resolves.toMatchObject({
      status: 'executed',
      txId: 'tx-debug-unsafe',
    })

    expect(prepared).toBe(true)
    expect(written).toBe(true)
  })

  it('maps rejected handles to rejected state', async () => {
    const updates: DuskDomainTxState[] = []
    const context = { title: 'Register aurora.dusk', description: 'Preview', fields: [] }

    await expect(
      trackDuskDomainTransaction(
        createPreviewDuskTxHandle({
          txId: 'tx-preview-2',
          delayMs: 0,
          finalStatus: 'rejected',
        }),
        context,
        { onUpdate: (state) => updates.push(state) },
      ),
    ).resolves.toMatchObject({
      status: 'rejected',
      txId: 'tx-preview-2',
    })

    expect(updates.map((state) => state.status)).toEqual(['submitted', 'rejected'])
  })

  it('maps direct wallet submission errors to a terminal failed state', async () => {
    const updates: DuskDomainTxState[] = []
    const app: DuskConnectAppLike = {
      async readContract() {
        throw new Error('unused')
      },
      async prepareContractCall(params) {
        return { ...params, prepared: true }
      },
      async writeContract() {
        throw new Error('This local wallet is read-only. Use a transaction-capable Dusk wallet or the trusted local write bridge to update deployed state.')
      },
    }

    await expect(submitDuskDomainWrite(app, call, { onUpdate: (state) => updates.push(state) })).resolves.toMatchObject({
      status: 'failed',
      message: 'This local wallet is read-only. Use a transaction-capable Dusk wallet or the trusted local write bridge to update deployed state.',
    })

    expect(updates.map((state) => state.status)).toEqual([
      'preparing',
      'awaiting_approval',
      'failed',
    ])
  })

  it('maps unsettled handles to timeout state when a timeout is configured', async () => {
    const updates: DuskDomainTxState[] = []
    const context = { title: 'Register aurora.dusk', description: 'Preview', fields: [] }

    await expect(
      trackDuskDomainTransaction(
        {
          id: 'tx-preview-3',
          status: 'submitted',
          wait: () => new Promise<never>(() => {}),
        },
        context,
        {
          timeoutMs: 1,
          onUpdate: (state) => updates.push(state),
        },
      ),
    ).resolves.toMatchObject({
      status: 'timeout',
      txId: 'tx-preview-3',
    })

    expect(updates.map((state) => state.status)).toEqual(['submitted', 'timeout'])
  })

  it('tracks Dusk Connect onStatus handles without duplicate submitted updates', async () => {
    const updates: DuskDomainTxState[] = []
    const context = { title: 'Register aurora.dusk', description: 'Preview', fields: [] }
    const statusHandlers = new Set<(status: unknown) => void>()

    await expect(
      trackDuskDomainTransaction(
        {
          hash: 'tx-connect-1',
          status: 'submitted',
          onStatus(handler) {
            statusHandlers.add(handler)
            handler({ status: 'submitted', hash: 'tx-connect-1' })
            handler({ status: 'executing', hash: 'tx-connect-1' })
            return () => statusHandlers.delete(handler)
          },
          waitExecuted: async () => ({ hash: 'tx-connect-1', status: 'executed' }),
        },
        context,
        { onUpdate: (state) => updates.push(state) },
      ),
    ).resolves.toMatchObject({
      status: 'executed',
      txId: 'tx-connect-1',
    })

    expect(updates.map((state) => state.status)).toEqual(['submitted', 'executing', 'executed'])
    expect(statusHandlers.size).toBe(0)
  })

  it('does not poll when the wallet returns an already executed result', async () => {
    const updates: DuskDomainTxState[] = []
    const context = { title: 'Reserve name', description: 'Preview', fields: [] }
    let waited = false

    await expect(
      trackDuskDomainTransaction(
        {
          hash: 'tx-already-executed',
          status: 'executed',
          waitExecuted: async () => {
            waited = true
            return { hash: 'tx-already-executed', status: 'executed' }
          },
        },
        context,
        { onUpdate: (state) => updates.push(state) },
      ),
    ).resolves.toMatchObject({
      status: 'executed',
      txId: 'tx-already-executed',
    })

    expect(waited).toBe(false)
    expect(updates.map((state) => state.status)).toEqual(['executed'])
  })

  it('keeps failed Dusk Connect receipts as a terminal failed state', async () => {
    const updates: DuskDomainTxState[] = []
    const context = { title: 'Register aurora.dusk', description: 'Preview', fields: [] }

    await expect(
      trackDuskDomainTransaction(
        {
          hash: 'tx-connect-failed',
          status: 'submitted',
          onStatus(handler) {
            handler({ status: 'submitted', hash: 'tx-connect-failed' })
            handler({ status: 'executing', hash: 'tx-connect-failed' })
          },
          waitExecuted: async () => ({
            hash: 'tx-connect-failed',
            status: 'failed',
            ok: false,
            error: 'DuskDomains: reveal too early',
          }),
        },
        context,
        { onUpdate: (state) => updates.push(state) },
      ),
    ).resolves.toMatchObject({
      status: 'failed',
      txId: 'tx-connect-failed',
      message: 'DuskDomains: reveal too early',
    })

    expect(updates.map((state) => state.status)).toEqual(['submitted', 'executing', 'failed'])
  })

  it('uses status-update hashes when a wallet handle does not expose one up front', async () => {
    const updates: DuskDomainTxState[] = []
    const context = { title: 'Register aurora.dusk', description: 'Preview', fields: [] }

    await expect(
      trackDuskDomainTransaction(
        {
          status: 'submitted',
          onStatus(handler) {
            handler({ status: 'submitted', hash: 'tx-status-only' })
            handler({ status: 'executing', hash: 'tx-status-only' })
          },
          waitExecuted: async () => ({ status: 'executed' }),
        },
        context,
        { onUpdate: (state) => updates.push(state) },
      ),
    ).resolves.toMatchObject({
      status: 'executed',
      txId: 'tx-status-only',
    })

    expect(updates.at(-1)).toMatchObject({
      status: 'executed',
      txId: 'tx-status-only',
    })
  })
})
