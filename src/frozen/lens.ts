/**
 * The read lens (`dusk-domains-lens` v1): decoding its replies and the checks a client makes on each
 * reply's evidence before using it. Internal: no package entrypoint exports it.
 * @module
 */
import { contractId, equalBytes, fromHex, hash, hex, nameKey as nameKeyOf } from './bytes.ts'
import { canonicalBytes } from './digests.ts'
import { stringifyJson } from './json.ts'
import { initCommitment, markLensRows } from './trust.ts'
import { wireValue } from './wire.ts'
import { lensCatalog, type LensMethod } from './lens-schema.ts'
import { MAX_REGISTRATION_AHEAD_BLOCKS, REGISTRATION_YEAR_BLOCKS } from '../core/lifecycle.ts'
import { estimateRegistrationQuote } from '../core/pricing.ts'
import { primaryNameStatus } from '../core/primary.ts'
import type { DataDriver } from './driver.ts'
import type { ContractRole, LoadedRelease } from './manifest.ts'
import type {
  Admission,
  Binding,
  Contract,
  DirectoryAllocationReturn,
  DirectoryConfig,
  Forward,
  Located,
  Market,
  NameKey,
  NameView,
  Node,
  PolicyConfig,
  PrimaryView,
  QuoteRequest,
  RecordValue,
  RecordsView,
  RegistrationContext,
  RegistrationQuote,
  ReleasedRoot,
  RenewalSchedule,
} from './types.ts'

/** A name's lifecycle at a reply's height, from the store's own `active` and `renewable` flags. */
export type NameLifecycle = 'Absent' | 'Active' | 'Grace' | 'Released' | 'Expired'
export interface Evidence {
  stores: Admission[]
  resolvers: Admission[]
}
export interface PolicyEvidence {
  policy: Contract
  policy_version: bigint
  binding: Binding
  config: PolicyConfig
}
export interface LensVerifiedPrimary {
  store: Contract
  primary: PrimaryView
  record: RecordValue
}
export interface LensRefusal {
  code: string
  contract: Contract | null
  cause: string | null
  height: bigint
}
/** Everything a root's renewal quote reads, for display: `total = annual_lux * years`. */
export interface RenewalInputs {
  schedule: RenewalSchedule
  annual_lux: string
  referral: boolean
  /** The most years the ten-year horizon allows now; 0 past the grace end. */
  max_years: number
}
export interface LensResolution {
  height: bigint
  key: NameKey
  store: Contract
  forwards: Forward[]
  name: Located<NameView>
  status: NameLifecycle
  records: (RecordValue | null)[]
  consulted: Evidence
}
export interface LensReverse {
  height: bigint
  endpoint: number[]
  primary: LensVerifiedPrimary | null
  consulted: Evidence
}
export interface LensNamePage {
  height: bigint
  key: NameKey
  store: Contract
  forwards: Forward[]
  name: Located<NameView>
  status: NameLifecycle
  records: RecordsView | null
  primary: { endpoint: number[] | null; verified: LensVerifiedPrimary | null; is_primary: boolean; refused: LensRefusal | null }
  renewal: RenewalInputs | null
  consulted: Evidence
}
export interface LensAvailability {
  height: bigint
  node: Node
  context: RegistrationContext
  status:
    | { Registered: { store: Contract; name: NameView } }
    | {
        Registrable: {
          placement: { store: Contract; canonical_store: Contract | null; released_root: ReleasedRoot | null }
          request: QuoteRequest
          quote: RegistrationQuote
        }
      }
  consulted: Evidence
  policy: PolicyEvidence | null
}
export interface LensPricing {
  height: bigint
  context: RegistrationContext
  policy: PolicyEvidence
}
export interface LensBootstrap {
  height: bigint
  config: DirectoryConfig
  allocation: DirectoryAllocationReturn
  stores: Admission[]
  resolvers: Admission[]
  market: { market: Market; order_api_version: number } | null
}

