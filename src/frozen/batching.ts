/**
 * Contract reads coalesced into Multicall for Dusk queries: every read a client sends in one tick goes
 * into one `aggregate`, or a few when they pass its limits, and each read settles from its own result as
 * a direct read would. Internal: no package entrypoint exports it.
 * @module
 */
import { fromHex, hex } from './bytes.ts'
import {
  ARGBUF_LEN,
  MAX_CALLS,
  callBytes,
  decodeAggregate,
  encodeAggregate,
  envelopeLength,
  replyLength,
  type CallError,
  type MulticallResult,
} from './multicall.ts'
import { elapsed, failedAt } from './sharing.ts'
import { NodeReadError, type ReadTransport } from './transport.ts'

/** A read's bytes and, when a multicall answered it, the height of the state that query read. */
export interface Reply {
  bytes: Uint8Array
  height?: bigint
}
/** A read that needed its height from a multicall reply, which no multicall gave: read it another way. */
export class Unbatched extends Error {}
/** Why reads went to the node one query at a time instead of through the multicall. */
export interface MulticallFallback {
  /**
   * `batch`: the whole query failed, and its reads were sent alone; `gas`: a read ran out of the gas
   * its batch gave it, and was sent alone.
   */
  reason: 'batch' | 'gas'
  error: unknown
  /** Reads sent alone. */
  calls: number
  /** Batching stopped for 5 minutes: two queries in a row failed whole. */
  disabled: boolean
}
/**
 * What the tab keeps of the multicall's failures, under one node and multicall: when the record ends, in
 * milliseconds since the epoch (`Date.now`), and why. Nothing else.
 */
export interface TabHoldoff {
  until: number
  /** `strike`: one query failed whole; `holdoff`: two in a row did, and batching is off until `until`. */
  reason: 'strike' | 'holdoff'
}
export interface TabHoldoffStore {
  load(): TabHoldoff | undefined
  save(record: TabHoldoff): void
  clear(): void
}
/**
 * The tab's record under `key`, in `sessionStorage`, so a page load after one whose queries failed holds off
 * too. Every access is inside try/catch: where storage is missing, throws or is blocked, nothing is kept and
 * each client holds batching off on its own failures alone.
 */
export function tabHoldoff(key: string): TabHoldoffStore {
  const storage = (): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined => {
    try {
      return (globalThis as { sessionStorage?: Storage }).sessionStorage ?? undefined
    } catch {
      return undefined
    }
  }
  return {
    load() {
      try {
        const text = storage()?.getItem(key)
        if (typeof text !== 'string') return undefined
        const record = JSON.parse(text) as Partial<TabHoldoff> | null
        if (!record || (record.reason !== 'strike' && record.reason !== 'holdoff')) return undefined
        if (typeof record.until !== 'number' || !Number.isFinite(record.until)) return undefined
        return { until: record.until, reason: record.reason }
      } catch {
        return undefined
      }
    },
    save(record) {
      try {
        storage()?.setItem(key, JSON.stringify({ until: record.until, reason: record.reason }))
      } catch {
        // Not kept: this client holds off on its own.
      }
    },
    clear() {
      try {
        storage()?.removeItem(key)
      } catch {
        // Not kept either way.
      }
    },
  }
}
/**
 * Run `task` at the next task, after every microtask of this one, as `setTimeout(task, 0)` would, but not
 * behind the timers a background tab throttles to one a second: through a fresh MessageChannel where the
 * platform has one, its port closed once used, so that Node and Deno still exit; else `setImmediate`, else
 * a timer.
 */
function nextTask(task: () => void): void {
  if (typeof MessageChannel === 'function') {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      channel.port1.close()
      task()
    }
    channel.port2.postMessage(null)
    return
  }
  const immediate = (globalThis as { setImmediate?: (run: () => void) => unknown }).setImmediate
  if (typeof immediate === 'function') immediate(task)
  else setTimeout(task, 0)
}
/** The wait before a rate-limited read (429, or 503 with a wait) is sent again; undefined for other failures. */
export function rateLimit(error: unknown, fallbackMs = 1000): number | undefined {
  const e = error as { status?: unknown; retryAfterMs?: unknown } | null
  if (!e || typeof e !== 'object') return undefined
  const wait = typeof e.retryAfterMs === 'number' && e.retryAfterMs >= 0 ? e.retryAfterMs : undefined
  return e.status === 429 ? (wait ?? fallbackMs) : e.status === 503 ? wait : undefined
}

/** The largest reply the HTTP transport takes for one read: a batched reply above it fails that read as a direct one does. */
const WIRE_BYTES = 32768
/**
 * The most gas a query's explicit caps add up to. With every capped call first and charged its whole cap,
 * the rest of Rusk's 3e9 query bound still gives each call with a fair share (cap 0) at least
 * 500,000,000 / 257 = 1.9M, 14 times what the costliest frozen read takes (131k).
 */
