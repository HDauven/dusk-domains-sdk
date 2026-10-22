/**
 * The read lens (`dusk-domains-lens` v1): decoding its replies and the checks a client makes on each
 * reply's evidence before using it. Internal: no package entrypoint exports it.
 * @module
 */
import { contractId, equalBytes, fromHex, hash, hex, nameKey as nameKeyOf } from './bytes.ts'
import { canonicalBytes } from './digests.ts'
import { stringifyJson, U64_MAX } from './json.ts'
import { initCommitment, markLensRows } from './trust.ts'
import { wireValue } from './wire.ts'
import { rateLimit } from './batching.ts'
import { LENS_INTERFACE, lensCatalog, type LensMethod } from './lens-schema.ts'
import { MAX_REGISTRATION_AHEAD_BLOCKS, REGISTRATION_YEAR_BLOCKS } from '../core/lifecycle.ts'
import { estimateRegistrationQuote, estimateRenewalQuote } from '../core/pricing.ts'
import { primaryNameStatus } from '../core/primary.ts'
import type { DataDriver } from './driver.ts'
import type { ContractRole, LensContract, ReleaseContract } from './manifest.ts'
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
  RenewalQuote,
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
/** A lens refusal (`LensReply::Refused`): why it gave no answer, at the height of the query. */
export interface LensRefusal {
  /** The lens's `LensError`, such as `InvalidName` or `GasBudget`. */
  code: string
  /** The contract the refusal is about, if one. */
  contract: Contract | null
  /** The frozen error that contract trapped with, if it named one. */
  cause: string | null
  /** The height the lens read at. */
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
/** What a reply's check threw, as a lens failure: any other error is its evidence failing to check. */
export function evidenceFailure(error: unknown): LensFailure {
  return error instanceof LensFailure
    ? error
    : new LensFailure('evidence', `Lens evidence does not check: ${error instanceof Error ? error.message : String(error)}`)
}
/** Rate-limit retries per lens call, the wait when the node names none, and the longest wait taken. */
export const LENS_RETRIES = 3
export const LENS_RETRY_MS = 1_000
export const LENS_RETRY_MAX_MS = 10_000
/** How long a lens deployment that failed its check, or a lens method that tripped, is held off. */
export const LENS_OFF_MS = 600_000
/** Wait `ms`, or until `signal` aborts, which throws its reason. */
export function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const stop = () => {
      clearTimeout(timer)
      reject(signal!.reason)
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', stop)
      resolve()
    }, ms)
    if (signal?.aborted) stop()
    else signal?.addEventListener('abort', stop, { once: true })
  })
}
/**
 * A lens read, sent again after the wait a rate limit names, 1 s if none, while `budget` has retries left
 * and the wait is at most 10 s; then it throws `limited(error)`. Any other failure throws as it is.
 */
export async function lensRetry<T>(
  read: () => Promise<T>,
  budget: { retries: number },
  limited: (error: unknown) => unknown = (error) => error,
  signal?: AbortSignal,
): Promise<T> {
  for (;;) {
    try {
      return await read()
    } catch (error) {
      const ms = rateLimit(error, LENS_RETRY_MS)
      if (ms === undefined) throw error
      if (budget.retries <= 0 || ms > LENS_RETRY_MAX_MS) throw limited(error)
      budget.retries--
      await wait(ms, signal)
    }
  }
}
/** A lens entry that commits to its code and its init, as every lens a client reads through does. Throws `deployment`. */
export function checkLensCommitments(entry: LensContract): void {
  if (entry.codeHash === undefined || entry.initHash === undefined)
    throw new LensFailure('deployment', 'The release lens has no code or init commitment')
}
/**
 * A lens entry a client may read through: it commits to code and init, and its init commitment is that of
 * `InitLens { directory }` over the release's directory, with the entry's driver. Throws `deployment`.
 */
