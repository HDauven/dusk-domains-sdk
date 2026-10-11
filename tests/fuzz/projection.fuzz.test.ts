import { expect, it, vi } from 'vitest'
import fc from 'fast-check'
import { createProjectionState, projectReceipt, snapshotProjection, restoreProjection, type ProjectionState } from '../../src/frozen/projection.ts'
import type { Receipt, ReceiptEvent } from '../../src/frozen/journal.ts'
import { nameKey } from '../../src/frozen/bytes.ts'
import { wireValue } from '../../src/frozen/wire.ts'
import { stringifyJson } from '../../src/frozen/json.ts'
import { launchPolicyConfig } from '../../src/core/pricing.ts'
import { indexerEventCatalog } from '../../src/indexer/events/indexerEventCatalog.ts'
import { setAcceptsMovesProposalCall, setRetiringProposalCall, setRecipientProposalCall } from '../../src/frozen/actions.ts'
import { bytes, id, sample as fixture, release } from '../helpers.ts'
import { arbitrary, choices, mutate, u64Arbitrary, U64_MAX } from './arbitraries.ts'
import { check, count, testTimeout } from './support.ts'

vi.setConfig({ testTimeout })
const scope = { [id(1)]: 'directory', [id(2)]: 'vault', [id(3)]: 'policy', [id(4)]: 'store', [id(5)]: 'resolver', [id(6)]: 'marketplace' } as const
const options = { directoryId: id(1), contracts: scope }
const roles = Object.entries(scope)
const binding = { directory: bytes(1), vault: bytes(2), network: 1 }
const topics = Object.keys(indexerEventCatalog).filter(t => t !== 'operation_begin' && t !== 'operation_end')
type Effect = [number, string, unknown]
const samples = new Map<string, any>()
const sample = (type: string): any => structuredClone(samples.get(type) ?? samples.set(type, fixture(type as never)).get(type))

/** One receipt with an operation frame around each effect, as the contracts emit them. */
function frame(height: bigint, effects: Effect[], identifier: string): Receipt {
  const events: ReceiptEvent[] = []
  for (const [who, topic, body] of effects) {
    const op_seq = BigInt(events.length + 1), call_path = [bytes(who)]
    const spec = indexerEventCatalog[topic as keyof typeof indexerEventCatalog]
    events.push({ emitter: id(who), topic: 'operation_begin', ordinal: events.length, data: { op_seq, height, call_path } },
      { emitter: id(who), topic, ordinal: events.length + 1, data: wireValue(spec.type, { version: 1, op_seq, body }) },
      { emitter: id(who), topic: 'operation_end', ordinal: events.length + 2, data: { op_seq, call_path } })
  }
  return { id: identifier, height, success: true, events }
}
function directory() {
  const d = sample('DirectoryInitialized'), config = d.config, policy = launchPolicyConfig()
  config.binding = binding
  config.registration = { revision: 1n, policy: bytes(3), policy_version: 1n, operator: config.operator.principal,
    operator_paused: false, guardian_suspended: false, allocation_version: 1n, newest_store: bytes(4) }
  config.revision = config.operator_epoch = config.guardian_epoch = config.source_version = config.market_version = 1n
  config.preferred_marketplace = bytes(6)
  config.renewal = { version: 1n, effective_at: 1n, annual_lux: policy.annual_lux, referral_bps: 1000 }
  for (const [key, n] of [['initial_store', 4], ['initial_resolver', 5], ['policy', 3]] as const)
    d.args[key] = { ...sample('Admission'), id: bytes(n), ordinal: 0, admitted_at: 1n }
  d.args.initial_market = { ...sample('Market'), id: bytes(6), version: 1n }
  d.args.vault = bytes(2)
  return d
}
const bootstrap = () => frame(1n, [
  [3, 'policy_initialized', { args: { binding, config: launchPolicyConfig() } }],
  [2, 'vault_initialized', { args: { binding, sources: [{ id: bytes(4), kind: 'Store', state: 'Listed' }] } }],
  [5, 'resolver_initialized', { args: { binding } }], [4, 'store_initialized', { args: { binding } }],
  [6, 'market_configured', { config: { binding, fee_bps: 250, new_orders_disabled: false, next_order_id: 1n,
    unsettled_orders: 0n, refund_accounts: 0n, held_lux: '0', refundable_lux: '0' } }],
  [1, 'directory_initialized', directory()],
], 'bootstrap')

