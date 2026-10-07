/** Transaction-atomic event projection for the frozen layer. @module */
import type * as T from './types.ts'
import { ProjectionJournal, copyEntity } from './projection-journal.ts'
import { contractId, equalBytes, hex, fromHex } from './bytes.ts'
import { stringifyJson, u64 } from './json.ts'
import { assertRecordsDigest, moveManifestDigest } from './digests.ts'
import {
  committedEvents,
  type Receipt,
  type CommittedEvent,
} from './journal.ts'
import type { ContractRole } from './manifest.ts'
import type { EventTopic } from '../indexer/events/indexerEventCatalog.ts'

type EffectTopic = Exclude<EventTopic, 'operation_begin' | 'operation_end'>
type Effect = {
  [K in EffectTopic]: {
    topic: K
    emitter: string
    height: bigint
    body: T.EventTypes[K] extends T.Event<infer B> ? B : never
  }
}[EffectTopic]
export interface ProjectedMove {
  ticket: T.MoveTicket
  lastProgressAt: bigint
  lifecycleDeadline: bigint
  terminalDeadline: bigint | null
  stagedCount: number
  cancelled: T.MoveCancelled | null
  forwarded: T.Forward | null
}
export interface ProjectedImport {
  status: T.ImportStatus
  rows: Record<number, T.ImportRowStaged>
  retainedRows: number
  ready: T.ImportReady | null
  activated: boolean
  cancelled: boolean
}
type MembershipIndex = Record<string, Record<string, true>>
interface MarketTotals {
  unsettledOrders: bigint
  refundAccounts: bigint
  refundableLux: bigint
  escrowLux: bigint
  nextOrderId: bigint
}
export interface ProjectionState {
  schemaVersion: 2
  /** Disable effect retention when the indexer persists its own event history. */
  retainEffects: boolean
  /** Serializable incremental indexes; keep these with every checkpoint. */
  indexes: {
    children: MembershipIndex
    primaries: MembershipIndex
    pendingProposals: MembershipIndex
    openMoves: MembershipIndex
    imports: MembershipIndex
    marketTotals: Record<string, MarketTotals>
  }
  height: bigint
  directoryId: string
  scope: Record<string, ContractRole>
  directory: T.DirectoryConfig | null
  admissions: Record<string, T.Admission>
  markets: Record<string, T.Market>
  proposals: Record<string, T.Proposal>
  initializations: Record<string, unknown>
  policies: Record<string, T.InitPolicy>
  names: Record<string, T.Name>
  history: Record<string, T.Name>
  counters: Record<string, T.RootCounters>
  primaries: Record<string, T.Primary>
  commitments: Record<string, T.Commitment>
  slots: Record<string, T.SlotSnapshot>
  watermarks: Record<string, T.StoreWatermarksChanged>
  forwards: Record<string, T.Forward>
  moves: Record<string, ProjectedMove>
  imports: Record<string, ProjectedImport>
  rootCooldowns: Record<string, bigint>
  initiatorCooldowns: Record<string, bigint>
  vault: {
    protocolLux: string
    liabilityLux: string
    accountedLux: string
    reservedBeneficiaries: number
    sourceVersion: bigint
  }
  sources: Record<string, T.FeeSource>
  referrals: Record<string, T.ReferralRow>
  marketConfigs: Record<string, T.Config>
  orders: Record<string, T.Order>
  closedOrders: Record<string, T.OrderClosed>
  refunds: Record<string, T.Refund>
  effects: CommittedEvent[]
  receipts: Record<string, true>
}
export interface ProjectionOptions {
  directoryId: string
  contracts: Record<string, ContractRole>
  /** Defaults to true; false keeps effects empty for external history storage. */
  retainEffects?: boolean
}
export function nameStateKey(store: string, key: T.NameKey): string {
  return `${contractId(store)}:${hex(key.root)}:${hex(key.node)}`
}
export function rootStateKey(store: string, root: T.Node): string {
  return `${contractId(store)}:${hex(root)}`
}
export function primaryStateKey(store: string, endpoint: T.Endpoint): string {
  return `${contractId(store)}:${hex(endpoint)}`
}
export function slotStateKey(resolver: string, slot: T.SlotKey): string {
  return `${contractId(resolver)}:${hex(slot.registry)}:${hex(slot.node)}:${slot.epoch}`
}
export function principalStateKey(p: T.TypedPrincipal): string {
  return `${p.kind}:${hex(p.bytes)}`
}
const proposalKey = (id: T.ProposalId): string =>
  `${id.operator_epoch}:${id.nonce}`