const CAP_BUDGET = 2_500_000_000n
/** Reply bytes a query is planned for, below the multicall's 65,536: estimates can be low. */
const REPLY_BUDGET = 60_000
/** A read's reply estimate before the client has seen one. */
const FIRST_REPLY = 2048
/** Queries that fail whole in a row before batching stops, and for how long. */
const STREAK = 2
const HOLDOFF_MS = 300_000

interface Waiter {
  resolve(reply: Reply): void
  reject(error: unknown): void
  /** Needs the height: settled only by a multicall reply, else rejected with `Unbatched`. */
  height: boolean
}
interface Call {
  id: string
  fn: string
  input: Uint8Array
  gas: bigint
  waiters: Waiter[]
}
const utf8 = new TextEncoder()
const describe = (error: CallError) => (typeof error === 'string' ? error : error.Panic)
const message = (error: unknown) => (error instanceof Error ? error.message : String(error))

export class Batcher {
  private queue: Call[] = []
  private pending = new Map<string, Call>()
  private scheduled = false
  private streak = 0
  private offUntil = -Infinity
  /** The largest reply or panic message seen for each contract's function, for planning queries. */
  private readonly sizes = new Map<string, number>()
  /**
   * `gas`: the cap a read needs, 0 for a fair share of the query's gas. `report` hears every fallback
   * and is never awaited. `tab`: where the tab keeps failures, so they count across its page loads.
   */
  constructor(
    private readonly transport: ReadTransport,
    readonly contractId: string,
    private readonly gas: (id: string, fn: string) => bigint,
    private readonly report?: (fallback: MulticallFallback) => void,
    private readonly tab?: TabHoldoffStore,
  ) {
    this.recall()
  }
  /**
   * The tab's record, while it holds: a holdoff holds batching off here too, a strike counts as one query
   * that failed. One past its end, or further off than any holdoff lasts (a clock set back), holds nothing.
   */
  private recall(): TabHoldoff | undefined {
    const record = this.tab?.load()
    const left = record ? record.until - Date.now() : 0
    if (!record || !(left > 0 && left <= HOLDOFF_MS)) return undefined
    if (record.reason === 'holdoff') this.offUntil = Math.max(this.offUntil, elapsed() + left)
    else this.streak = Math.max(this.streak, 1)
    return record
  }
  /** Whether reads go through the multicall now, or one at a time while it is held off, here or by the tab. */
  get active(): boolean {
    if (elapsed() < this.offUntil) return false
    this.recall()
    return elapsed() >= this.offUntil
  }
  /**
   * Read `fn` at contract `id` in the next query. `height`: the caller needs the height its reply was
   * read at, so only a multicall reply settles it; otherwise a read the multicall cannot answer is sent alone.
   */
  read(id: string, fn: string, input: Uint8Array, height = false): Promise<Reply> {
    if (!this.active || id === this.contractId)
      return height ? Promise.reject(new Unbatched('The multicall is held off')) : this.alone(id, fn, input)
    return new Promise<Reply>((resolve, reject) => {
      const key = `${id}/${fn}/${hex(input)}`
      let call = this.pending.get(key)
      // The same read twice in one tick is one call: one query answers both at one state.
      if (!call) {
        call = { id, fn, input: new Uint8Array(input), gas: this.gas(id, fn), waiters: [] }
        this.pending.set(key, call)
        this.queue.push(call)
      }
      call.waiters.push({ resolve, reject, height })
      // Every read the client sends before the next macrotask runs, its microtasks included, joins.
      if (!this.scheduled) {
        this.scheduled = true
        nextTask(() => this.flush())
      }
    })
  }
  /** One direct query, as without the multicall. */
  async alone(id: string, fn: string, input: Uint8Array): Promise<Reply> {
    const bytes = await this.transport.read(id, fn, input)
    this.learn(id, fn, bytes.length)
    return { bytes }
  }
  private learn(id: string, fn: string, length: number): void {
    const key = `${id}/${fn}`
    if (length > (this.sizes.get(key) ?? 0)) this.sizes.set(key, length)
  }
  private flush(): void {
    this.scheduled = false
    const calls = this.queue
    this.queue = []
    this.pending = new Map()
    for (const batch of this.plan(calls)) void this.send(batch)
  }
  /**
   * Queries for `calls`: every capped call first, then the fair shares, each query within 256 calls, an
   * envelope of 64 KiB, `REPLY_BUDGET` of estimated reply and `CAP_BUDGET` of caps.
   */
  plan(calls: Call[]): Call[][] {
    const ordered = [...calls.filter((c) => c.gas > 0n), ...calls.filter((c) => c.gas === 0n)]
    const queries: Call[][] = []
    let current: Call[] = [],
      caps = 0n,
      data = 0,
      reply = 0
    for (const c of ordered) {
      const own = callBytes(c.fn, c.input),
        estimate = this.sizes.get(`${c.id}/${c.fn}`) ?? FIRST_REPLY
      if (
        current.length &&
        (current.length === MAX_CALLS ||
          caps + c.gas > CAP_BUDGET ||
          envelopeLength(current.length + 1, data + own) > ARGBUF_LEN ||
          replyLength(current.length + 1, reply + estimate) > REPLY_BUDGET)
      ) {
        queries.push(current)
        current = []
        caps = 0n
        data = 0
        reply = 0
      }
      current.push(c)
      caps += c.gas
      data += own
      reply += estimate
    }
    if (current.length) queries.push(current)
    return queries
  }
  private async send(batch: Call[]): Promise<void> {
    let envelope: Uint8Array
    try {
      envelope = encodeAggregate(
        batch.map((c) => ({ contract: Uint8Array.from(fromHex(c.id, 32)), fnName: c.fn, args: c.input, gasLimit: c.gas })),
      )
    } catch (error) {
      // Larger than an envelope, which only a call of its own can be: no multicall carries it.
      return this.fail(batch, error, false)
    }
    let bytes: Uint8Array
    try {
      bytes = await this.transport.read(this.contractId, 'aggregate', envelope, ARGBUF_LEN)
    } catch (error) {
      // A rate limit is the node's answer to every read in the query: each read meets it as a direct read
      // would, and its own retry policy applies. Sending them alone would multiply the load it limits.
      if (rateLimit(error) !== undefined) return this.limited(batch, error)
      return this.fail(batch, error)
    }
    let results: MulticallResult[], height: bigint
    try {
      ;({ results, height } = decodeAggregate(bytes, batch.length))
    } catch (error) {
      return this.fail(batch, error)
    }
    this.streak = 0
    // A query answered: a failure the tab kept is no longer one of two in a row.
    if (this.tab?.load()?.reason === 'strike') this.tab.clear()
    batch.forEach((c, i) => this.settle(c, results[i], height))
  }
  private settle(c: Call, result: MulticallResult, height: bigint): void {
    // A call's failure is its read's answer at the query's height, which the error carries.
    const failWith = (error: Error) => {
      failedAt(error, height)
      for (const w of c.waiters) w.reject(error)
    }
    if ('Ok' in result) {
      this.learn(c.id, c.fn, result.Ok.length)
      // The HTTP transport refuses a reply above its bound: so does a batched read.
      if (result.Ok.length > WIRE_BYTES) return failWith(new Error('Contract reply exceeds wire envelope'))
      for (const w of c.waiters) w.resolve({ bytes: new Uint8Array(result.Ok), height })
      return
    }
    // Its share of this query's gas was not enough: a direct query has the whole bound.
    if (result.Err === 'OutOfGas') {
      this.tell({ reason: 'gas', error: new Error(`${c.id}.${c.fn} ran out of gas in a multicall`), calls: 1, disabled: false })
      return this.sendAlone(c)
    }
    if (typeof result.Err === 'object') this.learn(c.id, c.fn, utf8.encode(result.Err.Panic).length)
    // A direct query that fails answers HTTP 500; inside the query the callee's own error is known.
    failWith(new NodeReadError(`Contract read failed (${c.id}.${c.fn}): ${describe(result.Err)}`, 500))
  }
  /** Every read of a rate-limited query fails with its status and wait, as a direct read would. */
  private limited(batch: Call[], error: unknown): void {
    const e = error as { status: number; retryAfterMs?: number }
    for (const c of batch) {
      const failure = new NodeReadError(`Contract read failed (${c.id}.${c.fn}): ${message(error)}`, e.status, e.retryAfterMs)
      for (const w of c.waiters) w.reject(failure)
    }
  }
  /**
   * A query that failed whole: its reads are sent alone, and a second failure in a row, in this client or
   * an earlier page load of the tab, holds batching off; the tab keeps which.
   */
  private fail(batch: Call[], error: unknown, counts = true): void {
    if (counts) {
      const kept = this.recall()
      if (kept?.reason === 'holdoff') this.streak = 0
      else if (++this.streak >= STREAK) {
        this.offUntil = elapsed() + HOLDOFF_MS
        this.streak = 0
        this.tab?.save({ until: Date.now() + HOLDOFF_MS, reason: 'holdoff' })
      } else this.tab?.save({ until: Date.now() + HOLDOFF_MS, reason: 'strike' })
    }
    this.tell({ reason: 'batch', error, calls: batch.length, disabled: !this.active })
    for (const c of batch) this.sendAlone(c)
  }
  private sendAlone(c: Call): void {
    const alone = c.waiters.filter((w) => !w.height)
    for (const w of c.waiters) if (w.height) w.reject(new Unbatched('No multicall answered this read'))
    if (!alone.length) return
    this.alone(c.id, c.fn, c.input).then(
      (reply) => {
        for (const w of alone) w.resolve({ bytes: new Uint8Array(reply.bytes) })
      },
      (error: unknown) => {
        for (const w of alone) w.reject(error)
      },
    )
  }
  private tell(fallback: MulticallFallback): void {
    try {
      const done = this.report?.(fallback) as PromiseLike<unknown> | undefined
      if (typeof done?.then === 'function') done.then(undefined, () => {})
    } catch {
      // A diagnostics hook never changes a read.
    }
  }
}
