/**
 * Multicall for Dusk v1, emulated as the deployed contract runs `aggregate`: every call at the height the
 * query read, a cap of 0 a fair share of the query's 3e9 gas (what is left over the calls left plus one),
 * a failed call charged its whole limit, a callee's panic kept to 200 bytes, and the whole query refused
 * past 256 calls or 64 KiB either way. `fakeNode` serves Rusk's HTTP API over a test transport, so the
 * client reads through its real default transport, and a direct read that fails answers HTTP 500 as a
 * public node does. The codec halves the SDK does not ship (`decodeCalls`, `encodeReply`) are written here
 * from the archive layout and checked against the released driver.
 */
import { fromHex, hex } from '../src/frozen/bytes.ts'
import { ARGBUF_LEN, MAX_CALLS, MAX_PANIC_BYTES, MULTICALL_CONTRACT_ID, replyLength, type MulticallResult } from '../src/frozen/multicall.ts'
import type { ReadTransport } from '../src/frozen/transport.ts'

export interface EmulatedCall {
  contract: string
  fn: string
  args: Uint8Array
  gasLimit: bigint
}
const fatal = new TextDecoder('utf-8', { fatal: true })
/** `Vec<Call>` from an envelope, strictly; what the contract's argument check refuses throws. */
export function decodeCalls(bytes: Uint8Array): EmulatedCall[] {
  const bad = () => new Error('Argument should correctly deserialize')
  if (bytes.length < 8 || bytes.length % 8 !== 0) throw bad()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    root = bytes.length - 8,
    array = root + view.getInt32(root, true),
    n = view.getUint32(root + 4, true)
  if (array < 0 || array % 8 !== 0 || array + 56 * n !== root) throw bad()
  const claim = (base: number, at: number, length: number) => {
    const start = base + view.getInt32(at, true)
    if (start < 0 || start + length > array) throw bad()
    return bytes.slice(start, start + length)
  }
  return Array.from({ length: n }, (_, i) => {
    const slot = array + 56 * i,
      last = bytes[slot + 39]
    const name = (last & 0x80) === 0 ? (last > 7 ? (() => { throw bad() })() : bytes.slice(slot + 32, slot + 32 + last)) : claim(slot + 32, slot + 36, view.getUint32(slot + 32, true))
    return {
      contract: hex(bytes.subarray(slot, slot + 32)),
      fn: fatal.decode(name),
      args: claim(slot + 40, slot + 40, view.getUint32(slot + 44, true)),
      gasLimit: view.getBigUint64(slot + 48, true),
    }
  })
}
/** The `Aggregate` archive the contract writes: the reply bytes first, then the result slots, then the root. */
export function encodeReply(height: bigint, results: MulticallResult[]): Uint8Array {
  const utf8 = new TextEncoder()
  const data: Uint8Array[] = [],
    at: number[] = []
  let pos = 0
  for (const r of results) {
    at.push(pos)
    const bytes = 'Ok' in r ? r.Ok : typeof r.Err === 'object' ? utf8.encode(r.Err.Panic) : new Uint8Array()
    if ('Ok' in r || bytes.length > 7) {
      data.push(bytes)
      pos += bytes.length
    }
  }
  const slots = Math.ceil(pos / 4) * 4,
    root = Math.ceil((slots + 16 * results.length) / 8) * 8
  const out = new Uint8Array(root + 16),
    view = new DataView(out.buffer)
  let p = 0
  for (const d of data) {
    out.set(d, p)
    p += d.length
  }
  results.forEach((r, i) => {
    const s = slots + 16 * i
    if ('Ok' in r) {
      view.setInt32(s + 4, at[i] - (s + 4), true)
      view.setUint32(s + 8, r.Ok.length, true)
      return
    }
    out[s] = 1
    if (typeof r.Err === 'string') {
      out[s + 4] = { OutOfGas: 1, DoesNotExist: 2, Unknown: 3 }[r.Err]
      return
    }
    const text = utf8.encode(r.Err.Panic)
    if (text.length > 7) {
      view.setUint32(s + 8, text.length, true)
      view.setInt32(s + 12, at[i] - (s + 8), true)
    } else {
      out.set(text, s + 8)
      out[s + 15] = text.length
    }
  })
  view.setBigUint64(root, height, true)
  view.setInt32(root + 8, slots - (root + 8), true)
  view.setUint32(root + 12, results.length, true)
  return out
}
/** A panic message as the contract keeps it: its first 200 bytes, cut at a character boundary. */
export function cut(message: string): string {
  const bytes = new TextEncoder().encode(message)
  if (bytes.length <= MAX_PANIC_BYTES) return message
  let end = MAX_PANIC_BYTES
  while (end > 0 && (bytes[end] & 0xc0) === 0x80) end--
  return new TextDecoder().decode(bytes.subarray(0, end))
}
/** Gas, as the query and the multicall charge it. */
export const QUERY_GAS = 3_000_000_000n
const SETUP_GAS = 7_000n

