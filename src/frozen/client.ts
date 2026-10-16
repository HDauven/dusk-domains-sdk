/** Canonical frozen-layer reads, admission discovery and monotone forwarding. @module */
import { contractId, equalBytes, fromHex, hex, nameKey, hash } from './bytes.ts'
import {
  registrationCalls,
  type RegistrationInput,
  type RegistrationCalls,
} from './actions.ts'
import { canonicalBytes } from './digests.ts'
import { methodCatalog } from './catalog.ts'
import {
  methodDefinition,
  type Input,
  type Output,
  type Method,
} from './calls.ts'
import {
  loadReleaseManifest,
  fetchDriver,
  object,
  validateReleaseContract,
  type LoadedRelease,
  type ManifestOptions,
  type ContractRole,
  type ReleaseContract,
} from './manifest.ts'
import { parseJson, stringifyJson } from './json.ts'
import { wireValue } from './wire.ts'
import { primaryNameStatus } from '../core/primary.ts'
import { createHttpTransport, type ReadTransport } from './transport.ts'
import { ReadSharing, type Attempt } from './sharing.ts'
import {
  ContractRefusedError,
  createLedger,
  heightIndependent,
  initCommitment,
  isHeightIndependent,
  noteSelection,
  noteVerifiedQuote,
  type Ledger,
  type Stage,
  type VerifiedContract,
} from './trust.ts'
import type { DataDriver } from './driver.ts'
import type { ReadMethods } from './read-types.ts'
import type {
  Admission,
  Authority,
  Home,
  Controllers,
  ReleasedRoot,
  QuoteRequest,
  Contract,
  Forward,
  Located,
  NameKey,
  NameView,
  MemberKind,
  PrimaryView,
  RecordValue,
  RegistrationQuote,
  QuoteRegistration,
  RenewalQuote,
  StoreQuoteRenewalArgs,
  DirectoryConfig,
  Interface,
  Binding,
  EventTypes,
  Market,
} from './types.ts'

export { ContractRefusedError, UnverifiedQuoteError } from './trust.ts'
/** An operation saw a block land; its snapshot runs it again. */
class TipMoved extends Error {}
const policyAdmissionMismatch = () =>
  new Error("Policy initialization does not match its admission's init commitment")
/**
 * A deep copy of plain data as it reads now: arrays, byte arrays, objects and primitives, Proxies
 * included. It never calls the input's own methods, which could hand back the original.
 */
function copyNow<T>(value: T): T {
  if (value instanceof Uint8Array) return new Uint8Array(value) as T
  if (Array.isArray(value)) {
    const length = value.length,
      copy: unknown[] = []
    for (let i = 0; i < length; i++) copy.push(copyNow(value[i]))
    return copy as T
  }
  if (value && typeof value === 'object') {
    const copy: Record<string, unknown> = {}
    for (const key of Object.keys(value)) copy[key] = copyNow((value as Record<string, unknown>)[key])
    return copy as T
  }
  return value
}

/** Key-value storage for `ClientOptions.verificationCache`; `sessionStorage` is one. */
export interface VerificationCache {
  getItem(key: string): string | null | undefined | Promise<string | null | undefined>
  setItem(key: string, value: string): unknown
}
export interface ClientOptions extends ManifestOptions {
  transport?: ReadTransport
  hopLimit?: number
  /**
   * Supply release-reviewed metadata for a newly admitted implementation, never an unverified
   * driver. The client admits it only once every check passes, into its own copy of the release.
   * It must not read, through this client, the contract it resolves.
   */
  resolveContract?: (
    role: ContractRole,
    id: string,
    admission?: Admission,
  ) => Promise<ReleaseContract>
  /**
   * Keep what verification reads about each contract for clients created later, such as after a
   * page load: its interface and deployment binding, a marketplace's order API version and a
   * policy's init commitment, none of which a deployed contract can change. An entry is bound to
   * the manifest's chain, network and node URL, the directory and vault, and the contract's ID,
   * role and release descriptor. Every check runs again on what an entry holds, and an entry that
   * fails one is ignored and verified from the chain. Admissions, membership, configuration and
   * other state are never kept, nor anything for a contract the client refused or verified only
   * in a snapshot it abandoned. Storage failures only mean verifying from the chain.
   */
  verificationCache?: VerificationCache
  /**
   * Open a snapshot at the height the latest height read reported, when it arrived less than this
   * many milliseconds ago, instead of reading the height again: 1000 by default, 0 to read it every
   * time. The snapshot still closes with a height read sent after it began, so either way its result
   * is the state at a height that was the tip during the call. When a block landed in between, it
   * reads again at the new height, and that first attempt is not one of its three.
   */
  heightReuseMs?: number
}
/**
 * A tenth of Dusk's block time of about 10 s: a height read this recent has gone stale about one time
 * in ten at most, and then costs one attempt that does not count, whose closing read opens the next.
 */
const HEIGHT_REUSE_MS = 1000
export type ReadApi<R extends ContractRole> = {
  [M in ReadMethods[R] & Method<R>]: (
    ...args: Input<R, M> extends null ? [] : [args: Input<R, M>]
  ) => Promise<Output<R, M>>
}
export interface Routed<T> {
  store: string
  value: Located<T>
  forwards: Forward[]
  height: bigint
}
export interface VerifiedPrimary {
  store: string
  primary: PrimaryView
  record: RecordValue
  height: bigint
}
export interface DirectoryState {
  height: bigint
  config: DirectoryConfig
  stores: Admission[]
  resolvers: Admission[]
}

export interface RegistrationPlacement {
  store: string
  canonicalStore: string | null
  releasedRoot: ReleasedRoot | null
  height: bigint
}
export interface PreparedRegistration extends RegistrationPlacement {
  quoteRequest: QuoteRequest
  quote: RegistrationQuote
  calls: RegistrationCalls
}
/** What verification reads about a contract, none of which a deployed contract can change. */
interface Facts {
  interface: Interface
  binding: Binding
  /** A marketplace's order API version. */
  orderApi?: number
  /** A policy's init commitment over its live binding and config. */
  init?: string
}

