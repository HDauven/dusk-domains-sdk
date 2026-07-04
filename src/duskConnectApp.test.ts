import { describe, expect, it } from 'vitest'
import {
  createDuskNamesConnectApp,
  DUSK_NAME_CONTRACTS,
  coreCompleteRegistrationRuntimeCall,
  coreGetNameCall,
  coreSetRecordSenderRuntimeCall,
  submitDuskNameWrite,
  type DuskNamesContractCallParams,
  type DuskNamesWriteContractCallParams,
} from './writes'

describe('Dusk Domains live Dusk Connect app adapter', () => {
  const node = `0x${'18'.repeat(32)}`

  function recordWriteCall() {
    return coreSetRecordSenderRuntimeCall({
      node,
      record: {
        key: 'website',
        value: 'https://dusk.domains',
        visibility: 'public',
        updatedAt: '2026-06-17T00:00:00.000Z',
        ttlSeconds: 3600,
      },
    })
  }

  function registrationWriteCall() {
    return coreCompleteRegistrationRuntimeCall({
      commitment: `0x${'31'.repeat(32)}`,
      secret: `0x${'03'.repeat(32)}`,
      node: `0x${'07'.repeat(32)}`,
      label: 'aurora',
      durationYears: 1,
      feeLux: 50_000_000_000,
      records: [],
      primaryEndpoint: null,
    })
  }

  it('forwards direct read, prepare, and write contract calls with wallet display context', async () => {
    const prepared = { prepared: true }
    const directCalls: Array<DuskNamesContractCallParams | DuskNamesWriteContractCallParams> = []
    const app = createDuskNamesConnectApp({
      async readContract(params) {
        directCalls.push(params)
        return { name: params.args }
      },
      async prepareContractCall(params) {
        directCalls.push(params)
        return prepared
      },
      async writeContract(params) {
        directCalls.push(params)
        return { hash: 'tx-live' }
      },
    })
    const readCall = coreGetNameCall({ node })
    const writeCall = recordWriteCall()

    await expect(app.readContract({
      contract: DUSK_NAME_CONTRACTS.core,
      functionName: readCall.functionName,
      args: { node: readCall.args.node },
      decodedContext: {
        title: 'Read domain',
        description: 'Read domain state.',
        fields: [{ label: 'Node', value: readCall.args.node }],
      },
    })).resolves.toEqual({ name: { node: readCall.args.node } })

    expect(directCalls[0]).toMatchObject({
      contract: DUSK_NAME_CONTRACTS.core,
      functionName: 'get_name',
    })
    expect(directCalls[0]).not.toHaveProperty('decodedContext')
    expect(directCalls[0]).not.toHaveProperty('display')

    await expect(submitDuskNameWrite(app, writeCall)).resolves.toMatchObject({
      status: 'executed',
      txId: 'tx-live',
    })
    expect(directCalls[1]).toMatchObject({
      contract: DUSK_NAME_CONTRACTS.core,
      functionName: 'set_record_sender_runtime',
      privacy: 'public',
      display: {
        title: 'Update website',
      },
    })
    expect(directCalls[2]).toMatchObject({
      display: {
        title: 'Update website',
      },
    })
    expect(directCalls[1]).not.toHaveProperty('decodedContext')
    expect(directCalls[2]).not.toHaveProperty('decodedContext')
  })

  it('strips internal context from read request fallbacks', async () => {
    const requests: Array<{ method: string; params?: unknown }> = []
    const app = createDuskNamesConnectApp({
      async request(request) {
        requests.push(request)
        return { name: null }
      },
    })

    await expect(app.readContract({
      contract: DUSK_NAME_CONTRACTS.core,
      functionName: 'get_name',
      args: { node },
      decodedContext: {
        title: 'Read domain',
        description: 'Read domain state.',
        fields: [],
      },
    })).resolves.toEqual({ name: null })

    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({
      method: 'dusk_readContract',
      params: {
        functionName: 'get_name',
      },
    })
    expect(requests[0].params).not.toHaveProperty('decodedContext')
    expect(requests[0].params).not.toHaveProperty('display')
  })

  it('uses Dusk request fallback method names by default', async () => {
    const requests: Array<{ method: string; params?: unknown }> = []
    const preparedCall = {
      contractId: DUSK_NAME_CONTRACTS.core.contractId,
      fnName: 'set_record_sender_runtime',
      fnArgs: '0x1234',
      privacy: 'public',
    }
    const app = createDuskNamesConnectApp({
      async request(request) {
        requests.push(request)
        if (request.method === 'dusk_prepareContractCall') return preparedCall
        return { hash: 'tx-send' }
      },
    })

    await expect(submitDuskNameWrite(app, recordWriteCall())).resolves.toMatchObject({
      status: 'executed',
      txId: 'tx-send',
    })
    expect(requests.map((request) => request.method)).toEqual([
      'dusk_prepareContractCall',
      'dusk_sendTransaction',
    ])
    expect(requests[1].params).toMatchObject({
      kind: 'contract_call',
      contractId: DUSK_NAME_CONTRACTS.core.contractId,
      fnName: 'set_record_sender_runtime',
      fnArgs: '0x1234',
      privacy: 'public',
      display: {
        title: 'Update website',
      },
    })
    expect(requests[1].params).not.toHaveProperty('preparedCall')
    expect(requests[1].params).not.toHaveProperty('functionName')
    expect(requests[1].params).not.toHaveProperty('decodedContext')
  })

  it('preserves contract-call deposits through Dusk request fallback submission', async () => {
    const requests: Array<{ method: string; params?: unknown }> = []
    const preparedCall = {
      contractId: DUSK_NAME_CONTRACTS.core.contractId,
      fnName: 'complete_registration_runtime',
      fnArgs: '0x1234',
      privacy: 'public',
    }
    const app = createDuskNamesConnectApp({
      async request(request) {
        requests.push(request)
        if (request.method === 'dusk_prepareContractCall') return preparedCall
        return { hash: 'tx-send' }
      },
    })

    await expect(submitDuskNameWrite(app, registrationWriteCall())).resolves.toMatchObject({
      status: 'executed',
      txId: 'tx-send',
    })
    expect(requests[0].params).toMatchObject({
      functionName: 'complete_registration_runtime',
      deposit: '50000000000',
    })
    expect(requests[1].params).toMatchObject({
      kind: 'contract_call',
      fnName: 'complete_registration_runtime',
      deposit: '50000000000',
    })
  })

  it('uses configurable request method names when direct methods are absent', async () => {
    const requests: Array<{ method: string; params?: unknown }> = []
    const app = createDuskNamesConnectApp({
      async request(request) {
        requests.push(request)
        if (request.method === 'names_prepare') return { id: 'prepared-call' }
        return { transactionHash: 'tx-request' }
      },
    }, {
      requestMethods: {
        prepareContractCall: 'names_prepare',
        writeContract: 'names_write',
      },
    })

    await expect(submitDuskNameWrite(app, recordWriteCall())).resolves.toMatchObject({
      status: 'executed',
      txId: 'tx-request',
    })
    expect(requests.map((request) => request.method)).toEqual(['names_prepare', 'names_write'])
    expect(requests[1].params).toMatchObject({
      preparedCall: { id: 'prepared-call' },
      functionName: 'set_record_sender_runtime',
      privacy: 'public',
      display: {
        title: 'Update website',
      },
    })
    expect(requests[1].params).not.toHaveProperty('decodedContext')
  })

  it('requires a prepared call for default dusk_sendTransaction writes', async () => {
    const app = createDuskNamesConnectApp({
      async request() {
        return { hash: 'tx-send' }
      },
    })

    await expect(app.writeContract({
      contract: DUSK_NAME_CONTRACTS.core,
      functionName: 'set_record_sender_runtime',
      decodedContext: {
        title: 'Update website',
        description: 'Update a public record.',
        fields: [],
      },
    })).rejects.toThrow('Prepared contract-call payload is required')
  })

  it('throws when no contract-call transport is available', async () => {
    const app = createDuskNamesConnectApp({})

    await expect(app.prepareContractCall({
      contract: DUSK_NAME_CONTRACTS.core,
      functionName: 'set_record_sender_runtime',
    })).rejects.toThrow('does not expose contract-call methods')
  })
})
