import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearDuskDomainRegistryCache,
  coreCommitRuntimeCall,
  coreClearPrimaryNameRuntimeCall,
  coreCreateSubnameRuntimeCall,
  corePruneSubnameRuntimeCall,
  coreRemoveSubnameRuntimeCall,
  coreTakeBackSubnamesRuntimeCall,
  coreGetNameCall,
  coreRegistrationPremiumCall,
  corePendingCommitmentCall,
  coreReadPrimaryNameCall,
  coreRenewRuntimeCall,
  DUSK_DOMAINS_CONTRACTS,
  prepareDuskDomainContractCall,
  readDuskDomainContract,
  registrationRegistry,
  toDuskDomainWireArgs,
  type DuskConnectAppLike,
  type DuskDomainContractMap,
  writeDuskDomainContract,
} from './calls'
import { contractIdFromOutput, routeDuskDomainCall } from './poolRouting'
import { createDuskDomainsConnectApp } from '../wallet/duskConnectApp'

const router = `0x${'c0'.repeat(32)}`
const olderRegistry = `0x${'11'.repeat(32)}`
const newestRegistry = `0x${'12'.repeat(32)}`
const heldNode = `0x${'07'.repeat(32)}`
const freeNode = `0x${'08'.repeat(32)}`
const endpointValue = '244Sywxj7PuMHpcPxemaXLcrY5rPgztra6H9Vz8cU1Ro5v23SxKTfVqr2yS7NXAXE1iq59ndn4aMZmYxuzu3Te3e9fokQKTUkYvFxYg2P2E8EEg1gWUbs3AFL2aNx62HQd7r'

const contracts: DuskDomainContractMap = {
  ...DUSK_DOMAINS_CONTRACTS,
  router: { ...DUSK_DOMAINS_CONTRACTS.router, contractId: router },
  core: { ...DUSK_DOMAINS_CONTRACTS.core, contractId: olderRegistry },
}

function bytes(hex: string) {
  return Array.from({ length: 32 }, (_, index) => Number.parseInt(hex.slice(2 + index * 2, 4 + index * 2), 16))
}