const refOf = (name: T.Name): T.NameRef => ({
  key: name.key,
  incarnation: name.incarnation,
})
function sameRef(a: T.NameRef, b: T.NameRef): boolean {
  return (
    equalBytes(a.key.root, b.key.root) &&
    equalBytes(a.key.node, b.key.node) &&
    a.incarnation.generation === b.incarnation.generation &&
    a.incarnation.serial === b.incarnation.serial
  )
}
function equal(a: unknown, b: unknown): boolean {
  return stringifyJson(a) === stringifyJson(b)
}
function requireHistory(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition)
    throw new Error(`Missing or inconsistent event history: ${message}`)
}
export function createProjectionState(
  options: ProjectionOptions,
): ProjectionState {
  const scope: Record<string, ContractRole> = {}
  for (const [id, role] of Object.entries(options.contracts))
    scope[contractId(id)] = role
  const directoryId = contractId(options.directoryId)
  if (
    scope[directoryId] !== 'directory' ||
    Object.values(scope).filter((x) => x === 'directory').length !== 1
  )
    throw new Error('Projection needs one release-verified directory')
  return {
    schemaVersion: 2,
    retainEffects: options.retainEffects ?? true,
    indexes: {
      children: {},
      primaries: {},
      pendingProposals: {},
      openMoves: {},
      imports: {},
      marketTotals: {},
    },
    height: 0n,
    directoryId,
    scope,
    directory: null,
    admissions: {},
    markets: {},
    proposals: {},
    initializations: {},
    policies: {},
    names: {},
    history: {},
    counters: {},
    primaries: {},
    commitments: {},
    slots: {},
    watermarks: {},
    forwards: {},
    moves: {},
    imports: {},
    rootCooldowns: {},
    initiatorCooldowns: {},
    vault: {
      protocolLux: '0',
      liabilityLux: '0',
      accountedLux: '0',
      reservedBeneficiaries: 0,
      sourceVersion: 1n,
    },
    sources: {},
    referrals: {},
    marketConfigs: {},
    orders: {},
    closedOrders: {},
    refunds: {},
    effects: [],
    receipts: {},
  }
}
function name(s: ProjectionState, store: string, ref: T.NameRef): T.Name {
  const n = s.names[nameStateKey(store, ref.key)]
  requireHistory(n && sameRef(refOf(n), ref), 'name incarnation')
  return n
}
function addIndex(index: MembershipIndex, group: string, key: string): void {
  index[group] ??= {}
  index[group][key] = true
}
function removeIndex(
  index: MembershipIndex,
  group: string,
  key: string,
): void {
  if (index[group]) delete index[group][key]
}
function refStateKey(store: string, ref: T.NameRef): string {
  return `${nameStateKey(store, ref.key)}:${ref.incarnation.generation}:${ref.incarnation.serial}`
}
function parentKey(store: string, n: T.Name): string | null {
  return n.subname
    ? nameStateKey(store, { root: n.key.root, node: n.subname.parent })
    : null
}
function putName(s: ProjectionState, store: string, n: T.Name): void {
  const key = nameStateKey(store, n.key),
    prior = s.names[key],
    parent = parentKey(store, n),
    oldParent = prior ? parentKey(store, prior) : null
  if (oldParent && oldParent !== parent)
    removeIndex(s.indexes.children, oldParent, key)
  if (parent) addIndex(s.indexes.children, parent, key)
  s.names[key] = copyEntity(n)
  s.history[refStateKey(store, refOf(n))] = copyEntity(n)
}
function removeName(s: ProjectionState, store: string, n: T.Name): void {
  const key = nameStateKey(store, n.key),
    parent = parentKey(store, n)
  if (parent) removeIndex(s.indexes.children, parent, key)
  delete s.names[key]
}
function putPrimary(s: ProjectionState, store: string, p: T.Primary): void {
  const key = primaryStateKey(store, p.endpoint),
    previous = s.primaries[key]
  if (previous)
    removeIndex(s.indexes.primaries, refStateKey(store, previous.name), key)
  s.primaries[key] = p
  addIndex(s.indexes.primaries, refStateKey(store, p.name), key)
}
function clearPrimary(
  s: ProjectionState,
  store: string,
  previous: T.Primary,
): void {
  const key = primaryStateKey(store, previous.endpoint),
    current = s.primaries[key]
  if (
    current &&
    current.mapping_id === previous.mapping_id &&
    sameRef(current.name, previous.name)
  ) {
    removeIndex(s.indexes.primaries, refStateKey(store, current.name), key)
    delete s.primaries[key]
  }
}
function clearNamePrimaries(
  s: ProjectionState,
  store: string,
  n: T.Name,
): void {
  for (const key of Object.keys(
    s.indexes.primaries[refStateKey(store, refOf(n))] ?? {},
  ))
    clearPrimary(s, store, s.primaries[key])
}
function children(s: ProjectionState, store: string, n: T.Name): T.Name[] {
  return Object.keys(s.indexes.children[nameStateKey(store, n.key)] ?? {})
    .sort()
    .map((key) => s.names[key])
}
function tree(s: ProjectionState, store: string, n: T.Name): T.Name[] {
  const rows: T.Name[] = [],
    seen = new Set<string>()
  function visit(row: T.Name): void {
    const key = hex(row.key.node)
    requireHistory(!seen.has(key) && rows.length < 257, 'subtree cycle/bound')
    seen.add(key)
    rows.push(row)
    for (const c of children(s, store, row)) visit(c)
  }
  visit(n)
  return rows
}
function directory(s: ProjectionState): T.DirectoryConfig {
  requireHistory(s.directory, 'directory initialization')
  return s.directory
}
function setDirectoryRevision(d: T.DirectoryConfig, revision: bigint): void {
  d.revision = d.registration.revision = u64(revision)
}
function actionAdmissionRole(action: T.Action): ContractRole {
  if ('AddStore' in action || 'SetAcceptsMoves' in action) return 'store'
  if ('AddResolver' in action) return 'resolver'
  if ('SetPolicy' in action) return 'policy'
  throw new Error('Unexpected directory admission')
}
function moveKey(store: string, id: T.Digest): string {
  return `${store}:${hex(id)}`
}
/** Automatic unlock uses block height and never revives after an elapsed deadline. */
export function moveLockEndsAt(move: ProjectedMove): bigint {
  return (
    move.terminalDeadline ??
    [
      move.ticket.expires_at,
      move.lastProgressAt + 360n,
      move.lifecycleDeadline,
    ].reduce((a, b) => (a < b ? a : b))
  )
}
export function effectiveMoveLock(
  move: ProjectedMove,
  height: bigint,
): boolean {
  return !move.cancelled && !move.forwarded && height < moveLockEndsAt(move)
}
function accountVault(s: ProjectionState): void {
  s.vault.accountedLux = (
    BigInt(s.vault.protocolLux) + BigInt(s.vault.liabilityLux)
  ).toString()
}
function admit(s: ProjectionState, role: ContractRole, a: T.Admission): void {
  requireHistory(a.interface_version === 1, 'admission version')
  const id = contractId(a.id)
  if (s.scope[id] && s.scope[id] !== role)
    throw new Error('Admission role conflict')
  s.scope[id] = role
  s.admissions[id] = a
}
function assertImportPair(
  s: ProjectionState,
  store: string,
  row: T.ImportRowStaged,
): void {
  const original = row.original.name,
    imported = row.imported
  const a = {
    ...original,
    expires_at: 0n,
    grace_end: 0n,
    records: null,
    subname: original.subname
      ? { ...original.subname, expiry_policy: 'InheritsParent' }
      : null,
  }
  const b = {
    ...imported,
    expires_at: 0n,
    grace_end: 0n,
    records: null,
    subname: imported.subname
      ? { ...imported.subname, expiry_policy: 'InheritsParent' }
      : null,
  }
  requireHistory(
    equal(a, b) && !original.custody && !imported.custody,
    'staged locked name fields',
  )
  requireHistory(
    Boolean(original.records) === Boolean(imported.records),
    'staged record pointer',
  )
  if (original.records && imported.records) {
    requireHistory(
      original.records.count === imported.records.count &&
        equalBytes(original.records.digest, imported.records.digest),
      'staged digest',
    )
    const slot =
      s.slots[
        slotStateKey(contractId(imported.records.resolver), {
          registry: fromHex(store, 32),
          node: imported.key.node,
          epoch: imported.records.epoch,
        })
      ]
    requireHistory(slot, 'staged resolver snapshot')
    assertRecordsDigest(
      slot.records,
      imported.records.count,
      imported.records.digest,
    )
  }
  if (row.imported_primary) {
    requireHistory(row.original.primary, 'staged primary source')
    const orig = row.original.primary,
      imp = row.imported_primary
    requireHistory(
      equalBytes(orig.endpoint, imp.endpoint) &&
        sameRef(orig.name, imp.name) &&
        orig.updated_at === imp.updated_at,
      'staged primary identity',
    )
  }
}

