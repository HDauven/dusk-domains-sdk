import { it, expect } from 'vitest'
import type { FrozenClient } from '../src/frozen/client.ts'
import { bytes } from './helpers.ts'
import { child, endpoint, lensWorld, ref, type LensWorld } from './lens-world.ts'

const sizes = [1, 4, 64] as const
type Mode = 'lens' | 'refusing' | 'none'
/** A world whose lens answers, refuses every read, or that has no lens. */
async function world(n: number, mode: Mode): Promise<LensWorld> {
  const w = await lensWorld(n, n, { lens: mode !== 'none' })
  if (mode === 'refusing')
    w.chain.lensReply = (fn, reply) =>
      fn === 'binding' || fn === 'lens_interface' ? reply : { Refused: { code: 'GasBudget', contract: null, cause: null, height: reply.Ok.height } }
  return w
}
/** The calls a first visit makes, from client creation on, with each step's share. */
async function visit(w: LensWorld, hint: boolean, reuse: boolean, steps: Record<string, (c: FrozenClient, hint?: string) => Promise<unknown>>) {
  w.chain.height++
  w.log.length = 0
  const c = await w.client(reuse ? { heightReuseMs: Infinity } : {})
  const counts: Record<string, number> = { 'client creation': w.log.length }
  for (const [name, step] of Object.entries(steps)) {
    const before = w.log.length
    await step(c, hint ? w.newest : undefined)
    counts[name] = w.log.length - before
  }
  counts.total = w.log.length
  return counts
}
const visitor = {
  home: (c: FrozenClient) => Promise.all([c.bootstrap(), c.pricing()]),
  'name page': (c: FrozenClient, hint?: string) => c.namePage('child.example.dusk', hint),
  'reverse lookup': (c: FrozenClient, hint?: string) => c.verifyPrimary(endpoint, hint),
  availability: (c: FrozenClient) => c.previewRegistration({ label: 'fresh', years: 1, actor: bytes(10) }),
}
/** 0.4.0's name page as the frontend makes it, each step reading the name first (store-scaling.test.ts). */
const composedPage = {
  'name page': async (c: FrozenClient, hint?: string) => {
    const name = () => c.getName('child.example.dusk', hint)
    const address = { key: child, record_key: 'moonlight_address' }
    await Promise.all([
      name(),
      (async () => c.locate((await name()).store, child.root, 'read_records', child))(),
      (async () => c.locate((await name()).store, child.root, 'resolve_record', address))(),
      (async () => {
        await c.locate((await name()).store, child.root, 'resolve_record', address)
        return c.verifyPrimary(endpoint, hint)
      })(),
      (async () => c.quoteRenewal((await name()).store, { name: ref, years: 1 }))(),
      (async () => {
        await name()
        return c.directory.config()
      })(),
    ])
  },
}

const visits: [number, boolean, boolean, Mode, number[]][] = []
// [stores, hint, height reuse, lens]: client creation, home, name page, reverse lookup, availability.
for (const n of sizes)
  for (const hint of [true, false]) {
    const scan = !hint && n > 1
    // Without a hint, the direct reads ask every store for the name and the primary.
    const direct = (reuse: boolean) => [2, n === 64 ? 28 : 22, (scan ? (n === 64 ? 70 : 10) : 7) - (reuse ? 1 : 0),
      (scan ? (n === 64 ? 65 : 5) : 1) - (reuse && scan ? 1 : 0), reuse ? 2 : 3]
    for (const reuse of [false, true]) {
      visits.push([n, hint, reuse, 'lens', reuse ? [2, 6, 2, 2, 2] : [2, 6, 3, 3, 3]])
      visits.push([n, hint, reuse, 'none', direct(reuse)])
      // Every fallback costs its lens query, and without height reuse a height read; the deployment
      // check is read once.
      const d = direct(reuse)
      visits.push([n, hint, reuse, 'refusing', reuse ? [2, d[1] + 4, d[2] + 1, d[3] + 1, d[4] + 1] : [2, d[1] + 5, d[2] + 2, d[3] + 2, d[4] + 2]])
    }
  }
it.each(visits)('a first visit at %i stores (hint %s, height reuse %s, lens %s) makes these reads', async (n, hint, reuse, mode, expected) => {
  const counts = await visit(await world(n, mode), hint, reuse, visitor)
  expect(Object.values(counts)).toEqual([...expected, expected.reduce((a, b) => a + b)])
})

it.each(sizes)('creates a client and loads a name page with one lens query at any number of stores (%i)', async (n) => {
  for (const hint of [true, false]) {
    // As 0.4.0 measured its page: a client as createClientFromManifest makes one, then the page, with
    // every snapshot opening at a height read that already arrived.
    const lens = await visit(await world(n, 'lens'), hint, true, { 'name page': visitor['name page'] })
    // The directory's interface and binding, the lens's binding and interface once, then the page:
    // a height read, the lens query and the closing height read.
    expect(lens).toEqual({ 'client creation': 2, 'name page': 5, total: 7 })
    const before = await visit(await world(n, 'none'), hint, true, composedPage)
    // 0.4.0's page, as store-scaling.test.ts pins it.
    const pages = Math.ceil(n / 16)
    expect(before.total).toBe(hint ? 15 + (n === 1 ? 2 : 0) : 14 + pages + 2 * n)
  }
})

it('reads the lens deployment once per client, never at client creation', async () => {
  const w = await world(4, 'lens')
  w.log.length = 0
  const c = await w.client()
  expect(w.log).toEqual(['01.interface_version', '01.binding'])
  w.log.length = 0
  await c.namePage('child.example.dusk', w.newest)
  expect(w.log).toEqual(['08.binding', '08.lens_interface', 'height', '08.name_page', 'height'])
  w.chain.height++
  w.log.length = 0
  await c.verifyPrimary(endpoint, w.newest)
  expect(w.log).toEqual(['height', '08.reverse', 'height'])
})