function poolApp() {
  const reads: string[] = []
  const targets: string[] = []
  const app: DuskConnectAppLike = {
      chainId: 'dusk:3',
    async readContract({ contract, functionName, args }) {
      reads.push(`${contract.contractId === router ? 'router' : contract.contractId}.${functionName}`)
      if (contract.contractId !== router) {
        targets.push(contract.contractId)
        return { fnName: functionName, output: null }
      }
      if (functionName === 'active_registry') return { fnName: functionName, output: bytes(newestRegistry) }
      if (functionName === 'locate_name') {
        const node = `0x${(args as { node: number[] }).node.map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
        return { fnName: functionName, output: node === heldNode ? bytes(olderRegistry) : null }
      }
      if (functionName === 'locate_primary') return { fnName: functionName, output: olderRegistry }
      throw new Error(`unexpected router call ${functionName}`)
    },
    async prepareContractCall({ contract }) {
      targets.push(contract.contractId)
      return {}
    },
    async writeContract() {
      return {}
    },
  }
  return { app, reads, targets }
}

describe('contract pool routing', () => {
  beforeEach(() => clearDuskDomainRegistryCache())

  it('sends name calls to the registry holding the name, locating it once', async () => {
    const { app, reads, targets } = poolApp()
    await readDuskDomainContract(app, coreGetNameCall({ node: heldNode }), contracts)
    await readDuskDomainContract(app, coreGetNameCall({ node: heldNode }), contracts)
    expect(targets).toEqual([olderRegistry, olderRegistry])
    expect(reads.filter((read) => read === 'router.locate_name')).toHaveLength(1)
  })

  it('sends commits and new registrations to the active registry', async () => {
    const { app, targets } = poolApp()
    await prepareDuskDomainContractCall(app, coreCommitRuntimeCall({ commitment: `0x${'31'.repeat(32)}` }), contracts)
    expect(targets).toEqual([newestRegistry])
    await expect(registrationRegistry(app, contracts, freeNode)).resolves.toBe(newestRegistry)
    // A released name comes back in the registry that still holds it.
    await expect(registrationRegistry(app, contracts, heldNode)).resolves.toBe(olderRegistry)
  })

  it('reads a pending commitment where its name registers when the name is given', async () => {
    const { app, targets } = poolApp()
    const pending = { controller: `0x${'09'.repeat(32)}`, commitment: `0x${'31'.repeat(32)}` }
    await readDuskDomainContract(app, corePendingCommitmentCall({ ...pending, node: heldNode }), contracts)
    await readDuskDomainContract(app, corePendingCommitmentCall({ ...pending, node: freeNode }), contracts)
    await readDuskDomainContract(app, corePendingCommitmentCall(pending), contracts)
    expect(targets).toEqual([olderRegistry, newestRegistry, newestRegistry])
    expect(toDuskDomainWireArgs(corePendingCommitmentCall({ ...pending, node: heldNode }))).not.toHaveProperty('node')
  })

  it('routes subnames by their parent and primary names by the router', async () => {
    const { app, targets } = poolApp()
    await prepareDuskDomainContractCall(app, coreCreateSubnameRuntimeCall({
      parentNode: heldNode,
      node: freeNode,
      parentName: 'aurora.dusk',
      name: 'pay.aurora.dusk',
      label: 'pay',
      owner: `0x${'09'.repeat(32)}`,
      manager: `0x${'09'.repeat(32)}`,
      expiresAt: 1_820_000_000,
      expiryPolicy: 'inherits_parent',
    }), contracts)
    await readDuskDomainContract(app, coreReadPrimaryNameCall({ endpointType: 'moonlight_address', endpointValue }), contracts)
    expect(targets).toEqual([olderRegistry, olderRegistry])
  })

  it('prepares primary clearing using only the endpoint, without reading name authority', async () => {
    const { app, targets, reads } = poolApp()
    const call = coreClearPrimaryNameRuntimeCall({ endpointType: 'moonlight_address', endpointValue })
    expect(Object.keys(toDuskDomainWireArgs(call))).toEqual(['endpoint'])
    await prepareDuskDomainContractCall(app, call, contracts)
    expect(targets).toEqual([olderRegistry])
    expect(reads).toEqual(['router.locate_primary'])
  })

  it('routes expired subname cleanup to the registry holding the subname', async () => {
    const { app, targets, reads } = poolApp()
    await prepareDuskDomainContractCall(app, corePruneSubnameRuntimeCall({ node: heldNode }), {
      ...contracts, core: { ...contracts.core, contractId: newestRegistry },
    })
    expect(targets).toEqual([olderRegistry])
    expect(reads).toContain('router.locate_name')
  })

  it('routes removal and batch take-back to the ancestor registry', async () => {
    const { app, targets } = poolApp()
    await prepareDuskDomainContractCall(app, coreRemoveSubnameRuntimeCall({ node: heldNode }), { ...contracts, core: { ...contracts.core, contractId: newestRegistry } })
    await prepareDuskDomainContractCall(app, coreTakeBackSubnamesRuntimeCall({ node: heldNode, nodes: [freeNode], owner: heldNode, manager: heldNode }), { ...contracts, core: { ...contracts.core, contractId: newestRegistry } })
    expect(targets).toEqual([olderRegistry, olderRegistry])
  })

  it('leaves explicit targets, other contracts and deployments without a router alone', async () => {
    const { app, reads } = poolApp()
    const pinned = { ...coreGetNameCall({ node: heldNode }), contractId: newestRegistry }
    await expect(routeDuskDomainCall(app, pinned, contracts)).resolves.toBe(pinned)
    const unrouted = coreGetNameCall({ node: heldNode })
    await expect(routeDuskDomainCall(app, unrouted, { ...contracts, router: DUSK_DOMAINS_CONTRACTS.router })).resolves.toBe(unrouted)
    await expect(registrationRegistry(app, { ...contracts, router: DUSK_DOMAINS_CONTRACTS.router }, freeNode)).resolves.toBeNull()
    expect(reads).toEqual([])
  })

  it('decodes router lookups and rejects malformed ones', () => {
    expect(contractIdFromOutput(null)).toBeNull()
    expect(contractIdFromOutput({ fnName: 'locate_name', output: null })).toBeNull()
    expect(contractIdFromOutput(bytes(olderRegistry))).toBe(olderRegistry)
    expect(contractIdFromOutput(olderRegistry.toUpperCase().replace('0X', ''))).toBe(olderRegistry)
    expect(() => contractIdFromOutput([1, 2, 3])).toThrow(/malformed/)
    expect(() => contractIdFromOutput('0x1234')).toThrow(/malformed/)
  })

  it('isolates renewal routes between clients after a failed read', async () => {
    const attackerRegistry = `0x${'66'.repeat(32)}`
    const poisonApp: DuskConnectAppLike = {
      chainId: 'dusk:3',
      async readContract({ contract }) {
        if (contract.contractId === router) return { output: bytes(attackerRegistry) }
        throw new Error('attacker-selected registry rejected the read')
      },
      async prepareContractCall() {
        return {}
      },
      async writeContract() {
        return {}
      },
    }

    // Even a failed read through one app instance seeds the process-global route.
    await expect(readDuskDomainContract(poisonApp, coreGetNameCall({ node: heldNode }), contracts))
      .rejects.toThrow('attacker-selected registry rejected the read')

    const routerReads: string[] = []
    const prepared: Array<{ contractId: string; deposit?: string }> = []
    const written: Array<{ contractId: string; deposit?: string }> = []
    const honestApp: DuskConnectAppLike = {
      chainId: 'dusk:3',
      async readContract({ contract, functionName }) {
        if (contract.contractId === router) {
          routerReads.push(functionName)
          return { output: bytes(olderRegistry) }
        }
        return { output: null }
      },
      async prepareContractCall({ contract, deposit }) {
        prepared.push({ contractId: contract.contractId, deposit })
        return {}
      },
      async writeContract({ contract, deposit }) {
        written.push({ contractId: contract.contractId, deposit })
        return {}
      },
    }

    const renewal = coreRenewRuntimeCall({
      node: heldNode,
      durationYears: 1,
      feeLux: 1_000_000_000,
    })
    const preparedCall = await prepareDuskDomainContractCall(honestApp, renewal, contracts)
    await writeDuskDomainContract(honestApp, renewal, preparedCall, contracts)

    expect(prepared).toEqual([{
      contractId: olderRegistry,
      deposit: '1000000000',
    }])
    expect(written).toEqual([{
      contractId: olderRegistry,
      deposit: '1000000000',
    }])
    expect(routerReads).toEqual(['locate_name'])
  })

  it('rejects sparse registry IDs without retaining a failed route', async () => {
    let routerReads = 0
    const app: DuskConnectAppLike = {
      chainId: 'dusk:3',
      async readContract({ contract }) {
        if (contract.contractId === router) {
          routerReads += 1
          return routerReads === 1
            ? { output: new Array<number>(32) }
            : { output: bytes(olderRegistry) }
        }
        return { output: null }
      },
      async prepareContractCall() {
        return {}
      },
      async writeContract() {
        return {}
      },
    }

    await expect(readDuskDomainContract(app, coreGetNameCall({ node: heldNode }), contracts))
      .rejects.toThrow()
    await expect(readDuskDomainContract(app, coreGetNameCall({ node: heldNode }), contracts))
      .resolves.toEqual({ output: null })
    expect(routerReads).toBe(2)
  })
})

describe('registry route cache lifetime', () => {
  beforeEach(() => clearDuskDomainRegistryCache())

  it.each(['read', 'prepare', 'write'] as const)('invalidates routes after a failed %s and does not cache lookups alone', async (operation) => {
    let registry = olderRegistry
    let fail = false
    let lookups = 0
    const run = async () => { if (fail) throw new Error('operation failed'); return {} }
    const app: DuskConnectAppLike = {
      chainId: 'dusk:3',
      async readContract({ contract }) {
        if (contract.contractId === router) { lookups++; return registry }
        return run()
      },
      prepareContractCall: run,
      writeContract: run,
    }
    const call = coreGetNameCall({ node: heldNode })
    await routeDuskDomainCall(app, call, contracts)
    await routeDuskDomainCall(app, call, contracts)
    expect(lookups).toBe(2)
    await readDuskDomainContract(app, call, contracts)
    expect(lookups).toBe(3)
    fail = true
    const invoke = operation === 'read' ? () => readDuskDomainContract(app, call, contracts)
      : operation === 'prepare' ? () => prepareDuskDomainContractCall(app, call, contracts)
        : () => writeDuskDomainContract(app, call, undefined, contracts)
    await expect(invoke()).rejects.toThrow('operation failed')
    fail = false
    registry = newestRegistry
    await expect(routeDuskDomainCall(app, call, contracts)).resolves.toMatchObject({ contractId: newestRegistry })
    expect(lookups).toBe(4)
  })

  it('keeps successful routes within their transport, chain and router', async () => {
    const { app, reads } = poolApp()
    let chainId: string | undefined = 'dusk:3'
    Object.defineProperty(app, 'chainId', { get: () => chainId })
    const call = coreGetNameCall({ node: heldNode })
    await readDuskDomainContract(app, call, contracts)
    await readDuskDomainContract(app, call, contracts)
    expect(reads.filter((call) => call === 'router.locate_name')).toHaveLength(1)
    const other = poolApp()
    await readDuskDomainContract(other.app, call, contracts)
    expect(other.reads).toContain('router.locate_name')
    chainId = 'dusk:2'
    await readDuskDomainContract(app, call, contracts)
    expect(reads.filter((call) => call === 'router.locate_name')).toHaveLength(2)
    chainId = undefined
    await readDuskDomainContract(app, call, contracts)
    await readDuskDomainContract(app, call, contracts)
    expect(reads.filter((call) => call === 'router.locate_name')).toHaveLength(4)
    // A different router in the same transport also needs its own locator read.
    const otherRouter = `0x${'ff'.repeat(32)}`
    chainId = 'dusk:3'
    app.readContract = async ({ contract }) => contract.contractId === otherRouter ? newestRegistry : null
    await expect(routeDuskDomainCall(app, call, { ...contracts, router: { ...contracts.router, contractId: otherRouter } })).resolves.toMatchObject({ contractId: newestRegistry })
  })

  it('bounds the cache and evicts its oldest successful route', async () => {
    let lookups = 0
    const app: DuskConnectAppLike = {
      chainId: 'dusk:3',
      async readContract({ contract }) { if (contract.contractId === router) { lookups++; return olderRegistry }; return null },
      async prepareContractCall() { return {} }, async writeContract() { return {} },
    }
    for (let i = 1; i <= 257; i++) {
      await readDuskDomainContract(app, coreGetNameCall({ node: `0x${i.toString(16).padStart(64, '0')}` }), contracts)
    }
    await readDuskDomainContract(app, coreGetNameCall({ node: `0x${'1'.padStart(64, '0')}` }), contracts)
    expect(lookups).toBe(258)
  })

  it.each([new Array(32), Object.assign(new Array(32), { 0: 1 }), Array(32).fill(1.5), Array(32).fill(-1), Array(32).fill(256), Array(32).fill('1'), Array(32).fill(0), `0x${'00'.repeat(32)}`])('rejects malformed or zero contract IDs %j', (id) => {
    expect(() => contractIdFromOutput(id)).toThrow('malformed contract ID')
  })
})

it('rejects a chain switch during a router lookup before preparing a deposit', async () => {
  let chainId = 'dusk:3'
  let prepared = false
  const app: DuskConnectAppLike = {
    get chainId() { return chainId },
    async readContract() { chainId = 'dusk:2'; return olderRegistry },
    async prepareContractCall() { prepared = true },
    async writeContract() {},
  }
  await expect(prepareDuskDomainContractCall(app, coreRenewRuntimeCall({ node: heldNode, durationYears: 1, feeLux: 1_000_000_000 }), contracts)).rejects.toThrow('chain changed')
  expect(prepared).toBe(false)
})

describe('prepared call routing', () => {
  it.each(['chain', 'target', 'chain and target'])('rejects a changed %s before submitting a prepared call', async change => {
    let chainId = 'dusk:3'
    let registry = olderRegistry
    const writeContract = vi.fn(async () => ({}))
    const app: DuskConnectAppLike = {
      get chainId() { return chainId },
      async readContract() { return registry },
      async prepareContractCall({ contract }) { return { contractId: contract.contractId } },
      writeContract,
    }
    const call = coreCommitRuntimeCall({ commitment: heldNode })
    const prepared = await prepareDuskDomainContractCall(app, call, contracts)
    expect(prepared).toMatchObject({ chainId: 'dusk:3', contractId: olderRegistry })
    if (change.includes('chain')) chainId = 'dusk:2'
    if (change.includes('target')) registry = newestRegistry
    await expect(writeDuskDomainContract(app, call, prepared, contracts)).rejects.toThrow('changed after preparation')
    expect(writeContract).not.toHaveBeenCalled()
  })

  it('never sends the old request payload after preparing a renewal on A and routing on B', async () => {
    let chainId = 'dusk:3'
    const request = vi.fn(async ({ method, params }: { method: string; params?: unknown }) => {
      if (method === 'dusk_readContract') return chainId === 'dusk:3' ? olderRegistry : newestRegistry
      if (method === 'dusk_prepareContractCall') return { contractId: (params as { contract: { contractId: string } }).contract.contractId, fnName: 'renew_runtime', fnArgs: '0x1234' }
      return { hash: 'tx' }
    })
    const app = createDuskDomainsConnectApp({ get chainId() { return chainId }, request })
    const call = coreRenewRuntimeCall({ node: heldNode, durationYears: 1, feeLux: 1_000_000_000 })
    const prepared = await prepareDuskDomainContractCall(app, call, contracts)
    expect(prepared).toMatchObject({ chainId: 'dusk:3', contractId: olderRegistry })
    chainId = 'dusk:2'
    await expect(writeDuskDomainContract(app, call, prepared, contracts)).rejects.toThrow('changed after preparation')
    expect(request.mock.calls.map(([call]) => call.method)).toEqual(['dusk_readContract', 'dusk_prepareContractCall', 'dusk_readContract'])
    const fresh = await prepareDuskDomainContractCall(app, call, contracts)
    await writeDuskDomainContract(app, call, fresh, contracts)
    expect(request.mock.calls.filter(([call]) => call.method === 'dusk_sendTransaction')).toEqual([
      [expect.objectContaining({ params: expect.objectContaining({ contractId: newestRegistry, deposit: '1000000000' }) })],
    ])
  })

  it('rejects a chain change while preparation is pending', async () => {
    let chainId = 'dusk:3'
    const { app } = poolApp()
    Object.defineProperty(app, 'chainId', { get: () => chainId })
    app.prepareContractCall = async () => { chainId = 'dusk:2'; return {} }
    await expect(prepareDuskDomainContractCall(app, coreCommitRuntimeCall({ commitment: heldNode }), contracts)).rejects.toThrow('chain changed during preparation')
  })

  it('rejects a chain switch at the routing boundary for an explicit target', async () => {
    let chainId = 'dusk:3'
    const { app } = poolApp()
    Object.defineProperty(app, 'chainId', { get: () => chainId })
    const prepare = vi.fn(async () => ({}))
    app.prepareContractCall = prepare
    const pending = prepareDuskDomainContractCall(app, { ...coreCommitRuntimeCall({ commitment: heldNode }), contractId: olderRegistry }, contracts)
    chainId = 'dusk:2'
    await expect(pending).rejects.toThrow('chain changed during registry routing')
    expect(prepare).not.toHaveBeenCalled()
  })

  it('refuses preparation without a chain identity', async () => {
    const { app } = poolApp()
    Object.defineProperty(app, 'chainId', { value: undefined })
    const prepare = vi.fn(async () => ({}))
    app.prepareContractCall = prepare
    await expect(prepareDuskDomainContractCall(app, coreCommitRuntimeCall({ commitment: heldNode }), contracts)).rejects.toThrow('requires the current wallet chain')
    expect(prepare).not.toHaveBeenCalled()
  })

  it('rejects unbound prepared payloads before reaching the transport', async () => {
    const { app } = poolApp()
    const write = vi.fn(async () => ({}))
    app.writeContract = write
    await expect(writeDuskDomainContract(app, coreCommitRuntimeCall({ commitment: heldNode }), {}, contracts)).rejects.toThrow('not bound')
    expect(write).not.toHaveBeenCalled()
  })
})

describe.each(['override', 'configured placeholder'])('zero contract ID: %s', source => {
  it.each(['read', 'prepare', 'write'] as const)('rejects before a live %s', async operation => {
    const run = vi.fn(async () => ({}))
    const app: DuskConnectAppLike = { chainId: 'dusk:3', readContract: run, prepareContractCall: run, writeContract: run }
    const renewal = coreRenewRuntimeCall({ node: heldNode, durationYears: 1, feeLux: 1_000_000_000 })
    const call = source === 'override' ? { ...renewal, contractId: `0x${'00'.repeat(32)}` } : renewal
    const invoke = operation === 'read' ? () => readDuskDomainContract(app, call)
      : operation === 'prepare' ? () => prepareDuskDomainContractCall(app, call)
        : () => writeDuskDomainContract(app, call)
    await expect(invoke()).rejects.toThrow('non-zero 32-byte hex contract ID')
    expect(run).not.toHaveBeenCalled()
  })
})

it('reads the premium from the registry retaining the dropped root', async () => {
  const { app, targets } = poolApp()
  await readDuskDomainContract(app, coreRegistrationPremiumCall({ node: heldNode }), {
    ...contracts, core: { ...contracts.core, contractId: newestRegistry },
  })
  expect(targets).toEqual([olderRegistry])
})
