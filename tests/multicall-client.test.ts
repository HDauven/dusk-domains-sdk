/**
 * A client batching through the multicall, over Rusk's HTTP API (`fakeNode`): every read answers as it
 * does without batching, a read that alone makes up an operation takes its height from the query, a
 * multi-read snapshot never mixes heights, and whatever fails fails as a direct read does.
 */
import { describe, expect, it } from 'vitest'
import { FrozenClient, type ClientOptions, type MulticallFallback, type VerificationCache } from '../src/frozen/client.ts'
import { MULTICALL_CONTRACT_ID as MC, type MulticallResult } from '../src/frozen/multicall.ts'
import { NodeReadError } from '../src/frozen/transport.ts'
import { bytes, id } from './helpers.ts'
import { hex, nameKey } from '../src/frozen/bytes.ts'
import { child, encode, endpoint, lensId, lensWorld, pointer, ref, released, store, view, type LensWorld } from './lens-world.ts'
import type { NameView } from '../src/frozen/types.ts'
import { fakeNode, withMulticall, type FakeNodeOptions, type Query } from './multicall-world.ts'

/** What a read returns, or the class, status and wait of what it throws. */
const outcome = (run: Promise<unknown>) =>
  run.then(
    (value) => ({ value }),
    (error: Error) => ({ error: { class: error?.constructor?.name, status: (error as NodeReadError).status, wait: (error as NodeReadError).retryAfterMs } }),
  )
const preview = (label: string) => ({ label, years: 1, actor: bytes(10) })
/** Every read a page makes, and the multi-read operations, as the lens tests and the baseline list them. */
const reads = (w: LensWorld): Record<string, (c: FrozenClient) => Promise<unknown>> => ({
  'getName hinted': (c) => c.getName('child.example.dusk', w.newest),
  'getName unhinted': (c) => c.getName('child.example.dusk'),
  'getName absent': (c) => c.getName('absent.dusk'),
  'resolve records': (c) => c.resolve('child.example.dusk', ['moonlight_address', 'avatar', 'missing'], w.newest),
  'verifyPrimary hinted': (c) => c.verifyPrimary(endpoint, w.newest),
  'verifyPrimary unhinted': (c) => c.verifyPrimary(endpoint),
  'verifyPrimary none': (c) => c.verifyPrimary(bytes(13, 96)),
  'namePage subname': (c) => c.namePage('child.example.dusk', w.newest),
  'namePage root': (c) => c.namePage('example.dusk'),
  'namePage absent': (c) => c.namePage('absent.dusk'),
  'previewRegistration unseen': (c) => c.previewRegistration(preview('fresh')),
  'previewRegistration released': (c) => c.previewRegistration(preview('gone'), store(0)),
  'previewRegistration registered': (c) => c.previewRegistration(preview('example')),
  pricing: (c) => c.pricing(),
  bootstrap: (c) => c.bootstrap(),
  discover: (c) => c.discover(),
  'locate records': (c) => c.locate(w.newest, child.root, 'read_records', child),
  quoteRenewal: (c) => c.quoteRenewal(w.newest, { name: ref, years: 1 }),
  registrationPlacement: (c) => c.registrationPlacement(nameKey('fresh.dusk').root),
  prepareRegistration: (c) => c.prepareRegistration({ actor: bytes(10), label: 'fresh', years: 1, secret: bytes(33), commitHeight: 100n }),
  'store read_records': (c) => c.store(w.newest).read_records(child),
  'store stats': (c) => c.store(w.newest).stats(),
  'directory config': (c) => c.directory.config(),
  'directory members': (c) => c.directory.members({ kind: 'Store', start: 0, limit: 16 }),
  'directory member': (c) => c.directory.member({ kind: 'Store', id: bytes(0x40) }),
  'directory renewal_schedule': (c) => c.directory.renewal_schedule(),
  'directory registration_context': (c) => c.directory.registration_context(),
})
/** A client of `w` reading through `node`, as `createClientFromManifest` makes one: the directory verified. */
async function on(w: LensWorld, node: ReturnType<typeof fakeNode>, options: ClientOptions = {}) {
  const c = new FrozenClient(w.release, { fetch: node.fetch, heightReuseMs: 0, onLensFallback: (f) => void w.fallbacks.push(f), ...options })
  await c.verifyContract('directory', id(1))
  return c
}
const node = (w: LensWorld, options: FakeNodeOptions = {}) => fakeNode(w.transport, { height: () => w.chain.height, ...options })
const counts = (n: ReturnType<typeof fakeNode>) => ({
  tips: n.requests.filter((r) => r.kind === 'tip').length,
  reads: n.requests.filter((r) => r.kind === 'read').length,
  queries: n.requests.filter((r) => r.kind === 'aggregate').length,
})
/** A node whose next query that makes a matching call, once armed, answers at `height` and gives that call `answer`. */
const laggingOnce = (w: LensWorld, match: (call: { contract: string; fn: string }) => boolean, answer?: MulticallResult, height = -1n) => {
  let armed = false,
    now = false
  const n = node(w, {
    before: (calls) => {
      now = armed && calls.some(match)
      if (now) armed = false
    },
    height: () => (now ? w.chain.height + height : w.chain.height),
    respond: (call) => (now && answer && match(call) ? answer : undefined),
  })
  return { n, arm: () => void (armed = true) }
}
/** A client that has shown height 120, from a read in one query. */
const showing120 = async (w: LensWorld, n: ReturnType<typeof fakeNode>) => {
  const c = await on(w, n)
  w.chain.height = 120n
  expect((await c.readAt('directory', id(1), 'config', null)).height).toBe(120n)
  return c
}

