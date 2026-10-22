/**
 * The light reader: forward resolution and verified primary names through a release's read lens alone,
 * with the lens's data driver as the only artifact it fetches. It checks the lens deployment and every
 * reply as the full client's lens path does (`lens.ts`), and never reads directly instead. Exported by the
 * `./lens-reader` entrypoint.
 * @module
 */
import { nameKey } from './bytes.ts'
import { encodeBase58, hasClaimableReferrerShape } from '../core/principal.ts'
import { fetchDriver, validateReleaseManifest } from './manifest.ts'
import { createHttpTransport, type ReadTransport } from './transport.ts'
import { elapsed } from './sharing.ts'
import type { LENS_INTERFACE, LensMethod } from './lens-schema.ts'
import {
  LENS_OFF_MS,
  LENS_RETRIES,
  LensFailure,
  StoreMarks,
  checkLensBinding,
  checkLensCommitments,
  checkLensEntry,
  checkLensInterface,
  checkResolution,
  checkReverse,
  evidenceFailure,
  lensInput,
  lensOutput,
  lensRetry,
  releaseBinding,
  replyStores,
  validRecordKeys,
  wait,
  type EvidenceContext,
  type LensRefusal,
  type LensResolution,
  type LensReverse,
  type NameLifecycle,
  type Resolved,
  type VerifiedPrimary,
} from './lens.ts'
import type { Binding } from './types.ts'

/** How long a reader's creation, or one of its reads, may take by default: 15 s. */
const TIMEOUT_MS = 15_000
/** The longest a timer waits: a `timeoutMs` past it would fire at once. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1
/** How many times a reply older than one the reader gave is asked for again, and how far apart. */
const OLDER_ASKS = 3
const OLDER_WAIT_MS = 1_000

/** Options of `createLensReader`: the node it queries, where the lens driver is, and the fetch and timeout. */
export interface LensReaderOptions {
  /** The Rusk node to query, such as `https://nodes.dusk.network/`. */
  nodeUrl: string
  /** The base the lens driver's `dataDriver.path` resolves against; the release's own `artifactBaseUrl` if left out. */
  artifactBaseUrl?: string
  /** Fetches the lens driver and sends the node queries: `globalThis.fetch` if left out. */
  fetch?: typeof fetch
  /** How long creating the reader, and each of its reads, may take, in milliseconds: 15,000 if left out. */
  timeoutMs?: number
}
/**
 * Why a light reader answered nothing. `deployment`: the release's lens, its driver or the deployed lens
 * failed a check, or the driver did not load; `refused`: the lens refused (`refusal`); `decode`: a reply
 * did not decode; `evidence`: what a reply rests on failed a check against the release; `read`: the node
 * query failed, a rate limit included once its retries ran out (`cause`); `timeout`: it ran past `timeoutMs`.
 */
export type LensReaderFailure = 'deployment' | 'refused' | 'decode' | 'evidence' | 'read' | 'timeout'
/** A light reader's failure, and why (`reason`). The reader never reads another way instead. */
export class LensReaderError extends Error {
  /** Why the read failed. */
  readonly reason: LensReaderFailure
  /** The lens's refusal, for `refused`. */
  declare readonly refusal?: LensRefusal
  /** A failure for `reason`, with what caused it and, for `refused`, the lens's refusal. */
  constructor(reason: LensReaderFailure, message: string, options: { cause?: unknown; refusal?: LensRefusal } = {}) {
    super(message, 'cause' in options ? { cause: options.cause } : undefined)
    this.name = 'LensReaderError'
    this.reason = reason
    if (options.refusal) Object.defineProperty(this, 'refusal', { value: options.refusal, enumerable: true })
  }
}
/**
 * A name's Moonlight account, as `resolveMoonlightAccount` reads it: the name's lifecycle and, for an
 * active name whose `moonlight_address` record has a Moonlight key's shape, that key in Base58.
 */
export interface MoonlightAccount {
  /** The name's lifecycle at `height`. */
  status: NameLifecycle
  /**
   * The name's Moonlight public key in Base58: 96 bytes in compressed form, not the identity, with both
   * coordinates in the field. The reader runs no curve check; a wallet validates the key as any address.
   */
  account?: string
  /** The height it was read at. */
  height: bigint
}
/**
 * Reads `.dusk` names through a release's lens only, one contract query each and no tip read: a reply
 * reports the height it was read at. Every answer passed the checks the full client makes on the lens's
 * replies; a read that fails throws a `LensReaderError`. Arguments the client refuses, such as a name
 * that is not canonical, throw an `Error` before any request, as the client's do.
 */
