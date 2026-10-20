/** Rusk HTTP read transport. No wallet or caller-provided height is required. @module */
import { parseJson, u64 } from './json.ts'
import { object } from './manifest.ts'
/** The chain tip a read answers at: its height and, when the transport reads it, its block hash. */
export interface ChainTip {
  height: bigint
  /** With a hash, a block replaced at the same height is a new tip; by height alone, it is not. */
  hash?: string
}
/** A read the node answered with an HTTP error: its `status`, and the wait it asked for (`Retry-After`), if any. */
export class NodeReadError extends Error {
  readonly status: number
  declare readonly retryAfterMs?: number
  constructor(message: string, status: number, retryAfterMs?: number) {
    super(message)
    this.name = 'NodeReadError'
    this.status = status
    if (retryAfterMs !== undefined) Object.defineProperty(this, 'retryAfterMs', { value: retryAfterMs, enumerable: true })
  }
}
/** Delay-seconds past this are a wait longer than any retry takes, kept as `Number.MAX_SAFE_INTEGER` ms. */
const MAX_DELAY_SECONDS = BigInt(Math.floor(Number.MAX_SAFE_INTEGER / 1000))
/** A reply's `Retry-After` in ms: delay-seconds, or an HTTP date counted from the reply's own `Date`. */
function retryAfter(headers: Headers): number | undefined {
  const text = headers.get('retry-after')?.trim()
  if (!text) return undefined
  if (/^\d+$/u.test(text)) {
    const seconds = BigInt(text)
    return seconds > MAX_DELAY_SECONDS ? Number.MAX_SAFE_INTEGER : Number(seconds) * 1000
  }
  const at = Date.parse(text)
  if (!Number.isFinite(at) || !/[a-z]/iu.test(text)) return undefined
  const sent = Date.parse(headers.get('date') ?? '')
  return Math.max(0, at - (Number.isFinite(sent) ? sent : Date.now()))
}
/** How much of an error reply's body its message keeps, and how long a read waits for it. */
const DETAIL_BYTES = 512
const DETAIL_MS = 250
/** The start of an error reply's body, for its message only: what arrives within the bounds, or ''. */
async function detail(response: Response): Promise<string> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let stop = (): void => {}
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    reader = response.body?.getReader()
    if (reader) {
      const late = new Promise<undefined>((resolve) => {
        const timer = setTimeout(() => resolve(undefined), DETAIL_MS)
        stop = () => clearTimeout(timer)
      })
      // Until an empty chunk, or 16 reads: reads that answer at once would never let the timer run.
      for (let reads = 0; size <= DETAIL_BYTES && reads < 16; reads++) {
        const next = await Promise.race([reader.read(), late])
        if (!next || next.done || !next.value.length) break
        chunks.push(next.value)
        size += next.value.length
      }
    }
  } catch {
    // A body that failed: what arrived before it did.
  } finally {
    stop()
    try {
      reader?.cancel().catch(() => {})
    } catch {
      // Released already: nothing more to stop.
    }
  }
  const bytes = new Uint8Array(Math.min(size, DETAIL_BYTES))
  let offset = 0
  for (const chunk of chunks) {
    const part = chunk.subarray(0, bytes.length - offset)
    bytes.set(part, offset)
    offset += part.length
  }
  const text = new TextDecoder().decode(bytes).trim()
  return size > DETAIL_BYTES ? `${text}…` : text
}
export interface ReadTransport {
  currentBlockHeight(): Promise<bigint>
  /**
   * The tip's height and block hash, read together. Optional: a client reads a transport without
   * it by height alone, and then shares a reply between operations only briefly.
   */
  currentBlock?(): Promise<ChainTip>
  /**
   * A stable name for the chain state this transport reads, such as its node URL. Verification
   * cache entries are keyed by it; a client gets no persistent verification cache from a transport
   * without one unless `ClientOptions.transportNamespace` names it.
   */
  readonly namespace?: string
  /**
   * A contract read; one the node rate-limits should throw with `status` 429 and `retryAfterMs`, as
   * `NodeReadError` does. `maxBytes`, the largest reply to accept, is 32,768 when not given; a
   * multicall's reply takes up to 65,536.
   */
  read(
    contractId: string,
    functionName: string,
    bytes: Uint8Array,
    maxBytes?: number,
  ): Promise<Uint8Array>
}
export function createHttpTransport(
  nodeUrl: string,
  fetcher: typeof fetch = fetch,
): ReadTransport {
  const base = nodeUrl.replace(/\/$/u, '')
  // One request answers both, so the hash is of the block at that height.
  const tip = async (): Promise<Record<string, unknown>> => {
    const response = await fetcher(`${base}/on/graphql/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/graphql' },
      body: 'query { block(height: -1) { header { height hash } } }',
    })
    if (!response.ok)
      throw new NodeReadError(`Block height read failed: HTTP ${response.status}`, response.status, retryAfter(response.headers))
    const reply = object(parseJson(await response.text()))
    if (reply.errors) throw new Error('Block height query failed')
    const data = reply.data ? object(reply.data) : reply
    return object(object(data.block).header)
  }
  return {
    namespace: base,
    async currentBlock() {
      const header = await tip()
      if (typeof header.hash !== 'string' || !/^[\da-f]{64}$/iu.test(header.hash))
        throw new Error('Block hash query failed')
      return { height: u64(header.height), hash: header.hash.toLowerCase() }
    },
    async currentBlockHeight() {
      return u64((await tip()).height)
    },
    async read(id, name, bytes, maxBytes = 32768) {
      const response = await fetcher(`${base}/on/contracts:${id}/${name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          Accept: 'application/octet-stream',
        },
        body: new Uint8Array(bytes),
      })
      if (!response.ok) {
        // The status and headers make the error; the body only adds to its message.
        const status = response.status,
          wait = retryAfter(response.headers)
        throw new NodeReadError(`Contract read failed (${id}.${name}): ${(await detail(response)) || `HTTP ${status}`}`, status, wait)
      }
      return bounded(response, maxBytes)
    },
  }
}
/**
 * A reply's body, read no further than `maxBytes`: a declared length over it is refused unread, and a
 * stream is cancelled at the chunk that passes it. Without a stream the body is empty, as Fetch has it.
 */
async function bounded(response: Response, maxBytes: number): Promise<Uint8Array> {
  const over = () => new Error('Contract reply exceeds wire envelope')
  if (Number(response.headers.get('content-length') ?? undefined) > maxBytes) {
    await response.body?.cancel().catch(() => {})
    throw over()
  }
  if (!response.body) return new Uint8Array()
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = []
  let length = 0
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    if (!chunk.value.length) continue
    length += chunk.value.length
    if (length > maxBytes) {
      await reader.cancel().catch(() => {})
      throw over()
    }
    chunks.push(chunk.value)
  }
  const result = new Uint8Array(length)
  let at = 0
  for (const chunk of chunks) {
    result.set(chunk, at)
    at += chunk.length
  }
  return result
}