describe('when the client batches', () => {
  it('batches through the transport it builds, through a custom one only when asked, and never with `multicall: false`', async () => {
    const w = await lensWorld(1)
    const n = node(w)
    expect((await on(w, n)).multicall).toBe(MC)
    expect(new FrozenClient(w.release, { transport: w.transport }).multicall).toBeUndefined()
    expect(new FrozenClient(w.release, { fetch: n.fetch, multicall: false }).multicall).toBeUndefined()
    expect(new FrozenClient(w.release, { transport: w.transport, multicall: true }).multicall).toBe(MC)
    expect(new FrozenClient(w.release, { fetch: n.fetch, multicall: `0x${'ab'.repeat(32)}` }).multicall).toBe('ab'.repeat(32))
    expect(() => new FrozenClient(w.release, { fetch: n.fetch, multicall: 'not an id' })).toThrow('Invalid hex bytes')
    expect(() => new FrozenClient(w.release, { fetch: n.fetch, multicall: '00'.repeat(32) })).toThrow('Invalid contract ID')
    // A deployment at another ID is the one batched through.
    const other = 'ab'.repeat(32), m = node(w, { multicall: other })
    const c = await on(w, m, { multicall: other })
    await Promise.all([c.directory.config(), c.directory.allocation()])
    expect(m.requests.filter((r) => r.kind === 'aggregate').map((r) => r.contract)).toEqual([other, other])
    // Through a custom transport that asked for it.
    const t = withMulticall(w.transport, { height: () => w.chain.height })
    const d = new FrozenClient(w.release, { transport: t.transport, multicall: true, heightReuseMs: 0 })
    await Promise.all([d.directory.config(), d.directory.allocation()])
    expect(t.queries.at(-1)!.calls.map((x) => x.fn)).toEqual(['config', 'allocation'])
  })
  it.each([[1, true], [1, false], [4, true], [4, false], [64, true], [64, false]])(
    'answers every read as without batching, at %i stores, with a lens: %s',
    async (n, lens) => {
      const w = await lensWorld(n, 3, { lens })
      released(w, 'gone', 0)
      for (const [name, read] of Object.entries(reads(w))) {
        const off = node(w), batched = node(w)
        const direct = await outcome(read(await on(w, off, { multicall: false })))
        const through = await outcome(read(await on(w, batched)))
        expect(through, name).toEqual(direct)
        expect(counts(off).queries, name).toBe(0)
        expect(counts(batched).reads, name).toBe(0)
      }
      expect(w.fallbacks).toEqual([])
    },
    30_000,
  )
  it('reads a read that alone makes up an operation in one query, at the height its reply reports, with no tip read', async () => {
    const w = await lensWorld(4)
    const batched = node(w), off = node(w)
    const c = await on(w, batched), d = await on(w, off, { multicall: false })
    // Each contract verified first: what is counted below is the read alone.
    for (const x of [c, d]) await x.verifyContract('store', store(3))
    for (const [role, target, method, args] of [
      ['directory', id(1), 'config', null], ['directory', id(1), 'members', { kind: 'Store', start: 0, limit: 16 }],
      ['directory', id(1), 'registration_context', null], ['store', store(3), 'stats', null],
    ] as const) {
      w.chain.height++
      batched.requests.length = off.requests.length = 0
      const a = await c.readAt(role, target, method as never, args as never), b = await d.readAt(role, target, method as never, args as never)
      expect(a, method).toEqual(b)
      expect(a.height).toBe(w.chain.height)
      expect(counts(batched), method).toEqual({ tips: 0, reads: 0, queries: 1 })
      // Without batching: a tip read before and after the read.
      expect(counts(off).tips, method).toBe(2)
    }
  })
  it('reads one again between tip reads when its height is below what the client saw, and uses only an answer at that tip', async () => {
    const w = await lensWorld(1)
    let lagging = 0
    // The node's multicall answers one block behind its tip for the next `lagging` queries, as a node
    // behind a load balancer may.
    const n = node(w, { height: () => (lagging-- > 0 ? w.chain.height - 1n : w.chain.height) })
    const c = await on(w, n)
    expect((await c.readAt('directory', id(1), 'config', null)).height).toBe(100n)
    w.chain.height = 102n
    // The client sees 102: a lens reply at it.
    expect((await c.getName('child.example.dusk', w.newest)).height).toBe(102n)
    const before = n.queries.length
    lagging = 1
    // Its query answers at 101, below what the client saw: read again between tip reads, at 102.
    expect(await c.readAt('directory', id(1), 'allocation', null)).toMatchObject({ height: 102n })
    expect(n.queries.slice(before).map((q) => q.height)).toEqual([101n, 102n])
    // A snapshot whose batched reply is at another height than its tip reads it again: never answered at 101.
    lagging = 1
    const at = n.queries.length
    expect(await c.readAt('store', w.newest, 'home', { root: child.root })).toMatchObject({ value: 'Local', height: 102n })
    const heights = n.queries.slice(at).map((q) => q.height)
    expect(heights[0]).toBe(101n)
    expect(heights.slice(1).length).toBeGreaterThan(0)
    expect(heights.slice(1).every((h) => h === 102n)).toBe(true)
  })
  it('fails a read whose call panics with the error a direct read gives, and reads no tip for it', async () => {
    const w = await lensWorld(1)
    w.chain.replies.set('01.renewal_schedule', new Error('DuskDS:v1:InvalidArgument'))
    const batched = node(w), off = node(w)
    const [c, d] = [await on(w, batched), await on(w, off, { multicall: false })]
    batched.requests.length = off.requests.length = 0
    const a = await outcome(c.directory.renewal_schedule())
    const b = await outcome(d.directory.renewal_schedule())
    expect(a).toEqual(b)
    expect(a).toEqual({ error: { class: 'NodeReadError', status: 500, wait: undefined } })
    // Through the multicall the callee's own error is in the message; a public node's direct reply hides it.
    await expect((await on(w, node(w))).directory.renewal_schedule()).rejects.toThrow(`(${id(1)}.renewal_schedule): DuskDS:v1:InvalidArgument`)
    expect(counts(batched)).toEqual({ tips: 0, reads: 0, queries: 1 })
    expect(counts(off)).toEqual({ tips: 2, reads: 1, queries: 0 })
  })
  it('reads a multi-read snapshot again when a batched reply is at another height, never mixing two', async () => {
    const w = await lensWorld(4, 3, { lens: false })
    let landed = false
    // A block lands right after the snapshot read its tip: its next query reads the new block.
    const n = node(w, { before: () => { if (!landed) { landed = true; w.chain.height++ } } })
    const c = await on(w, n)
    landed = false
    const start = w.chain.height, from = n.queries.length
    const got = await c.getName('child.example.dusk')
    expect(got.height).toBe(start + 1n)
    // The attempt at `start` stopped at its first reply, from the next block: no query answered at `start`.
    expect(n.queries.slice(from).every((q) => q.height === start + 1n)).toBe(true)
    expect(n.queries.length - from).toBeGreaterThan(1)
    expect(got).toEqual(await (await on(w, node(w), { multicall: false })).getName('child.example.dusk'))
  })
  it('reads a snapshot again when a block lands while it verifies a contract, instead of failing it', async () => {
    for (const n of [1, 4]) {
      const w = await lensWorld(n, 3, { lens: false })
      let landed = false
      // The block lands just before the query that checks the first store the snapshot reads through.
      const node_ = node(w, { before: (calls) => { if (!landed && calls.some((x) => x.fn === 'interface_version' && x.contract !== id(1))) { landed = true; w.chain.height++ } } })
      const c = await on(w, node_)
      const start = w.chain.height
      const got = await c.getName('child.example.dusk')
      expect(landed, String(n)).toBe(true)
      expect(got.height, String(n)).toBe(start + 1n)
      expect(got, String(n)).toEqual(await (await on(w, node(w), { multicall: false })).getName('child.example.dusk'))
      // Verified in the snapshot that committed: signable, as without batching.
      await expect(c.verifyContract('store', store(0))).resolves.toBeUndefined()
    }
  })
  it('never shows a page whose primary was read at another height: the page is read again', async () => {
    const w = await lensWorld(4, 3, { lens: false })
    let lagged = false, lag = false
    // One query, the primary's, answered a block behind the tip the page opened at.
    const lagging = fakeNode(w.transport, {
      height: () => (lag ? w.chain.height - 1n : w.chain.height),
      before: (calls) => {
        lag = !lagged && calls.some((x) => x.fn === 'resolve_primary')
        if (lag) lagged = true
      },
    })
    const c = await on(w, lagging)
    const page = await c.namePage('child.example.dusk', w.newest)
    expect(lagged).toBe(true)
    expect(page.primary.error).toBeNull()
    expect(page).toEqual(await (await on(w, node(w), { multicall: false })).namePage('child.example.dusk', w.newest))
  })
  it('still reads a snapshot again when a block replaced its tip at the same height: replies show the height, tips the hash', async () => {
    const w = await lensWorld(4, 3, { lens: false })
    const n = node(w)
    const c = await on(w, n)
    let forked = false
    w.chain.onRead = (call) => {
      // The snapshot's home read: then a block replaces the tip at the same height.
      if (!forked && call.endsWith('.get_name')) {
        forked = true
        w.chain.fork++
      }
    }
    const got = await c.getName('child.example.dusk')
    expect(forked).toBe(true)
    expect(got.height).toBe(100n)
    // Every query was at height 100; only the tip's hash showed the attempt crossed a block, and it was read again.
    expect(n.queries.every((q) => q.height === 100n)).toBe(true)
    expect(n.queries.filter((q) => q.calls.some((x) => x.fn === 'get_name'))).toHaveLength(2)
  })
  it('sends the reads a page makes at once as one query: the lens views and a single read', async () => {
    const w = await lensWorld(4)
    const n = node(w)
    const c = await on(w, n)
    await c.bootstrap()
    n.queries.length = 0
    n.requests.length = 0
    const [boot, page, context] = await Promise.all([
      c.bootstrap(), c.namePage('child.example.dusk', w.newest), c.directory.registration_context(),
    ])
    expect(n.requests.map((r) => r.kind)).toEqual(['aggregate'])
    expect(n.queries[0].calls.map((x) => x.fn)).toEqual(['bootstrap', 'name_page', 'registration_context'])
    const d = await on(w, node(w), { multicall: false })
    expect([boot, page, context]).toEqual(await Promise.all([d.bootstrap(), d.namePage('child.example.dusk', w.newest), d.directory.registration_context()]))
  })
  it('gives each lens view the gas its reads need, a registration quote 80M, and every other read a fair share', async () => {
    const w = await lensWorld(1)
    released(w, 'gone', 0)
    const n = node(w)
    const c = await on(w, n)
    await c.bootstrap()
    await Promise.all([
      c.getName('child.example.dusk'), c.verifyPrimary(endpoint), c.namePage('child.example.dusk'), c.previewRegistration(preview('fresh')),
      c.pricing(), c.bootstrap(),
    ])
    const lens = new Map(n.queries.flatMap((q) => q.calls.filter((x) => x.contract === lensId).map((x) => [x.fn, x.gasLimit] as const)))
    expect(Object.fromEntries(lens)).toEqual({
      binding: 0n, lens_interface: 0n, resolve: 390_000_000n, reverse: 842_000_000n, name_page: 1_114_000_000n,
      availability: 590_000_000n, pricing: 46_000_000n, bootstrap: 110_000_000n,
    })
    const d = await on(w, n, { useLens: false })
    await d.quoteRegistration(store(0), { node: nameKey('fresh.dusk').node, label: 'fresh', years: 1, actor: bytes(10), expected_policy_version: 1n, expected_policy_config_version: 1n }).catch(() => {})
    const quotes = n.queries.flatMap((q) => q.calls.filter((x) => x.fn === 'quote_registration').map((x) => x.gasLimit))
    expect(quotes.length).toBeGreaterThan(0)
    expect(quotes.every((g) => g === 80_000_000n)).toBe(true)
    expect(n.queries.flatMap((q) => q.calls.filter((x) => x.contract !== lensId && x.fn !== 'quote_registration')).every((x) => x.gasLimit === 0n)).toBe(true)
  })
})

