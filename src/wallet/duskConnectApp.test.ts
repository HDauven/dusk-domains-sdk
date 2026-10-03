import { describe, expect, it } from 'vitest'
import {
  createDuskDomainsConnectApp,
  type DuskDomainsContractCallParams,
  type DuskDomainsWriteContractCallParams,
} from '@duskdomains/sdk/connect-app'
import {
  DUSK_DOMAINS_CONTRACTS as presets,
  coreCompleteRegistrationRuntimeCall,
  coreGetNameCall,
  coreSetRecordSenderRuntimeCall,
  submitDuskDomainWrite,
} from '../writes'

const DUSK_DOMAINS_CONTRACTS = { ...presets, core: { ...presets.core, contractId: `0x${'11'.repeat(32)}` } }

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
    const directCalls: Array<DuskDomainsContractCallParams | DuskDomainsWriteContractCallParams> = []
    const app = createDuskDomainsConnectApp({
      chainId: 'dusk:3',
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
      contract: DUSK_DOMAINS_CONTRACTS.core,
      functionName: readCall.functionName,
      args: { node: readCall.args.node },
      decodedContext: {
        title: 'Read domain',
        description: 'Read domain state.',
        fields: [{ label: 'Node', value: readCall.args.node }],
      },
    })).resolves.toEqual({ name: { node: readCall.args.node } })

    expect(directCalls[0]).toMatchObject({
      contract: DUSK_DOMAINS_CONTRACTS.core,
      functionName: 'get_name',
    })
    expect(directCalls[0]).not.toHaveProperty('decodedContext')
    expect(directCalls[0]).not.toHaveProperty('display')

    await expect(submitDuskDomainWrite(app, writeCall, { contracts: DUSK_DOMAINS_CONTRACTS })).resolves.toMatchObject({
      status: 'executed',
      txId: 'tx-live',
    })
    expect(directCalls[1]).toMatchObject({
      contract: DUSK_DOMAINS_CONTRACTS.core,
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
    const app = createDuskDomainsConnectApp({
      chainId: 'dusk:3',
      async request(request) {
        requests.push(request)
        return { name: null }
      },
    })

    await expect(app.readContract({
      contract: DUSK_DOMAINS_CONTRACTS.core,
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
      contractId: DUSK_DOMAINS_CONTRACTS.core.contractId,
      fnName: 'set_record_sender_runtime',
      fnArgs: '0x1234',
      privacy: 'public',
    }
    const app = createDuskDomainsConnectApp({
      chainId: 'dusk:3',
      async request(request) {
        requests.push(request)
        if (request.method === 'dusk_prepareContractCall') return preparedCall
        return { hash: 'tx-send' }
      },
    })

    await expect(submitDuskDomainWrite(app, recordWriteCall(), { contracts: DUSK_DOMAINS_CONTRACTS })).resolves.toMatchObject({
      status: 'executed',
      txId: 'tx-send',
    })
    expect(requests.map((request) => request.method)).toEqual([
      'dusk_prepareContractCall',
      'dusk_sendTransaction',
    ])
    expect(requests[1].params).toMatchObject({
      kind: 'contract_call',
      contractId: DUSK_DOMAINS_CONTRACTS.core.contractId,
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
      contractId: DUSK_DOMAINS_CONTRACTS.core.contractId,
      fnName: 'complete_registration_runtime',
      fnArgs: '0x1234',
      privacy: 'public',
    }
    const app = createDuskDomainsConnectApp({
      chainId: 'dusk:3',
      async request(request) {
        requests.push(request)
        if (request.method === 'dusk_prepareContractCall') return preparedCall
        return { hash: 'tx-send' }
      },
    })

    await expect(submitDuskDomainWrite(app, registrationWriteCall(), { contracts: DUSK_DOMAINS_CONTRACTS })).resolves.toMatchObject({
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
    const app = createDuskDomainsConnectApp({
      chainId: 'dusk:3',
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

    await expect(submitDuskDomainWrite(app, recordWriteCall(), { contracts: DUSK_DOMAINS_CONTRACTS })).resolves.toMatchObject({
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
    const app = createDuskDomainsConnectApp({
      chainId: 'dusk:3',
      async request() {
        return { hash: 'tx-send' }
      },
    })

    await expect(app.writeContract({
      contract: DUSK_DOMAINS_CONTRACTS.core,
      functionName: 'set_record_sender_runtime',
      decodedContext: {
        title: 'Update website',
        description: 'Update a public record.',
        fields: [],
      },
    })).rejects.toThrow('Prepared contract-call payload is required')
  })

  it('throws when no contract-call transport is available', async () => {
    const app = createDuskDomainsConnectApp({ chainId: 'dusk:3' })

    await expect(app.prepareContractCall({
      contract: DUSK_DOMAINS_CONTRACTS.core,
      functionName: 'set_record_sender_runtime',
    })).rejects.toThrow('does not expose contract-call methods')
  })
})

it('reflects the current transport chain identity for routing', () => {
  const transport = { chainId: 'dusk:3' }
  const app = createDuskDomainsConnectApp(transport)
  expect(app.chainId).toBe('dusk:3')
  transport.chainId = 'dusk:2'
  expect(app.chainId).toBe('dusk:2')
})

it('reflects Dusk Connect wallet state without falling back to a stale chain', () => {
  const transport = { chainId: 'dusk:3', state: { chainId: 'dusk:2' as string | null } }
  const app = createDuskDomainsConnectApp(transport)
  expect(app.chainId).toBe('dusk:2')
  transport.state.chainId = 'dusk:1'
  expect(app.chainId).toBe('dusk:1')
  transport.state.chainId = null
  expect(app.chainId).toBeUndefined()
})

it.each(['chain', 'target', 'unknown chain'])('rejects a changed %s at the request adapter boundary', async change => {
  const requests: string[] = []
  const transport = {
    chainId: 'dusk:3' as string | undefined,
    async request({ method }: { method: string }) {
      requests.push(method)
      return { contractId: DUSK_DOMAINS_CONTRACTS.core.contractId, fnName: 'commit_runtime', fnArgs: '0x1234' }
    },
  }
  const app = createDuskDomainsConnectApp(transport)
  const params = { contract: DUSK_DOMAINS_CONTRACTS.core, functionName: 'commit_runtime' }
  const preparedCall = await app.prepareContractCall(params)
  expect(preparedCall).toMatchObject({ chainId: 'dusk:3', contractId: params.contract.contractId })
  if (change === 'target') params.contract = { ...params.contract, contractId: `0x${'22'.repeat(32)}` }
  else transport.chainId = change === 'chain' ? 'dusk:2' : undefined
  await expect(app.writeContract({ ...params, preparedCall })).rejects.toThrow('changed after preparation')
  expect(requests).toEqual(['dusk_prepareContractCall'])
})

it('rejects a prepared request payload for a different contract', async () => {
  const requests: string[] = []
  const app = createDuskDomainsConnectApp({
    chainId: 'dusk:3',
    async request({ method }) {
      requests.push(method)
      return { contractId: `0x${'22'.repeat(32)}`, fnName: 'commit_runtime', fnArgs: '0x1234' }
    },
  })
  const params = { contract: DUSK_DOMAINS_CONTRACTS.core, functionName: 'commit_runtime' }
  const preparedCall = await app.prepareContractCall(params)
  await expect(app.writeContract({ ...params, preparedCall })).rejects.toThrow('does not match the target')
  expect(requests).toEqual(['dusk_prepareContractCall'])
})
