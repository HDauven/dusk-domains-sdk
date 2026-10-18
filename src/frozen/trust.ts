/**
 * What one client verified: the contracts it may read and sign for, the contracts it refused,
 * and the registration policy selections and quotes it checked. Each `FrozenClient` owns one
 * ledger, attached to its own copy of the release, so a decision never leaks to another client.
 * Internal: no package entrypoint exports it.
 * @module
 */
import { contractId, hash, hex } from './bytes.ts'
import { stringifyJson, u64 } from './json.ts'
import { wireValue } from './wire.ts'
import type { DataDriver } from './driver.ts'
import type { ContractRole, LoadedRelease, ReleaseContract } from './manifest.ts'
import type { Node, RegistrationQuote } from './types.ts'

export interface VerifiedContract {
  role: ContractRole
  descriptor: ReleaseContract
  driver: DataDriver
  /** Evidence the contract was verified with, compared again when more evidence arrives. */
  codeHash?: string
  initHash?: string
  /**
   * The release committed to its code and initialization, and verification compared them:
   * the Connect app may sign for it. Without both commitments a contract is readable only.
   */
  signable?: boolean
  /**
   * Verified inside these snapshot attempts, none of which committed yet: readable by them, never
   * signable. It is committed with the first that commits, and dropped when all are abandoned.
   */
  pending?: Set<Stage>
  /**
   * Verified with facts the verification cache held, not read by this client: readable, never
   * signable. Signing verifies it from the chain first (`confirmContract`), which replaces it.
   */
  cached?: boolean
  /** Verification added it to the client's release; dropping it removes it again. */
  addedToRelease?: boolean
}
/** One snapshot attempt's verifications, committed only when the attempt is. */
export interface Stage {
  touched: Set<string>
}
/** The policy and its config version that the directory selected at a selection version. */
export interface Selection {
  policy: string
  configVersion: string
}
/** A registration quote a client verified, and what a register call it priced carries. */
export interface QuoteProof {
  store: string
  node: string
  label: string
  years: number
  policy: string
  version: string
  configVersion: string
  totalLux: string
  height: string
}
export interface Ledger {
  /** The release's directory: every other contract's verification rests on it. */
  directory: string
  verified: Map<string, VerifiedContract>
  refused: Map<string, ContractRefusedError>
  /** Selection version to the policy the directory selected there, as this client read it. */
  selections: Map<string, Selection>
  /** Quotes this client verified, by the terms a register call carries. */
  quotes: Map<string, QuoteProof>
  /** Verify a contract again from the chain, ignoring the verification cache. */
  confirm?: (role: ContractRole, id: string) => Promise<void>
}
/** A contract failed a check against immutable evidence. Its client never accepts it again. */
export class ContractRefusedError extends Error {
  readonly contractId: string
  constructor(contract: string, message: string) {
    super(message)
    this.name = 'ContractRefusedError'
    this.contractId = contract
  }
}
/**
 * A call's target, or a contract it hands a name to, that this client has not verified: read it
 * through the client first (or `discover()`), which verifies it, then sign. When the client refused
 * it, `cause` is that `ContractRefusedError`.
 */
export class UnverifiedContractError extends Error {
  readonly contractId: string
  readonly role: ContractRole
  constructor(contract: string, role: ContractRole, message: string, refusal?: ContractRefusedError) {
    super(message, refusal ? { cause: refusal } : undefined)
    this.name = 'UnverifiedContractError'
    this.contractId = contract
    this.role = role
  }
}
/**
 * A registration quote that no client verified as this object, or that changed since: one
 * restored from storage, copied, or edited. Quote again (`quoteRegistration` or
 * `prepareRegistration`) and show the fresh price; nothing was signed.
 */
export class UnverifiedQuoteError extends Error {
  readonly retryable = true
  constructor(message: string) {
    super(message)
    this.name = 'UnverifiedQuoteError'
  }
}
const ledgers = new WeakMap<LoadedRelease, Ledger>()
/** Errors that say nothing about the chain height, so a snapshot never retries them. */
const independent = new WeakSet<object>()
// A long-lived client keeps its most recent quotes; an evicted one is quoted again.
const QUOTE_LIMIT = 1024