describe('under random delays and blocks', () => {
  it.each([0, Infinity])('returns only state read at one height, the tip during the call, batched (heightReuseMs %s)', async (heightReuseMs) => {
    // Seeded: every read and tip read waits a random few milliseconds; blocks land on their own schedule,
    // between queries, as a query reads one state; the name's expiry and renewal quote are functions of
    // the height they are read at. Every result must be the state at the height it reports, and that
    // height the tip at some point during the call.
    let seed = 20261020
    const random = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32
    const sleep = () => new Promise((resolve) => setTimeout(resolve, Math.floor(random() * 3)))
    const w = await lensWorld(4, 3, { lens: false })
    const state = () => {
      w.chain.schedule = { ...w.chain.schedule, version: w.chain.height }
      w.chain.names.set(`${w.newest}:${hex(child.node)}`, view(child, { records: pointer, expires_at: 1000n + w.chain.height }))
      w.chain.replies.set(`${w.newest.slice(0, 2)}.quote_renewal`, {
        Local: { schedule_version: 3n, total_lux: '123', referral_lux: '12', new_expiry: 5000n + w.chain.height, new_grace_end: 6000n },
      })
    }
    state()
    let busy = 0
    const n = node(w, { before: () => void busy++, after: () => void busy-- })
    const c = await on(w, n, { heightReuseMs })
    w.chain.onRead = sleep
    w.chain.onHeight = sleep
    let running = true
    const blocks = (async () => {
      while (running) {
        await new Promise((resolve) => setTimeout(resolve, 1 + Math.floor(random() * 8)))
        if (!busy) {
          w.chain.height++
          state()
        }
      }
    })()
    let committed = 0,
      crossed = 0,
      rounds = 0
    // At least 12 rounds, and on until a few blocks landed between them.
    for (; rounds < 64 && (rounds < 12 || w.chain.height <= 105n); rounds++)
      await Promise.all(
        Array.from({ length: 8 }, async (_, i) => {
          const start = w.chain.height
          try {
            if (i % 4 === 1) {
              const r = await c.quoteRenewal(w.newest, { name: ref, years: 1 })
              expect((r.value as { Local: { new_expiry: bigint } }).Local.new_expiry).toBe(5000n + r.height)
              expect(r.height >= start && r.height <= w.chain.height).toBe(true)
            } else if (i % 4 === 3) {
              // A read that alone makes up an operation: at the height of the query that answered it, and its state.
              const r = await c.readAt('directory', id(1), 'renewal_schedule', null)
              expect(r.value.version).toBe(r.height)
              expect(r.height >= start && r.height <= w.chain.height).toBe(true)
            } else {
              const r = await c.getName('child.example.dusk', random() < 0.5 ? w.newest : undefined)
              expect((r.value as { Local: NameView }).Local.name.expires_at).toBe(1000n + r.height)
              expect(r.height >= start && r.height <= w.chain.height).toBe(true)
            }
            committed++
          } catch (error) {
            expect((error as Error).message).toBe('Chain tip changed during read; retry the snapshot')
            crossed++
          }
        }),
      )
    running = false
    await blocks
    expect(committed + crossed).toBe(rounds * 8)
    expect(committed).toBeGreaterThan(0)
    expect(w.chain.height).toBeGreaterThan(105n)
    // Batched: one query for many reads.
    expect(counts(n).queries).toBeLessThan(n.queries.reduce((sum, q) => sum + q.calls.length, 0))
  }, 60_000)
})