// A consistent model history: registrations, authority changes, commitments and counters.
const commands = fc.array(fc.record({
  kind: fc.constantFrom('register', 'authority', 'commitment', 'counters'),
  owner: fc.integer({ min: 1, max: 255 }), amount: u64Arbitrary,
}), { maxLength: 24 })
function history(rows: any[], initialHeight: bigint): Receipt[] {
  let current: any = { ...sample('Name'), key: nameKey('property.dusk'), label: 'property',
    incarnation: { generation: 1n, serial: 1n }, records: null, subname: null, custody: null, referrer: null }
  const output: Receipt[] = []
  for (const [index, command] of [{ kind: 'register', owner: 10, amount: 0n }, ...rows].entries()) {
    const height = initialHeight + BigInt(index)
    let topic: string, body: any
    if (command.kind === 'register') {
      const previous_generation = index === 0 ? 0n : current.incarnation.generation
      current = { ...current, incarnation: { generation: previous_generation + 1n, serial: 1n }, owner: bytes(command.owner) }
      topic = 'root_registered'
      body = { ...sample('RootRegistered'), name: structuredClone(current), previous_generation, fee_lux: String(command.amount) }
    } else if (command.kind === 'authority') {
      const previous_owner = current.owner, previous_manager = current.manager
      current = { ...current, owner: bytes(command.owner), manager: bytes(command.owner) }
      topic = 'authorities_changed'
      body = { name: structuredClone(current), actor: previous_owner, previous_owner, previous_manager, data_cleared: false, reason: 'Holder' }
    } else if (command.kind === 'commitment') {
      topic = 'commitment_created'
      body = { commitment: { key: { actor: bytes(command.owner), hash: bytes(index) }, created_at: command.amount } }
    } else {
      topic = 'root_counters_changed'
      body = { root: current.key.root, counters: { generation: current.incarnation.generation, next_serial: 2n, next_epoch: command.amount, next_custody: 1n, revision: BigInt(index) } }
    }
    output.push(frame(height, [[4, topic, body]], `model-${index}`))
  }
  return output
}

// Rejections the reducers document. Anything else (TypeError, RangeError,
// an unrecognized message) is an unexpected reducer failure.
const EXPECTED = [/^Missing or inconsistent event history: /, /^Rollback before replaying an older block$/,
  /^Receipt events are not in strict ordinal order$/, /^Event emitter role mismatch$/, /^Journal begin height\/path mismatch$/,
  /^Unsupported event version$/, /^Invalid \S+ at /, /^Unexpected directory admission$/, /^Admission role conflict$/,
  /^Expected a lossless u64 integer$/, /^Expected decimal u64 Lux text$/, /^Invalid canonical enum$/, /^Too many records$/,
  /^Duplicate record key$/, /^Incomplete or unordered move history$/, /^Move contains custody$/,
  /^Resolver snapshot count\/digest mismatch$/, /^Invalid hex bytes$/, /^Invalid contract ID$/]
function apply(state: ProjectionState, receipt: Receipt, atomic = true): string {
  const before = atomic ? snapshotProjection(state) : undefined
  try {
    projectReceipt(state, receipt)
    return 'applied'
  } catch (error) {
    if (!(error instanceof Error) || error.constructor !== Error || !EXPECTED.some(r => r.test(error.message)))
      throw new Error(`Unexpected reducer error for ${stringifyJson(receipt.events.map(e => e.topic))}: ${(error as Error)?.stack ?? error}`)
    if (before) expect(state).toEqual(before)
    else throw error
    return error.message.replace(/ at .*$/, '')
  }
}
function replay(receipts: Receipt[], cut: number, atomic = true) {
  const first = createProjectionState(options), outcomes: string[] = []
  for (const receipt of receipts.slice(0, cut)) outcomes.push(apply(first, receipt, atomic))
  const checkpoint = snapshotProjection(first), original = structuredClone(checkpoint)
  const resumed = restoreProjection(checkpoint)
  expect(resumed).toEqual(first)
  for (const receipt of receipts.slice(cut)) outcomes.push(apply(resumed, receipt, atomic))
  expect(checkpoint).toEqual(original)
  return { state: resumed, outcomes }
}

it('projection: valid model sequences apply, restore losslessly, and replay deterministically', async () => {
  await check('projection/model-history', fc.property(commands, u64Arbitrary.map(n => n % (U64_MAX - 25n)), fc.nat(), (rows, height, cut) => {
    const receipts = [bootstrap(), ...history(rows, height + 2n)], evidence = structuredClone(receipts)
    const split = cut % (receipts.length + 1)
    const { state: resumed, outcomes } = replay(receipts, split, false)
    expect(outcomes.every(o => o === 'applied'), outcomes.join()).toBe(true)
    const { state: full } = replay(receipts, receipts.length, false)
    expect(resumed).toEqual(full)
    expect(receipts).toEqual(evidence)
    for (const receipt of receipts) expect(apply(resumed, receipt, false)).toBe('applied')
    expect(resumed).toEqual(full)
    expect(Object.keys(resumed.receipts)).toHaveLength(receipts.length)
  }))
})

