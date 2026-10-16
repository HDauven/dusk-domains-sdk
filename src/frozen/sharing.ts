/**
 * Height reads and contract reads one client shares between its snapshot attempts. A node answers at
 * its tip, so a reply proves nothing about a height on its own: it is shared only between attempts
 * that read at the same height, and an attempt closes only with a height read sent after every reply
 * it used had arrived. Internal: no package entrypoint exports it.
 * @module
 */
import { hex } from './bytes.ts'
import { u64 } from './json.ts'
import type { ReadTransport } from './transport.ts'
import type { Stage } from './trust.ts'
import type { Admission } from './types.ts'

/** One attempt of a snapshot. */
export interface Attempt {
  /** The height it reads at, from a height read that arrived before it sent any read. */
  readonly height: bigint
  /** What it verifies, which becomes signable only when it commits. */
  readonly stage: Stage
  /** When its snapshot began, on the client's clock. */
  readonly began: number
  /** When the latest reply it used arrived, on the client's clock. */
  replied: number
  /** The stores the directory admits, read once per attempt. */
  stores?: Promise<Admission[]>
}
interface Sighting {
  /** When it was sent, on the client's clock. */
  readonly sent: number
  readonly height: Promise<bigint>
  settled?: 'ok' | 'failed'
}
interface Shared {
  readonly bytes: Promise<Uint8Array>
  /** When its reply or failure arrived, on the client's clock. */
  settled?: number
}
/** Replies kept for the height last seen, at most. The oldest is dropped first. */
const LIMIT = 256

export class ReadSharing {
  private clock = 0
  /** The height read sent last. */
  private latest?: Sighting
  /** The height the last height read to arrive reported: the height `shared` holds replies for. */
  private seen?: bigint
  private readonly shared = new Map<string, Shared>()
  constructor(private readonly transport: ReadTransport) {}
  /** Advance the client's clock, which orders sends and replies. */
  now(): number {
    return ++this.clock
  }
  /** Read the height now. A height other than the one last seen drops every reply kept for that. */
  private sight(): Sighting {
    const sighting: { sent: number; height: Promise<bigint>; settled?: 'ok' | 'failed' } = {
      sent: this.now(),
      height: undefined as never,
    }
    sighting.height = (async () => u64(await this.transport.currentBlockHeight()))().then(
      (height) => {
        sighting.settled = 'ok'
        if (height !== this.seen) {
          this.shared.clear()
          this.seen = height
        }
        return height
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
   * The height an attempt reads at: the latest height read if it was sent after `since`, or, for a
   * snapshot's first attempt (`joinInFlight`), if it is still in flight; otherwise a new one.
   */
  open(since: number, joinInFlight: boolean): Promise<bigint> {
    const s = this.latest
    if (s && s.settled !== 'failed' && (s.sent > since || (joinInFlight && !s.settled))) return s.height
    return this.sight().height
  }
  /** A height read sent after `since`: the latest one if it was, else a new one. */
  close(since: number): Promise<bigint> {
    const s = this.latest
    if (s && s.settled !== 'failed' && s.sent > since) return s.height
    return this.sight().height
  }
  /**
   * Read `fn` at contract `id` for attempt `at`. At the height last seen, an identical read another
   * attempt made at that height, in flight or answered, is shared, and a failed one is forgotten.
   * Without an attempt, or unshared (`share` false), it is read alone. Each caller gets its own copy.
   */
  async read(
    at: Attempt | undefined,
    id: string,
    fn: string,
    input: Uint8Array,
    share = true,
  ): Promise<Uint8Array> {
    if (!at) return this.transport.read(id, fn, input)
    const key = share && at.height === this.seen ? `${id}/${fn}/${hex(input)}` : undefined
    let read = key === undefined ? undefined : this.shared.get(key)
    if (!read) {
      const entry: { bytes: Promise<Uint8Array>; settled?: number } = { bytes: undefined as never }
      entry.bytes = (async () => this.transport.read(id, fn, input))().then(
        (bytes) => {
          entry.settled = this.now()
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
      return new Uint8Array(await read.bytes)
    } finally {
      at.replied = Math.max(at.replied, read.settled!)
    }
  }
  /** Forget every reply kept. */
  clear(): void {
    this.shared.clear()
  }
}