describe('what a one-query read shows', () => {
  it('counts as a committed snapshot of the stores it lists: a lens reply leaving one out is then refused, as without batching', async () => {
    for (const multicall of [true, false]) {
      const w = await lensWorld(4)
      const n = node(w)
      const c = await on(w, n, { multicall })
      await c.directory.members({ kind: 'Store', start: 0, limit: 16 })
      expect(counts(n).tips, String(multicall)).toBe(multicall ? 0 : 2)
      // The lens answers from store 0 only: the name would be absent.
      w.chain.lensReply = (fn, reply) => {
        if (reply.Ok && fn === 'resolve') {
          reply.Ok.consulted.stores.splice(1)
          reply.Ok.store = reply.Ok.consulted.stores[0].id
          reply.Ok.name = 'Absent'
          reply.Ok.status = 'Absent'
        }
        return reply
      }
      w.chain.height++
      w.fallbacks.length = 0
      const got = await c.getName('child.example.dusk', w.newest)
      expect(got.value, String(multicall)).not.toBe('Absent')
      expect(w.fallbacks.map((f) => f.reason), String(multicall)).toEqual(['evidence'])
    }
  })
  it('never shows an older state than the client showed: one-query reads, lens views and snapshots share the high-water height', async () => {
    const w = await lensWorld(1)
    let behind = false
    const n = node(w, { height: () => (behind ? w.chain.height - 5n : w.chain.height) })
    const c = await on(w, n)
    w.chain.height = 120n
    expect((await c.readAt('directory', id(1), 'config', null)).height).toBe(120n)
    // The multicall now answers 5 blocks behind the tip: a one-query read is not used below 120, nor is a
    // failure there. Read between tip reads instead, every batched reply is from another height than the tip:
    // the snapshot is read again until it gives up, as when blocks keep landing.
    behind = true
    await expect(c.readAt('directory', id(1), 'allocation', null)).rejects.toThrow('Chain tip changed during read; retry the snapshot')
    w.chain.replies.set('01.allocation', new Error('DuskDS:v1:NotFound'))
    await expect(c.readAt('directory', id(1), 'allocation', null)).rejects.toThrow('Chain tip changed during read; retry the snapshot')
  })
})