export function checkLensEntry(entry: LensContract, driver: DataDriver, directory: string): void {
  checkLensCommitments(entry)
  if (lensInitCommitment(driver, directory) !== entry.initHash)
    throw new LensFailure('deployment', "The release lens entry's init commitment is not bound to the release's directory")
}
/** Whether a deployed lens reports lens v1's interface: its version and the pool's bounds. */
export function lensInterfaceMatches(face: Record<keyof typeof LENS_INTERFACE, number>): boolean {
  return Object.entries(LENS_INTERFACE).every(([k, v]) => face[k as keyof typeof LENS_INTERFACE] === v)
}
/** The binding a deployed lens reports: the release's directory, vault and network. Throws `deployment`. */
export function checkLensBinding(binding: Binding, release: Binding): void {
  if (!sameBinding(binding, release)) throw new LensFailure('deployment', 'Lens deployment binding mismatch')
}
/** The interface a deployed lens reports: lens v1's, with the pool's bounds. Throws `deployment`. */
export function checkLensInterface(face: Record<keyof typeof LENS_INTERFACE, number>): void {
  if (!lensInterfaceMatches(face)) throw new LensFailure('deployment', 'Unsupported lens interface')
}
/**
 * The code hash of the short-name release policy once planned for launch: the v1 policy's pricing for 3
 * or more characters, and 1- and 2-character roots `Denied` until its operator opens their release
 * (`start_release`), then priced from its `release()` heights, which this SDK does not read.
 */
export const LAUNCH_POLICY_CODE_HASH = 'fc0bf306316c0b25695b459a423025ccc59a81bdd8647534ec42b3f08bc4709f'
/**
 * Policies whose pricing this SDK computes (`estimateRegistrationQuote`), by code hash: the published
 * v1 policy, which the launch release runs, and the short-name release policy for 3 or more characters,
 * priced as v1. A reply priced by another, or quoting a 1- or 2-character root under the release policy,
 * reads directly.
 */
export const PRICED_POLICIES: ReadonlySet<string> = new Set([
  'c6a9d9013d8dc2c0e3415b8aafbcc1d5c91d275531d7e677ab3cff57b22de678',
  LAUNCH_POLICY_CODE_HASH,
])
/** Stores whose `quote_renewal` this SDK computes, by code hash: the published v1 store, which prices from the schedule alone. */
export const PRICED_STORES: ReadonlySet<string> = new Set(['ab7c6e22b4bda3707cee67e584b0070b158821bf404d0da37c1b6c69f84094b2'])
const evidence = (message: string): never => {
  throw new LensFailure('evidence', message)
}