function marketTotals(s: ProjectionState, store: string): MarketTotals {
  return (s.indexes.marketTotals[store] ??= {
    unsettledOrders: 0n,
    refundAccounts: 0n,
    refundableLux: 0n,
    escrowLux: 0n,
    nextOrderId: 0n,
  })
}
function orderEscrow(order: T.Order | undefined): bigint {
  return order?.status === 'Open'
    ? BigInt(
        order.terms.kind === 'Offer'
          ? order.terms.amount_lux
          : (order.highest?.amount_lux ?? '0'),
      )
    : 0n
}
function syncMarket(s: ProjectionState, store: string): void {
  const config = s.marketConfigs[store]
  if (!config) return
  const totals = marketTotals(s, store)
  config.unsettled_orders = totals.unsettledOrders
  config.refund_accounts = totals.refundAccounts
  config.refundable_lux = totals.refundableLux.toString()
  config.held_lux = (totals.refundableLux + totals.escrowLux).toString()
  if (totals.nextOrderId > config.next_order_id)
    config.next_order_id = totals.nextOrderId
}
function putOrder(
  s: ProjectionState,
  store: string,
  order: T.Order,
  retain: boolean,
): void {
  const key = `${store}:${order.terms.id}`,
    previous = s.orders[key],
    totals = marketTotals(s, store)
  totals.unsettledOrders += (retain ? 1n : 0n) - (previous ? 1n : 0n)
  totals.escrowLux +=
    (retain ? orderEscrow(order) : 0n) - orderEscrow(previous)
  if (order.terms.id >= totals.nextOrderId)
    totals.nextOrderId = order.terms.id + 1n
  if (retain) s.orders[key] = order
  else delete s.orders[key]
  syncMarket(s, store)
}