describe('the lens in a batch', () => {
  it('reads a lens reply refused for want of gas in a batch again alone, and answers as a direct query', async () => {
    for (const code of ['GasBudget', 'ReadFailed', 'QuoteRefused/GasBudget']) {
      const w = await lensWorld(4)
      const [refusal, cause] = code.split('/')
      // A lens given less gas than a direct query, as fair shares do: it refuses, while alone it answers.
      const n = node(w, {
        respond: (call) => (call.contract === lensId && call.fn === 'name_page'
          ? { Ok: encode({ Refused: { code: refusal, contract: bytes(1), cause: cause ?? null, height: w.chain.height } }) }
          : undefined),
      })
      const c = await on(w, n)
      const page = await c.namePage('child.example.dusk', w.newest)
      expect(page, code).toEqual(await (await on(w, node(w), { multicall: false })).namePage('child.example.dusk', w.newest))
      expect(w.fallbacks, code).toEqual([])
      expect(n.requests.filter((r) => r.kind === 'read').map((r) => r.fn), code).toEqual(['name_page'])
      // Not held off: the next view is batched again.
      await c.namePage('child.example.dusk', w.newest)
      expect(n.requests.filter((r) => r.kind === 'read'), code).toHaveLength(2)
    }
  })
  it('reads a name page again alone when its own primary check was refused for want of gas in the batch', async () => {
    const w = await lensWorld(4)
    let inQuery = false
    const n = node(w, { before: () => void (inQuery = true), after: () => void (inQuery = false) })
    // Inside a query, the page's primary check is refused for gas, as a lens given less than a direct query.
    w.chain.lensReply = (fn, reply) => {
      if (fn === 'name_page' && reply.Ok && inQuery)
        reply.Ok.primary = { endpoint: reply.Ok.primary.endpoint, verified: null, is_primary: false, refused: { code: 'GasBudget', contract: bytes(1), cause: null, height: reply.Ok.height } }
      return reply
    }
    const c = await on(w, n)
    const page = await c.namePage('child.example.dusk', w.newest)
    w.chain.lensReply = undefined
    expect(page).toEqual(await (await on(w, node(w), { multicall: false })).namePage('child.example.dusk', w.newest))
    expect(page.primary.verified).not.toBeNull()
    expect(n.requests.filter((r) => r.kind === 'read').map((r) => r.fn)).toEqual(['name_page'])
    expect(w.fallbacks).toEqual([])
  })
  it('keeps a refusal on its merits: an invalid name is not read again', async () => {
    const w = await lensWorld(1)
    const n = node(w)
    const c = await on(w, n)
    await outcome(c.getName('Not A Name'))
    expect(n.requests.filter((r) => r.kind === 'read')).toHaveLength(0)
  })
})

