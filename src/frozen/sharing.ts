/**
 * Height reads and contract reads one client shares between its snapshot attempts. A node answers at
 * its tip, so a reply proves nothing about a height on its own: it is shared only between attempts
 * that read at the same tip, and an attempt closes only with a height read sent after every reply
 * it used had arrived. A tip is a height and, where the transport reads it, the block's hash: a block
 * replaced at the same height is then another tip. By height alone it is not, so a reply that
 * arrived is shared with another operation only for a short window. Internal: no package entrypoint
 * exports it.
 * @module
 */
import type { Batcher } from './batching.ts'
import { hex } from './bytes.ts'
import { u64 } from './json.ts'
import type { ChainTip, ReadTransport } from './transport.ts'
import type { Stage } from './trust.ts'
import type { Admission } from './types.ts'

/**
 * An attempt saw a block land, from a reply that reports another height than its own: a store's quote,
 * or a batched read. Its snapshot runs it again.
 */
export class TipMoved extends Error {}

/** One attempt of a snapshot. */
export interface Attempt {
  /** The height it reads at, from a height read that arrived before it sent any read. */
  readonly height: bigint
  /** The block hash at that height, when the transport reads one. */
  readonly hash?: string
  /** What it verifies, which becomes signable only when it commits. */
  readonly stage: Stage
  /** When its snapshot began, on the client's clock. */
  readonly began: number
  /** When the latest reply it used arrived, on the client's clock. */
  replied: number
  /** Every store the directory admits, read once per attempt when an operation needs them all. */
  stores?: Promise<Admission[]>
  /** The admissions of stores this attempt read through, by ID; null where the directory has none. */
  admitted?: Map<string, Promise<Admission | null>>
}
interface Sighting {
  /** When it was sent, on the client's clock. */
  readonly sent: number
  readonly tip: Promise<ChainTip>
  settled?: 'ok' | 'failed'
}
interface Shared {
  readonly bytes: Promise<Uint8Array>
  /** When its reply or failure arrived, on the client's clock. */
  settled?: number
  /** When its reply arrived, in milliseconds (`elapsed`). */
  arrived?: number
  /** Whether a multicall answered it. */
  batched?: boolean
}
/** Whether two tips are one block: the same height and, where the transport reads one, hash. */
export function sameTip(a: ChainTip | undefined, b: ChainTip | undefined): boolean {
  return a !== undefined && b !== undefined && a.height === b.height && a.hash === b.hash
}
/** The transport's tip: by height and hash where it reads both together, else by height. */
async function tipOf(transport: ReadTransport): Promise<ChainTip> {
  if (!transport.currentBlock) return { height: u64(await transport.currentBlockHeight()) }
  const tip = await transport.currentBlock()
  if (tip.hash === undefined) return { height: u64(tip.height) }
  if (typeof tip.hash !== 'string' || !tip.hash) throw new Error('Invalid block hash')
  return { height: u64(tip.height), hash: tip.hash }
}
/** Replies kept for the height last seen, at most. The oldest is dropped first. */
const LIMIT = 256
/** The height of the query whose call failed a read, by the error it failed with. */
const failures = new WeakMap<object, bigint>()
/** Mark `error` as a read's answer in a multicall query at `height`: its own call's failure there. */
export function failedAt(error: object, height: bigint): void {
  failures.set(error, height)
}
/** The height of the query a read failed in, as its own call's answer there; undefined for any other failure. */
export function failureHeight(error: unknown): bigint | undefined {
  return typeof error === 'object' && error !== null ? failures.get(error) : undefined
}
/** Milliseconds, on a clock that never runs back where the platform has one. */
export const elapsed = (): number => (typeof performance === 'object' && performance ? performance.now() : Date.now())