export function createLedger(release: LoadedRelease): Ledger {
  const ledger: Ledger = {
    directory: contractId(release.manifest.contracts.find((c) => c.role === 'directory')!.contractId),
    verified: new Map(),
    refused: new Map(),
    selections: new Map(),
    quotes: new Map(),
  }
  ledgers.set(release, ledger)
  return ledger
}
/** The contract the client owning `release` verified in `role`; refused or unknown is undefined. */
export function verifiedContract(
  release: LoadedRelease,
  id: string,
  role?: ContractRole,
): VerifiedContract | undefined {
  const ledger = ledgers.get(release)
  id = contractId(id)
  const row = ledger?.verified.get(id)
  return row && !row.pending && !ledger!.refused.has(id) && (!role || row.role === role) ? row : undefined
}
/**
 * Like `verifiedContract`, but only a contract the Connect app may sign for: one the release
 * commits to, verified from the chain rather than the verification cache, through a directory the
 * client also verified from the chain and has not refused. The directory's records and binding
 * vouch for every other contract, so nothing is signable through a directory that is not.
 */
export function signableContract(
  release: LoadedRelease,
  id: string,
  role?: ContractRole,
): VerifiedContract | undefined {
  const row = verifiedContract(release, id, role)
  if (!row?.signable || row.cached) return undefined
  const ledger = ledgers.get(release)!
  if (contractId(id) === ledger.directory) return row
  const directory = verifiedContract(release, ledger.directory, 'directory')
  return directory && !directory.cached ? row : undefined
}

/** The refusal of `id` by the client owning `release`, if it refused it. */
export function refusedContract(release: LoadedRelease, id: string): ContractRefusedError | undefined {
  return ledgers.get(release)?.refused.get(contractId(id))
}
/**
 * Before signing for a contract, stop at a refusal and verify from the chain, once, one the client
 * owning `release` verified from its verification cache only: its result replaces the cached one,
 * and one that fails is refused, by that client, for reads too. A refusal of the contract, or of
 * the directory that vouches for it, throws an `UnverifiedContractError` with `message` and that
 * `ContractRefusedError` as its cause, every time. Anything else unverified is left to the
 * signature's own checks, which never pass it.
 */
export async function confirmContract(
  release: LoadedRelease,
  id: string,
  role: ContractRole,
  message: string,
): Promise<void> {
  const ledger = ledgers.get(release)
  if (!ledger) return
  id = contractId(id)
  // A refusal is never done with: it stops every signature, before anything else is looked at.
  const refusal = ledger.refused.get(id) ?? (id === ledger.directory ? undefined : ledger.refused.get(ledger.directory))
  if (refusal) throw new UnverifiedContractError(id, role, message, refusal)
  const row = ledger.verified.get(id)
  if (!row?.cached || row.pending || row.role !== role || !ledger.confirm) return
  try {
    await ledger.confirm(role, id)
  } catch (error) {
    throw error instanceof ContractRefusedError ? new UnverifiedContractError(id, role, message, error) : error
  }
}
/** The selection at `version` the client owning `release` read, under a signable policy. */
export function verifiedSelection(
  release: LoadedRelease,
  version: bigint,
): Selection | undefined {
  const selection = ledgers.get(release)?.selections.get(u64(version).toString())
  return selection && signableContract(release, selection.policy, 'policy') ? selection : undefined
}
/** The policy the client owning `release` read as the selection at `version`, signable or not. */
export function selectedPolicy(release: LoadedRelease, version: bigint): string | undefined {
  return ledgers.get(release)?.selections.get(u64(version).toString())?.policy
}
/** Record what the directory selected; a contradicting read is not evidence of either. */
export function noteSelection(
  ledger: Ledger,
  version: bigint,
  policy: string,
  configVersion: bigint,
): void {
  const key = u64(version).toString(),
    selection = { policy: contractId(policy), configVersion: u64(configVersion).toString() },
    known = ledger.selections.get(key)
  if (known && (known.policy !== selection.policy || known.configVersion !== selection.configVersion))
    throw new Error(`Conflicting reads of registration policy selection ${key}`)
  ledger.selections.set(key, selection)
}
interface QuoteRequest {
  store: string
  node: Node
  label: string
  years: number
}
// The quote objects clients verified, and their exact contents then.
const quotes = new WeakMap<object, { digest: string; store: string; node: string; label: string; years: number }>()
const digest = (quote: RegistrationQuote): string =>
  hex(hash('duskds:sdk:verified-quote:v1', new TextEncoder().encode(stringifyJson(wireValue('RegistrationQuote', quote)))))