describe('verification and caches', () => {
  /** A cache as `sessionStorage` is one. */
  const storage = () => {
    const items = new Map<string, string>()
    const cache: VerificationCache = { getItem: (k) => items.get(k) ?? null, setItem: (k, v) => void items.set(k, v) }
    return { items, cache }
  }
  it('keeps the same verification facts through batches, and a later client reads none of them again', async () => {
    for (const lens of [true, false]) {
      const w = await lensWorld(4, 3, { lens })
      const batched = storage(), direct = storage()
      const ns = { transportNamespace: 'fake-node' }
      await (await on(w, node(w), { verificationCache: batched.cache, ...ns })).discover()
      await (await on(w, node(w), { verificationCache: direct.cache, multicall: false, ...ns })).discover()
      if (lens) {
        await (await on(w, node(w), { verificationCache: batched.cache, ...ns })).bootstrap()
        await (await on(w, node(w), { verificationCache: direct.cache, multicall: false, ...ns })).bootstrap()
      }
      expect([...batched.items].sort(), String(lens)).toEqual([...direct.items].sort())
      const later = node(w)
      await (await on(w, later, { verificationCache: batched.cache, ...ns })).discover()
      const checks = later.queries.flatMap((q) => q.calls).filter((x) => ['interface_version', 'binding', 'order_api_version'].includes(x.fn))
      expect(checks).toEqual([])
    }
  })
  it('sends a contract check\'s reads together, and refuses a contract that fails one as without batching', async () => {
    const w = await lensWorld(1, 1, { lens: false })
    const n = node(w)
    await (await on(w, n)).discover()
    const together = n.queries.filter((q) => q.calls.some((x) => x.fn === 'interface_version'))
    expect(together.every((q) => q.calls.some((x) => x.fn === 'binding'))).toBe(true)
    // A store whose interface fails its check: refused, whatever its binding read answered.
    const wrong = { kind: 'Resolver', version: 1, move_version: 1, custody_version: 1 }
    for (const [call, reply] of [['40.interface_version', wrong], ['40.binding', new Error('binding unavailable')]] as const) {
      w.chain.replies.clear()
      w.chain.replies.set('40.interface_version', wrong)
      w.chain.replies.set(call, reply)
      const a = await outcome((await on(w, node(w))).discover())
      const b = await outcome((await on(w, node(w), { multicall: false })).discover())
      expect(a, call).toEqual(b)
      expect(a, call).toEqual({ error: { class: 'ContractRefusedError', status: undefined, wait: undefined } })
    }
  })
})

describe('rate limits and failures', () => {
  const tooMany = (wait = '0') => new Response('{"error":"Too many requests"}', { status: 429, headers: { 'retry-after': wait } })
  it('fails a rate-limited query\'s reads as direct reads: a lens view retries three times, in new queries; a direct read fails', async () => {
    for (const multicall of [true, false]) {
      const w = await lensWorld(1)
      let limit = false
      const n = node(w, { intercept: (r) => (limit && r.kind !== 'tip' ? tooMany() : undefined) })
      const c = await on(w, n, { multicall })
      // The directory and the lens checked while the node answers; then it limits every query.
      await c.bootstrap()
      limit = true
      const before = n.requests.length
      expect(await outcome(c.getName('child.example.dusk')), String(multicall)).toEqual({ error: { class: 'NodeReadError', status: 429, wait: 0 } })
      // The view's query and three retries, batched or not, and never a direct read instead.
      expect(n.requests.slice(before).map((r) => r.fn), String(multicall)).toEqual(Array(4).fill(multicall ? 'aggregate' : 'resolve'))
      // A direct read: its rate limit, no retry; batched it reads no tip either.
      const r = n.requests.length
      expect(await outcome(c.directory.config())).toEqual({ error: { class: 'NodeReadError', status: 429, wait: 0 } })
      expect(n.requests.slice(r).map((x) => x.kind), String(multicall)).toEqual(multicall ? ['aggregate'] : ['tip', 'read', 'tip'])
    }
  })
  it('reads each read alone when a query fails whole, holds batching off after two, and reports both', async () => {
    const w = await lensWorld(1, 3, { lens: false })
    const fallbacks: MulticallFallback[] = []
    // A chain without the multicall: its query is an ordinary read of a contract that is not there.
    const n = node(w, { multicall: null })
    const c = await on(w, n, { onMulticallFallback: (f) => void fallbacks.push(f) })
    const direct = await on(w, node(w), { multicall: false })
    expect(await c.directory.config()).toEqual(await direct.directory.config())
    expect(await c.getName('child.example.dusk')).toEqual(await direct.getName('child.example.dusk'))
    expect(fallbacks.map((f) => [f.reason, f.disabled])).toEqual([['batch', false], ['batch', true]])
    const sent = n.requests.length
    await c.getName('child.example.dusk')
    expect(n.requests.slice(sent).some((r) => r.kind === 'aggregate' || r.contract === MC)).toBe(false)
  })
})

