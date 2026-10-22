/**
 * The light reader over the simulated lens world (lens-world.ts), whose JSON replies follow its chain
 * state at any pool size. Its driver load is the one thing replaced: `fetchDriver` gives the world's
 * JSON driver, whose digests lens-reader.test.ts checks with the real one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchDriver } from '../src/frozen/manifest.ts'
import { createLensReader, LensReaderError } from '../src/lens-reader.ts'
import { bytes, jsonDriver } from './helpers.ts'
import { fromHex, hex } from '../src/frozen/bytes.ts'
import { child, endpoint, forward, lensWorld, resolver, store, type LensWorld } from './lens-world.ts'

vi.mock('../src/frozen/manifest.ts', async (actual) => ({ ...(await actual<object>()), fetchDriver: vi.fn() }))
beforeEach(() => void vi.mocked(fetchDriver).mockResolvedValue(jsonDriver))

/** A reader of the world's release, whose node is the world's transport. */
const readerOf = (w: LensWorld, timeoutMs?: number) =>
  createLensReader(
    { chainId: 'dusk:1', network: 1, contracts: [...w.release.contracts.values()], lens: w.release.manifest.lens },
    {
      nodeUrl: 'https://node.invalid',
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
      artifactBaseUrl: 'https://release.invalid/',
      fetch: (async (input: string, init: RequestInit) => {
        const [, target, fn] = /contracts:([\da-f]{64})\/(\w+)$/u.exec(input)!
        return w.transport.read(target, fn, init.body as Uint8Array).then((b) => new Response(b), (e) => new Response(String(e), { status: 500 }))
      }) as unknown as typeof fetch,
    },
  )
const outcome = (run: Promise<unknown>) =>
  run.then((value) => ({ value }), (error: unknown) => {
    if (!(error instanceof LensReaderError)) throw error
    return { reason: error.reason, message: error.message }
  })
const tamper = (w: LensWorld, change: (ok: any) => void) => {
  w.chain.lensReply = (_, reply) => {
    if (reply.Ok) change(reply.Ok)
    return reply
  }
}
const reads = {
  'resolve (records)': ['child.example.dusk', ['moonlight_address', 'avatar', 'missing']],
  'resolve (root)': ['example.dusk', ['moonlight_address']],
  'resolve (absent)': ['absent.dusk', ['moonlight_address']],
  'verifyPrimary (mapped)': [endpoint],
  'verifyPrimary (none)': [bytes(13, 96)],
} as const
type Read = keyof typeof reads
const read = (r: { resolve: Function; verifyPrimary: Function }, name: Read) =>
  name.startsWith('resolve') ? r.resolve(...reads[name]) : r.verifyPrimary(...reads[name])

describe.each([1, 4, 64])('with %i stores', (n) => {
  it('answers as the full client does through the lens, a moved root included', async () => {
    const w = await lensWorld(n)
    const compare = async () => {
      const [r, c] = [await readerOf(w), await w.client()]
      for (const name of Object.keys(reads) as Read[]) expect(await read(r, name), name).toEqual(await read(c, name))
      expect(w.fallbacks).toEqual([])
    }
    await compare()
    if (n < 2) return
    w.chain.homes.set(`${store(0)}:${hex(child.root)}`, { Forwarded: forward(child.root, w.newest, n - 1) })
    await compare()
    expect((await (await readerOf(w)).resolve('child.example.dusk')).forwards).toMatchObject([{ destination: fromHex(w.newest, 32) }])
  })
})

/** Each lens reply leaves out every store but the first, while `times` lasts: the name looks absent. */
const truncate = (w: LensWorld, times = Infinity) =>
  tamper(w, (ok) => {
    if (times-- <= 0) return
    ok.consulted.stores.splice(1)
    ok.store = ok.consulted.stores[0].id
    ok.name = 'Absent'
    ok.status = 'Absent'
    ok.records = ok.records.map(() => null)
    ok.consulted.resolvers = []
  })
const asks = (w: LensWorld) => w.log.filter((call) => call === '08.resolve').length