const quoteKey = (
  store: string,
  node: string,
  label: string,
  years: number,
  version: bigint,
  configVersion: bigint,
  totalLux: string,
): string =>
  stringifyJson([contractId(store), node, label, years, u64(version), u64(configVersion), BigInt(totalLux).toString()])
/**
 * Remember a quote the client verified at the directory's selection: in its ledger by the terms
 * a register call carries, and as this exact object with its contents for `registrationCalls`.
 */
export function noteVerifiedQuote(
  ledger: Ledger,
  quote: RegistrationQuote,
  request: QuoteRequest,
): void {
  const store = contractId(request.store),
    node = hex(request.node),
    proof: QuoteProof = {
      store,
      node,
      label: request.label,
      years: request.years,
      policy: contractId(quote.policy),
      version: u64(quote.policy_version).toString(),
      configVersion: u64(quote.quote.config_version).toString(),
      totalLux: BigInt(quote.total_lux).toString(),
      height: u64(quote.height).toString(),
    },
    key = quoteKey(store, node, request.label, request.years, quote.policy_version, quote.quote.config_version, quote.total_lux)
  ledger.quotes.delete(key)
  ledger.quotes.set(key, proof)
  if (ledger.quotes.size > QUOTE_LIMIT) ledger.quotes.delete(ledger.quotes.keys().next().value!)
  quotes.set(quote, { digest: digest(quote), store, node, label: request.label, years: request.years })
}
/** Whether a client verified this exact, unchanged quote object at `store` for `label` and `years`. */
export function isVerifiedQuote(
  quote: RegistrationQuote,
  store: string,
  label: string,
  years: number,
): boolean {
  const proof = quotes.get(quote)
  return Boolean(
    proof &&
      proof.store === contractId(store) &&
      proof.label === label &&
      proof.years === years &&
      proof.digest === digest(quote),
  )
}
/**
 * The quote the client owning `release` verified for exactly these register terms, under the
 * policy it read as the directory's selection at that version.
 */
export function registrationProof(
  release: LoadedRelease,
  store: string,
  terms: {
    node: Node
    label: string
    years: number
    expected_policy_version: bigint
    expected_policy_config_version: bigint
    expected_fee_lux: string
  },
): QuoteProof | undefined {
  const ledger = ledgers.get(release)
  if (!ledger) return undefined
  const proof = ledger.quotes.get(
      quoteKey(store, hex(terms.node), terms.label, terms.years, terms.expected_policy_version,
        terms.expected_policy_config_version, terms.expected_fee_lux),
    ),
    selection = verifiedSelection(release, terms.expected_policy_version)
  return proof && selection?.policy === proof.policy && selection.configVersion === proof.configVersion
    ? proof
    : undefined
}
/** Objects a lens reply supplied, at every depth: no signed call takes them as arguments. */
const lensRows = new WeakSet<object>()
export function markLensRows(values: readonly unknown[]): void {
  const mark = (value: unknown): void => {
    if (!value || typeof value !== 'object' || lensRows.has(value)) return
    lensRows.add(value)
    for (const child of Object.values(value)) mark(child)
  }
  for (const value of values) mark(value)
}
export function isLensRow(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && lensRows.has(value))
}
/**
 * A call takes no object a lens `bootstrap()` returned: check caller input before any copy, which
 * would drop the mark.
 */
export function refuseLensRows(input: unknown): void {
  if (holdsLensRow(input))
    throw new Error('A lens bootstrap reply is not evidence for a signed call: read its values directly')
}
/** Whether `value` holds, at any depth, an object a lens reply supplied. */
export function holdsLensRow(value: unknown, seen = new Set<object>()): boolean {
  if (!value || typeof value !== 'object' || seen.has(value)) return false
  if (lensRows.has(value)) return true
  seen.add(value)
  return Object.values(value).some((child) => holdsLensRow(child, seen))
}
export function heightIndependent<E>(error: E): E {
  if (error && typeof error === 'object') independent.add(error)
  return error
}
export function isHeightIndependent(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && independent.has(error))
}
/**
 * Spec §2.3 init commitment: H("duskds:init:v1" || canonical init archive). The reviewed driver
 * encodes `init` exactly as the deployment's archive, so a live contract's initialization
 * (binding, and a policy's immutable config) reproduces its admission's `init_hash`.
 */
export function initCommitment(driver: DataDriver, init: unknown): string {
  return hex(hash('duskds:init:v1', driver.encodeInput('init', stringifyJson(init))))
}