/** Why a lens answer was not used. Every one sends that call to the direct reads. */
export type LensFallbackReason = 'deployment' | 'refused' | 'decode' | 'height' | 'evidence' | 'unsupported' | 'read'
export class LensFailure extends Error {
  readonly reason: LensFallbackReason
  /** The lens's refusal, for `refused`. */
  readonly refusal?: LensRefusal
  /** Counts toward turning the lens off for its method: a reply that did not decode or check. */
  readonly strikes: boolean
  constructor(reason: LensFallbackReason, message: string, options: { refusal?: LensRefusal; strikes?: boolean } = {}) {
    super(message)
    this.name = 'LensFailure'
    this.reason = reason
    if (options.refusal) this.refusal = options.refusal
    this.strikes = options.strikes ?? (reason === 'decode' || reason === 'evidence')
  }
}
/**
 * Policies whose pricing this SDK computes (`estimateRegistrationQuote`), by code hash: the published
 * v1 policy. A reply priced by another reads directly.
 */
export const PRICED_POLICIES: ReadonlySet<string> = new Set(['c6a9d9013d8dc2c0e3415b8aafbcc1d5c91d275531d7e677ab3cff57b22de678'])
const evidence = (message: string): never => {
  throw new LensFailure('evidence', message)
}

/** What a reply's evidence is checked against: the client's own release and refusals. */
export interface EvidenceContext {
  release: LoadedRelease
  refused: { has(id: string): boolean }
  /** Code and init hashes the client verified a contract with, compared again here. */
  known: (id: string) => { codeHash?: string; initHash?: string } | undefined
  /** The policy the client read directly as the directory's selection at a version, if it did. */
  selection: (version: bigint) => string | undefined
  /** The highest store ordinal the client has seen: a reply lists every store up to it. */
  storeMark: number
  directoryId: string
  vaultId: string
}
/** The binding every contract of the release names: its directory, vault and network. */
export function releaseBinding(ctx: EvidenceContext): Binding {
  return {
    directory: fromHex(ctx.directoryId, 32),
    vault: fromHex(ctx.vaultId, 32),
    network: ctx.release.manifest.network,
  }
}
export const sameBinding = (a: Binding, b: Binding): boolean =>
  equalBytes(a.directory, b.directory) && equalBytes(a.vault, b.vault) && a.network === b.network

/**
 * A directory record of a contract, as the lens read it, checked as `verify` checks the record it
 * reads: a contract the release lists in `role`, not refused by this client, at interface version 1,
 * with the release's code and init hashes where it carries them, and those it was verified with.
 */
export function checkAdmission(ctx: EvidenceContext, role: ContractRole, a: Admission | Market): string {
  const id = contractId(a.id),
    c = ctx.release.contracts.get(id)
  if (!c || c.role !== role) return evidence(`Lens evidence names ${role} ${id}, which the release does not list`)
  if (ctx.refused.has(id)) return evidence(`Lens evidence names ${role} ${id}, which this client refused`)
  const code = hex(a.code_hash),
    init = hex(a.init_hash),
    known = ctx.known(id)
  if (
    a.interface_version !== 1 ||
    (c.codeHash !== undefined && c.codeHash !== code) ||
    (c.initHash !== undefined && c.initHash !== init) ||
    (known?.codeHash !== undefined && known.codeHash !== code) ||
    (known?.initHash !== undefined && known.initHash !== init)
  )
    return evidence(`Lens evidence for ${role} ${id} does not match the release`)
  return id
}
/**
 * Every admitted store, in admission order, as the lens reads the pool: ordinals from zero, distinct
 * IDs, each checked against the release. Returns their IDs by ordinal.
 */
export function checkStores(ctx: EvidenceContext, stores: Admission[]): string[] {
  if (!stores.length || stores.length > 64) return evidence('Lens evidence has no valid store list')
  // Seen by this client at or below the reply's height, a store is in every reply; one left out may
  // be the client's mistake (a lying node can raise the mark), so it reads directly without a strike.
  if (stores.length - 1 < ctx.storeMark)
    throw new LensFailure('evidence', 'Lens evidence lacks stores this client has seen', { strikes: false })
  const ids = stores.map((a, i) => {
    if (a.ordinal !== i) evidence('Lens evidence lists stores out of admission order')
    return checkAdmission(ctx, 'store', a)
  })
  if (new Set(ids).size !== ids.length) evidence('Lens evidence lists a store twice')
  return ids
}
/** The resolvers a reply rests on, each checked; `needed` must all be among them. */
export function checkResolvers(ctx: EvidenceContext, resolvers: Admission[], needed: readonly Contract[], all = false): string[] {
  const ids = resolvers.map((a, i) => {
    if (all && a.ordinal !== i) evidence('Lens evidence lists resolvers out of admission order')
    return checkAdmission(ctx, 'resolver', a)
  })
  if (new Set(ids).size !== ids.length) evidence('Lens evidence lists a resolver twice')
  for (const id of needed)
    if (!ids.includes(contractId(id))) evidence(`Lens evidence lacks the admission of resolver ${contractId(id)}`)
  return ids
}
/**
 * The selected policy and its whole config: a release policy, the selection the reply's context
 * names, the release's binding, and a config whose init commitment is the release's `initHash`.
 */