describe('a cold page', () => {
  const calls = (q: Query) => q.calls.map((x) => `${x.contract.slice(0, 2)}.${x.fn}`).sort()
  it('checks the lens deployment in the query that verifies the directory: a cold home page is two queries', async () => {
    const w = await lensWorld(4)
    const n = node(w)
    const c = await on(w, n)
    const boot = await c.bootstrap()
    expect(n.requests.map((r) => r.kind)).toEqual(['aggregate', 'aggregate'])
    expect(n.queries.map(calls)).toEqual([['01.binding', '01.interface_version', '08.binding', '08.lens_interface'], ['08.bootstrap']])
    const d = await on(w, node(w), { multicall: false })
    expect(boot).toEqual(await d.bootstrap())
    expect(w.fallbacks).toEqual([])
  })
  it('reads nothing ahead that the client would not read: a kept lens check, the lens off, or a direct client', async () => {
    const w = await lensWorld(4)
    const items = new Map<string, string>()
    const cache: VerificationCache = { getItem: (k) => items.get(k) ?? null, setItem: (k, v) => void items.set(k, v) }
    const ns = { verificationCache: cache, transportNamespace: 'fake-node' }
    await (await on(w, node(w), ns)).bootstrap()
    // A later page of the session: every check kept, so the first query is the view's.
    const later = node(w)
    await (await on(w, later, ns)).bootstrap()
    expect(later.queries.map(calls)).toEqual([['08.bootstrap']])
    // Without the lens: the directory's check alone.
    const off = node(w)
    await on(w, off, { useLens: false })
    expect(off.queries.map(calls)).toEqual([['01.binding', '01.interface_version']])
  })
  it('reads the lens check itself when its read-ahead was not answered, and holds off a lens that fails it, as without batching', async () => {
    const w = await lensWorld(4)
    let first = true
    // The first query fails whole: the directory's reads go alone, and the lens check reads again for itself.
    const n = node(w, { intercept: (r) => (r.kind === 'aggregate' && first ? ((first = false), new Response('{"error":"Internal server error"}', { status: 500 })) : undefined) })
    const c = await on(w, n)
    const d = await on(w, node(w), { multicall: false })
    expect(await c.bootstrap()).toEqual(await d.bootstrap())
    expect(n.requests.map((r) => `${r.kind}:${r.status}`)).toEqual(['aggregate:500', 'read:200', 'read:200', 'aggregate:200', 'aggregate:200'])
    expect(n.queries.map(calls)).toEqual([['08.binding', '08.lens_interface'], ['08.bootstrap']])
    expect(w.fallbacks).toEqual([])
    // A lens bound elsewhere fails its check, read ahead or not: the same fallback, the same answers.
    w.chain.replies.set('08.binding', { directory: bytes(11), vault: bytes(2), network: 1 })
    const seen: string[][] = []
    for (const multicall of [true, false]) {
      w.fallbacks.length = 0
      const x = await on(w, node(w), { multicall })
      expect(await x.bootstrap(), String(multicall)).toEqual(await d.bootstrap())
      seen.push(w.fallbacks.map((f) => `${f.method}:${f.reason}:${f.disabled}`))
    }
    expect(seen[0]).toEqual(seen[1])
    expect(seen[0]).toEqual(['bootstrap:deployment:true'])
  })
})

describe('a call that fails in a query', () => {
  /** What a call can answer besides a reply: each fails the read as a direct read fails. */
  const failures: [string, MulticallResult][] = [
    ['a panic', { Err: { Panic: 'DuskDS:v1:NotFound' } }],
    ['a missing contract', { Err: 'DoesNotExist' }],
    ['an unknown function', { Err: 'Unknown' }],
    ['a reply over 32 KiB', { Ok: new Uint8Array(40_000) }],
  ]
  it.each(failures)('fails a read only at a height it may answer at: %s from a query at another is read again', async (_, failure) => {
    // A read alone, from a query below what the client showed: read again between tip reads.
    const w = await lensWorld(1)
    const { n, arm } = laggingOnce(w, (x) => x.fn === 'allocation', failure)
    const c = await showing120(w, n)
    const direct = await (await on(w, node(w), { multicall: false })).readAt('directory', id(1), 'allocation', null)
    arm()
    expect(await c.readAt('directory', id(1), 'allocation', null)).toEqual(direct)
    expect(n.queries.map((q) => q.height).slice(-2)).toEqual([119n, 120n])
    // A snapshot's, from a query at another height than its tip, below or above: the snapshot read again.
    for (const offset of [-1n, 1n]) {
      const v = await lensWorld(4, 3, { lens: false })
      const lagging = laggingOnce(v, (x) => x.fn === 'get_name', failure, offset)
      const d = await on(v, lagging.n)
      lagging.arm()
      expect(await d.getName('child.example.dusk'), String(offset)).toEqual(await (await on(v, node(v), { multicall: false })).getName('child.example.dusk'))
      expect(lagging.n.queries.some((q) => q.height === v.chain.height + offset), String(offset)).toBe(true)
    }
  })
})

