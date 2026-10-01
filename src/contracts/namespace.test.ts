import { expect, it } from 'vitest'
import { coreUpdateAuthoritiesRuntimeCall, coreRemoveSubnameRuntimeCall, coreTakeBackSubnamesRuntimeCall, coreReassignSubnameRuntimeCall } from './callBuilders'
import { toDuskDomainWireArgs } from './callWireArgs'
import { isCoreTakeBackSubnamesRuntimeArgs, isCoreUpdateAuthoritiesRuntimeArgs } from './callArgGuards'

const node = `0x${'11'.repeat(32)}`
const owner = `0x${'22'.repeat(32)}`
it('builds and encodes namespace writes', () => {
  expect(coreReassignSubnameRuntimeCall({ node, owner, manager: owner }).functionName).toBe('update_authorities_runtime')
  expect(toDuskDomainWireArgs(coreRemoveSubnameRuntimeCall({ node }))).toEqual({ node: Array(32).fill(17) })
  expect(toDuskDomainWireArgs(coreTakeBackSubnamesRuntimeCall({ node, nodes: [owner], owner, manager: owner })))
    .toEqual({ node: Array(32).fill(17), nodes: [Array(32).fill(34)], owner: Array(32).fill(34), manager: Array(32).fill(34) })
})
it('bounds and deduplicates take-back calls before encoding', () => {
  for (const nodes of [[], [owner, owner], [owner, owner.slice(2)], Array(257).fill(owner)]) {
    const args = { node, nodes, owner, manager: owner }
    expect(isCoreTakeBackSubnamesRuntimeArgs(args)).toBe(false)
    expect(() => toDuskDomainWireArgs(coreTakeBackSubnamesRuntimeCall(args))).toThrow('1 to 256')
  }
  const nodes = Array.from({ length: 256 }, (_, i) => `0x${(i + 1).toString(16).padStart(64, '0')}`)
  expect(isCoreTakeBackSubnamesRuntimeArgs({ node, nodes, owner, manager: owner })).toBe(true)
})

it('validates namespace response bounds and authorities', async () => {
  const { isIndexedNamespace, isNamespaceSummary } = await import('../indexer/indexerClientGuards')
  const namespace = { descendantCount:0, heldByOthersCount:0, subnames:[], ancestors:[{node, name:'alice.dusk', owner, manager:owner, expiresAtBlockHeight:100}] }
  expect(isIndexedNamespace(namespace)).toBe(true)
  expect(isIndexedNamespace({...namespace,ancestors:[{...namespace.ancestors[0],expiresAtBlockHeight:'100'}]})).toBe(false)
  expect(isNamespaceSummary({descendantCount:2,heldByOthersCount:3})).toBe(false)
  expect(isNamespaceSummary({descendantCount:257,heldByOthersCount:0})).toBe(false)
  expect(isIndexedNamespace({...namespace,descendantCount:1})).toBe(false)
})


it.each([undefined, false, true])('encodes optional transfer reset %s with both authorities', clearRecords => {
  const args = { node, owner, manager: owner, ...(clearRecords === undefined ? {} : { clearRecords }) }
  expect(isCoreUpdateAuthoritiesRuntimeArgs(args)).toBe(true)
  expect(toDuskDomainWireArgs(coreUpdateAuthoritiesRuntimeCall(args))).toEqual({
    node: Array(32).fill(17), owner: Array(32).fill(34), manager: Array(32).fill(34),
    clear_records: clearRecords ?? false,
  })
})

it.each([null, 'true', 1, {}])('rejects a non-boolean transfer reset %s', clearRecords => {
  const args = { node, owner, manager: owner, clearRecords }
  expect(isCoreUpdateAuthoritiesRuntimeArgs(args)).toBe(false)
  expect(() => toDuskDomainWireArgs(coreUpdateAuthoritiesRuntimeCall(args as never))).toThrow('optional boolean clearRecords')
})

it('distinguishes holder-only permissions from namespace control in errors', async () => {
  const { userFacingErrorMessage } = await import('../client/userFacingErrors')
  expect(userFacingErrorMessage(new Error('DuskDomains: owner or manager authorization required'))).toBe('Connect the owner or manager of this name.')
  expect(userFacingErrorMessage(new Error('DuskDomains: active ancestor authority required'))).toBe('Connect the owner or manager of an active ancestor.')
  expect(userFacingErrorMessage(new Error('DuskDomains: active namespace authority required'))).toBe('Connect the owner or manager of this name or an active ancestor.')
})


it('discloses explicit reset in wallet approval context', async () => {
  const { decodedDuskDomainContext } = await import('./callContext')
  expect(decodedDuskDomainContext(coreUpdateAuthoritiesRuntimeCall({ node, owner, manager: owner, clearRecords: true }))?.description)
    .toBe('Change authorities and clear this name’s records and primary name.')
})

it('discloses owner and manager clearing for ancestor reassignments and batches', async () => {
  const { decodedDuskDomainContext } = await import('./callContext')
  expect(decodedDuskDomainContext(coreReassignSubnameRuntimeCall({ node, owner, manager: node, clearRecords: false }))?.description)
    .toContain('An ancestor changing another holder’s owner or manager always clears the subname’s records and primary name.')
  expect(decodedDuskDomainContext(coreTakeBackSubnamesRuntimeCall({ node, nodes: [owner], owner, manager: node }))?.description)
    .toContain('Changing an owner or manager always clears that name’s records and primary name.')
})
