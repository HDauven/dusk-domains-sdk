import { expect, it } from 'vitest'
import * as sdk from '../src/index.ts'
import * as projection from '../src/projection.ts'
import { methodDefinition } from '../src/frozen/calls.ts'
import { definitions } from '../src/frozen/schema.ts'
import { indexerEventCatalog } from '../src/indexer/events/indexerEventCatalog.ts'
import { bytes, fixtures, id, release, sample } from './helpers.ts'

it('exports the exact positive controller interface marker', () => {
  expect(sdk.CONTROLLER_INTERFACE).toBe(0x4444534354524c01n)
})
it('removes the approval builder, read helper, gas policy and projection helper', () => {
  expect(sdk).not.toHaveProperty('directoryApproveControllerCall')
  expect(sdk.FrozenClient.prototype).not.toHaveProperty('controllerApproval')
  expect(sdk.GAS_LIMITS).not.toHaveProperty('directory.approve_controller')
  expect(projection).not.toHaveProperty('projectedControllerApproval')
})
it.each(['approve_controller', 'controller_approval'])('removes directory.%s from the catalog', method => {
  expect(() => methodDefinition('directory', method)).toThrow('Unknown directory method')
})
it.each(['ApproveController', 'ControllerApproval', 'ControllerApprovalChanged', 'Event<ControllerApprovalChanged>'])(
  'removes the %s schema', type => expect(definitions).not.toHaveProperty(type),
)
it('removes the approval event topic', () => {
  expect(indexerEventCatalog).not.toHaveProperty('controller_approval_changed')
})

it('matches the complete directory function catalog from the protocol driver', async () => {
  const schema = (await release()).drivers.get(id(1))!.schema() as { functions: { name: string; input: string; output: string }[] }
  for (const method of schema.functions)
    expect(methodDefinition('directory', method.name)).toMatchObject(method)
})

it.each(['frozen-v1', 'frozen-v1-max'])('matches changed governance archives from %s', async suite => {
  const rows = fixtures(suite), driver = (await release()).drivers.get(id(1))!
  for (const type of ['Admission', 'DirectoryConfig', 'OperatorChanged', 'Action', 'Proposal', 'Propose', 'Proposals', 'Event<DirectoryInitialized>', 'Event<ProposalCreated>', 'Event<ActionApplied>', 'Event<OperatorChanged>']) {
    const candidates = Object.values(rows).filter(row => row.type === type)
    if (suite === 'frozen-v1') expect(candidates.length, type).toBeGreaterThan(0)
    for (const row of candidates) {
      const value = sdk.wireValue(row.type, row.json)
      if (type === 'Admission') expect(value).toHaveProperty('governance_version')
      if (type === 'DirectoryConfig' || type === 'OperatorChanged') expect(value).toHaveProperty('recipient_version')
      if (type === 'Propose') expect(sdk.hex(driver.encodeInput('propose', sdk.stringifyJson(value)))).toBe(row.rkyv)
      const method = { DirectoryConfig: 'config', Proposals: 'proposals' }[type]
      if (method) expect(sdk.wireValue(type, driver.decodeOutput(method, Uint8Array.from(sdk.fromHex(row.rkyv))))).toEqual(value)
      const topic = { 'Event<DirectoryInitialized>': 'directory_initialized', 'Event<ProposalCreated>': 'proposal_created', 'Event<ActionApplied>': 'action_applied', 'Event<OperatorChanged>': 'operator_changed' }[type]
      if (topic) expect(sdk.wireValue(type, driver.decodeEvent(topic, Uint8Array.from(sdk.fromHex(row.rkyv))))).toEqual(value)
    }
  }
})

it.each(['SetAcceptsMoves', 'SetRetiring'] as const)('builds %s using the current shared store version', variant => {
  const admission = { ...sample('Admission'), id: bytes(4), governance_version: 9007199254740993n }
  const build = variant === 'SetAcceptsMoves' ? sdk.setAcceptsMovesProposalCall : sdk.setRetiringProposalCall
  const call = build(id(1), admission, true)
  expect(call).toMatchObject({ functionName: 'propose', deposit: '0', args: { action: { [variant]: { store: bytes(4), expected_version: admission.governance_version, value: true } } } })
  admission.governance_version++
  expect(build(id(1), admission, false).args.action).toEqual({ [variant]: { store: bytes(4), expected_version: admission.governance_version, value: false } })
  expect(call.args.action).toEqual({ [variant]: { store: bytes(4), expected_version: 9007199254740993n, value: true } })
})
it('builds SetRecipient using the current recipient version and operator epoch', () => {
  const config = { ...sample('DirectoryConfig'), recipient_version: 9007199254740993n, operator_epoch: 4n }
  expect(sdk.setRecipientProposalCall(id(1), config, bytes(12, 96)).args.action).toEqual({ SetRecipient: { expected_operator_epoch: 4n, expected_recipient_version: 9007199254740993n, recipient: bytes(12, 96) } })
})
it('loads an older approval snapshot without retaining consent or guessing missing versions', () => {
  const state = projection.createProjectionState({ directoryId: id(1), contracts: { [id(1)]: 'directory', [id(4)]: 'store' } })
  state.directory = sample('DirectoryConfig')
  state.admissions[id(4)] = { ...sample('Admission'), id: bytes(4) }
  Reflect.deleteProperty(state.directory, 'recipient_version')
  Reflect.deleteProperty(state.admissions[id(4)], 'governance_version')
  const legacy = { ...state, controllerApprovals: { [id(10)]: { [id(41)]: 2n } } }
  const restored = projection.restoreProjection(legacy)
  expect(restored).not.toHaveProperty('controllerApprovals')
  expect(legacy.controllerApprovals[id(10)][id(41)]).toBe(2n)
  expect(restored.admissions[id(4)]).not.toHaveProperty('governance_version')
  expect(() => sdk.setAcceptsMovesProposalCall(id(1), restored.admissions[id(4)], false)).toThrow('current governance_version')
  expect(() => sdk.setRetiringProposalCall(id(1), restored.admissions[id(4)], true)).toThrow('current governance_version')
  expect(() => sdk.setRecipientProposalCall(id(1), restored.directory!, bytes(12, 96))).toThrow('current recipient_version')
  expect(projection.snapshotProjection(restored)).not.toHaveProperty('controllerApprovals')
})
