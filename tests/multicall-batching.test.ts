/**
 * The batcher on its own: which reads share a query, how queries are planned against the multicall's
 * limits, and how each read settles, from its own result or, when the query fails, as a direct read.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Batcher, Unbatched, tabHoldoff, type MulticallFallback, type TabHoldoffStore } from '../src/frozen/batching.ts'
import { MULTICALL_CONTRACT_ID as MC } from '../src/frozen/multicall.ts'
import { NodeReadError, type ReadTransport } from '../src/frozen/transport.ts'
import { hex } from '../src/frozen/bytes.ts'
import { QUERY_GAS, encodeReply, withMulticall, type MulticallOptions } from './multicall-world.ts'
import { clocks } from './lens-world.ts'

const A = 'aa'.repeat(32), B = 'bb'.repeat(32), L = 'cc'.repeat(32)
const enc = (s: string) => new TextEncoder().encode(s)
const dec = (b: Uint8Array) => new TextDecoder().decode(b)
/** A node whose reads answer `<contract>.<fn>:<input>`, or fail as `fail` says, logging every direct read. */
function chain(fail: (id: string, fn: string) => string | undefined = () => undefined) {
  const state = { height: 100n, reads: [] as string[], size: new Map<string, number>() }
  const inner: ReadTransport = {
    currentBlockHeight: async () => state.height,
    read: async (id, fn, input) => {
      state.reads.push(`${id.slice(0, 2)}.${fn}`)
      const message = fail(id, fn)
      if (message) throw new Error(message)
      const size = state.size.get(fn)
      return size === undefined ? enc(`${id.slice(0, 2)}.${fn}:${dec(input)}`) : new Uint8Array(size).fill(7)
    },
  }
  return { state, inner }
}
function setup(options: MulticallOptions & { fail?: (id: string, fn: string) => string | undefined; gas?: (id: string, fn: string) => bigint; tab?: TabHoldoffStore } = {}) {
  const c = chain(options.fail)
  const m = withMulticall(c.inner, { height: () => c.state.height, ...options })
  const fallbacks: MulticallFallback[] = []
  const queried: string[][] = []
  const transport: ReadTransport = {
    ...m.transport,
    read: (id, fn, input, max) => {
      if (id === MC && fn === 'aggregate') queried.push([])
      return m.transport.read(id, fn, input, max)
    },
  }
  const batcher = new Batcher(transport, MC, options.gas ?? (() => 0n), (f) => void fallbacks.push(f), options.tab)
  const read = (id: string, fn: string, input = '', height = false) => batcher.read(id, fn, enc(input), height)
  return { ...c, batcher, read, queries: m.queries, fallbacks, aggregates: () => queried.length }
}
/** The platform's own timer, kept before a test fakes timers. */
const realTimeout = globalThis.setTimeout
const outcome = (p: Promise<unknown>) => p.then((v) => ({ v }), (e: Error) => ({ e: { name: e.constructor.name, message: e.message, status: (e as NodeReadError).status, wait: (e as NodeReadError).retryAfterMs } }))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('which reads share a query', () => {
  it('sends a tick\'s query at the next task even while timers are held back, as a background tab holds them', async () => {
    const t = setup()
    // Timers that never fire: only a task that is not a timer can send the query.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval'] })
    try {
      const reads = Promise.all([t.read(A, 'config'), t.read(B, 'home', 'r1')])
      const held = new Promise((_, reject) => realTimeout(() => reject(new Error('held back by timers')), 1000))
      const replies = (await Promise.race([reads, held])) as { bytes: Uint8Array }[]
      expect(replies.map((r) => dec(r.bytes))).toEqual(['aa.config:', 'bb.home:r1'])
      expect(t.queries).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })
  it('sends the reads of one tick as one query, in the order they were made, each settled from its own result', async () => {
    const t = setup()
    const replies = await Promise.all([t.read(A, 'config'), t.read(B, 'home', 'r1'), t.read(A, 'members', 'p0'), t.read(B, 'get_name', 'k')])
    expect(t.queries).toHaveLength(1)
    expect(t.queries[0].calls.map((c) => `${c.contract.slice(0, 2)}.${c.fn}:${dec(c.args)}`)).toEqual(['aa.config:', 'bb.home:r1', 'aa.members:p0', 'bb.get_name:k'])
    expect(replies.map((r) => dec(r.bytes))).toEqual(['aa.config:', 'bb.home:r1', 'aa.members:p0', 'bb.get_name:k'])
    expect(replies.every((r) => r.height === 100n)).toBe(true)
  })
  it('joins reads made in later microtasks of the same tick, never a read made after the query was sent', async () => {
    const t = setup()
    const first = t.read(A, 'config')
    const later = Promise.resolve().then(() => Promise.resolve()).then(() => t.read(A, 'roles'))
    await Promise.all([first, later])
    expect(t.queries.map((q) => q.calls.map((c) => c.fn))).toEqual([['config', 'roles']])
    // Sent while that query is in flight, or in a later tick: a query of its own, at its own height.
    const inFlight = t.read(A, 'allocation')
    // Its query has read its height once it is recorded: only then does the block land.
    await vi.waitFor(() => expect(t.queries).toHaveLength(2))
    t.state.height = 101n
    const next = t.read(A, 'allocation')
    expect((await inFlight).height).toBe(100n)
    expect((await next).height).toBe(101n)
    expect(t.queries.map((q) => q.calls.map((c) => c.fn))).toEqual([['config', 'roles'], ['allocation'], ['allocation']])
  })
  it('reads the same call twice in one tick once, and gives each caller its own copy', async () => {
    const t = setup()
    const [a, b] = await Promise.all([t.read(A, 'config'), t.read(A, 'config'), t.read(A, 'config', 'other')])
    expect(t.queries[0].calls).toHaveLength(2)
    a.bytes[0] = 0
    expect(dec(b.bytes)).toBe('aa.config:')
  })
  it('sends a read of the multicall itself alone, never inside another query', async () => {
    const t = setup()
    await Promise.all([t.read(MC, 'version'), t.read(A, 'config')])
    expect(t.queries.map((q) => q.calls.map((c) => c.fn))).toEqual([['config']])
    expect(t.state.reads).toContain('93.version')
    await expect(t.read(MC, 'version', '', true)).rejects.toThrow(Unbatched)
  })
})

describe('how queries are planned', () => {
  it('takes 256 calls in one query and a 257th in a second, each read settled', async () => {
    const t = setup()
    // Once the client knows how large a reply is: before, it plans 2 KiB for each.
    await t.read(A, 'get_name', 'first')
    const reads = Array.from({ length: 257 }, (_, i) => t.read(A, 'get_name', String(i)))
    const replies = await Promise.all(reads)
    // The two queries go out together; either may answer first.
    expect(t.queries.slice(1).map((q) => q.calls.length).sort((a, b) => a - b)).toEqual([1, 256])
    replies.forEach((r, i) => expect(dec(r.bytes)).toBe(`aa.get_name:${i}`))
  })
  it('fills an envelope to exactly 64 KiB, and splits at a byte more', async () => {
    // A call is 56 bytes of slot plus its argument, the envelope 8 bytes of root: 65,536 = 8 + 2·56 + 2·32,708.
    const t = setup()
    await Promise.all([t.read(A, 'home', 'x'.repeat(32_708)), t.read(B, 'home', 'y'.repeat(32_708))])
    expect(t.queries.map((q) => q.calls.length)).toEqual([2])
    const u = setup()
    await Promise.all([u.read(A, 'home', 'x'.repeat(32_708)), u.read(B, 'home', 'y'.repeat(32_709))])
    expect(u.queries.map((q) => q.calls.length)).toEqual([1, 1])
    // A name of 8 bytes or more takes its bytes outside the slot too.
    const v = setup()
    await Promise.all([v.read(A, 'get_name', 'x'.repeat(32_700)), v.read(B, 'get_name', 'y'.repeat(32_700))])
    expect(v.queries.map((q) => q.calls.length)).toEqual([2])
    const w = setup()
    await Promise.all([w.read(A, 'get_name', 'x'.repeat(32_700)), w.read(B, 'get_name', 'y'.repeat(32_701))])
    expect(w.queries.map((q) => q.calls.length)).toEqual([1, 1])
  })
  it('sends a read too large for any envelope alone, beside a query of the others, holding nothing off', async () => {
    const t = setup()
    for (let round = 0; round < 3; round++) {
      const [big, small] = await Promise.all([t.read(A, 'home', 'x'.repeat(65_473)), t.read(B, 'config')])
      expect(big).toEqual({ bytes: enc(`aa.home:${'x'.repeat(65_473)}`) })
      expect(small.height).toBe(100n)
    }
    expect(t.queries.map((q) => q.calls.map((c) => c.fn))).toEqual([['config'], ['config'], ['config']])
    expect(t.state.reads.filter((r) => r === 'aa.home')).toHaveLength(3)
    expect(t.fallbacks.map((f) => [f.reason, f.calls, f.disabled])).toEqual(Array(3).fill(['batch', 1, false]))
    expect(t.batcher.active).toBe(true)
  })
  it('plans replies from those it saw: an unforeseen overflow is read alone once, and split from then on', async () => {
    const t = setup()
    t.state.size.set('page', 20_000)
    const four = () => Promise.all([0, 1, 2, 3].map((i) => t.read(A, 'page', String(i))))
    // 4 × 20,000 bytes of reply: past 64 KiB, which fails the multicall's query whole.
    const first = await four()
    expect(first.every((r) => r.bytes.length === 20_000 && r.height === undefined)).toBe(true)
    expect(t.fallbacks).toMatchObject([{ reason: 'batch', calls: 4, disabled: false }])
    expect(t.state.reads.filter((r) => r === 'aa.page')).toHaveLength(4 + 4)
    // Now each is known to take 20,000 bytes: two of them a query, within the 60,000 the plan allows.
    const second = await four()
    expect(second.every((r) => r.height === 100n)).toBe(true)
    expect(t.queries.slice(-2).map((q) => q.calls.length)).toEqual([2, 2])
    expect(t.fallbacks).toHaveLength(1)
  })
  it('sends capped calls first, at their caps, and at most 2.5e9 of caps a query; fair shares get the rest', async () => {
    const caps: Record<string, bigint> = { name_page: 1_114_000_000n, reverse: 842_000_000n, resolve: 390_000_000n }
    const t = setup({ gas: (_, fn) => caps[fn] ?? 0n })
    await Promise.all(['config', 'name_page', 'home', 'reverse', 'name_page', 'resolve', 'members'].map((fn, i) => t.read(fn in caps ? L : A, fn, String(i))))
    // 1.114e9 + 0.842e9 = 1.956e9; another name_page would pass 2.5e9, and the resolve fits beside it.
    expect(t.queries.map((q) => q.calls.map((c) => c.fn))).toEqual([['name_page', 'reverse'], ['name_page', 'resolve', 'config', 'home', 'members']])
    for (const q of t.queries) {
      q.calls.forEach((c, i) => {
        if (c.gasLimit) expect(q.limits[i]).toBe(c.gasLimit)
        // Every capped call charged its whole cap, a fair share still has 500M among the calls left.
        else expect(q.limits[i]).toBeGreaterThanOrEqual((QUERY_GAS - 2_500_000_000n) / BigInt(q.calls.length + 1))
      })
    }
  })
  it('lets every frozen read answer at a fair share, even after 255 calls before it failed at theirs', async () => {
    // A failed call is charged its whole limit; the costliest frozen read takes 131k.
    const t = setup({ fail: (_, fn) => (fn === 'bad' ? 'DuskDS:v1:InvalidArgument' : undefined), need: () => 131_225n })
    // Reply sizes known: a panic message, and the name.
    await Promise.all([outcome(t.read(A, 'bad', 'x')), t.read(B, 'get_name', 'x')])
    t.queries.length = 0
    const reads = [...Array.from({ length: 255 }, (_, i) => t.read(A, 'bad', String(i))), t.read(B, 'get_name', 'last')]
    const settled = await Promise.all(reads.map(outcome))
    expect(t.queries).toHaveLength(1)
    expect(settled.at(-1)).toEqual({ v: { bytes: enc('bb.get_name:last'), height: 100n } })
    expect(t.queries[0].limits.at(-1)! / 1_000_000n).toBe(11n)
    expect(settled.slice(0, 255).every((s) => 'e' in s && s.e.status === 500)).toBe(true)
  })
})

describe('how each read settles', () => {
  it('fails a read whose call panicked with the HTTP 500 a direct read gets, naming the callee error; the others answer', async () => {
    const t = setup({ fail: (_, fn) => (fn === 'members' ? 'DuskDS:v1:InvalidArgument' : fn === 'quote' ? 'x'.repeat(300) : undefined) })
    const [ok, bad, long] = await Promise.all([t.read(A, 'config'), t.read(A, 'members', 'limit 0'), t.read(B, 'quote')].map(outcome))
    expect(ok).toEqual({ v: { bytes: enc('aa.config:'), height: 100n } })
    expect(bad).toEqual({ e: { name: 'NodeReadError', message: `Contract read failed (${A}.members): DuskDS:v1:InvalidArgument`, status: 500, wait: undefined } })
    // The multicall keeps 200 bytes of a panic message.
    expect(long).toEqual({ e: { name: 'NodeReadError', message: `Contract read failed (${B}.quote): ${'x'.repeat(200)}`, status: 500, wait: undefined } })
    expect(t.state.reads).toHaveLength(3)
  })
  it('fails a read of a missing contract or function with HTTP 500, as a direct read', async () => {
    const t = setup({ exists: (id) => id !== B, respond: (call) => (call.fn === 'nope' ? { Err: 'Unknown' } : undefined) })
    const [missing, unknown] = await Promise.all([t.read(B, 'config'), t.read(A, 'nope')].map(outcome))
    expect(missing).toMatchObject({ e: { name: 'NodeReadError', status: 500, message: `Contract read failed (${B}.config): DoesNotExist` } })
    expect(unknown).toMatchObject({ e: { name: 'NodeReadError', status: 500, message: `Contract read failed (${A}.nope): Unknown` } })
  })
  it('refuses a batched reply past 32 KiB as the HTTP transport refuses a direct one', async () => {
    const t = setup()
    t.state.size.set('big', 32_769)
    t.state.size.set('edge', 32_768)
    const [big, other] = await Promise.all([t.read(A, 'big'), t.read(B, 'config')].map(outcome))
    expect(big).toEqual({ e: { name: 'Error', message: 'Contract reply exceeds wire envelope', status: undefined, wait: undefined } })
    expect(other).toEqual({ v: { bytes: enc('bb.config:'), height: 100n } })
    const edge = await t.read(A, 'edge')
    expect(edge.bytes.length).toBe(32_768)
    expect(t.queries).toHaveLength(2)
  })
  it('reads a call that ran out of its share of gas alone, as a direct query has the whole bound', async () => {
    const t = setup({ need: (c) => (c.fn === 'heavy' ? 2_000_000_000n : 50_000n) })
    const [heavy, light] = await Promise.all([t.read(A, 'heavy'), t.read(A, 'config')])
    expect(t.queries[0].results[0]).toEqual({ Err: 'OutOfGas' })
    expect(heavy).toEqual({ bytes: enc('aa.heavy:') })
    expect(light.height).toBe(100n)
    expect(t.fallbacks).toMatchObject([{ reason: 'gas', calls: 1, disabled: false }])
    // A read that needs its height has none from a direct read.
    await expect(t.read(A, 'heavy', '', true)).rejects.toThrow(Unbatched)
  })
  it('reads every call alone when the query fails whole: an error page, a reply that does not decode, a missing multicall', async () => {
    for (const fault of ['500', 'garbage', 'missing'] as const) {
      const t = setup(fault === 'missing' ? { exists: () => true } : {})
      const transport: ReadTransport = {
        currentBlockHeight: async () => 100n,
        read: async (id, fn, input, max) => {
          if (id === MC && fault === '500') throw new NodeReadError(`Contract read failed (${id}.${fn}): {"error":"Internal server error"}`, 500)
          if (id === MC && fault === 'garbage') return Uint8Array.from([1, 2, 3])
          if (id === MC) throw new NodeReadError('Contract read failed: no such contract', 500)
          return t.inner.read(id, fn, input, max)
        },
      }
      const fallbacks: MulticallFallback[] = []
      const b = new Batcher(transport, MC, () => 0n, (f) => void fallbacks.push(f))
      const settled = await Promise.all([b.read(A, 'config', enc('')), b.read(B, 'home', enc('r'))].map(outcome))
      expect(settled, fault).toEqual([{ v: { bytes: enc('aa.config:') } }, { v: { bytes: enc('bb.home:r') } }])
      expect(fallbacks, fault).toMatchObject([{ reason: 'batch', calls: 2, disabled: false }])
      // A read that needs a multicall reply's height is not answered by a direct one.
      await expect(b.read(A, 'config', enc(''), true), fault).rejects.toThrow(Unbatched)
    }
  })
  it('holds batching off for 5 minutes after two queries in a row fail whole; a query that answers resets the count', async () => {
    const clock = clocks()
    let failing = true
    const t = setup({ before: () => { if (failing) throw new Error('node error') } })
    await t.read(A, 'config')
    failing = false
    await t.read(A, 'config')
    failing = true
    await t.read(A, 'config')
    // One failure, an answer, one failure: not two in a row.
    expect(t.fallbacks.map((f) => f.disabled)).toEqual([false, false])
    expect(t.batcher.active).toBe(true)
    await t.read(A, 'config')
    expect(t.fallbacks.map((f) => f.disabled)).toEqual([false, false, true])
    expect(t.batcher.active).toBe(false)
    const queries = t.aggregates()
    await Promise.all([t.read(A, 'config'), t.read(B, 'config')])
    expect(t.aggregates()).toBe(queries)
    await expect(t.read(A, 'config', '', true)).rejects.toThrow(Unbatched)
    clock.advance(299_999)
    expect(t.batcher.active).toBe(false)
    clock.advance(1)
    failing = false
    expect((await t.read(A, 'config')).height).toBe(100n)
    expect(t.aggregates()).toBe(queries + 1)
    clock.restore()
  })
  it('fails every read of a rate-limited query with its status and wait, reading none alone and holding nothing off', async () => {
    for (const [status, wait] of [[429, 2000], [429, undefined], [503, 1500]] as const) {
      const t = setup()
      const transport: ReadTransport = {
        currentBlockHeight: async () => 100n,
        read: async (id, fn, input, max) => {
          if (id === MC) throw new NodeReadError(`Contract read failed (${id}.${fn}): HTTP ${status}`, status, wait)
          return t.inner.read(id, fn, input, max)
        },
      }
      const fallbacks: MulticallFallback[] = []
      const b = new Batcher(transport, MC, () => 0n, (f) => void fallbacks.push(f))
      for (let round = 0; round < 3; round++) {
        const settled = await Promise.all([b.read(A, 'config', enc('')), b.read(B, 'home', enc('r'), true)].map(outcome))
        expect(settled).toEqual([
          { e: { name: 'NodeReadError', message: `Contract read failed (${A}.config): Contract read failed (${MC}.aggregate): HTTP ${status}`, status, wait } },
          { e: { name: 'NodeReadError', message: `Contract read failed (${B}.home): Contract read failed (${MC}.aggregate): HTTP ${status}`, status, wait } },
        ])
      }
      expect(t.state.reads).toEqual([])
      expect(fallbacks).toEqual([])
      expect(b.active).toBe(true)
    }
    // A 503 without a wait is not a rate limit: the reads are sent alone.
    const t = setup()
    const b = new Batcher({ ...t.inner, read: async (id, fn, input, max) => {
      if (id === MC) throw new NodeReadError('unavailable', 503)
      return t.inner.read(id, fn, input, max)
    } }, MC, () => 0n)
    expect(await b.read(A, 'config', enc(''))).toEqual({ bytes: enc('aa.config:') })
  })
  it('never awaits the fallback hook, and a hook that throws changes no read', async () => {
    const c = chain()
    const m = withMulticall(c.inner, { before: () => { throw new Error('down') } })
    let calls = 0
    const b = new Batcher(m.transport, MC, () => 0n, () => {
      calls++
      if (calls === 1) throw new Error('hook')
      return new Promise(() => {}) as never
    })
    expect(await b.read(A, 'config', enc(''))).toEqual({ bytes: enc('aa.config:') })
    expect(await b.read(A, 'config', enc(''))).toEqual({ bytes: enc('aa.config:') })
    expect(calls).toBe(2)
  })
  it('passes the 64 KiB bound to the transport for a query, and none for a read alone', async () => {
    const bounds: (number | undefined)[] = []
    const c = chain()
    const m = withMulticall(c.inner)
    const b = new Batcher({ ...m.transport, read: (id, fn, input, max) => (bounds.push(max), m.transport.read(id, fn, input, max)) }, MC, () => 0n)
    await b.read(A, 'config', enc(''))
    await b.alone(A, 'config', enc(''))
    expect(bounds).toEqual([65_536, undefined])
    expect(hex(encodeReply(1n, []))).toHaveLength(32)
  })
})

describe('the tab\'s holdoff', () => {
  it('holds batching off on a record that holds, and on nothing past its end, further off than a holdoff lasts, or malformed', () => {
    const items = new Map<string, string>()
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v), removeItem: (k: string) => void items.delete(k) })
    const now = Date.now()
    for (const [record, held] of [
      [{ until: now + 60_000, reason: 'holdoff' }, true],
      [{ until: now + 60_000, reason: 'strike' }, false],
      [{ until: now - 1, reason: 'holdoff' }, false],
      // Set when the clock read later than it does now: more than a holdoff lasts, so not one this tab made.
      [{ until: now + 300_000 + 60_000, reason: 'holdoff' }, false],
      ['{"until":', false],
      [{ until: String(now + 60_000), reason: 'holdoff' }, false],
      [{ until: now + 60_000, reason: 'paused' }, false],
    ] as const) {
      items.set('k', typeof record === 'string' ? record : JSON.stringify(record))
      expect(setup({ tab: tabHoldoff('k') }).batcher.active, JSON.stringify(record)).toBe(!held)
    }
  })
  it('counts a strike the tab kept as one failed query, and forgets it once a query is answered', async () => {
    const items = new Map<string, string>()
    vi.stubGlobal('sessionStorage', { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v), removeItem: (k: string) => void items.delete(k) })
    items.set('k', JSON.stringify({ until: Date.now() + 60_000, reason: 'strike' }))
    // Answered: the strike is forgotten, and one failure later batching still runs.
    const ok = setup({ tab: tabHoldoff('k') })
    await ok.read(A, 'config')
    expect(items.has('k')).toBe(false)
    // Kept: the next query that fails whole is the second in a row.
    items.set('k', JSON.stringify({ until: Date.now() + 60_000, reason: 'strike' }))
    const t = setup({ fail: () => undefined, tab: tabHoldoff('k'), before: () => { throw new Error('error page') } })
    await t.read(A, 'config')
    expect(t.batcher.active).toBe(false)
    expect(JSON.parse(items.get('k')!).reason).toBe('holdoff')
    expect(t.fallbacks.map((f) => f.disabled)).toEqual([true])
  })
})
