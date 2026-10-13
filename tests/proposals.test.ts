import { it, expect } from 'vitest'
import {
  createProjectionState,
  projectReceipt,
  projectedProposal,
  projectedProposals,
  type ProjectionState,
} from '../src/frozen/projection.ts'
import type { Receipt, ReceiptEvent } from '../src/frozen/journal.ts'
import type * as T from '../src/frozen/types.ts'
import { bytes, id, sample } from './helpers.ts'

const options = {
  directoryId: id(1),
  contracts: { [id(1)]: 'directory', [id(2)]: 'vault', [id(3)]: 'policy', [id(4)]: 'store', [id(5)]: 'resolver' },
} as const
let sequence = 0
function receipt(height: bigint, effects: [number, string, unknown][]): Receipt {
  const events: ReceiptEvent[] = []
  for (const [who, topic, body] of effects) {
    const op_seq = BigInt(++sequence), call_path = [bytes(who)]
    events.push(
      { emitter: id(who), topic: 'operation_begin', data: { op_seq, height, call_path }, ordinal: events.length },
      { emitter: id(who), topic, data: { version: 1, op_seq, body }, ordinal: events.length + 1 },
      { emitter: id(who), topic: 'operation_end', data: { op_seq, call_path }, ordinal: events.length + 2 },
    )
  }
  return { height, id: `receipt-${sequence}`, success: true, events }
}
function directory(): T.DirectoryInitialized {
  const event = sample('DirectoryInitialized')
  event.config.binding.directory = bytes(1)
  event.config.revision = event.config.registration.revision = 1n
  event.config.operator_epoch = event.config.guardian_epoch = 1n
  event.args.initial_store.id = bytes(4)
  event.args.initial_resolver.id = bytes(5)
  event.args.policy.id = bytes(3)
  event.args.initial_market = null
  return event
}
const guardianReplacement = (): T.Action => ({
  ReplaceGuardian: { expected_epoch: 1n, next: { kind: 'Contract', bytes: bytes(40) } },
})
function proposal(nonce: bigint, action: T.Action = sample('Proposal').action): T.Proposal {
  return {
    ...sample('Proposal'),
    id: { operator_epoch: 1n, nonce },
    action,
    proposed_at: 10n,
    ready_at: 100n,
    expires_at: 200n,
    status: 'Pending',
  }
}
function governance(...proposals: T.Proposal[]): ProjectionState {
  return projectReceipt(
    createProjectionState(options),
    receipt(1n, [
      [1, 'directory_initialized', directory()],
      ...proposals.map((p): [number, string, unknown] => [1, 'proposal_created', { proposal: p }]),
    ]),
  )
}

it('reads an untouched pending proposal as Expired from its expiry height, as the directory does', () => {
  const p = proposal(1n), s = governance(p)
  expect(projectedProposal(s, p.id, 199n)?.status).toBe('Pending')
  expect(projectedProposal(s, p.id, 200n)?.status).toBe('Expired')
  expect(projectedProposal(s, p.id, 10_000n)?.status).toBe('Expired')
  // Nothing happens on chain at expiry: the stored row stays as it was created.
  expect(s.proposals['1:1'].status).toBe('Pending')
  expect(projectedProposal(s, { operator_epoch: 1n, nonce: 9n }, 199n)).toBeNull()
})

it('reads a pending proposal of an earlier operator epoch as Invalidated, even past its expiry', () => {
  const p = proposal(1n), config = directory().config
  const s = projectReceipt(governance(p), receipt(2n, [
    [1, 'operator_changed', { ...sample('OperatorChanged'), current: config.operator, operator_epoch: 2n }],
  ]))
  expect(projectedProposal(s, p.id, 150n)?.status).toBe('Invalidated')
  expect(projectedProposal(s, p.id, 250n)?.status).toBe('Invalidated')
})

it('reads a competing guardian replacement as Invalidated once the guardian epoch moves', () => {
  const replacement = proposal(1n, guardianReplacement()), other = proposal(2n), config = directory().config
  const s = projectReceipt(governance(replacement, other), receipt(2n, [
    [1, 'guardian_changed', { ...sample('GuardianChanged'), current: config.guardian, guardian_epoch: 2n, suspended: false }],
  ]))
  expect(projectedProposal(s, replacement.id, 150n)?.status).toBe('Invalidated')
  expect(projectedProposal(s, other.id, 150n)?.status).toBe('Pending')
})

it('keeps terminal statuses and lists every retained proposal by nonce with its status at a height', () => {
  const executed = proposal(3n), cancelled = proposal(1n), pending = proposal(2n), config = directory().config
  const s = projectReceipt(governance(executed, cancelled, pending), receipt(150n, [
    [1, 'proposal_executed', { id: executed.id, action_hash: executed.action_hash }],
    [1, 'proposal_cancelled', { id: cancelled.id, actor: config.operator.principal }],
  ]))
  expect(projectedProposals(s, 150n).map((p) => [p.id.nonce, p.status])).toEqual([
    [1n, 'Cancelled'], [2n, 'Pending'], [3n, 'Executed'],
  ])
  expect(projectedProposals(s, 500n).map((p) => [p.id.nonce, p.status])).toEqual([
    [1n, 'Cancelled'], [2n, 'Expired'], [3n, 'Executed'],
  ])
  // Reads never write projection state.
  expect(s.proposals['1:2'].status).toBe('Pending')
})