export interface MulticallOptions {
  /** The height the query reads at; by default the inner transport's. */
  height?: () => bigint | Promise<bigint>
  /** The gas a call spends when it succeeds: 50k by default. */
  need?: (call: EmulatedCall) => bigint
  /** A call's result instead of its read, given the gas limit it got: as a callee answering by its limit. */
  respond?: (call: EmulatedCall, limit: bigint) => MulticallResult | undefined
  /** Contracts that exist, by default any. */
  exists?: (contract: string) => boolean
  /** Runs before the query: one that throws fails the whole query (HTTP 500). */
  before?: (calls: EmulatedCall[]) => void | Promise<void>
  /** Runs when the query is done, answered or failed. */
  after?: () => void
}
export interface Query {
  calls: EmulatedCall[]
  height: bigint
  /** The gas limit each call got. */
  limits: bigint[]
  results: MulticallResult[]
}
/** `aggregate` over `inner`: what each call reads and the outcome the contract would return for it. */
export function multicall(inner: ReadTransport, options: MulticallOptions = {}) {
  const queries: Query[] = []
  async function aggregate(envelope: Uint8Array): Promise<Uint8Array> {
    try {
      return await run(envelope)
    } finally {
      options.after?.()
    }
  }
  async function run(envelope: Uint8Array): Promise<Uint8Array> {
    if (envelope.length > ARGBUF_LEN) throw new Error('Memory access out of bounds')
    const calls = decodeCalls(envelope)
    if (calls.length > MAX_CALLS) throw new Error(`multicall: ${calls.length} calls, at most ${MAX_CALLS}`)
    await options.before?.(calls)
    const height = options.height ? await options.height() : await inner.currentBlockHeight()
    let left = QUERY_GAS - SETUP_GAS,
      outOfLine = 0
    const limits: bigint[] = [],
      results: MulticallResult[] = []
    for (const [i, call] of calls.entries()) {
      const share = left / BigInt(calls.length - i + 1)
      const limit = call.gasLimit === 0n ? (share > 0n ? share : 1n) : call.gasLimit >= left ? (left * 93n) / 100n : call.gasLimit
      limits.push(limit)
      let result = options.respond?.(call, limit)
      const need = options.need?.(call) ?? 50_000n
      if (!result) {
        if (options.exists && !options.exists(call.contract)) result = { Err: 'DoesNotExist' }
        else if (need > limit) result = { Err: 'OutOfGas' }
        else
          try {
            result = { Ok: new Uint8Array(await inner.read(call.contract, call.fn, call.args)) }
          } catch (error) {
            result = { Err: { Panic: cut(error instanceof Error ? error.message : String(error)) } }
          }
      }
      left -= 'Ok' in result ? need : result.Err === 'DoesNotExist' ? 0n : limit
      results.push(result)
      outOfLine += 'Ok' in result ? result.Ok.length : typeof result.Err === 'object' && new TextEncoder().encode(result.Err.Panic).length > 7 ? new TextEncoder().encode(result.Err.Panic).length : 0
      if (replyLength(calls.length, outOfLine) > ARGBUF_LEN) throw new Error(`multicall: reply exceeds ${ARGBUF_LEN} bytes at call ${i}`)
    }
    queries.push({ calls, height, limits, results })
    return encodeReply(height, results)
  }
  return { queries, aggregate }
}
/** `inner` with the multicall deployed at `id`, as a custom transport the client batches through. */
export function withMulticall(inner: ReadTransport, options: MulticallOptions & { id?: string } = {}) {
  const id = options.id ?? MULTICALL_CONTRACT_ID
  const m = multicall(inner, options)
  const transport: ReadTransport = {
    ...inner,
    currentBlockHeight: () => inner.currentBlockHeight(),
    ...(inner.currentBlock ? { currentBlock: () => inner.currentBlock!() } : {}),
    read: (target, fn, bytes, maxBytes) =>
      target === id && fn === 'aggregate' ? m.aggregate(bytes) : inner.read(target, fn, bytes, maxBytes),
  }
  return { transport, queries: m.queries }
}