export function checkPolicy(ctx: EvidenceContext, policy: PolicyEvidence, context: RegistrationContext): string {
  const id = contractId(policy.policy),
    c = ctx.release.contracts.get(id),
    driver = ctx.release.drivers.get(id)
  if (!c || c.role !== 'policy' || !driver) return evidence(`Lens evidence names policy ${id}, which the release does not list`)
  if (ctx.refused.has(id)) return evidence(`Lens evidence names policy ${id}, which this client refused`)
  if (!equalBytes(policy.policy, context.policy) || policy.policy_version !== context.policy_version)
    return evidence("Lens policy evidence is not the directory's selection")
  const selected = ctx.selection(policy.policy_version)
  if (selected !== undefined && selected !== id) return evidence('Lens selects another policy than this client read')
  if (!sameBinding(policy.binding, releaseBinding(ctx))) return evidence('Lens policy evidence has another binding')
  const init = initCommitment(driver, wireValue('InitPolicy', { binding: policy.binding, config: policy.config }))
  const known = ctx.known(id)?.initHash
  if (c.initHash === undefined || c.initHash !== init || (known !== undefined && known !== init))
    return evidence("Lens policy config does not match the release's init commitment")
  return id
}
/** A route the lens reports, against the store list it read: hops to admitted stores, ordinals rising. */
export function checkRoute(stores: readonly string[], key: NameKey, store: Contract, forwards: Forward[], name: Located<NameView>): string {
  const home = contractId(store)
  if (!stores.includes(home)) return evidence('Lens reply names a store outside its evidence')
  if (forwards.length > 63) return evidence('Lens route exceeds the hop limit')
  // A route starts at an admitted store below its first hop: never one to ordinal 0.
  let ordinal = 0
  const seen = new Set<string>()
  for (const f of forwards) {
    const to = contractId(f.destination)
    if (!equalBytes(f.root, key.root) || seen.has(to) || stores[f.destination_ordinal] !== to || f.destination_ordinal <= ordinal)
      return evidence('Lens route has an invalid forward')
    seen.add(to)
    ordinal = f.destination_ordinal
  }
  if (typeof name === 'object' && 'Forwarded' in name) return evidence('Lens reply ends at a forward')
  // A route ends at the root's home, where a subname may still be absent.
  if (forwards.length && contractId(forwards.at(-1)!.destination) !== home) return evidence('Lens route ends elsewhere')
  if (name !== 'Absent' && !sameKey(name.Local.name.key, key)) return evidence('Lens reply is for another name')
  return home
}
/** The lifecycle the store's flags give `name` (the lens's `status`). */
export function lifecycle(name: Located<NameView>, key: NameKey): NameLifecycle {
  if (typeof name !== 'object' || !('Local' in name)) return 'Absent'
  const v = name.Local,
    root = equalBytes(key.root, key.node)
  return v.active ? 'Active' : root && v.renewable ? 'Grace' : root ? 'Released' : 'Expired'
}
/** Everything `quote_renewal` reads for a root at `height` (the lens's `renewal_inputs`). */
export function renewalInputs(view: NameView, schedule: RenewalSchedule, height: bigint): RenewalInputs {
  const n = view.name,
    tier = Math.min(Math.max(new TextEncoder().encode(n.label).length, 1), 5) - 1
  let max = 0
  if (height < n.grace_end)
    for (let years = 10; years >= 1; years--)
      if (n.expires_at + BigInt(years) * REGISTRATION_YEAR_BLOCKS <= height + MAX_REGISTRATION_AHEAD_BLOCKS) {
        max = years
        break
      }
  return { schedule, annual_lux: schedule.annual_lux[tier], referral: n.referrer !== null, max_years: max }
}
/** The quote request hash a registration quote must carry (spec `quote_hash`). */
export function quoteHash(request: QuoteRequest): number[] {
  return hash('duskds:quote:v1', canonicalBytes('QuoteRequest', request))
}
/** The init commitment of a lens bound to `directory`, as its deployment computes it. */
export function lensInitCommitment(driver: DataDriver, directory: string): string {
  return initCommitment(driver, wireValue('InitLens', { directory: fromHex(directory, 32) }))
}
/** Encode a lens call's argument with the reviewed lens driver. */
export function lensInput(driver: DataDriver, method: LensMethod, args: unknown): Uint8Array {
  const spec = lensCatalog.find((m) => m.name === method)!
  return driver.encodeInput(method, stringifyJson(wireValue(spec.input, args)))
}
/** A lens reply, decoded and validated strictly; a refusal throws it. */
export function lensOutput<T>(driver: DataDriver, method: LensMethod, bytes: Uint8Array): T {
  const spec = lensCatalog.find((m) => m.name === method)!
  let value: unknown
  try {
    value = wireValue(spec.output, driver.decodeOutput(method, bytes))
  } catch (error) {
    throw new LensFailure('decode', `Lens ${method} reply does not decode: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (!spec.output.startsWith('LensReply<')) return value as T
  const r = value as { Ok: T } | { Refused: LensRefusal }
  if ('Refused' in r) throw new LensFailure('refused', `Lens ${method} refused: ${r.Refused.code}`, { refusal: r.Refused })
  return r.Ok
}

/** A primary every `verifyPrimary` check accepts (client.ts `VerifiedPrimary`). */
interface Primary {
  store: string
  primary: PrimaryView
  record: RecordValue
  height: bigint
}
/** A name at its home, with records by key: `getName` plus each key's `resolve_record`, at one height. */
export interface Resolved {
  store: string
  value: Located<NameView>
  forwards: Forward[]
  height: bigint
  status: NameLifecycle
  /** One per requested key, in order: the home's `resolve_record`, null unless the name is active and holds it. */
  records: (RecordValue | null)[]
}
/** What a name's page shows, at one height. Display only: renewals and writes are quoted and verified directly. */
export interface NamePage {
  height: bigint
  key: NameKey
  store: string
  forwards: Forward[]
  value: Located<NameView>
  status: NameLifecycle
  /** Every record (`read_records`), for a name some store holds. */
  records: RecordsView | null
  /** The primary of the name's own `moonlight_address` endpoint; `error` when its verification failed. */
  primary: { endpoint: number[] | null; verified: Primary | null; isPrimary: boolean; error: unknown }
  /** For a root some store holds: what its renewal quote reads, to show prices by years. */
  renewal: RenewalInputs | null
}
/** The directory's registration context and the policy it selects, with that policy's whole config. */
export interface Pricing {
  height: bigint
  context: RegistrationContext
  policy: string
  config: PolicyConfig
}
/** `discover()`'s directory state, with the allocation and the preferred marketplace's directory record. */
export interface Bootstrap {
  height: bigint
  config: DirectoryConfig
  stores: Admission[]
  resolvers: Admission[]
  allocation: DirectoryAllocationReturn
  market: Market | null
}

/** The `moonlight_address` endpoint a name's records name, as a name page and the lens read it. */
export function moonlightEndpoint(records: RecordsView): number[] | null {
  const value = records.records.find((r) => r.key === 'moonlight_address')?.value
  return value?.length === 96 ? [...value] : null
}
const local = (name: Located<NameView>): NameView | undefined =>
  typeof name === 'object' && 'Local' in name ? name.Local : undefined
const sameKey = (a: NameKey, b: NameKey) => equalBytes(a.root, b.root) && equalBytes(a.node, b.node)
/** A primary the lens verified, checked against the endpoint and the store list. */
function verifiedPrimary(stores: readonly string[], p: LensVerifiedPrimary, endpoint: number[], height: bigint): Primary {
  const store = contractId(p.store)
  if (!stores.includes(store)) evidence('Lens primary is at a store outside its evidence')
  let spelled: NameKey | undefined
  try {
    spelled = nameKeyOf(p.primary.spelling)
  } catch {
    evidence('Lens primary spelling is not a name')
  }
  if (
    !equalBytes(p.primary.primary.endpoint, endpoint) ||
    !sameKey(spelled!, p.primary.primary.name.key) ||
    p.record.key !== 'moonlight_address' ||
    !equalBytes(p.record.value, endpoint)
  )
    evidence('Lens primary does not match its endpoint')
  return { store, primary: p.primary, record: p.record, height }
}
/** `resolve`: the route, lifecycle and records of `key`, and the resolver they were read from. */
export function checkResolution(ctx: EvidenceContext, r: LensResolution, key: NameKey, keys: readonly string[]): Resolved {
  const stores = checkStores(ctx, r.consulted.stores)
  if (!sameKey(r.key, key)) evidence('Lens reply is for another name')
  const store = checkRoute(stores, key, r.store, r.forwards, r.name)
  if (lifecycle(r.name, key) !== r.status) evidence('Lens status does not follow from its name')
  const view = local(r.name)
  if (r.records.length !== keys.length || r.records.some((v, i) => v && (!view?.active || v.key !== keys[i])))
    evidence('Lens records are not those requested')
  // A record is read from the name's record slot, at its resolver: no slot, no record.
  const pointer = view?.active && keys.length ? view.name.records : null
  if (!pointer && r.records.some(Boolean)) evidence('Lens reports a record for a name without a record slot')
  checkResolvers(ctx, r.consulted.resolvers, pointer ? [pointer.resolver] : [])
  return { store, value: r.name, forwards: r.forwards, height: r.height, status: r.status, records: r.records }
}
/** `reverse`: the verified primary of `endpoint`, if any, and the resolver its record was read from. */
export function checkReverse(ctx: EvidenceContext, r: LensReverse, endpoint: number[]): Primary | null {
  const stores = checkStores(ctx, r.consulted.stores)
  checkResolvers(ctx, r.consulted.resolvers, [])
  if (!equalBytes(r.endpoint, endpoint)) evidence('Lens reply is for another endpoint')
  if (!r.primary) return null
  if (!r.consulted.resolvers.length) evidence("Lens evidence lacks the resolver of the primary's record")
  return verifiedPrimary(stores, r.primary, endpoint, r.height)
}
/** `name_page`: everything `checkResolution` checks, the records, the primary and renewal inputs. */
export function checkNamePage(ctx: EvidenceContext, r: LensNamePage, key: NameKey): NamePage {
  const stores = checkStores(ctx, r.consulted.stores)
  if (!sameKey(r.key, key)) evidence('Lens reply is for another name')
  const store = checkRoute(stores, key, r.store, r.forwards, r.name)
  if (lifecycle(r.name, key) !== r.status) evidence('Lens status does not follow from its name')
  const view = local(r.name),
    p = r.primary
  // A refused primary is part of the reply: the whole page is read directly instead.
  if (p.refused) throw new LensFailure('refused', `Lens name_page refused its primary: ${p.refused.code}`, { refusal: p.refused })
  let verified: Primary | null = null
  if (!view) {
    if (r.records || r.renewal || p.endpoint || p.verified || p.is_primary) evidence('Lens page of an absent name has content')
  } else {
    const records = r.records
    if (!records || !same(records.pointer, view.name.records))
      evidence("Lens records are not the name's")
    if (!records!.pointer && records!.records.length) evidence('Lens reports records for a name without a record slot')
    const endpoint = moonlightEndpoint(records!)
    if ((p.endpoint === null) !== (endpoint === null) || (endpoint && !equalBytes(p.endpoint!, endpoint)))
      evidence("Lens primary is not for the name's endpoint")
    if (p.verified) verified = verifiedPrimary(stores, p.verified, endpoint ?? [], r.height)
    else if (p.is_primary) evidence('Lens page claims an unverified primary')
    const own = Boolean(
      verified &&
        sameKey(verified.primary.primary.name.key, key) &&
        verified.primary.primary.name.incarnation.generation === view.name.incarnation.generation &&
        verified.primary.primary.name.incarnation.serial === view.name.incarnation.serial,
    )
    if (own !== p.is_primary) evidence('Lens page misreports whether its name is primary')
    // For its own name the page carries what verifyPrimary checks: the holder, lifecycle and record.
    if (
      verified && sameKey(verified.primary.primary.name.key, key) &&
      (!own ||
        !primaryNameStatus({ endpoint: endpoint!, primary: verified.primary, name: view, record: verified.record, height: r.height }).verified ||
        !records!.records.some((rec) => same(rec, verified!.record)))
    )
      evidence("Lens page's own primary does not check against its name")
    const root = equalBytes(key.root, key.node)
    if (!root ? r.renewal !== null : !r.renewal || !same(renewalInputs(view, r.renewal.schedule, r.height), r.renewal))
      evidence('Lens renewal inputs do not follow from the name')
  }
  const needed = [...(view?.name.records ? [view.name.records.resolver] : [])]
  checkResolvers(ctx, r.consulted.resolvers, needed)
  if (verified && !r.consulted.resolvers.length) evidence("Lens evidence lacks the resolver of the primary's record")
  return {
    height: r.height,
    key: r.key,
    store,
    forwards: r.forwards,
    value: r.name,
    status: r.status,
    records: r.records,
    primary: { endpoint: p.endpoint, verified, isPrimary: p.is_primary, error: null },
    renewal: r.renewal,
  }
}
/**
 * `availability`, as `previewRegistration` shows it: `registered` for a root its home holds, else the
 * placement store's quote, bound to this request at the reply's height, under the selected policy.
 */
export function checkAvailability(
  ctx: EvidenceContext,
  r: LensAvailability,
  key: NameKey,
  input: { label: string; years: number; actor: number[] },
): 'registered' | { store: string; quote: RegistrationQuote; height: bigint } {
  const stores = checkStores(ctx, r.consulted.stores)
  checkResolvers(ctx, r.consulted.resolvers, [])
  if (!equalBytes(r.node, key.node)) evidence('Lens reply is for another name')
  // The directory's newest store is its last admission.
  if (!equalBytes(r.context.newest_store, r.consulted.stores.at(-1)!.id)) evidence("Lens context's newest store is not the last admitted")
  if ('Registered' in r.status) {
    const held = r.status.Registered
    if (!stores.includes(contractId(held.store))) evidence('Lens names a home outside its evidence')
    // Registered is this root, active or in grace at the reply's height.
    if (!sameKey(held.name.name.key, key) || r.height >= held.name.name.grace_end || r.policy)
      evidence('Lens reports another registration than this root')
    return 'registered'
  }
  const { placement, request, quote } = r.status.Registrable,
    store = contractId(placement.store)
  if (!stores.includes(store)) evidence('Lens places the root outside its evidence')
  if (!r.policy) return evidence('Lens quote has no policy evidence')
  const policy = checkPolicy(ctx, r.policy, r.context),
    released = placement.released_root
  knownPricing(ctx, policy)
  // Only a quote the store would let register: neither stop flag, registration open, not denied.
  const q = quote.quote
  if (r.context.operator_paused || r.context.guardian_suspended || !q.registration_open || q.label_status === 'Denied')
    evidence('Lens quotes a registration the store would refuse')
  // Placement as `placementAt` makes it: an unseen root at the newest store, a released root at its
  // home, or, from a retiring home, at a newer store that is not retiring.
  const row = (id: Contract | null) => (id ? r.consulted.stores.find((a) => equalBytes(a.id, id)) : undefined)
  const canonical = row(placement.canonical_store),
    at = row(placement.store)!
  if (
    placement.canonical_store
      ? !canonical ||
        (released
          ? !canonical.retiring || at.retiring || at.ordinal <= canonical.ordinal
          : canonical.retiring || !equalBytes(placement.store, placement.canonical_store) ||
            request.previous_generation === 0n || request.previous_grace_end === null || request.previous_grace_end > r.height)
      : released || at !== r.consulted.stores.at(-1)
  )
    evidence('Lens placement is not where this root registers')
  if (
    !equalBytes(request.directory, fromHex(ctx.directoryId, 32)) ||
    !equalBytes(request.store, placement.store) ||
    !equalBytes(request.node, key.node) ||
    request.label !== input.label ||
    !equalBytes(request.actor, input.actor) ||
    request.years !== input.years ||
    request.height !== r.height ||
    request.policy_version !== r.context.policy_version ||
    (released
      ? request.previous_generation !== released.counters.generation || request.previous_grace_end !== released.grace_end
      : !placement.canonical_store && (request.previous_generation !== 0n || request.previous_grace_end !== null))
  )
    evidence('Lens quote request is not this registration')
  if (
    quote.height !== r.height ||
    contractId(quote.policy) !== policy ||
    quote.policy_version !== r.context.policy_version ||
    quote.quote.config_version !== r.policy.config.config_version ||
    !equalBytes(quote.quote.request_hash, quoteHash(request))
  )
    evidence('Lens quote does not match its request and policy')
  // The price, recomputed from the policy's committed config: the policy's own pricing rules.
  const { estimate: _, total_lux, ...priced } = estimateRegistrationQuote(r.policy.config, request)
  if (total_lux !== quote.total_lux || !same(priced, quote.quote))
    evidence("Lens quote is not the policy's price")
  return { store, quote, height: r.height }
}
/** `pricing`: the selected policy, its config checked against the release's init commitment. */
export function checkPricing(ctx: EvidenceContext, r: LensPricing): Pricing {
  const policy = checkPolicy(ctx, r.policy, r.context)
  knownPricing(ctx, policy)
  return { height: r.height, context: r.context, policy, config: r.policy.config }
}
/** A policy whose pricing this SDK knows, or a direct read without a strike. */
function knownPricing(ctx: EvidenceContext, policy: string): void {
  const code = ctx.release.contracts.get(policy)?.codeHash
  if (code === undefined || !PRICED_POLICIES.has(code))
    throw new LensFailure('unsupported', "This SDK does not know the selected policy's pricing", { strikes: false })
}
/** `bootstrap`: the whole pool and the preferred marketplace, each against the release. */
export function checkBootstrap(ctx: EvidenceContext, r: LensBootstrap): Bootstrap {
  if (!sameBinding(r.config.binding, releaseBinding(ctx))) evidence('Lens directory config has another binding')
  checkStores(ctx, r.stores)
  checkResolvers(ctx, r.resolvers, [], true)
  if (r.stores.length !== r.config.store_count || r.resolvers.length !== r.config.resolver_count)
    evidence('Lens member counts differ from the directory config')
  // The allocation is the directory's newest store and resolver: its last admissions.
  const a = r.allocation
  if (
    !equalBytes(a.newest_store, r.stores.at(-1)!.id) || !equalBytes(a.newest_resolver, r.resolvers.at(-1)?.id ?? []) ||
    !equalBytes(r.config.registration.newest_store, a.newest_store) || r.config.registration.allocation_version !== a.version
  )
    evidence('Lens allocation is not the last admissions')
  const preferred = r.config.preferred_marketplace
  if (!preferred !== !r.market) evidence('Lens market record is not the preferred marketplace')
  if (preferred && r.market) {
    if (!equalBytes(r.market.market.id, preferred) || r.market.order_api_version !== 1)
      evidence('Lens market record is not the preferred marketplace')
    checkAdmission(ctx, 'marketplace', r.market.market)
  }
  // Shown, never evidence for a signed governance call: those builders refuse these rows.
  markLensRows([r.config, r.allocation, ...r.stores, ...r.resolvers, r.market?.market])
  return {
    height: r.height, config: r.config, stores: r.stores, resolvers: r.resolvers, allocation: r.allocation,
    market: r.market?.market ?? null,
  }
}
/** The store admissions a reply lists: its evidence's, or bootstrap's own. */
export function replyStores(reply: unknown): Admission[] {
  const r = reply as { consulted?: Evidence; stores?: Admission[] }
  return r.consulted?.stores ?? r.stores ?? []
}
/** Deep equality of wire values, whatever their key order. */
function same(a: unknown, b: unknown): boolean {
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return a === b
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a),
    kb = Object.keys(b)
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}