export interface LensReader {
  /**
   * The name at its home, with one record (or null) per key, as `client.resolve` returns it through the
   * lens: at most 16 distinct keys of 1 to 64 bytes, `moonlight_address` alone if left out. A record is
   * there only for an active name that holds it.
   */
  resolve(name: string, recordKeys?: readonly string[]): Promise<Resolved>
  /** The verified primary name of a 96-byte Moonlight key, or null, as `client.verifyPrimary` returns it. */
  verifyPrimary(endpoint: readonly number[] | Uint8Array): Promise<VerifiedPrimary | null>
  /** `resolve(name)`, reduced to the name's lifecycle and, when it is active, its Moonlight account. */
  resolveMoonlightAccount(name: string): Promise<MoonlightAccount>
}

/** A resolution's lifecycle and, for an active name whose `moonlight_address` has a key's shape, that key in Base58. */
export function moonlightAccount({ status, records, height }: Resolved): MoonlightAccount {
  const value = records.find((r) => r?.key === 'moonlight_address')?.value
  const key = status === 'Active' && value && hasClaimableReferrerShape({ kind: 'Moonlight', bytes: value })
  return { status, height, ...(key ? { account: encodeBase58(value) } : {}) }
}
const message = (error: unknown): string => (error instanceof Error ? error.message : String(error))
/**
 * `run` with a signal that aborts once it settles, or after `ms`, when the result is a `timeout` error
 * even if `run` ignores the signal.
 */
async function bounded<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new LensReaderError('timeout', `The lens reader took over ${ms} ms`)
      controller.abort(error)
      reject(error)
    }, ms)
  })
  try {
    return await Promise.race([run(controller.signal), late])
  } finally {
    clearTimeout(timer)
    controller.abort()
  }
}
/** A lens failure as the reader reports it: its reason (`unsupported` and `height` as `evidence`) and refusal. */
function reported(failure: LensFailure, cause: unknown = failure): LensReaderError {
  const reason = failure.reason === 'unsupported' || failure.reason === 'height' ? 'evidence' : failure.reason
  return new LensReaderError(reason, failure.message, { cause, ...(failure.refusal ? { refusal: failure.refusal } : {}) })
}
/** A check of the lens's deployment: what it throws as the reader reports it, any other error as `deployment`. */
function deployed(check: () => void): void {
  try {
    check()
  } catch (error) {
    throw error instanceof LensFailure
      ? reported(error)
      : new LensReaderError('deployment', `The lens deployment does not check: ${message(error)}`, { cause: error })
  }
}
/** A reply decoded, or its refusal, the height it was at, and whether it shows an older state than the reader showed. */
type Answer<R> =
  | { reply: R; refusal?: undefined; height: bigint; older: boolean }
  | { reply?: undefined; refusal: LensFailure; height: bigint; older: boolean }

/**
 * A light reader for `release`, a manifest object (`chainId`, `network`, `contracts` and a top-level
 * `lens`) validated as `validateReleaseManifest` validates it; other fields, such as a site URL, are
 * ignored. Contract IDs and commitments come from it alone. As for the client, the lens entry needs
 * `codeHash` and `initHash`, of which only `initHash` can be checked: no read returns a contract's code,
 * and the lens's ID derives from the reviewed WASM the release pins. Every store and resolver, whose
 * admissions the lens's evidence names, needs both too: the reader verifies no contract directly.
 *
 * Only the lens driver is fetched, from `artifactBaseUrl` (or the release's own `artifactBaseUrl`), and
 * used once its size and every pinned digest match and its schema is lens v1's, with an init commitment
 * over the release's directory that is the entry's `initHash`. The deployed lens's `binding` and
 * `lens_interface` must be the release's directory, vault and network and lens v1: they are read once,
 * beside the first query, and again by a later read while that check has not passed. A lens that failed
 * it is held off for 10 minutes: every read in that time throws its failure and sends nothing.
 *
 * Each read sends one lens query to `nodeUrl` (`POST /on/contracts:<lens>/<method>`) and reads no tip.
 * Its reply must decode with the driver and pass the full client's evidence checks: each store and
 * resolver admission it names is one the release lists in that role, with the release's code and init
 * hashes. A reply or refusal that shows an older state than this reader showed, below a height it
 * answered at or without a store it saw by its height, is asked for again after 1 s, three times, an ask
 * that fails leaving it in hand. A node that keeps answering so went back, as after a reverted block, or
 * lags: its last answer is used, a refusal thrown, and later ones are held to it, as the client reads a
 * node whose tip went back at that tip. A refusal's height holds later replies as an answer's does. A
 * rate-limited query is sent again after its `Retry-After`, 1 s if none and never one over 10 s, three
 * times a read, the deployment check it starts included. Whatever fails, a refusal included, throws a
 * `LensReaderError`; nothing is read another way.
 */