export interface FakeNodeOptions extends MulticallOptions {
  /** Where the multicall is deployed; none: a chain without it, whose queries of it fail. */
  multicall?: string | null
  /** A reply instead of the node's own: a rate limit or an error page. */
  intercept?: (request: { kind: 'tip' | 'read' | 'aggregate'; contract?: string; fn?: string }) => Response | undefined
  /** Whether a failed direct query's body names the panic, as a local node may, or not, as public nodes. */
  panicText?: boolean
}
/**
 * Rusk's HTTP query API over `inner`, as a `fetch`: the tip from GraphQL, contract queries, and the
 * multicall's `aggregate`. A query that fails answers HTTP 500 with Rusk's error body.
 */
export function fakeNode(inner: ReadTransport, options: FakeNodeOptions = {}) {
  const id = options.multicall === undefined ? MULTICALL_CONTRACT_ID : options.multicall
  const m = multicall(inner, options)
  const requests: { kind: 'tip' | 'read' | 'aggregate'; contract?: string; fn?: string; status: number }[] = []
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input))
    const body = init?.body ? new Uint8Array(init.body as ArrayBuffer) : new Uint8Array()
    if (url.pathname === '/on/graphql/query') {
      const intercepted = options.intercept?.({ kind: 'tip' })
      if (intercepted) {
        requests.push({ kind: 'tip', status: intercepted.status })
        return intercepted
      }
      const tip = inner.currentBlock ? await inner.currentBlock() : { height: await inner.currentBlockHeight(), hash: '00'.repeat(32) }
      requests.push({ kind: 'tip', status: 200 })
      const hash = /^[\da-f]{64}$/u.test(tip.hash ?? '') ? tip.hash! : hex(new TextEncoder().encode(String(tip.hash)).slice(0, 32)).padEnd(64, '0')
      return new Response(`{"block":{"header":{"hash":"${hash}","height":${tip.height}}}}`)
    }
    const [, target, fn] = /^\/on\/contracts:([\da-f]{64})\/(\w+)$/u.exec(url.pathname) ?? []
    if (!target) return new Response('not found', { status: 404 })
    const kind = target === id && fn === 'aggregate' ? 'aggregate' : 'read'
    const intercepted = options.intercept?.({ kind, contract: target, fn })
    if (intercepted) {
      requests.push({ kind, contract: target, fn, status: intercepted.status })
      return intercepted
    }
    try {
      const reply = kind === 'aggregate' ? await m.aggregate(body) : await inner.read(target, fn, body)
      requests.push({ kind, contract: target, fn, status: 200 })
      return new Response(new Uint8Array(reply))
    } catch (error) {
      requests.push({ kind, contract: target, fn, status: 500 })
      const text = options.panicText ? `${error instanceof Error ? error.message : String(error)}` : '{"error":"Internal server error"}'
      return new Response(text, { status: 500, headers: { 'content-type': 'application/json' } })
    }
  }
  return { fetch: fetch as typeof globalThis.fetch, requests, queries: m.queries }
}
/** A contract ID's bytes. */
export const idBytes = (id: string) => Uint8Array.from(fromHex(id, 32))