function apply(
  s: ProjectionState,
  e: Effect,
  activated: Set<string>,
  forwarded: Set<string>,
): void {
  const store = e.emitter
  switch (e.topic) {
    case 'directory_initialized': {
      requireHistory(
        store === s.directoryId && !s.directory,
        'directory origin',
      )
      s.directory = e.body.config
      s.initializations[store] = e.body.args
      admit(s, 'store', e.body.args.initial_store)
      admit(s, 'resolver', e.body.args.initial_resolver)
      admit(s, 'policy', e.body.args.policy)
      if (e.body.args.initial_market) {
        const m = e.body.args.initial_market
        s.markets[contractId(m.id)] = m
        s.scope[contractId(m.id)] = 'marketplace'
      }
      break
    }
    case 'store_initialized':
    case 'resolver_initialized':
    case 'vault_initialized':
    case 'policy_initialized': {
      requireHistory(
        contractId(e.body.args.binding.directory) === s.directoryId,
        'initialization binding',
      )
      s.initializations[store] = e.body.args
      if (e.topic === 'policy_initialized') s.policies[store] = e.body.args
      if (e.topic === 'vault_initialized')
        for (const source of e.body.args.sources)
          s.sources[contractId(source.id)] = source
      break
    }
    case 'proposal_created': {
      const p = e.body.proposal,
        key = proposalKey(p.id)
      removeIndex(
        s.indexes.pendingProposals,
        String(p.id.operator_epoch),
        key,
      )
      s.proposals[key] = p
      if (p.status === 'Pending')
        addIndex(s.indexes.pendingProposals, String(p.id.operator_epoch), key)
      break
    }
    case 'proposal_cancelled': {
      const p = s.proposals[proposalKey(e.body.id)]
      requireHistory(p, 'proposal cancellation')
      removeIndex(
        s.indexes.pendingProposals,
        String(p.id.operator_epoch),
        proposalKey(p.id),
      )
      p.status = 'Cancelled'
      break
    }
    case 'proposal_executed': {
      const p = s.proposals[proposalKey(e.body.id)]
      requireHistory(
        p && equalBytes(p.action_hash, e.body.action_hash),
        'proposal execution',
      )
      removeIndex(
        s.indexes.pendingProposals,
        String(p.id.operator_epoch),
        proposalKey(p.id),
      )
      p.status = 'Executed'
      break
    }
    case 'proposal_pruned':
      removeIndex(
        s.indexes.pendingProposals,
        String(e.body.id.operator_epoch),
        proposalKey(e.body.id),
      )
      delete s.proposals[proposalKey(e.body.id)]
      break
    case 'action_applied': {
      s.directory = e.body.config
      if (e.body.admission)
        admit(s, actionAdmissionRole(e.body.action), e.body.admission)
      if (e.body.market) {
        const m = e.body.market
        s.markets[contractId(m.id)] = m
        s.scope[contractId(m.id)] = 'marketplace'
      }
      if ('SetAcceptsMoves' in e.body.action) {
        const a = e.body.action.SetAcceptsMoves
        requireHistory(s.admissions[contractId(a.store)], 'store admission')
        s.admissions[contractId(a.store)].accepts_moves = a.value
      }
      break
    }
    case 'operator_changed': {
      const d = directory(s)
      d.operator = e.body.current
      d.operator_epoch = e.body.operator_epoch
      d.registration.operator = e.body.current.principal
      setDirectoryRevision(d, d.revision + 1n)
      break
    }
    case 'guardian_changed': {
      const d = directory(s)
      d.guardian = e.body.current
      d.guardian_epoch = e.body.guardian_epoch
      d.registration.guardian_suspended = e.body.suspended
      setDirectoryRevision(d, d.revision + 1n)
      break
    }
    case 'proposals_invalidated': {
      const epoch = String(e.body.previous_operator_epoch)
      for (const key of Object.keys(s.indexes.pendingProposals[epoch] ?? {}))
        s.proposals[key].status = 'Invalidated'
      delete s.indexes.pendingProposals[epoch]
      break
    }
    case 'registration_pause_changed': {
      const d = directory(s)
      d.registration.operator_paused = e.body.paused
      setDirectoryRevision(d, e.body.revision)
      break
    }
    case 'policy_suspension_changed': {
      const d = directory(s)
      d.registration.guardian_suspended = e.body.suspended
      setDirectoryRevision(d, e.body.revision)
      break
    }
    case 'delays_changed': {
      const d = directory(s)
      d.proposal_delay = e.body.proposal_delay
      d.guardian_delay = e.body.guardian_delay
      setDirectoryRevision(d, e.body.revision)
      break
    }
    case 'commitment_created': {
      const c = e.body.commitment
      s.commitments[`${store}:${hex(c.key.actor)}:${hex(c.key.hash)}`] = c
      break
    }
    case 'commitment_removed': {
      const c = e.body.commitment
      delete s.commitments[`${store}:${hex(c.key.actor)}:${hex(c.key.hash)}`]
      break
    }
    case 'root_registered':
    case 'subname_created':
      putName(s, store, e.body.name)
      break
    case 'root_renewed': {
      const b = e.body,
        n = name(s, store, b.root)
      requireHistory(
        b.inheritance_rule === 1 &&
          n.expires_at === b.old_expiry &&
          n.grace_end === b.old_grace_end,
        'renewal baseline',
      )
      for (const key of Object.keys(
        s.indexes.openMoves[refStateKey(store, b.root)] ?? {},
      )) {
        const m = s.moves[key],
          end = moveLockEndsAt(m)
        if (e.height < end) m.lifecycleDeadline = b.expires_at
        else {
          m.terminalDeadline = end
          removeIndex(s.indexes.openMoves, refStateKey(store, b.root), key)
        }
      }
      function renew(row: T.Name): void {
        row.expires_at = b.expires_at
        row.grace_end = b.grace_end
        putName(s, store, row)
        for (const child of children(s, store, row))
          if (child.subname!.expiry_policy === 'InheritsParent') renew(child)
      }
      renew(n)
      break
    }
    case 'subtree_removed': {
      const b = e.body,
        n = name(s, store, b.target),
        rows = tree(s, store, n).slice(b.include_target ? 0 : 1)
      requireHistory(rows.length === b.removed_count, 'subtree removed count')
      for (const row of rows) {
        clearNamePrimaries(s, store, row)
        removeName(s, store, row)
      }
      break
    }
    case 'authorities_changed': {
      const b = e.body
      name(s, store, refOf(b.name))
      if (b.data_cleared) clearNamePrimaries(s, store, b.name)
      putName(s, store, b.name)
      break
    }
    case 'identity_cleared': {
      const b = e.body,
        n = name(s, store, b.name)
      n.records = null
      if (b.old_primary) clearPrimary(s, store, b.old_primary)
      putName(s, store, n)
      break
    }
    case 'slot_changed': {
      const b = e.body,
        n = name(s, store, b.name)
      n.records = b.current
      putName(s, store, n)
      break
    }
    case 'primary_changed': {
      const b = e.body
      if (b.previous) clearPrimary(s, store, b.previous)
      if (b.current) {
        name(s, store, b.current.name)
        putPrimary(s, store, b.current)
      }
      break
    }
    case 'custody_started': {
      const n = name(s, store, e.body.name)
      n.custody = e.body.custody
      putName(s, store, n)
      break
    }
    case 'custody_ended': {
      const n = name(s, store, e.body.name)
      if (n.custody?.nonce === e.body.nonce) n.custody = null
      putName(s, store, n)
      break
    }
    case 'root_counters_changed':
      s.counters[rootStateKey(store, e.body.root)] = e.body.counters
      break
    case 'store_watermarks_changed':
      s.watermarks[store] = e.body
      break
    case 'resolver_slot_written': {
      const b = e.body
      assertRecordsDigest(
        b.snapshot.records,
        b.snapshot.count,
        b.snapshot.digest,
      )
      const key = slotStateKey(store, b.slot)
      if (b.snapshot.count === 0) delete s.slots[key]
      else s.slots[key] = b.snapshot
      break
    }
    case 'resolver_slot_pruned':
      delete s.slots[slotStateKey(store, e.body.slot)]
      break
    case 'fee_source_changed':
      s.sources[contractId(e.body.source.id)] = e.body.source
      s.vault.sourceVersion = e.body.source_version
      break
    case 'beneficiary_reserved':
      s.referrals[principalStateKey(e.body.beneficiary)] = {
        beneficiary: e.body.beneficiary,
        claimable_lux: '0',
      }
      s.vault.reservedBeneficiaries = e.body.reserved_beneficiaries
      break
    case 'fee_received': {
      const b = e.body
      s.vault.protocolLux = b.protocol_lux
      s.vault.liabilityLux = b.liability_lux
      if (b.metadata.beneficiary) {
        const key = principalStateKey(b.metadata.beneficiary)
        requireHistory(s.referrals[key], 'beneficiary reservation')
        s.referrals[key].claimable_lux = b.beneficiary_claimable_lux
      }
      accountVault(s)
      break
    }
    case 'referral_claimed': {
      const b = e.body,
        key = principalStateKey(b.beneficiary)
      requireHistory(s.referrals[key], 'referral claim')
      s.referrals[key].claimable_lux = b.remaining_lux
      s.vault.liabilityLux = b.liability_lux
      accountVault(s)
      break
    }
    case 'protocol_claimed':
      s.vault.protocolLux = e.body.remaining_lux
      accountVault(s)
      break
    case 'move_started': {
      const b = e.body
      requireHistory(contractId(b.ticket.source) === store, 'move source')
      s.moves[moveKey(store, b.ticket.id)] = {
        ticket: b.ticket,
        lastProgressAt: b.ticket.created_at,
        lifecycleDeadline: b.lifecycle_deadline,
        terminalDeadline: null,
        stagedCount: 0,
        cancelled: null,
        forwarded: null,
      }
      addIndex(
        s.indexes.openMoves,
        refStateKey(store, b.ticket.root),
        moveKey(store, b.ticket.id),
      )
      const rootKey = rootStateKey(store, b.ticket.root.key.root),
        actorKey = `${store}:${hex(b.ticket.initiator)}`
      if (
        s.rootCooldowns[rootKey] !== undefined &&
        e.height >= s.rootCooldowns[rootKey] + 8640n
      )
        delete s.rootCooldowns[rootKey]
      if (
        s.initiatorCooldowns[actorKey] !== undefined &&
        e.height >= s.initiatorCooldowns[actorKey] + 8640n
      )
        delete s.initiatorCooldowns[actorKey]
      break
    }
    case 'move_progressed': {
      const b = e.body,
        m = s.moves[moveKey(store, b.id)]
      requireHistory(
        m &&
          effectiveMoveLock(m, e.height) &&
          b.staged_count === m.stagedCount + 1,
        'move progress',
      )
      m.stagedCount = b.staged_count
      m.lastProgressAt = b.last_progress_at
      break
    }
    case 'import_prepared': {
      const status = e.body.status
      requireHistory(
        contractId(status.ticket.destination) === store,
        'import destination',
      )
      s.imports[moveKey(store, status.ticket.id)] = {
        status,
        rows: {},
        retainedRows: 0,
        ready: null,
        activated: false,
        cancelled: false,
      }
      addIndex(
        s.indexes.imports,
        rootStateKey(store, status.ticket.root.key.root),
        moveKey(store, status.ticket.id),
      )
      break
    }
    case 'import_row_staged': {
      const b = e.body,
        g = s.imports[moveKey(store, b.id)]
      requireHistory(g && !g.cancelled && !g.activated, 'import group')
      requireHistory(
        b.index === g.retainedRows && b.index === b.original.index,
        'import row index',
      )
      assertImportPair(s, store, b)
      g.rows[b.index] = b
      g.retainedRows++
      g.status.staged_count++
      g.status.staged_primaries += b.imported_primary ? 1 : 0
      g.status.last_progress_at = e.height
      g.status.staged = g.status.staged.map((value, index) =>
        index === b.index >> 3 ? value | (1 << (b.index % 8)) : value,
      )
      requireHistory(g.status.reserved_bytes >= 2048n, 'import reservation')
      g.status.reserved_bytes -= 2048n
      if (
        b.imported.records &&
        b.imported.records.epoch >= g.status.prepared_counters.next_epoch
      )
        g.status.prepared_counters.next_epoch = b.imported.records.epoch + 1n
      break
    }
    case 'import_ready': {
      const b = e.body,
        g = s.imports[moveKey(store, b.id)]
      requireHistory(g && !g.cancelled, 'import readiness')
      const rows = Object.values(g.rows).sort((a, b) => a.index - b.index)
      requireHistory(
        rows.length === b.row_count &&
          b.row_count === g.status.ticket.row_count &&
          rows.filter((r) => r.imported_primary).length === b.primary_count,
        'import readiness counts',
      )
      const digest = moveManifestDigest(
        g.status.ticket,
        rows.map((r) => r.original),
      )
      requireHistory(
        equalBytes(digest, b.manifest) &&
          equalBytes(digest, g.status.ticket.manifest),
        'import manifest seal',
      )
      g.ready = b
      g.status.ready = true
      g.status.prepared_counters = b.counters
      break
    }
    case 'root_imported': {
      const b = e.body,
        id = hex(b.ticket.id),
        g = s.imports[moveKey(store, b.ticket.id)],
        source = contractId(b.ticket.source)
      requireHistory(
        g &&
          g.ready &&
          !g.cancelled &&
          !g.activated &&
          equal(g.status.ticket, b.ticket),
        'sealed import history',
      )
      const rows = Object.values(g.rows).sort((a, b) => a.index - b.index)
      requireHistory(
        rows.length === b.live.rows.length &&
          b.counters.revision === b.live.revision + 1n,
        'activation live vector/revision',
      )
      const counters =
        s.counters[rootStateKey(source, b.ticket.root.key.root)]
      const preparation = s.moves[moveKey(source, b.ticket.id)]
      requireHistory(
        counters &&
          counters.revision === b.live.revision &&
          preparation &&
          effectiveMoveLock(preparation, e.height) &&
          g.status.reserved_bytes === 0n,
        'source live counters',
      )
      requireHistory(
        equal(
          { ...g.ready.counters, revision: b.live.revision + 1n },
          b.counters,
        ),
        'destination prepared counters',
      )
      for (const [i, row] of rows.entries()) {
        const live = b.live.rows[i],
          n = copyEntity(row.imported),
          src = name(s, source, refOf(row.original.name))
        requireHistory(
          src.expires_at === live.expires_at &&
            src.grace_end === live.grace_end &&
            (src.subname?.expiry_policy ?? null) === live.expiry_policy,
          'source lifecycle reconciliation',
        )
        requireHistory(
          equal(
            { ...src, expires_at: 0n, grace_end: 0n },
            { ...row.original.name, expires_at: 0n, grace_end: 0n },
          ),
          'source locked fields',
        )
        n.expires_at = live.expires_at
        n.grace_end = live.grace_end
        if (n.subname) {
          requireHistory(live.expiry_policy !== null, 'subname inheritance')
          n.subname.expiry_policy = live.expiry_policy
        } else requireHistory(live.expiry_policy === null, 'root inheritance')
        putName(s, store, n)
        if (live.primary_mapping_id !== 0n) {
          const orig = row.original.primary,
            imp = row.imported_primary
          requireHistory(
            orig && imp && orig.mapping_id === live.primary_mapping_id,
            'live primary candidate',
          )
          const current = s.primaries[primaryStateKey(source, orig.endpoint)]
          requireHistory(
            current &&
              current.mapping_id === orig.mapping_id &&
              sameRef(current.name, orig.name),
            'source primary reconciliation',
          )
          const existing = s.primaries[primaryStateKey(store, imp.endpoint)]
          requireHistory(!existing, 'destination primary conflict')
          putPrimary(s, store, imp)
        }
      }
      s.counters[rootStateKey(store, b.ticket.root.key.root)] = b.counters
      g.activated = true
      g.status.activated = true
      g.status.prepared_counters = b.counters
      activated.add(id)
      break
    }
    case 'root_forwarded': {
      const b = e.body,
        id = hex(b.ticket.id),
        m = s.moves[moveKey(store, b.ticket.id)]
      requireHistory(
        activated.has(id) &&
          m &&
          equal(m.ticket, b.ticket) &&
          equalBytes(b.forward.move_id, b.ticket.id) &&
          equalBytes(b.forward.root, b.ticket.root.key.root),
        'atomic forwarded/imported pair',
      )
      const root = name(s, store, b.ticket.root)
      for (const row of tree(s, store, root)) {
        clearNamePrimaries(s, store, row)
        removeName(s, store, row)
      }
      s.forwards[rootStateKey(store, b.forward.root)] = b.forward
      removeIndex(
        s.indexes.openMoves,
        refStateKey(store, m.ticket.root),
        moveKey(store, m.ticket.id),
      )
      m.forwarded = b.forward
      forwarded.add(id)
      break
    }
    case 'move_cancelled': {
      const b = e.body,
        m = s.moves[moveKey(store, b.ticket.id)]
      requireHistory(m && equal(m.ticket, b.ticket), 'move cancellation')
      requireHistory(
        b.cooldown_applied ===
          (b.reason === 'Owner' || b.reason === 'Idle') &&
          b.cancelled_at === e.height,
        'move cooldown reason/height',
      )
      removeIndex(
        s.indexes.openMoves,
        refStateKey(store, m.ticket.root),
        moveKey(store, m.ticket.id),
      )
      m.cancelled = b
      m.terminalDeadline = moveLockEndsAt(m)
      if (b.cooldown_applied) {
        s.rootCooldowns[rootStateKey(store, b.ticket.root.key.root)] =
          b.cancelled_at
        s.initiatorCooldowns[`${store}:${hex(b.ticket.initiator)}`] =
          b.cancelled_at
      }
      break
    }
    case 'import_rows_pruned': {
      const b = e.body,
        key = moveKey(store, b.id),
        g = s.imports[key]
      requireHistory(
        g && !g.activated && b.cancelled,
        'cancelled import cleanup',
      )
      g.cancelled = true
      g.status.cancelled = true
      g.status.reserved_bytes = 0n
      for (const i of b.indices) {
        if (g.rows[i]) g.retainedRows--
        delete g.rows[i]
      }
      requireHistory(g.retainedRows === b.remaining, 'import prune remainder')
      if (b.remaining === 0) {
        removeIndex(
          s.indexes.imports,
          rootStateKey(store, g.status.ticket.root.key.root),
          key,
        )
        delete s.imports[key]
      }
      break
    }
    case 'forwarded_rows_pruned': {
      requireHistory(
        s.forwards[rootStateKey(store, e.body.root)],
        'permanent forward cleanup',
      )
      if (e.body.remaining === 0) {
        const group = rootStateKey(store, e.body.root)
        for (const key of Object.keys(s.indexes.imports[group] ?? {})) {
          if (s.imports[key].activated) {
            removeIndex(s.indexes.imports, group, key)
            delete s.imports[key]
          }
        }
      }
      break
    }
    case 'market_configured':
      s.marketConfigs[store] = e.body.config
      syncMarket(s, store)
      break
    case 'order_changed':
      putOrder(s, store, e.body.order, true)
      break
    case 'order_closed': {
      const b = e.body
      s.closedOrders[`${store}:${b.order.terms.id}`] = b
      putOrder(
        s,
        store,
        b.order,
        b.order.status === 'ReturnPending' &&
          (b.reason === 'Cancelled' || b.reason === 'Expired'),
      )
      break
    }
    case 'refund_changed': {
      const key = `${store}:${hex(e.body.refund.authority)}`,
        previous = s.refunds[key],
        totals = marketTotals(s, store)
      totals.refundAccounts += previous ? 0n : 1n
      totals.refundableLux +=
        BigInt(e.body.refund.amount_lux) - BigInt(previous?.amount_lux ?? '0')
      s.refunds[key] = e.body.refund
      syncMarket(s, store)
      break
    }
    case 'refund_claimed':
    case 'trade_settled':
    case 'escrow_renewed':
      break // Audited below; authoritative balance/order effects have their own events.
    default: {
      const exhaustive: never = e
      throw new Error(`Unprojected event ${String(exhaustive)}`)
    }
  }
}
/** Discover only journal-committed admissions, then include later events from their emitters. */
function receiptEffects(
  previous: ProjectionState,
  receipt: Receipt,
): CommittedEvent[] {
  const effects = committedEvents(receipt, previous.scope),
    scope: Record<string, ContractRole> = Object.create(previous.scope),
    admittedAt = new Map<string, number>()
  function add(id: T.Contract, role: ContractRole, ordinal: number): void {
    const emitter = contractId(id)
    if (scope[emitter]) return
    scope[emitter] = role
    admittedAt.set(emitter, ordinal)
  }
  for (const event of effects) {
    if (event.emitter !== previous.directoryId) continue
    if (event.topic === 'directory_initialized') {
      const { args } = (event.data as T.Event<T.DirectoryInitialized>).body
      add(args.initial_store.id, 'store', event.ordinal)
      add(args.initial_resolver.id, 'resolver', event.ordinal)
      add(args.policy.id, 'policy', event.ordinal)
      if (args.initial_market)
        add(args.initial_market.id, 'marketplace', event.ordinal)
    } else if (event.topic === 'action_applied') {
      const body = (event.data as T.Event<T.ActionApplied>).body
      if (body.admission)
        add(
          body.admission.id,
          actionAdmissionRole(body.action),
          event.ordinal,
        )
      if (body.market) add(body.market.id, 'marketplace', event.ordinal)
    }
  }
  if (!admittedAt.size) return effects
  // Earlier operations from a newly admitted emitter remain out of scope.
  // Re-run journal framing as well as effect decoding for the expanded scope.
  return committedEvents(
    {
      ...receipt,
      events: receipt.events.filter((event) => {
        const emitter = event.emitter.replace(/^0x/u, '').toLowerCase(),
          ordinal = admittedAt.get(emitter)
        return ordinal === undefined || event.ordinal > ordinal
      }),
    },
    scope,
  )
}
/** Apply in place and return the same state. A rejected receipt leaves it exactly unchanged. */
export function projectReceipt(
  previous: ProjectionState,
  receipt: Receipt,
): ProjectionState {
  if (Object.hasOwn(previous.receipts, receipt.id)) return previous
  if (receipt.height < previous.height)
    throw new Error('Rollback before replaying an older block')
  const effects = receiptEffects(previous, receipt),
    journal = new ProjectionJournal(),
    next = journal.view(previous),
    activated = new Set<string>(),
    forwarded = new Set<string>()
  try {
    for (const event of effects) {
      if (!next.scope[event.emitter]) continue
      requireHistory(
        event.topic !== 'operation_begin' && event.topic !== 'operation_end',
        'framing event leaked',
      )
      const effect = {
        topic: event.topic,
        emitter: event.emitter,
        height: event.height,
        // Decoding owns event.data; mutable state must not share retained evidence.
        body: next.retainEffects
          ? structuredClone((event.data as T.Event<unknown>).body)
          : (event.data as T.Event<unknown>).body,
      } as Effect
      apply(next, effect, activated, forwarded)
      if (next.retainEffects) journal.append(previous.effects, event)
    }
    requireHistory(
      activated.size === forwarded.size &&
        [...activated].every((id) => forwarded.has(id)),
      'incomplete atomic move',
    )
    next.height = receipt.height
    next.receipts[receipt.id] = true
    journal.commit()
    return previous
  } catch (error) {
    journal.rollback()
    throw error
  }
}
/** Deliberately copy the entire projection for a checkpoint or a stable consumer view. */
export function snapshotProjection(state: ProjectionState): ProjectionState {
  return structuredClone(state)
}
/** Resume from an independent copy, preserving the reusable checkpoint and all indexes. */
export function restoreProjection(
  snapshot: ProjectionState,
): ProjectionState {
  if (snapshot.schemaVersion !== 2)
    throw new Error(
      'Unsupported projection snapshot; replay receipts with schema version 2',
    )
  return snapshotProjection(snapshot)
}
export interface Projector {
  /** Live state; use snapshotProjection for an independent view. */
  readonly state: ProjectionState
  apply(receipt: Receipt): ProjectionState
  /** Explicitly retain this height for rollback. Call only at complete block boundaries. */
  checkpoint(): void
  /** Restore an exact checkpoint height, discarding newer checkpoints. */
  rollbackTo(height: bigint): ProjectionState
}
/** In-place convenience projector with explicitly requested, in-memory checkpoints. */
export function createProjector(options: ProjectionOptions): Projector {
  let current = createProjectionState(options)
  const checkpoints = new Map<bigint, ProjectionState>([
    [0n, snapshotProjection(current)],
  ])
  return {
    get state() {
      return current
    },
    apply(receipt) {
      return projectReceipt(current, receipt)
    },
    checkpoint() {
      checkpoints.set(current.height, snapshotProjection(current))
    },
    rollbackTo(height) {
      const checkpoint = checkpoints.get(height)
      if (!checkpoint)
        throw new Error('No projection checkpoint at requested height')
      current = restoreProjection(checkpoint)
      for (const h of checkpoints.keys())
        if (h > height) checkpoints.delete(h)
      return current
    },
  }
}
/** Active primary resolution from projected names and full resolver events only. */
export function projectedPrimary(
  state: ProjectionState,
  endpoint: T.Endpoint,
  height: bigint,
): { store: string; primary: T.Primary; name: T.Name } | null {
  let result: { store: string; primary: T.Primary; name: T.Name } | null =
    null
  for (const [key, p] of Object.entries(state.primaries)) {
    if (!equalBytes(p.endpoint, endpoint)) continue
    const store = key.slice(0, 64),
      n = state.names[nameStateKey(store, p.name.key)]
    if (
      !n ||
      !sameRef(refOf(n), p.name) ||
      height >= n.expires_at ||
      !n.records
    )
      continue
    const slot =
      state.slots[
        slotStateKey(contractId(n.records.resolver), {
          registry: fromHex(store, 32),
          node: n.key.node,
          epoch: n.records.epoch,
        })
      ]
    requireHistory(slot, 'primary resolver history')
    assertRecordsDigest(slot.records, n.records.count, n.records.digest)
    if (
      !slot.records.some(
        (r) => r.key === 'moonlight_address' && equalBytes(r.value, endpoint),
      )
    )
      continue
    requireHistory(!result, 'pool primary uniqueness')
    result = { store, primary: p, name: n }
  }
  return result
}
/** Physical resolver data remains after logical identity removal until a prune event. */
export function projectedSlotLiveness(
  state: ProjectionState,
  resolver: string,
  slot: T.SlotKey,
): T.SlotLiveness {
  const registry = contractId(slot.registry)
  for (const [key, n] of Object.entries(state.names))
    if (
      key.startsWith(`${registry}:`) &&
      equalBytes(n.key.node, slot.node) &&
      n.records?.epoch === slot.epoch &&
      contractId(n.records.resolver) === contractId(resolver)
    )
      return 'Current'
  for (const g of Object.values(state.imports))
    if (
      !g.cancelled &&
      !g.activated &&
      contractId(g.status.ticket.destination) === registry
    )
      for (const row of Object.values(g.rows)) {
        const n = row.imported
        if (
          equalBytes(n.key.node, slot.node) &&
          n.records?.epoch === slot.epoch &&
          contractId(n.records.resolver) === contractId(resolver)
        )
          return 'Staged'
      }
  return 'Stale'
}
/** Projected home preserves forwarding after cleanup and later generations. */
export function projectedHome(
  state: ProjectionState,
  store: string,
  root: T.Node,
): T.Home {
  const forward = state.forwards[rootStateKey(store, root)]
  if (forward) return { Forwarded: structuredClone(forward) }
  if (state.names[nameStateKey(store, { root, node: root })]) return 'Local'
  for (const group of Object.values(state.imports))
    if (
      !group.activated &&
      contractId(group.status.ticket.destination) === contractId(store) &&
      equalBytes(group.status.ticket.root.key.root, root)
    )
      return { Staged: [...group.status.ticket.id] }
  return 'Absent'
}
/** Canonical lifecycle from event state and a caller's block snapshot. */
export function projectedName(
  state: ProjectionState,
  store: string,
  key: T.NameKey,
  height: bigint,
): T.Located<T.NameView> {
  const home = projectedHome(state, store, key.root)
  if (typeof home === 'object' && 'Forwarded' in home) return home
  const row = state.names[nameStateKey(store, key)]
  if (!row) return 'Absent'
  const pending = Object.values(state.moves).find(
    (m) =>
      contractId(m.ticket.source) === contractId(store) &&
      equalBytes(m.ticket.root.key.root, key.root) &&
      effectiveMoveLock(m, height),
  )
  return {
    Local: {
      name: structuredClone(row),
      counters: row.subname
        ? null
        : structuredClone(
            state.counters[rootStateKey(store, key.root)] ?? null,
          ),
      active: height < row.expires_at,
      renewable: !row.subname && height < row.grace_end,
      move_pending: pending ? [...pending.ticket.id] : null,
    },
  }
}
export function projectedRecords(
  state: ProjectionState,
  store: string,
  key: T.NameKey,
): T.Located<T.RecordsView> {
  const home = projectedHome(state, store, key.root)
  if (typeof home === 'object' && 'Forwarded' in home) return home
  const n = state.names[nameStateKey(store, key)]
  if (!n) return 'Absent'
  if (!n.records) return { Local: { pointer: null, records: [] } }
  const snapshot =
    state.slots[
      slotStateKey(contractId(n.records.resolver), {
        registry: fromHex(contractId(store), 32),
        node: key.node,
        epoch: n.records.epoch,
      })
    ]
  requireHistory(snapshot, 'resolver records')
  assertRecordsDigest(snapshot.records, n.records.count, n.records.digest)
  return {
    Local: {
      pointer: structuredClone(n.records),
      records: structuredClone(snapshot.records),
    },
  }
}
export function projectedChildren(
  state: ProjectionState,
  store: string,
  page: T.ChildPage,
): T.Located<T.Children> {
  const home = projectedHome(state, store, page.parent.root)
  if (typeof home === 'object' && 'Forwarded' in home) return home
  const n = state.names[nameStateKey(store, page.parent)]
  if (!n) return 'Absent'
  if (!Number.isInteger(page.limit) || page.limit < 1 || page.limit > 16)
    throw new Error('Child page limit must be 1..16')
  const rows = children(state, contractId(store), n).filter(
      (c) => !page.after || hex(c.key.node) > hex(page.after),
    ),
    selected = rows.slice(0, page.limit)
  return {
    Local: {
      rows: structuredClone(selected),
      next:
        rows.length > selected.length ? [...selected.at(-1)!.key.node] : null,
    },
  }
}
export function projectedCommitment(
  state: ProjectionState,
  store: string,
  key: T.CommitmentKey,
  height: bigint,
  raw = false,
): T.Commitment | null {
  const c =
    state.commitments[
      `${contractId(store)}:${hex(key.actor)}:${hex(key.hash)}`
    ]
  return c &&
    (raw || (height >= c.created_at && height - c.created_at <= 8640n))
    ? structuredClone(c)
    : null
}
export function projectedMoveStatus(
  state: ProjectionState,
  store: string,
  id: T.Digest,
  height: bigint,
): T.MoveStatus | null {
  const move = state.moves[moveKey(contractId(store), id)]
  if (!move || move.cancelled) return null
  if (move.forwarded) return { Forwarded: structuredClone(move.forwarded) }
  const end = moveLockEndsAt(move)
  return {
    Preparing: {
      ticket: structuredClone(move.ticket),
      staged_count: move.stagedCount,
      last_progress_at: move.lastProgressAt,
      lifecycle_deadline: move.lifecycleDeadline,
      lock_ends_at: end,
      stale: height >= end,
      idle:
        height >= end &&
        end !== move.lifecycleDeadline &&
        end !== move.ticket.expires_at,
    },
  }
}
export function projectedCooldowns(
  state: ProjectionState,
  store: string,
  query: T.MoveCooldownQuery,
  height: bigint,
): T.Located<T.MoveCooldowns> {
  const home = projectedHome(state, store, query.root)
  if (typeof home === 'object' && 'Forwarded' in home) return home
  if (home !== 'Local') return 'Absent'
  const valid = (t: bigint | undefined): bigint | null =>
    t !== undefined && (height < t || height - t < 8640n) ? t : null
  return {
    Local: {
      root_cancelled_at: valid(
        state.rootCooldowns[rootStateKey(store, query.root)],
      ),
      initiator_cancelled_at: valid(
        state.initiatorCooldowns[
          `${contractId(store)}:${hex(query.initiator)}`
        ],
      ),
    },
  }
}
