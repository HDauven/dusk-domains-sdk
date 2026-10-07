import { it, expect } from 'vitest'
import {
  createProjector,
  createProjectionState,
  projectReceipt,
  nameStateKey,
  rootStateKey,
  primaryStateKey,
  slotStateKey,
  projectedPrimary,
  projectedSlotLiveness,
  effectiveMoveLock,
  moveLockEndsAt,
} from '../src/frozen/projection.ts'
import {
  committedEvents,
  type Receipt,
  type ReceiptEvent,
} from '../src/frozen/journal.ts'
import { recordsDigest, moveManifestDigest } from '../src/frozen/digests.ts'
import { hex, nameKey } from '../src/frozen/bytes.ts'
import type * as T from '../src/frozen/types.ts'
import type { ProjectionState } from '../src/frozen/projection.ts'
import { bytes, id, sample, fixtures } from './helpers.ts'
const scope = {
  [id(1)]: 'directory',
  [id(2)]: 'vault',
  [id(3)]: 'policy',
  [id(4)]: 'store',
  [id(5)]: 'resolver',
  [id(6)]: 'marketplace',
  [id(8)]: 'store',
} as const
const options = { directoryId: id(1), contracts: scope }
const ref = (n: T.Name): T.NameRef => ({
  key: n.key,
  incarnation: n.incarnation,
})
let sequence = 0
function receipt(
  height: bigint,
  effects: [number, string, unknown][],
  identifier?: string,
): Receipt {
  const events: ReceiptEvent[] = []
  for (const [who, topic, body] of effects) {
    const op_seq = BigInt(++sequence)
    const call_path = [bytes(who)]
    events.push(
      {
        emitter: id(who),
        topic: 'operation_begin',
        data: { op_seq, height, call_path },
        ordinal: events.length,
      },
      {
        emitter: id(who),
        topic,
        data: { version: 1, op_seq, body },
        ordinal: events.length + 1,
      },
      {
        emitter: id(who),
        topic: 'operation_end',
        data: { op_seq, call_path },
        ordinal: events.length + 2,
      },
    )
  }
  return {
    height,
    id: identifier ?? `receipt-${sequence}`,
    success: true,
    events,
  }
}
function makeName(spelling = 'example.dusk', serial = 1n): T.Name {
  return {
    key: nameKey(spelling),
    label: spelling.split('.')[0],
    incarnation: { generation: 7n, serial },
    owner: bytes(10),
    manager: bytes(11),
    expires_at: 1000n,
    grace_end: 2000n,
    referrer: null,
    subname: null,
    records: null,
    custody: null,
  }
}
const counters: T.RootCounters = {
  generation: 7n,
  next_serial: 6n,
  next_epoch: 10n,
  next_custody: 4n,
  revision: 5n,
}
function registered(n: T.Name): T.RootRegistered {
  return {
    ...sample('RootRegistered'),
    name: n,
    previous_generation: 6n,
    reason: 'Paid',
    fee_lux: '100',
    premium_lux: '0',
    referral_lux: '0',
  }
}
function child(
  parent: T.Name,
  label: string,
  serial: bigint,
  expiry: T.ExpiryPolicy = 'InheritsParent',
): T.Name {
  const spelling = `${label}.${parent.subname ? 'child.' : ''}example.dusk`,
    n = makeName(spelling, serial)
  n.subname = {
    parent: parent.key.node,
    depth: parent.subname ? 2 : 1,
    expiry_policy: expiry,
    created_at: 1n,
  }
  return n
}
function startState(names: T.Name[]): ProjectionState {
  let s = createProjectionState(options)
  s = projectReceipt(
    s,
    receipt(10n, [
      [4, 'root_registered', registered(names[0])],
      [4, 'root_counters_changed', { root: names[0].key.root, counters }],
      ...names
        .slice(1)
        .map(
          (n) =>
            [4, 'subname_created', { name: n, actor: bytes(10) }] as [
              number,
              string,
              unknown,
            ],
        ),
    ]),
  )
  return s
}
function renewal(n: T.Name, expiry: bigint): T.RootRenewed {
  return {
    root: ref(n),
    old_expiry: n.expires_at,
    expires_at: expiry,
    old_grace_end: n.grace_end,
    grace_end: expiry + 1000n,
    inheritance_rule: 1,
    years: 1,
    payer: { kind: 'Contract', bytes: bytes(12) },
    fee_lux: '100',
    referral_lux: '0',
    schedule_version: 1n,
  }
}
it('filters reverted effects, unfinished ancestors, reused sequences and unrelated host events', () => {
  const h = 10n,
    events: ReceiptEvent[] = []
  function push(who: number, topic: string, data: unknown, reverted = false) {
    events.push({
      emitter: id(who),
      topic,
      data,
      reverted,
      ordinal: events.length,
    })
  }
  const begin = (who: number, seq: bigint, path: number[][]) =>
    push(who, 'operation_begin', { op_seq: seq, height: h, call_path: path })
  const end = (who: number, seq: bigint, path: number[][]) =>
    push(who, 'operation_end', { op_seq: seq, call_path: path })
  const effect = (seq: bigint, key: number, reverted = false) =>
    push(
      4,
      'commitment_created',
      {
        version: 1,
        op_seq: seq,
        body: {
          commitment: {
            key: { actor: bytes(10), hash: bytes(key) },
            created_at: h,
          },
        },
      },
      reverted,
    )
  begin(6, 1n, [bytes(6)])
  begin(4, 1n, [bytes(6), bytes(4)])
  effect(1n, 1) // failed nested attempt lacks End
  begin(4, 1n, [bytes(6), bytes(4)])
  effect(1n, 2)
  effect(1n, 3, true)
  end(4, 1n, [bytes(6), bytes(4)])
  end(6, 1n, [bytes(6)])
  begin(6, 2n, [bytes(6)])
  begin(4, 2n, [bytes(6), bytes(4)])
  effect(2n, 4)
  end(4, 2n, [bytes(6), bytes(4)]) // failed parent
  push(0, 'transfer', { anything: 'host' })
  const r = { id: 'nested', height: h, success: true, events },
    committed = committedEvents(r, scope)
  expect(committed).toHaveLength(1)
  expect((committed[0].data as any).body.commitment.key.hash).toEqual(bytes(2))
  expect(
    Object.keys(projectReceipt(createProjectionState(options), r).commitments),
  ).toHaveLength(1)
  expect(committedEvents({ ...r, success: false }, scope)).toEqual([])
})
it('journals reject wrong versions, emitters and runtime paths', () => {
  const r = receipt(10n, [
    [
      4,
      'commitment_created',
      {
        commitment: {
          key: { actor: bytes(2), hash: bytes(3) },
          created_at: 10n,
        },
      },
    ],
  ])
  const unknown = structuredClone(r)
  ;(unknown.events[1].data as any).version = 2
  expect(() => committedEvents(unknown, scope)).toThrow('version')
  const role = structuredClone(r)
  role.events.forEach((e) => (e.emitter = id(3)))
  ;(role.events[0].data as any).call_path = [bytes(3)]
  expect(() => committedEvents(role, scope)).toThrow('role')
  const path = structuredClone(r)
  ;(path.events[0].data as any).call_path = [bytes(8)]
  expect(() => committedEvents(path, scope)).toThrow('path')
})
it('replays inherited renewal, fixed branches, node custody, ancestor effects and subtree removal', () => {
  const root = makeName(),
    c = child(root, 'child', 2n),
    leaf = child(c, 'leaf', 3n),
    fixed = child(root, 'fixed', 4n, 'FixedBeforeParent')
  let s = startState([root, c, leaf, fixed])
  s = projectReceipt(
    s,
    receipt(20n, [[4, 'root_renewed', renewal(root, 3000n)]]),
  )
  expect(s.names[nameStateKey(id(4), leaf.key)].expires_at).toBe(3000n)
  expect(s.names[nameStateKey(id(4), fixed.key)].expires_at).toBe(1000n)
  const custody: T.Custody = {
    nonce: 4n,
    incarnation: c.incarnation,
    custodian: bytes(6),
    origin_owner: c.owner,
    origin_manager: c.manager,
  }
  const changed = {
    ...s.names[nameStateKey(id(4), c.key)],
    owner: bytes(6),
    manager: bytes(6),
    custody,
  }
  s = projectReceipt(
    s,
    receipt(21n, [
      [
        4,
        'custody_started',
        { name: ref(c), custody, callback_data_hash: bytes(1) },
      ],
      [
        4,
        'authorities_changed',
        {
          name: changed,
          previous_owner: c.owner,
          previous_manager: c.manager,
          actor: c.owner,
          reason: 'CustodyStart',
          data_cleared: false,
        },
      ],
    ]),
  )
  expect(s.names[nameStateKey(id(4), c.key)].custody?.nonce).toBe(4n)
  expect(s.names[nameStateKey(id(4), leaf.key)].owner).toEqual(leaf.owner)
  s = projectReceipt(
    s,
    receipt(22n, [
      [
        4,
        'subtree_removed',
        {
          target: ref(c),
          include_target: true,
          removed_count: 2,
          reason: 'Removed',
          actor: root.owner,
        },
      ],
    ]),
  )
  expect(s.names[nameStateKey(id(4), c.key)]).toBeUndefined()
  expect(s.names[nameStateKey(id(4), leaf.key)]).toBeUndefined()
  expect(s.names[nameStateKey(id(4), fixed.key)]).toBeDefined()
})
it('raw primaries resolve only through current records and old cleanup cannot erase a replacement', () => {
  const endpoint = bytes(12, 96),
    records: T.RecordValue[] = [
      {
        key: 'moonlight_address',
        value: endpoint,
        ttl_seconds: 3600n,
        updated_at: 10n,
      },
    ],
    root = makeName()
  root.records = {
    resolver: bytes(5),
    epoch: 1n,
    count: 1,
    digest: recordsDigest(records),
  }
  let s = startState([root])
  const p: T.Primary = {
      endpoint,
      name: ref(root),
      mapping_id: 1n,
      updated_at: 10n,
    },
    slot = { registry: bytes(4), node: root.key.node, epoch: 1n }
  s = projectReceipt(
    s,
    receipt(11n, [
      [
        5,
        'resolver_slot_written',
        { slot, snapshot: { records, count: 1, digest: root.records.digest } },
      ],
      [
        4,
        'primary_changed',
        { endpoint, previous: null, current: p, reason: 'Set' },
      ],
    ]),
  )
  expect(projectedPrimary(s, endpoint, 11n)?.name.key).toEqual(root.key)
  expect(projectedPrimary(s, endpoint, 1000n)).toBeNull()
  const replacement = { ...p, mapping_id: 2n }
  s = projectReceipt(
    s,
    receipt(12n, [
      [
        4,
        'primary_changed',
        { endpoint, previous: p, current: replacement, reason: 'Set' },
      ],
      [
        4,
        'primary_changed',
        { endpoint, previous: p, current: null, reason: 'Clear' },
      ],
    ]),
  )
  expect(s.primaries[primaryStateKey(id(4), endpoint)].mapping_id).toBe(2n)
  s = projectReceipt(
    s,
    receipt(13n, [
      [
        4,
        'identity_cleared',
        {
          name: ref(root),
          old_slot: root.records,
          old_primary: replacement,
          reason: 'Holder',
        },
      ],
    ]),
  )
  expect(projectedPrimary(s, endpoint, 13n)).toBeNull()
  expect(projectedSlotLiveness(s, id(5), slot)).toBe('Stale')
  expect(s.slots[slotStateKey(id(5), slot)]).toBeDefined()
})
function moving(withRecords = false) {
  const root = makeName(),
    c = child(root, 'child', 2n),
    endpoint = bytes(12, 96)
  const records: T.RecordValue[] = [
    {
      key: 'moonlight_address',
      value: endpoint,
      ttl_seconds: 100n,
      updated_at: 10n,
    },
  ]
  if (withRecords)
    root.records = {
      resolver: bytes(5),
      epoch: 1n,
      count: 1,
      digest: recordsDigest(records),
    }
  const originalPrimary: T.Primary = {
    endpoint,
    name: ref(root),
    mapping_id: 1n,
    updated_at: 10n,
  }
  let s = startState([root, c])
  s = projectReceipt(
    s,
    receipt(11n, [
      [
        4,
        'primary_changed',
        { endpoint, previous: null, current: originalPrimary, reason: 'Set' },
      ],
    ]),
  )
  const rows: T.ExportRow[] = [
    { index: 0, name: root, primary: originalPrimary },
    { index: 1, name: c, primary: null },
  ]
  const ticket: T.MoveTicket = {
    id: bytes(42),
    source: bytes(4),
    destination: bytes(8),
    root: ref(root),
    initiator: root.owner,
    source_revision: 5n,
    counters,
    row_count: 2,
    primary_count: 1,
    manifest: bytes(0),
    created_at: 20n,
    expires_at: 8660n,
  }
  ticket.manifest = moveManifestDigest(ticket, rows)
  const status: T.ImportStatus = {
    ticket,
    staged: Array(33).fill(0),
    staged_count: 0,
    staged_primaries: 0,
    last_progress_at: 20n,
    ready: false,
    prepared_counters: { ...counters, revision: 6n },
    reserved_bytes: 4096n,
    activated: false,
    cancelled: false,
  }
  s = projectReceipt(
    s,
    receipt(20n, [
      [4, 'move_started', { ticket, lifecycle_deadline: 1000n }],
      [8, 'import_prepared', { status }],
    ]),
  )
  const staged: T.ImportRowStaged[] = rows.map((original, index) => ({
    id: ticket.id,
    index,
    original,
    imported: {
      ...original.name,
      records: original.name.records
        ? { ...original.name.records, epoch: 101n }
        : null,
    },
    imported_primary: original.primary
      ? { ...original.primary, mapping_id: 50n }
      : null,
  }))
  return {
    s,
    root,
    c,
    endpoint,
    records,
    originalPrimary,
    rows,
    ticket,
    status,
    staged,
  }
}
function stageAll(m: ReturnType<typeof moving>): ProjectionState {
  let s = m.s
  for (const row of m.staged) {
    const effects: [number, string, unknown][] = []
    if (row.imported.records)
      effects.push([
        5,
        'resolver_slot_written',
        {
          slot: {
            registry: bytes(8),
            node: row.imported.key.node,
            epoch: row.imported.records.epoch,
          },
          snapshot: {
            records: m.records,
            count: 1,
            digest: row.imported.records.digest,
          },
        },
      ])
    effects.push(
      [8, 'import_row_staged', row],
      [
        4,
        'move_progressed',
        {
          id: m.ticket.id,
          staged_count: row.index + 1,
          last_progress_at: 21n + BigInt(row.index),
        },
      ],
    )
    s = projectReceipt(s, receipt(21n + BigInt(row.index), effects))
  }
  return projectReceipt(
    s,
    receipt(23n, [
      [
        8,
        'import_ready',
        {
          id: m.ticket.id,
          manifest: m.ticket.manifest,
          row_count: 2,
          primary_count: 1,
          counters: {
            ...counters,
            next_epoch: m.root.records ? 102n : counters.next_epoch,
            revision: 6n,
          },
        },
      ],
    ]),
  )
}
function finalize(
  m: ReturnType<typeof moving>,
  revision = 5n,
  primary = 1n,
  expiry = 1000n,
): [number, string, unknown][] {
  const live: T.MoveLiveState = {
    revision,
    rows: [
      {
        expires_at: expiry,
        grace_end: expiry + 1000n,
        expiry_policy: null,
        primary_mapping_id: primary,
      },
      {
        expires_at: expiry,
        grace_end: expiry + 1000n,
        expiry_policy: 'InheritsParent',
        primary_mapping_id: 0n,
      },
    ],
  }
  return [
    [
      8,
      'root_imported',
      {
        ticket: m.ticket,
        counters: {
          ...counters,
          next_epoch: m.root.records ? 102n : counters.next_epoch,
          revision: revision + 1n,
        },
        live,
      },
    ],
    [
      4,
      'root_forwarded',
      {
        ticket: m.ticket,
        forward: {
          root: m.root.key.root,
          destination: bytes(8),
          destination_ordinal: 1,
          move_id: m.ticket.id,
          generation: 7n,
          completed_at: 30n,
        },
      },
    ],
  ]
}
it('atomically activates staged tree, reconciles renewals and suppressed primaries, and preserves replacement mappings', () => {
  const m = moving(true)
  let s = stageAll(m)
  expect(s.names[nameStateKey(id(8), m.root.key)]).toBeUndefined()
  expect(
    projectedSlotLiveness(s, id(5), {
      registry: bytes(8),
      node: m.root.key.node,
      epoch: 101n,
    }),
  ).toBe('Staged')
  const other = makeName('other.dusk'),
    replacement = { ...m.originalPrimary, name: ref(other), mapping_id: 51n }
  s = projectReceipt(
    s,
    receipt(24n, [
      [4, 'root_renewed', renewal(m.root, 4000n)],
      [
        4,
        'root_counters_changed',
        { root: m.root.key.root, counters: { ...counters, revision: 7n } },
      ],
      [
        4,
        'primary_changed',
        {
          endpoint: m.endpoint,
          previous: m.originalPrimary,
          current: null,
          reason: 'Clear',
        },
      ],
      [8, 'root_registered', registered(other)],
      [
        8,
        'primary_changed',
        {
          endpoint: m.endpoint,
          previous: null,
          current: replacement,
          reason: 'Set',
        },
      ],
    ]),
  )
  const before = structuredClone(s)
  s = projectReceipt(s, receipt(30n, finalize(m, 7n, 0n, 4000n)))
  expect(before.names[nameStateKey(id(4), m.root.key)]).toBeDefined()
  expect(before.names[nameStateKey(id(8), m.root.key)]).toBeUndefined()
  expect(s.names[nameStateKey(id(4), m.root.key)]).toBeUndefined()
  expect(s.names[nameStateKey(id(8), m.c.key)].expires_at).toBe(4000n)
  expect(s.primaries[primaryStateKey(id(8), m.endpoint)]).toEqual(replacement)
  expect(s.primaries[primaryStateKey(id(4), m.endpoint)]).toBeUndefined()
  expect(s.forwards[rootStateKey(id(4), m.root.key.root)].generation).toBe(7n)
  s = projectReceipt(
    s,
    receipt(31n, [
      [
        4,
        'forwarded_rows_pruned',
        {
          root: m.root.key.root,
          move_id: m.ticket.id,
          names: m.rows.map((r) => ref(r.name)),
          remaining: 0,
        },
      ],
    ]),
  )
  expect(s.forwards[rootStateKey(id(4), m.root.key.root)]).toBeDefined()
  expect(s.names[nameStateKey(id(8), m.c.key)]).toBeDefined()
})
it('preserves surviving raw primaries and rejects missing seal/row/slot history without publishing half a move', () => {
  const m = moving()
  const s = stageAll(m)
  const moved = projectReceipt(s, receipt(30n, finalize(m)))
  expect(moved.primaries[primaryStateKey(id(8), m.endpoint)].mapping_id).toBe(
    50n,
  )
  for (const broken of [m.s, { ...s, imports: {} }, structuredClone(s)]) {
    if (broken !== m.s && Object.keys(broken.imports).length)
      broken.imports[`${id(8)}:${hex(m.ticket.id)}`].ready = null
    expect(() => projectReceipt(broken, receipt(30n, finalize(m)))).toThrow(
      'history',
    )
  }
  expect(() => projectReceipt(s, receipt(30n, [finalize(m)[0]]))).toThrow(
    'atomic',
  )
  expect(s.names[nameStateKey(id(4), m.root.key)]).toBeDefined()
  const corrupted = moving(true)
  corrupted.staged[0].imported.records!.digest = bytes(9)
  expect(() => stageAll(corrupted)).toThrow('digest')
})
it('derives locks from height and progress, does not revive late renewals, and keeps cooldowns separate', () => {
  const m = moving()
  let s = m.s,
    key = `${id(4)}:${hex(m.ticket.id)}`
  expect(moveLockEndsAt(s.moves[key])).toBe(380n)
  expect(effectiveMoveLock(s.moves[key], 379n)).toBe(true)
  expect(effectiveMoveLock(s.moves[key], 380n)).toBe(false)
  s = projectReceipt(
    s,
    receipt(400n, [[4, 'root_renewed', renewal(m.root, 5000n)]]),
  )
  expect(moveLockEndsAt(s.moves[key])).toBe(380n)
  expect(effectiveMoveLock(s.moves[key], 400n)).toBe(false)
  s = projectReceipt(
    s,
    receipt(401n, [
      [
        4,
        'move_cancelled',
        {
          ticket: m.ticket,
          reason: 'Idle',
          cancelled_at: 401n,
          cooldown_applied: true,
        },
      ],
    ]),
  )
  expect(s.rootCooldowns[rootStateKey(id(4), m.root.key.root)]).toBe(401n)
  const m2 = moving()
  const cancelled = projectReceipt(
    m2.s,
    receipt(1000n, [
      [
        4,
        'move_cancelled',
        {
          ticket: m2.ticket,
          reason: 'LifecycleEnded',
          cancelled_at: 1000n,
          cooldown_applied: false,
        },
      ],
    ]),
  )
  expect(cancelled.rootCooldowns).toEqual({})
  expect(() =>
    projectReceipt(
      m2.s,
      receipt(1000n, [
        [
          4,
          'move_cancelled',
          {
            ticket: m2.ticket,
            reason: 'LifecycleEnded',
            cancelled_at: 1000n,
            cooldown_applied: true,
          },
        ],
      ]),
    ),
  ).toThrow('cooldown')
})
it('first import cleanup cancels the entire inactive group and stale slots never become live', () => {
  const m = moving(true)
  let s = stageAll(m)
  s = projectReceipt(
    s,
    receipt(500n, [
      [
        8,
        'import_rows_pruned',
        { id: m.ticket.id, indices: [1], remaining: 1, cancelled: true },
      ],
    ]),
  )
  expect(s.imports[`${id(8)}:${hex(m.ticket.id)}`].status.reserved_bytes).toBe(
    0n,
  )
  expect(
    projectedSlotLiveness(s, id(5), {
      registry: bytes(8),
      node: m.root.key.node,
      epoch: 101n,
    }),
  ).toBe('Stale')
  expect(() => projectReceipt(s, receipt(501n, finalize(m)))).toThrow('history')
  expect(s.rootCooldowns).toEqual({})
})
it('vault balance and referral reservations replay from vault effects, independently of stop flags', () => {
  const beneficiary = { kind: 'Contract', bytes: bytes(10) } as const,
    p = { ...beneficiary, bytes: [...beneficiary.bytes] },
    metadata = {
      ...sample('FeeMetadata'),
      beneficiary: p,
      referral_lux: '3',
      reason: 'Registration' as const,
    }
  let s = createProjectionState(options)
  s = projectReceipt(
    s,
    receipt(10n, [
      [
        2,
        'vault_initialized',
        {
          args: {
            binding: { directory: bytes(1), vault: bytes(2), network: 1 },
            sources: [{ id: bytes(4), kind: 'Store', state: 'Listed' }],
          },
        },
      ],
      [
        2,
        'beneficiary_reserved',
        { beneficiary: p, reserved_beneficiaries: 1 },
      ],
      [
        2,
        'fee_received',
        {
          source: bytes(4),
          metadata,
          received_lux: '10',
          protocol_lux: '7',
          liability_lux: '3',
          beneficiary_claimable_lux: '3',
        },
      ],
    ]),
  )
  expect(s.vault.accountedLux).toBe('10')
  s = projectReceipt(
    s,
    receipt(11n, [
      [
        2,
        'referral_claimed',
        {
          beneficiary: p,
          recipient: bytes(12, 96),
          amount_lux: '3',
          remaining_lux: '0',
          liability_lux: '0',
        },
      ],
      [
        2,
        'protocol_claimed',
        {
          operator: p,
          operator_epoch: 1n,
          recipient: bytes(12, 96),
          amount_lux: '7',
          remaining_lux: '0',
        },
      ],
    ]),
  )
  expect(s.vault.accountedLux).toBe('0')
  expect(s.vault.reservedBeneficiaries).toBe(1)
  expect(Object.values(s.referrals)[0].claimable_lux).toBe('0')
})
it('market cancellation retains ReturnPending and refund claims remain independent of custody return', () => {
  const order = fixtures('market-v1')['input:cancel_order'].json as T.Order
  order.terms.id = 1n
  order.status = 'Open'
  // Fixtures are decoded by projectReceipt; normalize fields first through the public schema.
  let s = createProjectionState(options)
  s = projectReceipt(
    s,
    receipt(10n, [
      [6, 'order_changed', { order }],
      [
        6,
        'refund_changed',
        { refund: { authority: bytes(12), amount_lux: '50' } },
      ],
    ]),
  )
  const pending = {
    ...s.orders[`${id(6)}:1`],
    status: 'ReturnPending' as const,
  }
  s = projectReceipt(
    s,
    receipt(11n, [
      [6, 'order_closed', { order: pending, reason: 'Cancelled' }],
      [
        6,
        'refund_changed',
        { refund: { authority: bytes(12), amount_lux: '0' } },
      ],
      [
        6,
        'refund_claimed',
        { authority: bytes(12), recipient: bytes(12, 96), amount_lux: '50' },
      ],
    ]),
  )
  expect(s.orders[`${id(6)}:1`].status).toBe('ReturnPending')
  expect(s.refunds[`${id(6)}:${hex(bytes(12))}`].amount_lux).toBe('0')
  s = projectReceipt(
    s,
    receipt(12n, [[6, 'order_closed', { order: pending, reason: 'Returned' }]]),
  )
  expect(s.orders[`${id(6)}:1`]).toBeUndefined()
})
it('reorg rollback restores full transactions and replay is idempotent', () => {
  const projector = createProjector(options),
    root = makeName(),
    a = receipt(10n, [[4, 'root_registered', registered(root)]]),
    b = receipt(11n, [[4, 'root_renewed', renewal(root, 4000n)]])
  projector.apply(a)
  projector.apply(b)
  expect(projector.apply(b).receipts).toHaveLength(2)
  expect(
    projector.rollbackTo(10n).names[nameStateKey(id(4), root.key)].expires_at,
  ).toBe(1000n)
  expect(
    projector.apply(b).names[nameStateKey(id(4), root.key)].expires_at,
  ).toBe(4000n)
  expect(projector.rollbackTo(0n).names).toEqual({})
})
it('replays all directory configuration, proposals and effective admissions', () => {
  let s = createProjectionState(options)
  const initialized = sample('DirectoryInitialized')
  initialized.config.binding.directory = bytes(1)
  initialized.args.initial_store.id = bytes(4)
  initialized.args.initial_resolver.id = bytes(5)
  initialized.args.policy.id = bytes(3)
  initialized.args.initial_market = null
  s = projectReceipt(
    s,
    receipt(1n, [
      [1, 'directory_initialized', initialized],
      [
        4,
        'store_initialized',
        {
          args: {
            binding: { directory: bytes(1), vault: bytes(2), network: 1 },
          },
        },
      ],
      [
        5,
        'resolver_initialized',
        {
          args: {
            binding: { directory: bytes(1), vault: bytes(2), network: 1 },
          },
        },
      ],
      [
        3,
        'policy_initialized',
        {
          args: {
            ...sample('InitPolicy'),
            binding: { directory: bytes(1), vault: bytes(2), network: 1 },
          },
        },
      ],
    ]),
  )
  const proposal = sample('Proposal')
  proposal.id = { operator_epoch: 1n, nonce: 1n }
  proposal.status = 'Pending'
  const second = {
    ...structuredClone(proposal),
    id: { operator_epoch: 1n, nonce: 2n },
  }
  s = projectReceipt(
    s,
    receipt(2n, [
      [1, 'proposal_created', { proposal }],
      [1, 'proposal_created', { proposal: second }],
    ]),
  )
  const admission = {
      ...sample('Admission'),
      id: bytes(9),
      ordinal: 2,
      interface_version: 1,
    },
    config = structuredClone(s.directory!)
  s = projectReceipt(
    s,
    receipt(3n, [
      [
        1,
        'proposal_executed',
        { id: proposal.id, action_hash: proposal.action_hash },
      ],
      [
        1,
        'action_applied',
        {
          id: proposal.id,
          action: { AddStore: { expected_allocation_version: 1n, admission } },
          config,
          admission,
          market: null,
        },
      ],
      [
        1,
        'proposal_cancelled',
        { id: second.id, actor: { kind: 'Contract', bytes: bytes(12) } },
      ],
      [
        1,
        'operator_changed',
        {
          ...sample('OperatorChanged'),
          current: config.operator,
          operator_epoch: 2n,
        },
      ],
      [
        1,
        'guardian_changed',
        {
          ...sample('GuardianChanged'),
          current: config.guardian,
          guardian_epoch: 2n,
          suspended: false,
        },
      ],
      [
        1,
        'proposals_invalidated',
        { previous_operator_epoch: 1n, operator_epoch: 2n },
      ],
      [
        1,
        'registration_pause_changed',
        { paused: false, revision: 3n, actor: config.operator.principal },
      ],
      [
        1,
        'policy_suspension_changed',
        { suspended: true, revision: 4n, actor: config.guardian },
      ],
      [
        1,
        'delays_changed',
        { proposal_delay: 17280n, guardian_delay: 60480n, revision: 5n },
      ],
      [1, 'proposal_pruned', { id: second.id, final_status: 'Cancelled' }],
    ]),
  )
  expect(s.scope[id(9)]).toBe('store')
  expect(s.admissions[id(9)]).toEqual(admission)
  expect(s.directory?.registration.operator_paused).toBe(false)
  expect(s.directory?.registration.guardian_suspended).toBe(true)
  expect(s.proposals['1:2']).toBeUndefined()
})
it('replays logical slot changes, custody end, watermarks, commitment removal and physical pruning', () => {
  const root = makeName()
  let s = startState([root])
  const records: T.RecordValue[] = [
      { key: 'url', value: [1], ttl_seconds: 1n, updated_at: 11n },
    ],
    pointer: T.SlotPointer = {
      resolver: bytes(5),
      epoch: 1n,
      count: 1,
      digest: recordsDigest(records),
    },
    slot = { registry: bytes(4), node: root.key.node, epoch: 1n }
  const commitment: T.Commitment = {
      key: { actor: bytes(12), hash: bytes(13) },
      created_at: 11n,
    },
    custody: T.Custody = {
      nonce: 1n,
      incarnation: root.incarnation,
      custodian: bytes(6),
      origin_owner: root.owner,
      origin_manager: root.manager,
    }
  s = projectReceipt(
    s,
    receipt(11n, [
      [4, 'commitment_created', { commitment }],
      [
        4,
        'commitment_removed',
        { commitment, reason: 'Consumed', destination: bytes(8) },
      ],
      [
        5,
        'resolver_slot_written',
        { slot, snapshot: { records, count: 1, digest: pointer.digest } },
      ],
      [
        4,
        'slot_changed',
        {
          name: ref(root),
          previous: null,
          current: pointer,
          reason: 'Initial',
        },
      ],
      [
        4,
        'custody_started',
        { name: ref(root), custody, callback_data_hash: bytes(1) },
      ],
      [4, 'custody_ended', { name: ref(root), nonce: 1n, reason: 'Returned' }],
      [
        4,
        'store_watermarks_changed',
        { next_slot_epoch: 2n, next_mapping_id: 1n, next_move_sequence: 1n },
      ],
      [
        4,
        'slot_changed',
        {
          name: ref(root),
          previous: pointer,
          current: null,
          reason: 'Replacement',
        },
      ],
      [5, 'resolver_slot_pruned', { slot, reason: 'Stale' }],
      [
        2,
        'fee_source_changed',
        {
          source: { id: bytes(6), kind: 'Marketplace', state: 'Draining' },
          source_version: 2n,
        },
      ],
    ]),
  )
  expect(s.commitments).toEqual({})
  expect(s.names[nameStateKey(id(4), root.key)].custody).toBeNull()
  expect(s.slots).toEqual({})
  expect(s.vault.sourceVersion).toBe(2n)
})
it('replays a maximum 257-row tree with independent primary endpoints', () => {
  const root = makeName(),
    nodes: T.Name[] = [root]
  let serial = 2n
  const branches = Array.from({ length: 16 }, (_, i) => ({
    label: `branch${i}`,
    node: nameKey(`branch${i}.example.dusk`).node,
  })).sort((a, b) => hex(a.node).localeCompare(hex(b.node)))
  for (const branch of branches) {
    const parent = makeName(`${branch.label}.example.dusk`, serial++)
    parent.subname = {
      parent: root.key.node,
      depth: 1,
      expiry_policy: 'InheritsParent',
      created_at: 1n,
    }
    nodes.push(parent)
    const leaves = Array.from({ length: 15 }, (_, i) => `leaf${i}`).sort(
      (a, b) =>
        hex(nameKey(`${a}.${branch.label}.example.dusk`).node).localeCompare(
          hex(nameKey(`${b}.${branch.label}.example.dusk`).node),
        ),
    )
    for (const label of leaves) {
      const n = makeName(`${label}.${branch.label}.example.dusk`, serial++)
      n.owner = bytes(Number(serial % 200n) + 1)
      n.subname = {
        parent: parent.key.node,
        depth: 2,
        expiry_policy: 'InheritsParent',
        created_at: 1n,
      }
      nodes.push(n)
    }
  }
  const cs = { ...counters, next_serial: serial },
    primaries = nodes.map((n, i) => ({
      endpoint: [i & 255, i >> 8, ...bytes(12, 94)],
      name: ref(n),
      mapping_id: BigInt(i + 1),
      updated_at: 10n,
    }))
  let s = startState(nodes)
  s = projectReceipt(
    s,
    receipt(11n, [
      [4, 'root_counters_changed', { root: root.key.root, counters: cs }],
      ...primaries.map(
        (p) =>
          [
            4,
            'primary_changed',
            { endpoint: p.endpoint, previous: null, current: p, reason: 'Set' },
          ] as [number, string, unknown],
      ),
    ]),
  )
  const rows = nodes.map((n, index) => ({
      index,
      name: n,
      primary: primaries[index],
    })),
    ticket: T.MoveTicket = {
      id: bytes(41),
      source: bytes(4),
      destination: bytes(8),
      root: ref(root),
      initiator: root.owner,
      source_revision: 5n,
      counters: cs,
      row_count: 257,
      primary_count: 257,
      manifest: bytes(0),
      created_at: 20n,
      expires_at: 8660n,
    }
  ticket.manifest = moveManifestDigest(ticket, rows)
  const status: T.ImportStatus = {
    ticket,
    staged: bytes(0, 33),
    staged_count: 0,
    staged_primaries: 0,
    last_progress_at: 20n,
    ready: false,
    prepared_counters: { ...cs, revision: 6n },
    reserved_bytes: 257n * 2048n,
    activated: false,
    cancelled: false,
  }
  s = projectReceipt(
    s,
    receipt(20n, [
      [4, 'move_started', { ticket, lifecycle_deadline: 1000n }],
      [8, 'import_prepared', { status }],
    ]),
  )
  for (const row of rows) {
    s = projectReceipt(
      s,
      receipt(21n + BigInt(row.index), [
        [
          8,
          'import_row_staged',
          {
            id: ticket.id,
            index: row.index,
            original: row,
            imported: row.name,
            imported_primary: {
              ...row.primary,
              mapping_id: BigInt(row.index + 1000),
            },
          },
        ],
        [
          4,
          'move_progressed',
          {
            id: ticket.id,
            staged_count: row.index + 1,
            last_progress_at: 21n + BigInt(row.index),
          },
        ],
      ]),
    )
  }
  s = projectReceipt(
    s,
    receipt(278n, [
      [
        8,
        'import_ready',
        {
          id: ticket.id,
          manifest: ticket.manifest,
          row_count: 257,
          primary_count: 257,
          counters: { ...cs, revision: 6n },
        },
      ],
    ]),
  )
  expect(s.imports[`${id(8)}:${hex(ticket.id)}`].status.reserved_bytes).toBe(0n)
  const live: T.MoveLiveState = {
    revision: 5n,
    rows: nodes.map((n, i) => ({
      expires_at: n.expires_at,
      grace_end: n.grace_end,
      expiry_policy: n.subname?.expiry_policy ?? null,
      primary_mapping_id: primaries[i].mapping_id,
    })),
  }
  s = projectReceipt(
    s,
    receipt(279n, [
      [8, 'root_imported', { ticket, counters: { ...cs, revision: 6n }, live }],
      [
        4,
        'root_forwarded',
        {
          ticket,
          forward: {
            root: root.key.root,
            destination: bytes(8),
            destination_ordinal: 1,
            move_id: ticket.id,
            generation: 7n,
            completed_at: 279n,
          },
        },
      ],
    ]),
  )
  expect(Object.keys(s.names)).toHaveLength(257)
  expect(Object.keys(s.primaries)).toHaveLength(257)
  for (const [i, n] of nodes.entries()) {
    expect(s.names[nameStateKey(id(8), n.key)].owner).toEqual(n.owner)
    expect(
      s.primaries[primaryStateKey(id(8), primaries[i].endpoint)].mapping_id,
    ).toBe(BigInt(i + 1000))
  }
}, 20000)