/** What a reply's evidence is checked against: the client's own release and refusals. */
export interface EvidenceContext {
  /** The release's network and contracts, and the verified drivers a policy's evidence is checked with. */
  release: {
    manifest: { network: number }
    contracts: ReadonlyMap<string, ReleaseContract>
    drivers: ReadonlyMap<string, DataDriver>
  }
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
/**
 * Store ordinals a client saw, each with the height it saw it at: heights and ordinals rising.
 * Admissions are never removed, so a reply lists every store seen at or below its height.
 */
export class StoreMarks {
  private readonly marks: { height: bigint; ordinal: number }[] = []
  /** The highest store ordinal seen at or below `height`, or -1. */
  at(height: bigint): number {
    let mark = -1
    for (const m of this.marks) if (m.height <= height && m.ordinal > mark) mark = m.ordinal
    return mark
  }
  /** Keep that `ordinal` was admitted by `height`, dropping what it makes redundant. */
  saw(height: bigint, ordinal: number): void {
    if (this.at(height) >= ordinal) return
    for (let i = this.marks.length - 1; i >= 0; i--)
      if (this.marks[i].height >= height && this.marks[i].ordinal <= ordinal) this.marks.splice(i, 1)
    this.marks.push({ height, ordinal })
    this.marks.sort((a, b) => (a.height < b.height ? -1 : a.height > b.height ? 1 : 0))
  }
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
    tier = Math.min(Math.max(new TextEncoder().encode(n.label).length, 1), 5) - 1,
    // As the lens's checked u64 arithmetic: a horizon or an expiry past u64 allows no year.
    limit = height + MAX_REGISTRATION_AHEAD_BLOCKS
  let max = 0
  if (height < n.grace_end && limit <= U64_MAX)
    for (let years = 10; years >= 1; years--)
      if (n.expires_at + BigInt(years) * REGISTRATION_YEAR_BLOCKS <= limit) {
        max = years
        break
      }
  return { schedule, annual_lux: schedule.annual_lux[tier], referral: n.referrer !== null, max_years: max }
}
/**
 * What the home's `quote_renewal` answers at a page's height, computed with `estimateRenewalQuote`, or
 * undefined where the page does not show all it rests on: a root at a home of `PRICED_STORES` code with no
 * move pending (which may be finalizing), and years within its horizon. `estimateRenewalQuote` checks the
 * grace end and schedule as the store does, and refuses a grace end off the grace period, which the store
 * renews: that is quoted directly.
 */
export function pageRenewalQuote(
  page: { height: bigint; key: NameKey; value: Located<NameView>; renewal: RenewalInputs | null },
  years: number,
  storeCode: string | undefined,
): RenewalQuote | undefined {
  const view = local(page.value),
    inputs = page.renewal
  if (
    !view || !inputs || !equalBytes(page.key.root, page.key.node) || !sameKey(view.name.key, page.key) ||
    view.name.subname !== null || view.move_pending !== null ||
    storeCode === undefined || !PRICED_STORES.has(storeCode) ||
    !Number.isInteger(years) || years < 1 || years > inputs.max_years
  )
    return undefined
  let quote: RenewalQuote
  try {
    quote = estimateRenewalQuote(inputs.schedule, view.name, years, page.height)
  } catch {
    return undefined
  }
  // The tier price the page reports for its label, priced again: one more check of what it rests on.
  return BigInt(quote.total_lux) === BigInt(inputs.annual_lux) * BigInt(years) ? quote : undefined
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

/** A primary name `verifyPrimary` verified: its store, the mapping, the forward record and the height. */
export interface VerifiedPrimary {
  /** The store holding the mapping and its name. */
  store: string
  /** The mapping, its name and the spelling. */
  primary: PrimaryView
  /** The name's `moonlight_address` record, which is the endpoint. */
  record: RecordValue
  /** The height it was verified at. */
  height: bigint
}
/** A name at its home, with records by key: `getName` plus each key's `resolve_record`, at one height. */
export interface Resolved {
  /** The name's home: the store holding its root, or the directory's newest store when no store does. */
  store: string
  /** The home's answer: the name, or `Absent`. */
  value: Located<NameView>
  /** The forwards followed to the home. */
  forwards: Forward[]
  /** The height it was read at. */
  height: bigint
  /** The name's lifecycle there, from the store's `active` and `renewable` flags. */
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
  primary: { endpoint: number[] | null; verified: VerifiedPrimary | null; isPrimary: boolean; error: unknown }
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
function verifiedPrimary(stores: readonly string[], p: LensVerifiedPrimary, endpoint: number[], height: bigint): VerifiedPrimary {
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
/** A copy of `resolve`'s record keys: at most 16 distinct keys of 1 to 64 bytes, or it throws. */
export function validRecordKeys(recordKeys: readonly string[]): string[] {
  const keys = [...recordKeys],
    encoder = new TextEncoder()
  if (
    keys.length > 16 ||
    new Set(keys).size !== keys.length ||
    keys.some((k) => typeof k !== 'string' || !k || encoder.encode(k).length > 64)
  )
    throw new Error('Expected at most 16 distinct record keys of 1 to 64 bytes')
  return keys
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
export function checkReverse(ctx: EvidenceContext, r: LensReverse, endpoint: number[]): VerifiedPrimary | null {
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
  let verified: VerifiedPrimary | null = null
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
  knownPricing(ctx, policy, input.label)
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
/** A policy whose pricing this SDK knows, for the root `label` a reply quotes; or a direct read without a strike. */
function knownPricing(ctx: EvidenceContext, policy: string, label?: string): void {
  const code = ctx.release.contracts.get(policy)?.codeHash
  if (code === undefined || !PRICED_POLICIES.has(code))
    throw new LensFailure('unsupported', "This SDK does not know the selected policy's pricing", { strikes: false })
  // Released or not, the store's quote alone prices them: an honest released quote never strikes.
  if (code === LAUNCH_POLICY_CODE_HASH && label !== undefined && label.length < 3)
    throw new LensFailure('unsupported', "This SDK does not price the release policy's 1- and 2-character roots", { strikes: false })
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