it('asks again for a reply without a store it saw, then takes the node at its word, as a fresh reader would', async () => {
  const w = await lensWorld(4),
    r = await readerOf(w)
  expect((await r.resolve('child.example.dusk')).status).toBe('Active')
  // Once, as a node behind a balancer might: asked again 1 s later, the whole pool answers.
  truncate(w, 1)
  w.chain.height++
  expect((await r.resolve('child.example.dusk')).status).toBe('Active')
  expect(asks(w)).toBe(1 + 2)
  // Every time: asked three more times, the node's reply is used, and later ones are held to it.
  truncate(w)
  w.chain.height++
  expect((await r.resolve('child.example.dusk')).status).toBe('Absent')
  expect(asks(w)).toBe(3 + 4)
  w.chain.height++
  expect((await r.resolve('child.example.dusk')).status).toBe('Absent')
  expect(asks(w)).toBe(7 + 1)
}, 15_000)

it('asks again for a reply below a height it answered at, then reads a node that went back at its tip', async () => {
  const w = await lensWorld(4),
    r = await readerOf(w)
  w.chain.height = 101n
  expect((await r.resolve('child.example.dusk')).height).toBe(101n)
  // A node a block behind, which catches up by the next ask.
  w.chain.height = 100n
  w.chain.onReply = (call) => void (call === '08.resolve' && (w.chain.height = 101n))
  expect((await r.resolve('child.example.dusk')).height).toBe(101n)
  expect(asks(w)).toBe(1 + 2)
  // One that went back, as after a reverted block: asked three more times, it is read at its tip, and
  // later replies are held to that.
  w.chain.onReply = undefined
  w.chain.height = 100n
  expect((await r.resolve('child.example.dusk')).height).toBe(100n)
  expect(asks(w)).toBe(3 + 4)
  expect((await r.resolve('child.example.dusk')).height).toBe(100n)
  expect(asks(w)).toBe(7 + 1)
}, 15_000)

it('asks again for a refusal below a height it answered at, and throws one at its height', async () => {
  const w = await lensWorld(4),
    r = await readerOf(w),
    refusal = (height: bigint) => ({ Refused: { code: 'ReadFailed', contract: null, cause: null, height } })
  w.chain.height = 101n
  await r.resolve('child.example.dusk')
  let refusals = 1
  w.chain.lensReply = (fn, reply) => (fn === 'resolve' && refusals-- > 0 ? refusal(100n) : reply)
  expect((await r.resolve('child.example.dusk')).height).toBe(101n)
  expect(asks(w)).toBe(1 + 2)
  w.chain.lensReply = (fn, reply) => (fn === 'resolve' ? refusal(101n) : reply)
  expect(await outcome(r.resolve('child.example.dusk'))).toEqual({ reason: 'refused', message: 'Lens resolve refused: ReadFailed' })
  expect(asks(w)).toBe(3 + 1)
  // A node that keeps refusing below: asked three more times, its refusal is thrown and taken as its
  // state, so the next refusal there is not asked for again.
  w.chain.lensReply = (fn, reply) => (fn === 'resolve' ? refusal(100n) : reply)
  expect(await outcome(r.resolve('child.example.dusk'))).toMatchObject({ reason: 'refused' })
  expect(asks(w)).toBe(4 + 4)
  expect(await outcome(r.resolve('child.example.dusk'))).toMatchObject({ reason: 'refused' })
  expect(asks(w)).toBe(8 + 1)
}, 15_000)

it('keeps nothing from a read that timed out, even when the check it waited on passes later', async () => {
  const w = await lensWorld(4),
    r = await readerOf(w, 600),
    pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
  let bindings = 0
  w.chain.onRead = async (call) => {
    if (call !== '08.binding') return
    // The first check fails to read at 400 ms; the one the joining read starts then passes at 800 ms.
    if (++bindings === 1) w.chain.replies.set('08.binding', new Error('busy'))
    else w.chain.replies.delete('08.binding')
    await pause(400)
  }
  w.chain.height = 105n
  const [first, joined] = await Promise.all([outcome(r.resolve('child.example.dusk')), outcome(r.resolve('child.example.dusk'))])
  expect(first).toMatchObject({ reason: 'read' })
  expect(joined).toEqual({ reason: 'timeout', message: 'The lens reader took over 600 ms' })
  await pause(400)
  expect(bindings).toBe(2)
  // The timed-out read's reply at 105 was never shown: a reply at 100 is no older state.
  w.chain.onRead = undefined
  w.chain.height = 100n
  expect((await r.resolve('child.example.dusk')).height).toBe(100n)
})