// Arbitrary schema-valid events (and perturbed, duplicated, reframed or stale
// copies of real ones) interleaved with a consistent history.
const noise = fc.array(fc.record({ at: fc.nat(), kind: fc.nat(), topic: fc.nat(), who: fc.nat(), pick: fc.nat(), steps: choices }), { maxLength: 16 })
const rehome = (receipt: Receipt, height: bigint) => {
  receipt.height = height
  for (const e of receipt.events) if (e.topic === 'operation_begin') (e.data as any).height = height
}
function noiseReceipt(n: any, receipts: Receipt[], position: number, index: number): Receipt {
  const height = receipts.slice(0, position).reduce((h, r) => (r.height > h ? r.height : h), 1n)
  const kind = ['arbitrary', 'arbitrary', 'perturb', 'perturb', 'duplicate', 'renamed', 'reframed', 'stale'][n.kind % 8]
  if (kind === 'arbitrary') {
    const topic = topics[n.topic % topics.length], spec = indexerEventCatalog[topic as keyof typeof indexerEventCatalog]
    const emitters = roles.filter(([, role]) => spec.role === '*' || role === spec.role)
    const who = parseInt(emitters[n.who % emitters.length][0].slice(0, 2), 16)
    const event = fc.sample(arbitrary(spec.type), { seed: n.pick, numRuns: 1 })[0]
    return frame(height, [[who, topic, event.body]], `noise-${index}-${kind}`)
  }
  // A duplicate repeats a receipt already seen; other copies may come from anywhere and are rehomed.
  const base = kind === 'duplicate' ? receipts[n.pick % position] : receipts[n.pick % receipts.length]
  const copy: Receipt = structuredClone({ ...base, id: kind === 'duplicate' ? base.id : `noise-${index}-${kind}` })
  const effects = copy.events.filter(e => e.topic !== 'operation_begin' && e.topic !== 'operation_end')
  if (kind === 'perturb' && effects.length) {
    const event = effects[n.topic % effects.length]
    const spec = indexerEventCatalog[event.topic as keyof typeof indexerEventCatalog]
    event.data = mutate(spec.type, event.data, n.steps)
    rehome(copy, height)
  } else if (kind === 'reframed') {
    const i = n.topic % copy.events.length
    if (n.who % 2) copy.events.splice(i, 1)
    else copy.events.splice(i, 0, structuredClone(copy.events[i]))
    copy.events.forEach((e, k) => { e.ordinal = k })
    rehome(copy, height)
  } else if (kind === 'stale') rehome(copy, height > 0n ? height - 1n : 0n)
  else if (kind !== 'duplicate') rehome(copy, height) // renamed, or a perturbation of a copy without effects
  return copy
}
it('projection: arbitrary event sequences only produce documented rejections, atomically and deterministically', async () => {
  const metrics: Record<string, number> = {}
  await check('projection/arbitrary-events', fc.property(commands, noise, fc.nat(), (rows, extra, cut) => {
    const receipts = [bootstrap(), ...history(rows, 2n)]
    extra.forEach((n, index) => {
      const position = 1 + (n.at % receipts.length)
      receipts.splice(position, 0, noiseReceipt(n, receipts, position, index))
    })
    const evidence = structuredClone(receipts)
    const first = replay(receipts, receipts.length)
    const second = replay(receipts, cut % (receipts.length + 1))
    expect(second.outcomes).toEqual(first.outcomes)
    expect(second.state).toEqual(first.state)
    expect(receipts).toEqual(evidence)
    first.outcomes.forEach((outcome, i) => count(metrics, `${receipts[i].id.split('-')[2] ?? 'model'}: ${outcome.replace(/^Missing or inconsistent event history: .*/, 'inconsistent history')}`))
  }), { metrics })
})

it('proposal helpers: exact u64 guards and byte encodable calls', async () => {
  const driver = (await release()).drivers.get(id(1))!
  await check('helpers/proposals', fc.property(u64Arbitrary.map(n => n || 1n), u64Arbitrary, arbitrary('Endpoint'), fc.boolean(), (version, epoch, recipient, flag) => {
    const calls = [
      setAcceptsMovesProposalCall(id(1), { id: bytes(4), governance_version: version }, flag),
      setRetiringProposalCall(id(1), { id: bytes(4), governance_version: version }, flag),
      setRecipientProposalCall(id(1), { operator_epoch: epoch, recipient_version: version }, recipient),
    ]
    for (const call of calls) {
      const decoded = wireValue('Propose', driver.decodeInput('propose', driver.encodeInput('propose', stringifyJson(call.args))))
      expect(decoded).toEqual(call.args)
      const guard = Object.values(decoded.action)[0] as any
      expect(guard.expected_version ?? guard.expected_recipient_version).toBe(version)
      if ('expected_operator_epoch' in guard) expect(guard.expected_operator_epoch).toBe(epoch)
    }
  }))
})