export class FrozenClient {
  readonly release: LoadedRelease
  readonly transport: ReadTransport
  readonly directoryId: string
  readonly vaultId: string
  readonly directory: ReadApi<'directory'>
  readonly vault: ReadApi<'vault'>
  readonly hopLimit: number
  /** See `ClientOptions.heightReuseMs`. */
  readonly heightReuseMs: number
  private readonly options: ClientOptions
  private readonly ledger: Ledger
  private readonly verifying = new Map<string, Promise<void>>()
  private readonly sharing: ReadSharing
  /** Facts this client holds, by `factsKey`; `kept` once the verification cache has them. */
  private readonly facts = new Map<string, { facts: Facts; kept: boolean }>()
  /** Contracts an attempt verified, whose facts the cache gets once the attempt commits. */
  private readonly unkept = new WeakMap<VerifiedContract, string>()
  /**
   * The client trusts only what it verified itself. `client.release` is its own copy of
   * `release`: contracts it resolves are added there, not to `release` or another client's.
   * Pass `client.release` to the Connect app, which signs only for contracts this client verified.
   */
  constructor(release: LoadedRelease, options: ClientOptions = {}) {
    this.release = {
      ...release,
      contracts: new Map(release.contracts),
      drivers: new Map(release.drivers),
    }
    this.ledger = createLedger(this.release)
    this.options = options
    this.transport =
      options.transport ??
      createHttpTransport(release.manifest.nodeUrl, options.fetch)
    this.sharing = new ReadSharing(this.transport)
    this.directoryId = release.manifest.contracts.find(
      (c) => c.role === 'directory',
    )!.contractId
    this.vaultId = release.manifest.contracts.find(
      (c) => c.role === 'vault',
    )!.contractId
    this.hopLimit = options.hopLimit ?? 63
    if (
      !Number.isInteger(this.hopLimit) ||
      this.hopLimit < 1 ||
      this.hopLimit > 63
    )
      throw new Error('hopLimit must be 1..63')
    this.heightReuseMs = options.heightReuseMs ?? HEIGHT_REUSE_MS
    if (typeof this.heightReuseMs !== 'number' || !(this.heightReuseMs >= 0))
      throw new Error('heightReuseMs must be zero or more')
    this.directory = this.api('directory', this.directoryId)
    this.vault = this.api('vault', this.vaultId)
  }
  /**
   * Run `operation` at one chain height. Nodes answer reads at their tip only, so a sequence
   * is consistent only when no block lands during it: the height is read before and after,
   * and a sequence that crossed a block is taken again, whether it returned or threw, since
   * reads across heights prove nothing. A failure at an unchanged height is final, as is a
   * verification failure. After three crossed attempts it throws a retryable error. A snapshot
   * opens at a height read that arrived less than `heightReuseMs` ago, or shares one in flight;
   * the height read that closes it is always sent after `operation` settles.
   */
  async snapshot<T>(operation: (height: bigint, stage: Stage) => Promise<T>): Promise<T> {
    return this.attempts((at) => operation(at.height, at.stage), false)
  }
  /**
   * `snapshot`, sharing reads between attempts at one height. `tracked`: every read `operation`
   * uses goes through `at`, so the attempt closes with any height read sent after the snapshot began
   * and the last reply it used arrived, possibly the one it opened with. Each reply it used was then
   * answered at a height no lower than the opening read's and no higher than the closing one's, so
   * equal heights are one height. Otherwise it closes with a height read sent after `operation`
   * settles. A retry opens with the height read that closed the attempt before it.
   *
   * The first attempt opens at the height of a height read that arrived within `heightReuseMs`, if
   * any. That read arrived before the attempt sent anything, so it bounds its replies from below as
   * a new one would; how old it is decides only how likely the attempt is to cross a block. If such
   * an attempt crosses one, it is not one of the three, and a failure it met is not one of three that
   * must repeat; it commits, or fails for good, like any other. Only the first attempt can open this
   * way, so a snapshot makes four attempts at most.
   */
  private async attempts<T>(operation: (at: Attempt) => Promise<T>, tracked: boolean): Promise<T> {
    let crossed: unknown
    // Messages of attempts that failed across a block; the same one every time is not chance.
    const failures: string[] = []
    const began = this.sharing.now()
    let since = began,
      reused = this.sharing.recent(this.heightReuseMs),
      first = true
    for (let counted = 0; counted < 3; ) {
      const free = reused !== undefined,
        before = reused ?? (await this.sharing.open(since, first))
      reused = undefined
      first = false
      // What this attempt verifies becomes signable only if the attempt commits.
      const at: Attempt = { height: before, stage: { touched: new Set() }, began, replied: 0 }
      const close = () => {
        since = tracked ? Math.max(began, at.replied) : this.sharing.now()
        return this.sharing.close(since)
      }
      let result: T
      try {
        result = await operation(at)
      } catch (error) {
        this.abandon(at.stage)
        if (isHeightIndependent(error)) throw error
        if (!(error instanceof TipMoved)) {
          let after: bigint
          try {
            after = await close()
          } catch {
            throw error
          }
          if (after === before) throw error
          if (!free) failures.push(error instanceof Error ? error.message : String(error))
        } else since = this.sharing.now()
        crossed = error
        if (!free) counted++
        continue
      }
      if (before === (await close())) {
        this.commit(at.stage)
        return result
      }
      this.abandon(at.stage)
      crossed = undefined
      if (!free) counted++
    }
    if (failures.length === 3 && failures.every((m) => m === failures[0]))
      throw crossed
    throw new Error('Chain tip changed during read; retry the snapshot', {
      cause: crossed,
    })
  }
  /** Make what a committed attempt verified signable, and keep its facts. */
  private commit(stage: Stage): void {
    for (const id of stage.touched) {
      const row = this.ledger.verified.get(id)
      if (row?.pending) {
        row.pending = undefined
        this.keepFacts(row)
      }
    }
  }
  /** Drop what only abandoned attempts verified, from the ledger and the client's release. */
  private abandon(stage: Stage): void {
    for (const id of stage.touched) {
      const row = this.ledger.verified.get(id)
      if (!row?.pending) continue
      row.pending.delete(stage)
      if (row.pending.size) continue
      this.ledger.verified.delete(id)
      if (row.addedToRelease) {
        this.release.contracts.delete(id)
        this.release.drivers.delete(id)
      }
    }
  }
  /**
   * Read a verified contract, or the candidate under verification, for attempt `at`. A state read
   * in an attempt is shared with other attempts at its height; a verification read (`shared`
   * false, and every candidate read) never is.
   */
  private async raw<R extends ContractRole, M extends Method<R>>(
    role: R,
    id: string,
    method: M,
    args: Input<R, M>,
    at?: Attempt,
    candidate?: { role: ContractRole; driver: DataDriver },
    shared = !candidate,
  ): Promise<Output<R, M>> {
    id = contractId(id)
    const contract = candidate ?? this.ledger.verified.get(id)
    if (!contract || contract.role !== role || this.ledger.refused.has(id))
      throw new Error(`No verified ${role} driver for ${id}`)
    const spec = methodDefinition(role, method)
    if (spec.mode !== 'read') throw new Error('Write method used as a read')
    const input = contract.driver.encodeInput(
      method,
      stringifyJson(wireValue(spec.input, args)),
    )
    const bytes = await this.sharing.read(at, id, method, input, shared)
    return wireValue(
      spec.output,
      contract.driver.decodeOutput(method, bytes),
    ) as Output<R, M>
  }
  /** The exact ABI read surface, with lossless typed output and automatic height acquisition. */
  async read<R extends ContractRole, M extends ReadMethods[R] & Method<R>>(
    role: R,
    id: string,
    method: M,
    args: Input<R, M>,
  ): Promise<Output<R, M>> {
    await this.verifyContract(role, id)
    return this.attempts(async (at) => {
      if (
        role === 'store' &&
        methodDefinition(role, method).output.startsWith('Located<')
      ) {
        const root = this.argumentRoot(args)
        return (
          await this.followRaw(
            at,
            id,
            root,
            method as Method<'store'>,
            args as never,
          )
        ).value as Output<R, M>
      }
      if (role === 'store' && method === 'home') {
        const stores = await this.storeAdmissions(at)
        return (await this.followHomeRaw(at, stores, id, (args as { root: Contract }).root))
          .value as Output<R, M>
      }
      return this.raw(role, id, method, args, at)
    }, true)
  }
  private api<R extends ContractRole>(role: R, id: string): ReadApi<R> {
    return Object.fromEntries(
      methodCatalog[role]
        .filter((m) => m.mode === 'read')
        .map((m) => [
          m.name,
          (args: unknown = null) =>
            this.read(
              role,
              id,
              m.name as ReadMethods[R] & Method<R>,
              args as never,
            ),
        ]),
    ) as unknown as ReadApi<R>
  }
  store(id: string): ReadApi<'store'> {
    return this.api('store', id)
  }
  resolver(id: string): ReadApi<'resolver'> {
    return this.api('resolver', id)
  }
  policy(id: string): ReadApi<'policy'> {
    return this.api('policy', id)
  }
  marketplace(id: string): ReadApi<'marketplace'> {
    return this.api('marketplace', id)
  }
  /**
   * Verify `id` as `role` once for this client: its release artifact, the directory's record of
   * it, its interface and deployment binding, and its init commitment. Nothing it resolves
   * becomes readable or signable until every check passes, and a contract that fails a check
   * stays refused for this client. The Connect app signs only for a contract whose release
   * descriptor carries both `codeHash` and `initHash`, compared here; without them it is
   * readable only. The client reads the directory's record of a store, resolver or
   * marketplace itself. `evidence` is admission evidence the caller holds, such as an event's
   * admission or market record: it must match what the client reads, and a mismatch rejects it
   * without refusing the contract. The directory has no record readable for a policy or the
   * vault: a policy's live initialization is compared with the release's `initHash` and the
   * evidence's, and the vault is the one every admitted contract's binding names.
   */
  async verifyContract(
    role: ContractRole,
    id: string,
    evidence?: Admission | Market,
  ): Promise<void> {
    return this.verify(role, id, evidence, false)
  }
  /**
   * `fromDirectory`: the client read `evidence` from the directory itself. Only that, or the
   * contract's own reads, can refuse a contract: evidence a caller supplies, such as an event,
   * that contradicts them is rejected, and the contract stays as verified. `at`: the snapshot
   * attempt verifying it, which commits the result only if the attempt commits.
   */
  private async verify(
    role: ContractRole,
    id: string,
    evidence: Admission | Market | undefined,
    fromDirectory: boolean,
    at?: Attempt,
  ): Promise<void> {
    id = contractId(id)
    const key = id,
      stage = at?.stage
    // Let a verification of the same contract, in any role, finish; then answer from its outcome.
    for (let pending = this.verifying.get(key); pending; pending = this.verifying.get(key))
      await pending.catch(() => {})
    const refusal = this.ledger.refused.get(id)
    if (refusal) throw heightIndependent(refusal)
    const known = this.ledger.verified.get(id)
    // A verification only other attempts staged is no evidence outside them: verify it again,
    // unless this call belongs to an attempt too, which then commits it with its own evidence.
    if (known && (!known.pending || stage)) {
      if (known.role !== role)
        throw heightIndependent(new Error('Contract role mismatch'))
      if (known.pending && stage) {
        known.pending.add(stage)
        stage.touched.add(id)
      }
      if (evidence) {
        this.compareEvidence(id, known.descriptor, evidence, known, fromDirectory)
        // A policy verified before any init commitment was known meets its admission's now.
        if (role === 'policy' && known.initHash === undefined) {
          const live = await this.policyInit(id, known, undefined, at)
          if (live !== hex(evidence.init_hash)) throw heightIndependent(policyAdmissionMismatch())
          known.initHash = live
        }
      }
      return
    }
    const run = this.verifyNew(role, id, evidence, fromDirectory, at)
    this.verifying.set(key, run)
    try {
      await run
    } finally {
      this.verifying.delete(key)
    }
  }
  private async verifyNew(
    role: ContractRole,
    id: string,
    evidence: Admission | Market | undefined,
    fromDirectory: boolean,
    at?: Attempt,
  ): Promise<void> {
    const stage = at?.stage
    try {
      if (role !== 'directory')
        await this.verify('directory', this.directoryId, undefined, false, at)
      const candidate = await this.candidate(role, id, evidence),
        c = candidate.descriptor
      if (c.role !== role) throw new Error('Contract role mismatch')
      // The directory's record, read by the client, can refuse the contract; a caller's evidence
      // is checked against that record and the release, and only rejected.
      const record = fromDirectory ? evidence : await this.evidence(role, id, at)
      if (record) this.compareEvidence(id, c, record, undefined, true)
      if (evidence && !fromDirectory) {
        const read = record && {
          codeHash: hex(record.code_hash),
          initHash: hex(record.init_hash),
        }
        this.compareEvidence(id, c, evidence, read, false)
      }
      // Facts an earlier verification read are checked like fresh ones; facts that fail a check are
      // only ignored, and the contract is checked from the chain, which alone can refuse it.
      const key = this.factsKey(role, id, c),
        held = this.facts.get(key) ?? (await this.cachedFacts(key))
      const checked =
        (held && (await this.checkContract(role, id, candidate, evidence, record, at, held.facts))) ||
        (await this.checkContract(role, id, candidate, evidence, record, at))!
      this.facts.set(key, checked.facts === held?.facts ? held : { facts: checked.facts, kept: false })
      // Every check passed: only now does the contract become readable, and signable once the
      // snapshot attempt that verified it, if any, commits.
      const addedToRelease = !this.release.contracts.has(id)
      if (addedToRelease) {
        this.release.contracts.set(id, c)
        this.release.drivers.set(id, candidate.driver)
      }
      const row: VerifiedContract = {
        ...candidate,
        codeHash: record ? hex(record.code_hash) : c.codeHash,
        initHash: checked.initHash,
        // The directory and vault are the release's trust roots: nothing on chain records them.
        // Every other contract is signable only with both commitments, compared above.
        signable:
          role === 'directory' ||
          role === 'vault' ||
          (c.codeHash !== undefined && c.initHash !== undefined),
        ...(stage ? { pending: new Set([stage]), addedToRelease } : {}),
      }
      this.ledger.verified.set(id, row)
      this.unkept.set(row, key)
      if (stage) stage.touched.add(id)
      else this.keepFacts(row)
    } catch (error) {
      // Artifacts, evidence and contract checks do not depend on the height a snapshot reads at.
      throw heightIndependent(error)
    }
  }
  /**
   * Check a contract's interface, deployment binding, a marketplace's order API and a policy's init
   * commitment, in that order. Read from the chain, the first check that fails refuses the contract.
   * Given `held`, facts an earlier verification read, a failed check returns undefined instead.
   */
  private async checkContract(
    role: ContractRole,
    id: string,
    candidate: VerifiedContract,
    evidence: Admission | Market | undefined,
    record: Admission | Market | undefined,
    at: Attempt | undefined,
    held?: Facts,
  ): Promise<{ facts: Facts; initHash: string | undefined } | undefined> {
    const c = candidate.descriptor
    const fail = (message: string): undefined => {
      if (!held) this.refuse(id, message)
      return undefined
    }
    const iface =
      held?.interface ??
      ((await this.raw(
        role,
        id,
        'interface_version' as Method<typeof role>,
        null as never,
        at,
        candidate,
      )) as Interface)
    if (
      iface.kind.toLowerCase() !== role ||
      iface.version !== 1 ||
      iface.move_version !== (role === 'store' ? 1 : 0) ||
      iface.custody_version !==
        (role === 'store' || role === 'marketplace' ? 1 : 0)
    )
      return fail('Unsupported frozen contract interface')
    const binding =
      held?.binding ??
      ((await this.raw(
        role,
        id,
        'binding' as Method<typeof role>,
        null as never,
        at,
        candidate,
      )) as Binding)
    if (
      contractId(binding.directory) !== this.directoryId ||
      contractId(binding.vault) !== this.vaultId ||
      binding.network !== this.release.manifest.network
    )
      return fail('Contract deployment binding mismatch')
    const facts: Facts = held ?? { interface: iface, binding }
    if (role === 'marketplace') {
      if (!held) facts.orderApi = await this.raw('marketplace', id, 'order_api_version', null, at, candidate)
      if (facts.orderApi !== 1) return fail('Unsupported marketplace order API')
    }
    let initHash = record ? hex(record.init_hash) : c.initHash
    if (role === 'policy' && (c.initHash !== undefined || evidence)) {
      if (!held) facts.init = await this.policyCommitment(id, candidate, binding, at)
      if (facts.init === undefined) return undefined
      if (c.initHash !== undefined && c.initHash !== facts.init)
        return fail('Policy initialization does not match its init commitment')
      initHash = facts.init
      if (evidence && hex(evidence.init_hash) !== initHash) {
        if (held) return undefined
        throw policyAdmissionMismatch()
      }
    }
    return { facts, initHash }
  }
  /**
   * A policy's initialization is its immutable binding and config, so its live state reproduces
   * its init archive. Refuse it unless that matches the release's `initHash`, when it has one.
   */
  private async policyInit(
    id: string,
    contract: VerifiedContract,
    binding?: Binding,
    at?: Attempt,
  ): Promise<string> {
    const live = await this.policyCommitment(id, contract, binding, at)
    if (contract.descriptor.initHash !== undefined && contract.descriptor.initHash !== live)
      this.refuse(id, 'Policy initialization does not match its init commitment')
    return live
  }
  /** Spec §2.3's init commitment of a policy's live binding and immutable config. */
  private async policyCommitment(
    id: string,
    contract: VerifiedContract,
    binding?: Binding,
    at?: Attempt,
  ): Promise<string> {
    binding ??= await this.raw('policy', id, 'binding', null, at, contract)
    const config = await this.raw('policy', id, 'config', null, at, contract)
    return initCommitment(contract.driver, wireValue('InitPolicy', { binding, config }))
  }
  /** What facts are about: a contract and its release descriptor's commitments and driver. */
  private factsKey(role: ContractRole, id: string, c: ReleaseContract): string {
    const a = c.dataDriver
    return stringifyJson([
      role, id, c.codeHash ?? null, c.initHash ?? null,
      a.sha256 ?? null, a.blake2b256 ?? null, a.blake3 ?? null, a.bytes ?? null,
    ])
  }
  /** The verification cache's key for facts: also bound to this deployment and its node. */
  private cacheKey(key: string): string {
    const m = this.release.manifest
    const digest = hash(
      'duskds:sdk:verification-cache:v1',
      stringifyJson([m.chainId, m.network, m.nodeUrl, this.directoryId, this.vaultId, key]),
    )
    return `duskdomains:verified:v1:${hex(digest)}`
  }
  /** Facts the verification cache holds for `key`; a malformed or unreadable entry is none. */
  private async cachedFacts(key: string): Promise<{ facts: Facts; kept: boolean } | undefined> {
    const cache = this.options.verificationCache
    if (!cache) return undefined
    try {
      const text = await cache.getItem(this.cacheKey(key))
      if (typeof text !== 'string') return undefined
      const entry = object(parseJson(text))
      if (entry.version !== 1) return undefined
      const facts: Facts = {
        interface: wireValue('Interface', entry.interface),
        binding: wireValue('Binding', entry.binding),
      }
      if (entry.orderApi !== undefined) facts.orderApi = wireValue('u16', entry.orderApi)
      if (entry.init !== undefined) {
        if (typeof entry.init !== 'string' || !/^[\da-f]{64}$/u.test(entry.init)) return undefined
        facts.init = entry.init
      }
      return { facts, kept: true }
    } catch {
      return undefined
    }
  }
  /** Give the verification cache the facts a committed verification checked, if it lacks them. */
  private keepFacts(row: VerifiedContract): void {
    const key = this.unkept.get(row)
    this.unkept.delete(row)
    const held = key === undefined ? undefined : this.facts.get(key)
    const cache = this.options.verificationCache
    if (!cache || !held || held.kept) return
    held.kept = true
    const { facts } = held
    const value = stringifyJson({
      version: 1,
      interface: facts.interface,
      binding: facts.binding,
      ...(facts.orderApi === undefined ? {} : { orderApi: facts.orderApi }),
      ...(facts.init === undefined ? {} : { init: facts.init }),
    })
    try {
      const done = cache.setItem(this.cacheKey(key!), value) as PromiseLike<unknown> | undefined
      if (typeof done?.then === 'function') done.then(undefined, () => {})
    } catch {
      // Storage is full or unavailable: the next client verifies from the chain.
    }
  }
  /** The release's artifact for `id`, or the resolver's reviewed one; never added to the release here. */
  private async candidate(
    role: ContractRole,
    id: string,
    evidence?: Admission | Market,
  ): Promise<VerifiedContract> {
    const listed = this.release.contracts.get(id),
      driver = this.release.drivers.get(id)
    if (listed && driver) return { role, descriptor: listed, driver }
    if (!this.options.resolveContract)
      throw new Error(`Missing release artifact for admitted ${role} ${id}`)
    const c = validateReleaseContract(
      await this.options.resolveContract(
        role,
        id,
        evidence && 'ordinal' in evidence ? evidence : undefined,
      ),
    )
    if (c.contractId !== id || c.role !== role)
      throw new Error('Resolved artifact does not match admission')
    return {
      role,
      descriptor: c,
      driver: await fetchDriver(c, this.release.artifactBaseUrl, this.options.fetch),
    }
  }
  /** The directory's record of an admitted store, resolver or marketplace, read for itself. */
  private async evidence(
    role: ContractRole,
    id: string,
    at?: Attempt,
  ): Promise<Admission | Market | undefined> {
    if (role !== 'store' && role !== 'resolver' && role !== 'marketplace')
      return undefined
    const record =
      role === 'marketplace'
        ? await this.raw('directory', this.directoryId, 'market', {
            id: fromHex(id, 32),
          }, at, undefined, false)
        : await this.raw('directory', this.directoryId, 'member', {
            kind: role === 'store' ? 'Store' : 'Resolver',
            id: fromHex(id, 32),
          }, at, undefined, false)
    if (!record)
      throw new Error(`${role[0].toUpperCase()}${role.slice(1)} ${id} is not admitted`)
    return record
  }
  /**
   * Admission evidence must match the reviewed release artifact and what the contract was
   * verified with. A mismatch in the directory's own record refuses the contract; in evidence a
   * caller supplied, it rejects that evidence only.
   */
  private compareEvidence(
    id: string,
    c: ReleaseContract,
    evidence: Admission | Market,
    known: { codeHash?: string; initHash?: string } | undefined,
    refuses: boolean,
  ): void {
    if (contractId(evidence.id) !== id)
      throw new Error('Admission does not match its contract')
    const code = hex(evidence.code_hash),
      init = hex(evidence.init_hash)
    if (
      evidence.interface_version !== 1 ||
      (c.codeHash !== undefined && c.codeHash !== code) ||
      (c.initHash !== undefined && c.initHash !== init) ||
      (known?.codeHash !== undefined && known.codeHash !== code) ||
      (known?.initHash !== undefined && known.initHash !== init)
    ) {
      if (refuses) this.refuse(id, 'Admission artifact/version mismatch')
      throw heightIndependent(new Error('Admission artifact/version mismatch'))
    }
  }
  private refuse(id: string, message: string): never {
    const refusal = new ContractRefusedError(id, message)
    this.ledger.refused.set(id, refusal)
    throw heightIndependent(refusal)
  }
  private async members(kind: MemberKind, at: Attempt): Promise<Admission[]> {
    const rows: Admission[] = []
    let start = 0
    for (let page = 0; page < 4; page++) {
      const result = await this.raw('directory', this.directoryId, 'members', {
        kind,
        start,
        limit: 16,
      }, at)
      for (const member of result.rows) {
        if (
          member.ordinal !== rows.length ||
          rows.some((r) => equalBytes(r.id, member.id))
        )
          throw new Error('Invalid directory admission order')
        rows.push(member)
      }
      if (result.next === null) return rows
      if (result.next <= start || result.next !== rows.length)
        throw new Error('Invalid admission cursor')
      start = result.next
    }
    throw new Error('Directory membership exceeds frozen bound')
  }
  async discover(): Promise<DirectoryState> {
    await this.verifyContract('directory', this.directoryId)
    return this.attempts(async (at) => {
      const config = await this.raw(
        'directory',
        this.directoryId,
        'config',
        null,
        at,
      )
      const stores = await this.members('Store', at),
        resolvers = await this.members('Resolver', at)
      if (
        stores.length !== config.store_count ||
        resolvers.length !== config.resolver_count
      )
        throw new Error('Directory member count mismatch')
      for (const a of stores) await this.verify('store', contractId(a.id), a, true, at)
      for (const a of resolvers)
        await this.verify('resolver', contractId(a.id), a, true, at)
      await this.verify('vault', this.vaultId, undefined, false, at)
      // A SetPolicy can select a policy this release does not list yet. Only registration uses
      // it, and quoteRegistration verifies it there; other operations never need it.
      if (config.preferred_marketplace) {
        const market = await this.raw('directory', this.directoryId, 'market', {
          id: config.preferred_marketplace,
        }, at)
        if (!market)
          throw new Error(
            `Marketplace ${contractId(config.preferred_marketplace)} is not admitted`,
          )
        await this.verify(
          'marketplace',
          contractId(config.preferred_marketplace),
          market,
          true,
          at,
        )
      }
      return { height: at.height, config, stores, resolvers }
    }, true)
  }
  /**
   * Accept only already authenticated, committed directory effects from the projection. An
   * admission that contradicts what the client reads is rejected; the contract stays verified.
   */
  async admitDirectoryEvent(
    topic: 'directory_initialized' | 'action_applied',
    event: EventTypes['directory_initialized'] | EventTypes['action_applied'],
  ): Promise<void> {
    if (event.version !== 1) throw new Error('Unsupported event version')
    if (topic === 'directory_initialized') {
      const body = (event as EventTypes['directory_initialized']).body
      for (const [role, a] of [
        ['store', body.args.initial_store],
        ['resolver', body.args.initial_resolver],
      ] as const)
        await this.verifyContract(role, contractId(a.id), a)
    } else {
      const body = (event as EventTypes['action_applied']).body
      if (body.admission) {
        // Store flag changes carry the updated admission, like AddStore.
        const role =
          'AddStore' in body.action ||
          'SetAcceptsMoves' in body.action ||
          'SetRetiring' in body.action
            ? 'store'
            : 'AddResolver' in body.action
              ? 'resolver'
              : 'SetPolicy' in body.action
                ? 'policy'
                : null
        if (!role)
          throw new Error(
            `Unexpected admission for ${Object.keys(body.action)[0]}`,
          )
        await this.verifyContract(
          role,
          contractId(body.admission.id),
          body.admission,
        )
      }
    }
    // Membership is read again before routing, even at a height already read.
    this.sharing.clear()
  }
  private argumentRoot(args: unknown): Contract {
    const a = args as {
      root?: Contract
      key?: NameKey
      name?: { key: NameKey }
      parent?: NameKey
    }
    const root = a.root ?? a.key?.root ?? a.name?.key.root ?? a.parent?.root
    if (!root) throw new Error('Located read has no root key')
    return root
  }
  /** The stores the directory admits, each verified; read once per attempt. */
  private storeAdmissions(at: Attempt): Promise<Admission[]> {
    return (at.stores ??= (async () => {
      await this.verify('directory', this.directoryId, undefined, false, at)
      const stores = await this.members('Store', at)
      for (const row of stores)
        await this.verify('store', contractId(row.id), row, true, at)
      return stores
    })())
  }
  private ordinal(stores: Admission[], id: string): number {
    const row = stores.find((a) => contractId(a.id) === contractId(id))
    if (!row) throw new Error('Unadmitted store')
    return row.ordinal
  }
  private checkForward(
    stores: Admission[],
    from: string,
    root: Contract,
    f: Forward,
    seen: Set<string>,
  ): string {
    const to = contractId(f.destination)
    if (
      !equalBytes(root, f.root) ||
      seen.has(to) ||
      f.destination_ordinal <= this.ordinal(stores, from) ||
      this.ordinal(stores, to) !== f.destination_ordinal
    )
      throw new Error('Non-monotone or invalid shard forwarding')
    return to
  }
  private async followHomeRaw(
    at: Attempt,
    stores: Admission[],
    start: string,
    root: Contract,
  ): Promise<{
    store: string
    value: 'Absent' | 'Local' | { Staged: Contract }
    forwards: Forward[]
  }> {
    let store = contractId(start)
    const seen = new Set<string>(),
      forwards: Forward[] = []
    for (let hops = 0; hops <= this.hopLimit; hops++) {
      seen.add(store)
      this.ordinal(stores, store)
      const value = await this.raw('store', store, 'home', { root }, at)
      if (typeof value === 'object' && 'Forwarded' in value) {
        if (hops === this.hopLimit)
          throw new Error('Forwarding hop limit exceeded')
        const next = this.checkForward(stores, store, root, value.Forwarded, seen)
        forwards.push(value.Forwarded)
        store = next
      } else return { store, value, forwards }
    }
    throw new Error('Forwarding hop limit exceeded')
  }
  private async followRaw(
    at: Attempt,
    start: string,
    root: Contract,
    method: Method<'store'>,
    args: never,
  ): Promise<{ store: string; value: Located<unknown>; forwards: Forward[] }> {
    // A cached home is a hint. Every read revalidates it, including unknown descendants.
    const stores = await this.storeAdmissions(at)
    const home = await this.followHomeRaw(at, stores, start, root)
    return this.followFrom(at, stores, start, home, root, method, args)
  }
  /**
   * Read `method` at the home this attempt followed from `start`, and follow any forward it
   * returns, hop by hop. `home` must be what `followHomeRaw` returned from `start` at this height.
   */
  private async followFrom(
    at: Attempt,
    stores: Admission[],
    start: string,
    home: { store: string; forwards: Forward[] },
    root: Contract,
    method: Method<'store'>,
    args: never,
  ): Promise<{ store: string; value: Located<unknown>; forwards: Forward[] }> {
    let store = home.store
    const forwards = [...home.forwards],
      seen = new Set([
        contractId(start),
        ...forwards.map((f) => contractId(f.destination)),
      ])
    for (let hops = forwards.length; hops <= this.hopLimit; hops++) {
      const value = (await this.raw(
        'store',
        store,
        method,
        args,
        at,
      )) as Located<unknown>
      if (typeof value === 'object' && 'Forwarded' in value) {
        if (hops === this.hopLimit)
          throw new Error('Forwarding hop limit exceeded')
        const next = this.checkForward(stores, store, root, value.Forwarded, seen)
        seen.add(next)
        forwards.push(value.Forwarded)
        store = next
      } else return { store, value, forwards }
    }
    throw new Error('Forwarding hop limit exceeded')
  }
  async locate<T>(
    start: string,
    root: Contract,
    method: Method<'store'>,
    args: unknown,
  ): Promise<Routed<T>> {
    if (!methodDefinition('store', method).output.startsWith('Located<'))
      throw new Error('Expected a Located read')
    return this.attempts(
      async (at) =>
        ({
          ...(await this.followRaw(at, start, root, method, args as never)),
          height: at.height,
        }) as Routed<T>,
      true,
    )
  }
  async getName(
    spelling: string,
    homeHint?: string,
  ): Promise<Routed<NameView>> {
    const key = nameKey(spelling)
    return this.attempts(async (at) => {
      const height = at.height,
        stores = await this.storeAdmissions(at)
      // The name at a home this attempt found Local: followed from there, as `followRaw` from that
      // store would, without reading membership and that home again.
      const named = async (home: { store: string; forwards: Forward[] }) =>
        ({
          ...(await this.followFrom(
            at,
            stores,
            home.store,
            { store: home.store, forwards: [] },
            key.root,
            'get_name',
            key as never,
          )),
          forwards: home.forwards,
          height,
        }) as Routed<NameView>
      if (homeHint) {
        const hinted = await this.followHomeRaw(at, stores, homeHint, key.root)
        if (hinted.value === 'Local') return named(hinted)
        // An unavailable forwarded destination throws; an absent hint permits discovery.
        if (hinted.forwards.length)
          return {
            store: hinted.store,
            value: 'Absent',
            forwards: hinted.forwards,
            height,
          }
      }
      for (const a of stores) {
        const home = await this.followHomeRaw(at, stores, contractId(a.id), key.root)
        if (home.value === 'Local') return named(home)
      }
      const allocation = await this.raw(
        'directory',
        this.directoryId,
        'allocation',
        null,
        at,
      )
      return {
        store: contractId(allocation.newest_store),
        value: 'Absent',
        forwards: [],
        height,
      }
    }, true)
  }
  async listControllers(): Promise<Controllers> {
    return this.directory.controllers()
  }
  /** Check every home before choosing a released root's cession destination. */
  async registrationPlacement(root: Contract): Promise<RegistrationPlacement> {
    await this.verifyContract('directory', this.directoryId)
    return this.attempts(async (at) => (await this.placementAt(at, root)).placement, true)
  }
  /**
   * Placement read inside the caller's attempt, at its height, with the canonical root's name
   * when there is one.
   */
  private async placementAt(
    at: Attempt,
    root: Contract,
  ): Promise<{ placement: RegistrationPlacement; canonical?: NameView }> {
    const height = at.height,
      stores = await this.storeAdmissions(at)
    const homes = new Map<string, Home>()
    for (const a of stores) {
      const id = contractId(a.id),
        home = await this.raw('store', id, 'home', { root }, at)
      if (typeof home === 'object' && 'Staged' in home)
        throw new Error('Registration root has a staged import')
      homes.set(id, home)
    }
    const locals = [...homes].filter(([, home]) => home === 'Local')
    if (locals.length > 1) throw new Error('Multiple canonical registration homes')
    const canonicalStore = locals[0]?.[0] ?? null
    for (const [start, home] of homes) {
      if (typeof home !== 'object' || !('Forwarded' in home)) continue
      let hop = start,
        current: Home = home,
        hops = 0
      const seen = new Set([start])
      while (typeof current === 'object' && 'Forwarded' in current) {
        if (hops++ === this.hopLimit)
          throw new Error('Forwarding hop limit exceeded')
        hop = this.checkForward(stores, hop, root, current.Forwarded, seen)
        seen.add(hop)
        current = homes.get(hop)!
      }
      if (hop !== canonicalStore || current !== 'Local')
        throw new Error('Forward does not terminate at the canonical home')
    }
    let releasedRoot: ReleasedRoot | null = null
    let store: string | null = canonicalStore
    let canonical: NameView | undefined
    if (canonicalStore) {
      const source = stores.find(
        (a) => contractId(a.id) === canonicalStore,
      )!
      const view = await this.raw('store', canonicalStore, 'get_name', {
        root,
        node: root,
      }, at)
      if (
        typeof view !== 'object' ||
        !('Local' in view) ||
        height < view.Local.name.grace_end
      )
        throw new Error('Registration root is not released')
      canonical = view.Local
      if (source.retiring) {
        store = null
        for (const a of [...stores].reverse()) {
          if (a.retiring) continue
          const capacity = await this.raw(
            'store', contractId(a.id), 'capacity', null, at,
          )
          if (!capacity.sealed) {
            if (a.ordinal > source.ordinal) store = contractId(a.id)
            break
          }
        }
        if (!store) throw new Error('No eligible retirement successor')
        releasedRoot = await this.raw(
          'store', canonicalStore, 'released_root', { root }, at,
        )
        if (
          releasedRoot.grace_end !== view.Local.name.grace_end ||
          releasedRoot.counters.generation !== view.Local.name.incarnation.generation
        )
          throw new Error('Released root lineage changed')
      }
    } else {
      const newest = stores.at(-1)
      if (!newest || newest.retiring)
        throw new Error('Newest registration store is unavailable')
      store = contractId(newest.id)
      if ((await this.raw('store', store, 'capacity', null, at)).sealed)
        throw new Error('Newest registration store is sealed')
    }
    return { placement: { store: store!, canonicalStore, releasedRoot, height }, canonical }
  }
  /**
   * Quote at the selected store and bind its request to the previous lifecycle. Placement,
   * selection, policy and quote are read at one height: a block that lands meanwhile makes the
   * whole preparation run again at the new height (see `snapshot`), never a mixed request. The
   * quote and calls are for `input` as it was passed; they become signable only once that
   * snapshot committed.
   */
  async prepareRegistration(
    registrationInput: Omit<RegistrationInput, 'quote' | 'commitmentStore'> & {
      commitmentStore?: string
    },
  ): Promise<PreparedRegistration> {
    // Fixed before any await: a caller changing its object meanwhile changes nothing here.
    const input = Object.freeze(copyNow(registrationInput))
    const key = nameKey(`${input.label}.dusk`)
    if (!equalBytes(key.root, key.node))
      throw new Error('Registration requires a root label')
    await this.verifyContract('directory', this.directoryId)
    const read = await this.attempts(async (at) => {
      const height = at.height,
        { placement, canonical } = await this.placementAt(at, key.root)
      const context = await this.raw(
        'directory', this.directoryId, 'registration_context', null, at,
      )
      const policy = contractId(context.policy)
      await this.verify('policy', policy, undefined, false, at)
      const config = await this.raw('policy', policy, 'config', null, at)
      let previousGeneration = placement.releasedRoot?.counters.generation ?? 0n
      let previousGraceEnd = placement.releasedRoot?.grace_end ?? null
      if (placement.canonicalStore && !placement.releasedRoot) {
        // Placement read this root's name at its canonical home at this height: Local, released.
        if (!canonical) throw new Error('Registration home changed')
        previousGeneration = canonical.name.incarnation.generation
        previousGraceEnd = canonical.name.grace_end
      }
      const quoteRequest: QuoteRequest = {
        version: 1,
        directory: fromHex(this.directoryId, 32),
        store: fromHex(placement.store, 32),
        node: key.node,
        label: input.label,
        actor: input.actor,
        years: input.years,
        height,
        previous_generation: previousGeneration,
        previous_grace_end: previousGraceEnd,
        policy_version: context.policy_version,
      }
      const quote = await this.raw('store', placement.store, 'quote_registration', {
        node: key.node,
        label: input.label,
        actor: input.actor,
        years: input.years,
        expected_policy_version: context.policy_version,
        expected_policy_config_version: config.config_version,
      }, at)
      // The store prices at the tip it reads: another height means a block landed meanwhile.
      if (quote.height !== height) throw new TipMoved()
      if (
        !equalBytes(quote.quote.request_hash,
          hash('duskds:quote:v1', canonicalBytes('QuoteRequest', quoteRequest))) ||
        quote.policy_version !== context.policy_version ||
        quote.quote.config_version !== config.config_version ||
        contractId(quote.policy) !== policy
      )
        throw new Error('Registration quote does not match placement and previous lifecycle')
      return { placement, height, quoteRequest, quote, configVersion: config.config_version }
    }, true)
    // Evidence only from a snapshot that committed: an abandoned attempt leaves nothing signable.
    const { placement, height, quoteRequest, quote } = read
    this.noteQuote(
      quote,
      { store: placement.store, node: key.node, label: input.label, years: input.years },
      read.configVersion,
    )
    return {
      ...placement,
      height,
      quoteRequest,
      quote,
      calls: registrationCalls(placement.store, {
        ...input,
        commitmentStore: input.commitmentStore ?? placement.store,
        quote,
      }),
    }
  }
  /**
   * Quote at the store under the policy the directory selects, verified against the release,
   * at one height. The quote must name that policy, selection and config version. It is for
   * `args` as they were passed, and becomes evidence only once its snapshot committed. Only a
   * quote returned here or by `prepareRegistration` builds a registration (`registrationCalls`),
   * and the Connect app signs a reveal only for the terms this client quoted.
   */
  async quoteRegistration(
    store: string,
    quoteArgs: QuoteRegistration,
  ): Promise<RegistrationQuote> {
    // Fixed before any await: the request the store prices is the one the proof names.
    const args = Object.freeze(wireValue('QuoteRegistration', quoteArgs))
    store = contractId(store)
    await this.verifyContract('directory', this.directoryId)
    await this.verifyContract('store', store)
    const { quote, configVersion } = await this.attempts(async (at) => {
      const context = await this.raw(
        'directory', this.directoryId, 'registration_context', null, at,
      )
      const policy = contractId(context.policy)
      await this.verify('policy', policy, undefined, false, at)
      const config = await this.raw('policy', policy, 'config', null, at)
      const quote = await this.raw('store', store, 'quote_registration', args, at)
      if (quote.height !== at.height) throw new TipMoved()
      if (
        contractId(quote.policy) !== policy ||
        quote.policy_version !== context.policy_version ||
        quote.quote.config_version !== config.config_version
      )
        throw new Error("Registration quote does not match the directory's policy selection")
      return { quote, configVersion: config.config_version }
    }, true)
    // Evidence only from a snapshot that committed: an abandoned attempt leaves nothing signable.
    this.noteQuote(quote, { store, node: args.node, label: args.label, years: args.years }, configVersion)
    return quote
  }
  private noteQuote(
    quote: RegistrationQuote,
    request: { store: string; node: Contract; label: string; years: number },
    configVersion: bigint,
  ): void {
    noteSelection(this.ledger, quote.policy_version, contractId(quote.policy), configVersion)
    noteVerifiedQuote(this.ledger, quote, request)
  }
  async quoteRenewal(
    store: string,
    args: StoreQuoteRenewalArgs,
  ): Promise<Routed<RenewalQuote>> {
    return this.locate(store, args.name.key.root, 'quote_renewal', args)
  }
  /** Resolve current owner/manager authority, then verify home, incarnation, lifecycle, forward record and pool uniqueness. */
  async verifyPrimary(endpoint: number[]): Promise<VerifiedPrimary | null> {
    return this.attempts(async (at) => {
      const height = at.height,
        stores = await this.storeAdmissions(at)
      let found: VerifiedPrimary | null = null
      for (const a of stores) {
        const store = contractId(a.id),
          primary = await this.raw('store', store, 'resolve_primary', { endpoint }, at)
        if (!primary) continue
        const name = await this.followRaw(
          at,
          store,
          primary.primary.name.key.root,
          'get_name',
          primary.primary.name.key as never,
        )
        if (
          name.store !== store ||
          typeof name.value !== 'object' ||
          !('Local' in name.value)
        )
          continue
        const view = name.value.Local as NameView,
          n = view.name,
          ref = primary.primary.name
        if (
          n.incarnation.generation !== ref.incarnation.generation ||
          n.incarnation.serial !== ref.incarnation.serial ||
          !view.active ||
          height >= n.expires_at
        )
          continue
        const record = await this.raw('store', store, 'resolve_record', {
          key: n.key,
          record_key: 'moonlight_address',
        }, at)
        if (
          typeof record !== 'object' ||
          !('Local' in record) ||
          !record.Local ||
          !equalBytes(record.Local.value, endpoint)
        )
          continue
        if (!equalBytes(nameKey(primary.spelling).node, n.key.node))
          throw new Error('Primary spelling mismatch')
        if (
          !primaryNameStatus({
            endpoint,
            primary,
            name: view,
            record: record.Local,
            height,
          }).verified
        )
          continue
        if (found) throw new Error('Multiple verified pool primaries')
        found = { store, primary, record: record.Local, height }
      }
      return found
    }, true)
  }
}
export async function createClientFromManifest(
  source: unknown,
  options: ClientOptions = {},
): Promise<FrozenClient> {
  const client = new FrozenClient(
    await loadReleaseManifest(source, options),
    options,
  )
  await client.discover()
  return client
}