describe('the multicall by default', () => {
  it('is on only for a mainnet or testnet release, through the transport the client builds', async () => {
    const w = await lensWorld(1)
    const n = node(w)
    const client = (network: number, options: ClientOptions = {}) =>
      new FrozenClient({ ...w.release, manifest: { ...w.release.manifest, network } }, { fetch: n.fetch, heightReuseMs: 0, ...options })
    expect(client(1).multicall).toBe(MC)
    expect(client(2).multicall).toBe(MC)
    for (const network of [0, 3, 7]) {
      expect(client(network).multicall, String(network)).toBeUndefined()
      expect(client(network, { multicall: true }).multicall, String(network)).toBe(MC)
      expect(client(network, { multicall: `0x${'ab'.repeat(32)}` }).multicall, String(network)).toBe('ab'.repeat(32))
      expect(new FrozenClient({ ...w.release, manifest: { ...w.release.manifest, network } }, { transport: w.transport }).multicall).toBeUndefined()
    }
    // A local chain's client reads as 0.4.1 does: no query to a multicall it may not have.
    w.chain.replies.set('01.binding', { directory: bytes(1), vault: bytes(2), network: 0 })
    const local = client(0)
    n.requests.length = 0
    await local.verifyContract('directory', id(1))
    await local.directory.config()
    expect(n.requests.some((r) => r.kind === 'aggregate')).toBe(false)
    expect(n.requests.filter((r) => r.kind === 'read').length).toBeGreaterThan(0)
  })
})

describe('a read outside a snapshot', () => {
  const cases: [string, string, MulticallResult][] = [
    ['a panic', 'interface_version', { Err: { Panic: 'DuskDS:v1:NotFound' } }],
    ['a missing contract', 'interface_version', { Err: 'DoesNotExist' }],
    ['an unknown function', 'interface_version', { Err: 'Unknown' }],
    ['a reply over 32 KiB', 'interface_version', { Ok: new Uint8Array(40_000) }],
    ['no admission record', 'member', { Ok: encode(null) }],
  ]
  // The genesis store, which no directory probe vouches for: its interface and binding are read from the chain.
  const genesis = store(0)
  it.each(cases)('verifies a store lazily at the height the client showed: %s from a query below it is read again as one direct query', async (_, fn, answer) => {
    const w = await lensWorld(4)
    const { n, arm } = laggingOnce(w, (x) => x.fn === fn && (fn === 'member' || x.contract === genesis), answer)
    const c = await showing120(w, n)
    const direct = await (await on(w, node(w), { multicall: false })).store(genesis).stats()
    arm()
    n.requests.length = 0
    expect(await c.store(genesis).stats()).toEqual(direct)
    await expect(c.verifyContract('store', genesis)).resolves.toBeUndefined()
    // No outcome of the stale query was used: each of its calls went out again as 0.4.1 sends it, alone, once.
    const stale = n.queries.filter((q) => q.height === 119n)
    expect(stale).toHaveLength(1)
    expect(n.requests.filter((r) => r.kind === 'read').map((r) => r.fn).sort()).toEqual(stale[0].calls.map((x) => x.fn).sort())
  })
  it('reads a lens view from below what the client showed again between tip reads, as before: not first again directly', async () => {
    const w = await lensWorld(1)
    let armed = false,
      lagging = false
    // The next query that asks the lens to resolve reads the chain a block behind, as a lagging node does.
    const n = node(w, {
      before: (calls) => {
        lagging = armed && calls.some((x) => x.contract === lensId && x.fn === 'resolve')
        if (lagging) (armed = false), (w.chain.height -= 1n)
      },
      after: () => void (lagging && ((lagging = false), (w.chain.height += 1n))),
    })
    const c = await showing120(w, n)
    armed = true
    n.requests.length = 0
    const got = await c.getName('child.example.dusk', w.newest)
    expect(got.height).toBe(120n)
    expect(got).toEqual(await (await on(w, node(w), { multicall: false })).getName('child.example.dusk', w.newest))
    // The view's own height check reads it again between tip reads; nothing reads it directly first.
    expect(n.requests.filter((r) => r.kind === 'read')).toEqual([])
    expect(n.queries.filter((q) => q.calls.some((x) => x.fn === 'resolve')).map((q) => q.height)).toEqual([119n, 120n])
  })
  it.each([0n, 1n])('uses an outcome at or above what the client showed with no second query (%s)', async (height) => {
    const w = await lensWorld(4)
    const { n, arm } = laggingOnce(w, (x) => x.fn === 'interface_version' && x.contract === genesis, undefined, height)
    const c = await showing120(w, n)
    arm()
    n.requests.length = 0
    await c.verifyContract('store', genesis)
    expect(n.requests.filter((r) => r.kind === 'read')).toEqual([])
    expect(n.queries.at(-1)!.height).toBe(120n + height)
    // A lens view, which checks its own height, is not read twice either.
    const before = n.requests.length
    await c.getName('child.example.dusk', w.newest)
    expect(n.requests.slice(before).map((r) => r.kind)).toEqual(['aggregate'])
  })
})
