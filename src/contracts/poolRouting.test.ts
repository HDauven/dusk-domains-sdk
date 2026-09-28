import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearDuskDomainRegistryCache,
  coreCommitRuntimeCall,
  coreCreateSubnameRuntimeCall,
  coreGetNameCall,
  coreReadPrimaryNameCall,
  DUSK_DOMAINS_CONTRACTS,
  prepareDuskDomainContractCall,
  readDuskDomainContract,
  registrationRegistry,
  type DuskConnectAppLike,
  type DuskDomainContractMap,
} from './calls'
import { contractIdFromOutput, routeDuskDomainCall } from './poolRouting'

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
      revocationPolicy: 'parent_revocable',
    }), contracts)
    await readDuskDomainContract(app, coreReadPrimaryNameCall({ endpointType: 'moonlight_address', endpointValue }), contracts)
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
})