it('holds later replies to the height of a refusal it took, as to an answer it took', async () => {
  const w = await lensWorld(4),
    r = await readerOf(w)
  w.chain.height = 101n
  await r.resolve('child.example.dusk')
  // An older refusal through every ask: taken, at 100.
  w.chain.lensReply = (fn, reply) => (fn === 'resolve' ? { Refused: { code: 'ReadFailed', contract: null, cause: null, height: 100n } } : reply)
  expect(await outcome(r.resolve('child.example.dusk'))).toMatchObject({ reason: 'refused' })
  expect(asks(w)).toBe(1 + 4)
  // A reply below that refusal, from a node behind a balancer, is asked for again: by then it is at 100.
  w.chain.lensReply = undefined
  w.chain.height = 99n
  w.chain.onReply = (call) => void (call === '08.resolve' && (w.chain.height = 100n))
  expect((await r.resolve('child.example.dusk')).height).toBe(100n)
  expect(asks(w)).toBe(5 + 2)
  // A refusal above the floor raises it, as an answer does: a reply below it is asked for again too.
  w.chain.onReply = undefined
  w.chain.height = 103n
  w.chain.lensReply = (fn, reply) => (fn === 'resolve' ? { Refused: { code: 'ReadFailed', contract: null, cause: null, height: 103n } } : reply)
  expect(await outcome(r.resolve('child.example.dusk'))).toMatchObject({ reason: 'refused' })
  expect(asks(w)).toBe(7 + 1)
  w.chain.lensReply = undefined
  w.chain.height = 102n
  w.chain.onReply = (call) => void (call === '08.resolve' && (w.chain.height = 103n))
  expect((await r.resolve('child.example.dusk')).height).toBe(103n)
  expect(asks(w)).toBe(8 + 2)
}, 15_000)

it('takes the older answer in hand when asking for it again fails', async () => {
  const w = await lensWorld(4),
    r = await readerOf(w)
  w.chain.height = 101n
  await r.resolve('child.example.dusk')
  w.chain.height = 100n
  // Every ask after this one fails.
  w.chain.onReply = (call) => void (call === '08.resolve' && w.chain.replies.set('08.resolve', new Error('busy')))
  expect((await r.resolve('child.example.dusk')).height).toBe(100n)
  expect(asks(w)).toBe(1 + 2)
})

describe('fails closed where the full client reads directly instead', () => {
  const stores = (ok: any) => ok.consulted.stores as any[],
    resolvers = (ok: any) => ok.consulted.resolvers as any[]
  const both: Read[] = ['resolve (records)', 'verifyPrimary (mapped)']
  it.each([
    ['an admission of other code', (ok: any) => (stores(ok).at(-1).code_hash = bytes(8)), both],
    ['an admission of another init', (ok: any) => (stores(ok)[0].init_hash = bytes(8)), both],
    ['an admission at another interface version', (ok: any) => (stores(ok)[0].interface_version = 2), both],
    ['a resolver admitted as a store', (ok: any) => (stores(ok)[0].id = fromHex(resolver(0), 32)), both],
    ['a store the release does not list', (ok: any) => (stores(ok)[0].id = bytes(0x99)), both],
    ['stores out of admission order', (ok: any) => (stores(ok)[0].ordinal = 5), both],
    ['no store at all', (ok: any) => stores(ok).splice(0), both],
    ['no admission of the resolver its records were read from', (ok: any) => resolvers(ok).splice(0), both],
    ['a resolver admission of other code', (ok: any) => resolvers(ok).forEach((a) => (a.code_hash = bytes(8))), both],
    ['a record for an inactive name', (ok: any) => ok.name.Local && ((ok.name.Local.active = false), (ok.status = 'Expired')), ['resolve (records)' as Read]],
  ] as const)('%s', async (_, change, names) => {
    const w = await lensWorld(4)
    tamper(w, change)
    const r = await readerOf(w),
      c = await w.client()
    for (const name of names) {
      w.fallbacks.length = 0
      w.log.length = 0
      expect(await outcome(read(r, name)), name).toMatchObject({ reason: 'evidence' })
      // The reader sent one lens query and read nothing else; the client read the same reply, then directly.
      expect(w.log.filter((call) => !call.startsWith('08.')), name).toEqual([])
      await read(c, name)
      expect(w.fallbacks.map((f) => f.reason), name).toEqual(['evidence'])
    }
  })
})