export class ReadSharing {
  private clock = 0
  /** The height read sent last. */
  private latest?: Sighting
  /** The tip the last height read to arrive reported: the tip `shared` holds replies for. */
  private seen?: ChainTip
  /** When that height read arrived, in milliseconds (`elapsed`). */
  private seenAt = -Infinity
  /** The highest height any height read that arrived reported. */
  private top?: bigint
  private readonly shared = new Map<string, Shared>()
  /**
   * `windowMs`: by height alone, how long after a reply arrived another operation may share it.
   * With a block hash, a reply is shared for as long as the client sees its tip. `batcher`: reads go
   * through the multicall, and a batched reply an attempt uses must be at the attempt's height. `floor`:
   * the highest height the client showed, below which a batched reply no attempt uses is not used.
   */
  constructor(
    private readonly transport: ReadTransport,
    private readonly windowMs: number,
    private readonly batcher?: Batcher,
    private readonly floor?: () => bigint | undefined,
  ) {}
  /** Advance the client's clock, which orders sends and replies. */
  now(): number {
    return ++this.clock
  }
  /** Read the tip now. A tip other than the one last seen drops every reply kept for that. */
  private sight(): Sighting {
    const sighting: { sent: number; tip: Promise<ChainTip>; settled?: 'ok' | 'failed' } = {
      sent: this.now(),
      tip: undefined as never,
    }
    sighting.tip = tipOf(this.transport).then(
      (tip) => {
        sighting.settled = 'ok'
        if (this.top === undefined || tip.height > this.top) this.top = tip.height
        if (!sameTip(tip, this.seen)) {
          this.shared.clear()
          this.seen = tip
        }
        this.seenAt = elapsed()
        return tip
      },
      (error: unknown) => {
        sighting.settled = 'failed'
        throw error
      },
    )
    this.latest = sighting
    return sighting
  }
  /**
   * The tip the last height read to arrive reported, if it arrived less than `windowMs` ago. It
   * arrived before the caller sends any read, so it bounds the height of every reply from below.
   */
  recent(windowMs: number): ChainTip | undefined {
    return this.seen !== undefined && windowMs > 0 && elapsed() - this.seenAt < windowMs ? this.seen : undefined
  }
  /** The highest height a height read that arrived reported, of all of them; none before the first. */
  highest(): bigint | undefined {
    return this.top
  }
  /**
   * The tip an attempt reads at: the latest height read if it was sent after `since`, or, for a
   * snapshot's first attempt (`joinInFlight`), if it is still in flight; otherwise a new one.
   */
  open(since: number, joinInFlight: boolean): Promise<ChainTip> {
    const s = this.latest
    if (s && s.settled !== 'failed' && (s.sent > since || (joinInFlight && !s.settled))) return s.tip
    return this.sight().tip
  }
  /** A height read sent after `since`: the latest one if it was, else a new one. */
  close(since: number): Promise<ChainTip> {
    const s = this.latest
    if (s && s.settled !== 'failed' && s.sent > since) return s.tip
    return this.sight().tip
  }
  /**
   * The read another attempt made that attempt `at` may share: at the tip last seen, in flight, or
   * answered. By height alone, an answered one only while it is younger than the window.
   */
  private kept(at: Attempt, key: string): Shared | undefined {
    if (!sameTip(at, this.seen)) return undefined
    const entry = this.shared.get(key)
    if (entry?.arrived !== undefined && at.hash === undefined && elapsed() - entry.arrived >= this.windowMs) {
      this.shared.delete(key)
      return undefined
    }
    return entry
  }
  /**
   * Read `fn` at contract `id` for attempt `at`. At the height last seen, an identical read another
   * attempt made at that height, in flight or answered, is shared, and a failed one is forgotten.
   * Without an attempt, or unshared (`share` false), it is shared with no other. Each caller gets its own copy.
   */
  async read(
    at: Attempt | undefined,
    id: string,
    fn: string,
    input: Uint8Array,
    share = true,
    info?: { batched?: boolean; alone?: boolean; ownHeight?: boolean },
  ): Promise<Uint8Array> {
    // `alone`: one query of its own, not batched, and shared with no other attempt.
    const batcher = info?.alone ? undefined : this.batcher
    if (info?.alone) share = false
    if (!at) {
      if (!batcher) return this.transport.read(id, fn, input)
      // Read outside an attempt, as 0.4.1 reads it alone: a batched outcome, reply or failure, from below
      // what the client showed is not used, and the read goes out again as one direct query; unless its
      // reply reports its own height, which its caller holds to that (`ownHeight`), as a lens view's does.
      const stale = (height: bigint | undefined) => {
        const floor = info?.ownHeight ? undefined : this.floor?.()
        return height !== undefined && floor !== undefined && height < floor
      }
      let reply
      try {
        reply = await batcher.read(id, fn, input)
      } catch (error) {
        if (stale(failureHeight(error))) return this.transport.read(id, fn, input)
        throw error
      }
      if (stale(reply.height)) return this.transport.read(id, fn, input)
      if (info) info.batched = reply.height !== undefined
      return reply.bytes
    }
    const key = share && sameTip(at, this.seen) ? `${id}/${fn}/${hex(input)}` : undefined
    let read = key === undefined ? undefined : this.kept(at, key)
    if (!read) {
      const entry: Shared & { bytes: Promise<Uint8Array> } = { bytes: undefined as never }
      entry.bytes = (async () => (batcher ? this.fetch(at, entry, batcher, id, fn, input) : this.transport.read(id, fn, input)))().then(
        (bytes) => {
          entry.settled = this.now()
          entry.arrived = elapsed()
          return new Uint8Array(bytes)
        },
        (error: unknown) => {
          entry.settled = this.now()
          if (key !== undefined && this.shared.get(key) === entry) this.shared.delete(key)
          throw error
        },
      )
      if (key !== undefined) {
        this.shared.set(key, entry)
        if (this.shared.size > LIMIT) this.shared.delete(this.shared.keys().next().value!)
      }
      read = entry
    }
    try {
      const bytes = new Uint8Array(await read.bytes)
      if (info) info.batched = read.batched === true
      return bytes
    } finally {
      at.replied = Math.max(at.replied, read.settled!)
    }
  }
  /**
   * One read for an attempt. Through the multicall, its reply reports the height its query read, which
   * must be the attempt's: anything else is a reply from another tip, which the attempt cannot use.
   */
  private async fetch(at: Attempt, entry: Shared, batcher: Batcher, id: string, fn: string, input: Uint8Array): Promise<Uint8Array> {
    let reply
    try {
      reply = await batcher.read(id, fn, input)
    } catch (error) {
      // A call that failed at another height failed in another state than the attempt's: not its answer.
      const failed = failureHeight(error)
      if (failed !== undefined && failed !== at.height) throw new TipMoved(`A batched read failed at height ${failed}, not ${at.height}`)
      throw error
    }
    if (reply.height !== undefined && reply.height !== at.height)
      throw new TipMoved(`A batched read answered at height ${reply.height}, not ${at.height}`)
    entry.batched = reply.height !== undefined
    return reply.bytes
  }
  /** Keep a reply `at` read unshared, which its caller checked, for the state reads at its tip; never over one kept. */
  publish(at: Attempt, id: string, fn: string, input: Uint8Array, bytes: Uint8Array): void {
    const key = `${id}/${fn}/${hex(input)}`
    if (!sameTip(at, this.seen) || this.shared.has(key)) return
    this.shared.set(key, { bytes: Promise.resolve(new Uint8Array(bytes)), settled: this.now(), arrived: elapsed() })
    if (this.shared.size > LIMIT) this.shared.delete(this.shared.keys().next().value!)
  }
  /** Whether attempt `at` would share a read of `fn` at `id` with `input` that another attempt made. */
  holds(at: Attempt, id: string, fn: string, input: Uint8Array): boolean {
    return this.kept(at, `${id}/${fn}/${hex(input)}`) !== undefined
  }
  /** Forget every reply kept. */
  clear(): void {
    this.shared.clear()
  }
}