export async function createLensReader(release: unknown, options: LensReaderOptions): Promise<LensReader> {
  if (typeof options?.nodeUrl !== 'string') throw new Error('The lens reader needs options.nodeUrl')
  const fetcher = options.fetch ?? globalThis.fetch,
    timeoutMs = options.timeoutMs ?? TIMEOUT_MS
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) throw new RangeError('Invalid lens reader timeout')
  // It reads no indexer: the node URL stands in for the indexer URL a manifest has, and never leaves here.
  const manifest = validateReleaseManifest(release, { nodeUrl: options.nodeUrl, indexerUrl: options.nodeUrl })
  const off = (text: string) => new LensReaderError('deployment', text)
  const lens = manifest.lens
  if (!lens) throw off('The release has no lens')
  // Before its driver is fetched, which the client does not fetch for such an entry either.
  deployed(() => checkLensCommitments(lens))
  for (const c of manifest.contracts)
    if ((c.role === 'store' || c.role === 'resolver') && (c.codeHash === undefined || c.initHash === undefined))
      throw off(`The release's ${c.role} ${c.contractId} has no code or init commitment`)
  const base = options.artifactBaseUrl ?? manifest.artifactBaseUrl
  if (typeof base !== 'string') throw new Error('The lens reader needs an artifactBaseUrl')
  const driver = await bounded(timeoutMs, (signal) => fetchDriver(lens, base, (input, init) => fetcher(input, { ...init, signal }))).catch(
    (error: unknown) => {
      throw error instanceof LensReaderError ? error : new LensReaderError('deployment', `The lens driver did not load: ${message(error)}`, { cause: error })
    },
  )
  const directoryId = manifest.contracts.find((c) => c.role === 'directory')!.contractId,
    vaultId = manifest.contracts.find((c) => c.role === 'vault')!.contractId,
    lensId = lens.contractId
  deployed(() => checkLensEntry(lens, driver, directoryId))
  const fixed = {
      // A driver only checks a policy's evidence, which no read of this reader rests on.
      release: { manifest: { network: manifest.network }, contracts: new Map(manifest.contracts.map((c) => [c.contractId, c])), drivers: new Map() },
      // As a client that verified nothing directly: no contract refused or known, no selection read.
      refused: new Set<string>(),
      known: () => undefined,
      selection: () => undefined,
      directoryId,
      vaultId,
    },
    binding = releaseBinding({ ...fixed, storeMark: -1 }),
    // A transport is two closures: one per read gives its requests that read's signal.
    transport = (signal: AbortSignal): ReadTransport =>
      createHttpTransport(manifest.nodeUrl, (input, init) => fetcher(input, { ...init, signal }))
  /** What this reader showed: the highest height it answered at, and the stores it saw by each height. */
  let top: bigint | undefined,
    marks = new StoreMarks()
  let checking: Promise<void> | undefined
  /** A deployment that failed its check, and until when (on the monotonic clock) reads throw its failure. */
  let held: { error: LensReaderError; until: number } | undefined

  /** One lens query, sent again after a rate limit's wait while `budget` lasts. */
  const send = (node: ReadTransport, method: string, input: Uint8Array, budget: { retries: number }, signal: AbortSignal) =>
    lensRetry(() => node.read(lensId, method, input), budget, undefined, signal).catch((error: unknown) => {
      throw new LensReaderError('read', `Lens ${method} query failed: ${message(error)}`, { cause: error })
    })
  /** The deployed lens's binding and interface, checked once, with the budget of the read that starts the check. */
  const deployment = (budget: { retries: number }): Promise<void> =>
    (checking ??= bounded(timeoutMs, async (signal) => {
      const node = transport(signal)
      const read = async <T>(method: 'binding' | 'lens_interface'): Promise<T> => {
        const bytes = await send(node, method, lensInput(driver, method, null), budget, signal)
        try {
          return lensOutput<T>(driver, method, bytes)
        } catch (error) {
          throw reported(error as LensFailure)
        }
      }
      const bound = read<Binding>('binding'),
        face = read<typeof LENS_INTERFACE>('lens_interface')
      face.catch(() => {})
      const shown = await bound
      deployed(() => checkLensBinding(shown, binding))
      const interfaceShown = await face
      deployed(() => checkLensInterface(interfaceShown))
    }).catch((error: unknown) => {
      checking = undefined
      // As the client holds it off: a lens that failed the check, not one whose check could not be read.
      if (error instanceof LensReaderError && error.reason === 'deployment') held = { error, until: elapsed() + LENS_OFF_MS }
      throw error
    }))
  /** One lens query, sent beside the deployment check and used only once that passed, and its checked answer. */
  async function query<R extends { height: bigint }, T>(method: LensMethod, args: unknown, check: (reply: R, ctx: EvidenceContext) => T): Promise<T> {
    const input = lensInput(driver, method, args)
    return bounded(timeoutMs, async (signal) => {
      if (held && held.until > elapsed()) throw new LensReaderError('deployment', held.error.message, { cause: held.error })
      const node = transport(signal),
        budget = { retries: LENS_RETRIES },
        first = send(node, method, input, budget, signal)
      first.catch(() => {})
      // A check another read started may fail for that read's own reasons, its timer or its rate limits.
      const joined = checking !== undefined
      await deployment(budget).catch((error: unknown) => {
        if (joined && !signal.aborted && !(error instanceof LensReaderError && error.reason === 'deployment')) return deployment(budget)
        throw error
      })
      // An older state than this reader showed: below a height it answered at, or without a store it saw by then.
      const answer = (bytes: Uint8Array): Answer<R> => {
        try {
          const reply = lensOutput<R>(driver, method, bytes)
          return {
            reply,
            height: reply.height,
            older: (top !== undefined && reply.height < top) || replyStores(reply).length - 1 < marks.at(reply.height),
          }
        } catch (error) {
          const refusal = error instanceof LensFailure ? error.refusal : undefined
          if (!refusal) throw reported(error as LensFailure)
          return { refusal: error as LensFailure, height: refusal.height, older: top !== undefined && refusal.height < top }
        }
      }
      let got = answer(await first)
      // Asked for again, as the client reads it again; an ask that fails leaves the answer in hand.
      for (let asks = 0; got.older && asks < OLDER_ASKS; asks++) {
        await wait(OLDER_WAIT_MS, signal)
        try {
          got = answer(await send(node, method, input, budget, signal))
        } catch {
          break
        }
      }
      // A read that timed out shows nothing, and so changes nothing this reader holds.
      signal.throwIfAborted()
      // Still older: the node lags or went back, as after a reverted block. Its answer is its state now,
      // used as a fresh reader would use it, and the reader holds later answers to that instead. A refusal
      // is taken as an answer is: its height is the floor later answers are held to.
      const take = (answer: Answer<R>) => {
        if (answer.older) {
          top = undefined
          marks = new StoreMarks()
        }
        if (top === undefined || answer.height > top) top = answer.height
      }
      if (got.refusal) {
        take(got)
        throw reported(got.refusal)
      }
      const reply = got.reply
      let value: T
      try {
        value = check(reply, { ...fixed, storeMark: got.older ? -1 : marks.at(reply.height) })
      } catch (error) {
        throw reported(evidenceFailure(error), error)
      }
      take(got)
      // The stores an accepted reply lists, from ordinal 0, were admitted by its height.
      marks.saw(reply.height, replyStores(reply).length - 1)
      return value
    })
  }

  const reader: LensReader = {
    async resolve(name, recordKeys = ['moonlight_address']) {
      const key = nameKey(name),
        keys = validRecordKeys(recordKeys)
      return query('resolve', { name, record_keys: keys, hint: null }, (r: LensResolution, ctx) => checkResolution(ctx, r, key, keys))
    },
    async verifyPrimary(endpoint) {
      const bytes = Array.from(endpoint)
      return query('reverse', { endpoint: bytes, hint: null }, (r: LensReverse, ctx) => checkReverse(ctx, r, bytes))
    },
    async resolveMoonlightAccount(name) {
      return moonlightAccount(await reader.resolve(name, ['moonlight_address']))
    },
  }
  return reader
}
