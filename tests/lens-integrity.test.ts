import { describe, it, expect, vi } from 'vitest'
import { FrozenClient, createClientFromManifest } from '../src/frozen/client.ts'
import { bytes, driverBytes, fixtures, id, jsonDriver, policyInitHash, release as wasmRelease } from './helpers.ts'
import { authority, fromHex, hex, nameKey } from '../src/frozen/bytes.ts'
import { launchPolicyConfig } from '../src/core/pricing.ts'
import { setAcceptsMovesProposalCall, setRecipientProposalCall, setRetiringProposalCall } from '../src/frozen/actions.ts'
import { directoryProposeCall } from '../src/frozen/builders.ts'
import { buildCall } from '../src/frozen/calls.ts'
import { createMarketplaceCalls } from '../src/frozen/actions.ts'
import { loadReleaseManifest } from '../src/frozen/manifest.ts'
import { child, endpoint, forward, lensEntry, lensWorld, ref, released, store, view, type LensWorld } from './lens-world.ts'

const lensCalls = (log: string[]) => log.filter((call) => /^08\.(?!binding|lens_interface)/u.test(call))
const preview = (label: string) => ({ label, years: 1, actor: bytes(10) })
const outcome = (run: Promise<unknown>) =>
  run.then((value) => ({ value }), (error: Error) => ({ error: { class: error?.constructor?.name, message: error.message } }))
const tamper = (w: LensWorld, change: (ok: any, fn: string) => void) => {
  w.chain.lensReply = (fn, reply) => {
    if (reply.Ok) change(reply.Ok, fn)
    return reply
  }
}
/** The direct answer, then the lens client's, with what it reported. */
async function both(w: LensWorld, read: (c: FrozenClient) => Promise<unknown>, lensClient?: FrozenClient) {
  const direct = await outcome(read(await w.client({ useLens: false })))
  w.fallbacks.length = 0
  const viaLens = await outcome(read(lensClient ?? (await w.client())))
  return { direct, viaLens, reasons: w.fallbacks.map((f) => f.reason) }
}

describe('a reply that leaves out stores', () => {
  // Only store 0: the name, which lives at the newest store, would be absent.
  const truncate = (w: LensWorld) => tamper(w, (ok) => {
    const stores = ok.consulted?.stores ?? ok.stores
    stores.splice(1)
    if (ok.store) ok.store = stores[0].id
    if (ok.name) ok.name = 'Absent'
    if (ok.status) ok.status = 'Absent'
    if (ok.records && Array.isArray(ok.records)) ok.records = ok.records.map(() => null)
    if (ok.consulted) ok.consulted.resolvers = []
  })
  // Each a read of the stores from ordinal 0; a single admission alone is below.
  const sights: [string, (c: FrozenClient, w: LensWorld) => Promise<unknown>][] = [
    ['a lens reply', (c, w) => c.verifyPrimary(endpoint, w.newest)],
    ['a public members read', (c) => c.directory.members({ kind: 'Store', start: 0, limit: 16 })],
    ['a generic directory read', (c) => c.read('directory', id(1), 'members', { kind: 'Store', start: 0, limit: 16 })],
    ['a routed store read that scans the pool', (c) => c.store(store(0)).read_records(child)],
    ['discover()', (c) => c.discover()],
  ]
  it.each(sights)('is refused once this client saw them in %s, without a strike', async (_, sight) => {
    const w = await lensWorld(4)
    const c = await w.client()
    await sight(c, w)
    truncate(w)
    for (let i = 0; i < 4; i++) {
      w.chain.height++
      const r = await both(w, (x) => x.getName('child.example.dusk', w.newest), c)
      expect(r.viaLens).toEqual(r.direct)
      expect(r.reasons).toEqual(['evidence'])
    }
    // Never a strike: the method is still asked.
    expect(w.fallbacks.every((f) => !f.disabled)).toBe(true)
  })

  it('keeps only what a committed snapshot saw, and holds a reply only to what was seen at or below its height', async () => {
    const w = await lensWorld(4)
    const c = await w.client()
    // Every attempt crosses a block: the snapshot never commits, so what it read is not kept.
    w.chain.onRead = (call) => {
      if (call === '01.members') w.chain.height++
    }
    await expect(c.directory.members({ kind: 'Store', start: 0, limit: 16 })).rejects.toThrow('Chain tip changed')
    w.chain.onRead = undefined
    truncate(w)
    w.chain.height++
    expect((await both(w, (x) => x.getName('child.example.dusk', w.newest), c)).reasons).toEqual([])
    // Seen at this height, the store binds replies here and above, not a reply from an older tip.
    w.chain.lensReply = undefined
    const seenAt = w.chain.height
    await c.directory.members({ kind: 'Store', start: 0, limit: 16 })
    truncate(w)
    w.chain.height = seenAt - 1n
    expect((await both(w, (x) => x.getName('child.example.dusk', w.newest), c)).reasons).toEqual([])
    w.chain.height = seenAt + 1n
    expect((await both(w, (x) => x.getName('child.example.dusk', w.newest), c)).reasons).toEqual(['evidence'])
  })

  it('is not held to a single admission no member list showed: one excessive ordinal poisons nothing', async () => {
    const w = await lensWorld(4)
    const c = await w.client()
    // A node answers a member read with an ordinal no store has.
    w.chain.replies.set('01.member', { ...w.chain.stores[3], ordinal: 63 })
    await c.directory.member({ kind: 'Store', id: fromHex(w.newest, 32) })
    w.chain.replies.delete('01.member')
    for (let i = 0; i < 3; i++) {
      w.chain.height++
      const r = await both(w, (x) => x.getName('child.example.dusk', w.newest), c)
      expect(r.viaLens).toEqual(r.direct)
      expect(r.reasons).toEqual([])
    }
    // Read beside the member list, the same answer would extend the mark.
    w.chain.replies.set('01.member', { ...w.chain.stores[3], ordinal: 5 })
    await c.read('directory', id(1), 'members', { kind: 'Store', start: 0, limit: 16 })
    expect((await both(w, (x) => x.getName('child.example.dusk', w.newest), c)).reasons).toEqual([])
    w.chain.replies.delete('01.member')
  })

  it('cannot be told from a complete one by a client that has seen no more stores (documented residual)', async () => {
    const w = await lensWorld(4)
    tamper(w, (ok) => {
      ok.consulted.stores.splice(1)
      ok.store = ok.consulted.stores[0].id
      ok.name = 'Absent'
      ok.status = 'Absent'
    })
    const fresh = await both(w, (x) => x.getName('child.example.dusk', w.newest))
    expect(fresh.reasons).toEqual([])
    expect(fresh.viaLens).not.toEqual(fresh.direct)
  })
})

describe('the lens checks what its evidence allows', () => {
  it('refuses a route with no start admission below its first hop', async () => {
    const w = await lensWorld(4)
    tamper(w, (ok) => ok.forwards?.splice(0, 0, forward(child.root, store(0), 0)))
    const r = await both(w, (c) => c.getName('child.example.dusk', w.newest))
    expect(r.viaLens).toEqual(r.direct)
    expect(r.reasons).toEqual(['evidence'])
  })

  it('refuses a record for a name without a record slot', async () => {
    const w = await lensWorld(4)
    tamper(w, (ok, fn) => {
      if (fn === 'resolve' && ok.name.Local) ok.name.Local.name.records = null
      if (fn === 'resolve') ok.consulted.resolvers = []
      if (fn === 'name_page' && ok.name.Local) {
        ok.name.Local.name.records = null
        ok.records.pointer = null
      }
    })
    for (const read of [
      (c: FrozenClient) => c.resolve('child.example.dusk', ['moonlight_address'], w.newest),
      (c: FrozenClient) => c.namePage('child.example.dusk', w.newest),
    ]) {
      const r = await both(w, read)
      expect(r.viaLens).toEqual(r.direct)
      expect(r.reasons).toEqual(['evidence'])
    }
  })

  it('refuses a page whose own primary is stale or no longer held, and cannot check another name\'s (documented residual)', async () => {
    for (const stale of [
      // A fresh object: the page's name and its primary share their incarnation's.
      (ok: any) => (ok.primary.verified.primary.primary.name.incarnation = { generation: 7n, serial: 1n }),
      (ok: any) => (ok.name.Local.name.owner = bytes(77)),
      (ok: any) => (ok.name.Local.name.expires_at = ok.height),
    ]) {
      const w = await lensWorld(4)
      tamper(w, (ok, fn) => fn === 'name_page' && stale(ok))
      const r = await both(w, (c) => c.namePage('child.example.dusk', w.newest))
      expect(r.viaLens).toEqual(r.direct)
      expect(r.reasons).toEqual(['evidence'])
    }
    // reverse carries no name view: a stale incarnation the lens reports verified is not detectable.
    const w = await lensWorld(4)
    tamper(w, (ok, fn) => fn === 'reverse' && ok.primary && (ok.primary.primary.primary.name.incarnation = { generation: 7n, serial: 1n }))
    const r = await both(w, (c) => c.verifyPrimary(endpoint, w.newest))
    expect(r.reasons).toEqual([])
    expect(r.viaLens).not.toEqual(r.direct)
  })

  it('cannot check a renewal schedule changed together with its inputs (documented residual)', async () => {
    const w = await lensWorld(4)
    tamper(w, (ok, fn) => {
      if (fn !== 'name_page' || !ok.renewal) return
      ok.renewal.schedule.annual_lux = ['9', '9', '9', '9', '9']
      ok.renewal.annual_lux = '9'
    })
    const r = await both(w, (c) => c.namePage('example.dusk'))
    expect(r.reasons).toEqual([])
    expect(r.viaLens).not.toEqual(r.direct)
  })

  it('refuses another release policy than the selection this client read, and cannot tell it apart otherwise (documented residual)', async () => {
    const w = await lensWorld(4)
    // The release lists a second policy, as after a governance SetPolicy, with the launch config.
    const other = id(9)
    w.release.contracts.set(other, { ...w.release.contracts.get(id(3))!, contractId: other })
    w.release.drivers.set(other, jsonDriver)
    tamper(w, (ok) => {
      if (!ok.policy) return
      ok.context.policy = fromHex(other, 32)
      ok.policy.policy = fromHex(other, 32)
    })
    // A client that quoted directly read the selection at version 1: the lens's other answer is refused.
    const c = await w.client()
    await c.quoteRegistration(w.newest, {
      node: nameKey('fresh.dusk').node, label: 'fresh', actor: bytes(10), years: 1,
      expected_policy_version: 1n, expected_policy_config_version: launchPolicyConfig().config_version,
    })
    const known = await both(w, (x) => x.pricing(), c)
    expect(known.viaLens).toEqual(known.direct)
    expect(known.reasons).toEqual(['evidence'])
    const fresh = await both(w, (x) => x.pricing())
    expect(fresh.reasons).toEqual([])
    expect(fresh.viaLens).not.toEqual(fresh.direct)
    expect(policyInitHash(jsonDriver, launchPolicyConfig())).toBe(w.release.contracts.get(other)!.initHash)
  })

  it('refuses a forged allocation', async () => {
    for (const forge of [
      (ok: any) => (ok.allocation.newest_store = ok.stores[0].id),
      (ok: any) => (ok.allocation.newest_resolver = ok.resolvers[0].id),
      (ok: any) => (ok.allocation.version = 9n),
    ]) {
      const w = await lensWorld(4)
      tamper(w, (ok, fn) => fn === 'bootstrap' && forge(ok))
      const r = await both(w, (c) => c.bootstrap())
      expect(r.viaLens).toEqual(r.direct)
      expect(r.reasons).toEqual(['evidence'])
    }
  })

  it('refuses a registration or quote that is not this root\'s', async () => {
    const cases: [string, (w: LensWorld) => void, string][] = [
      ['another name reported registered', (w) => {
        const other = view(nameKey('other.dusk'), { label: 'other' })
        tamper(w, (ok, fn) => fn === 'availability' && (ok.status = { Registered: { store: fromHex(w.newest, 32), name: other } }))
      }, 'fresh'],
      ['a registration past its grace end', (w) => tamper(w, (ok, fn) => fn === 'availability' && ok.status.Registered && (ok.status.Registered.name.name.grace_end = ok.height)), 'example'],
      ['another total', (w) => tamper(w, (ok, fn) => fn === 'availability' && ok.status.Registrable && (ok.status.Registrable.quote.total_lux = '1')), 'fresh'],
      ['another price with a consistent total', (w) => tamper(w, (ok, fn) => {
        if (fn !== 'availability' || !ok.status.Registrable) return
        const q = ok.status.Registrable.quote
        q.quote.base_lux = '1'
        q.total_lux = (1n + BigInt(q.quote.premium_lux)).toString()
      }), 'fresh'],
      ['an unseen root placed at an older store', (w) => tamper(w, (ok, fn) => {
        if (fn !== 'availability' || !ok.status.Registrable) return
        ok.status.Registrable.placement.store = fromHex(store(0), 32)
      }), 'fresh'],
      ['a released root with no previous lineage', (w) => {
        released(w, 'gone', 1)
        tamper(w, (ok, fn) => {
          if (fn !== 'availability' || !ok.status.Registrable) return
          ok.status.Registrable.request.previous_generation = 0n
          ok.status.Registrable.request.previous_grace_end = null
        })
      }, 'gone'],
    ]
    for (const [name, fault, label] of cases) {
      const w = await lensWorld(4)
      fault(w)
      const r = await both(w, (c) => c.previewRegistration(preview(label)))
      expect(r.viaLens, name).toEqual(r.direct)
      expect(r.reasons, name).toEqual(['evidence'])
    }
  })
})

describe('a lens that keeps failing a method', () => {
  it('is not asked for it again after three decode or evidence failures without an answer in between', async () => {
    const w = await lensWorld(4)
    const c = await w.client()
    tamper(w, (ok, fn) => fn === 'resolve' && (ok.consulted.stores[0].code_hash = bytes(8)))
    for (let i = 0; i < 3; i++) await c.getName('child.example.dusk', w.newest)
    expect(w.fallbacks.map((f) => [f.reason, f.disabled])).toEqual([['evidence', false], ['evidence', false], ['evidence', true]])
    w.log.length = 0
    expect((await c.getName('child.example.dusk', w.newest)).store).toBe(w.newest)
    expect(await c.resolve('child.example.dusk', ['avatar'], w.newest)).toMatchObject({ records: [{ key: 'avatar' }] })
    expect(lensCalls(w.log)).toEqual([])
    // Other methods still read through it.
    await c.namePage('child.example.dusk', w.newest)
    expect(lensCalls(w.log)).toEqual(['08.name_page'])
    expect(w.fallbacks).toHaveLength(3)
  })

  it('keeps asking after refusals, and after failures an answer interrupts', async () => {
    const w = await lensWorld(4)
    const c = await w.client()
    const refuse = (code: string) => {
      w.chain.lensReply = (fn, reply) => (reply.Ok ? { Refused: { code, contract: null, cause: null, height: reply.Ok.height } } : reply)
    }
    refuse('StagedImport')
    for (let i = 0; i < 5; i++) {
      w.chain.height++
      await c.getName('child.example.dusk', w.newest)
    }
    let bad = true
    w.chain.lensReply = (fn, reply) => {
      if (reply.Ok && bad) reply.Ok.consulted.stores[0].code_hash = bytes(8)
      return reply
    }
    for (const fails of [true, true, false, true, true]) {
      bad = fails
      w.chain.height++
      await c.getName('child.example.dusk', w.newest)
    }
    expect(w.fallbacks.every((f) => !f.disabled)).toBe(true)
    w.chain.lensReply = undefined
    w.chain.height++
    w.log.length = 0
    await c.getName('child.example.dusk', w.newest)
    expect(lensCalls(w.log)).toEqual(['08.resolve'])
  })

  it('keeps a refusal inside a reply, a page\'s primary, as it keeps the reply\'s own', async () => {
    const w = await lensWorld(4)
    const { currentBlock: _, ...heightOnly } = w.transport
    const c = new FrozenClient(w.release, { transport: heightOnly, heightReuseMs: 0, onLensFallback: (f) => void w.fallbacks.push(f) })
    await c.verifyContract('directory', id(1))
    tamper(w, (ok, fn) => fn === 'name_page' && (ok.primary.refused = { code: 'GasBudget', contract: null, cause: null, height: ok.height }))
    const ask = async (run: () => Promise<unknown>) => {
      w.log.length = 0
      await run()
      return lensCalls(w.log)
    }
    const now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    try {
      expect(await ask(() => c.namePage('child.example.dusk', w.newest))).toEqual(['08.name_page'])
      // The same request at this height, then any page for 30 s: read directly.
      expect(await ask(() => c.namePage('child.example.dusk', w.newest))).toEqual([])
      w.chain.height++
      expect(await ask(() => c.namePage('example.dusk'))).toEqual([])
      clock.mockReturnValue(now + 30_001)
      expect(await ask(() => c.namePage('example.dusk'))).toEqual(['08.name_page'])
    } finally {
      clock.mockRestore()
    }
    expect(w.fallbacks[0]).toMatchObject({ method: 'namePage', reason: 'refused', disabled: false })
  })

  it('reads a request it refused at this height directly, and backs a method off after it ran short of resources', async () => {
    const w = await lensWorld(4)
    const c = await w.client()
    const refuse = (code: string) => {
      w.chain.lensReply = (fn, reply) => (reply.Ok ? { Refused: { code, contract: null, cause: null, height: reply.Ok.height } } : reply)
    }
    // A semantic refusal: the same request at the same height is not sent again; another is. By
    // height alone, with no reuse window, no answered read is shared: only the refusal is kept.
    const { currentBlock: _, ...heightOnly } = w.transport
    const h = new FrozenClient(w.release, { transport: heightOnly, heightReuseMs: 0, onLensFallback: (f) => void w.fallbacks.push(f) })
    await h.verifyContract('directory', id(1))
    refuse('StagedImport')
    w.log.length = 0
    await h.getName('child.example.dusk', w.newest)
    await h.getName('child.example.dusk', w.newest)
    expect(lensCalls(w.log)).toEqual(['08.resolve'])
    w.fallbacks.length = 0
    const ask = async (run: () => Promise<unknown>) => {
      w.log.length = 0
      await run()
      return lensCalls(w.log)
    }
    expect(await ask(() => c.getName('child.example.dusk', w.newest))).toEqual(['08.resolve'])
    expect(await ask(() => c.getName('child.example.dusk', w.newest))).toEqual([])
    expect(await ask(() => c.getName('example.dusk', w.newest))).toEqual(['08.resolve'])
    w.chain.height++
    expect(await ask(() => c.getName('child.example.dusk', w.newest))).toEqual(['08.resolve'])
    expect(w.fallbacks.map((f) => f.reason)).toEqual(['refused', 'refused', 'refused', 'refused'])
    // A resource refusal: the method reads directly for 30 s, whatever the request.
    const now = Date.now()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
    try {
      refuse('GasBudget')
      w.chain.height++
      expect(await ask(() => c.getName('child.example.dusk', w.newest))).toEqual(['08.resolve'])
      w.chain.height++
      expect(await ask(() => c.getName('example.dusk', w.newest))).toEqual([])
      expect(await ask(() => c.namePage('child.example.dusk', w.newest))).toEqual(['08.name_page'])
      clock.mockReturnValue(now + 30_001)
      w.chain.lensReply = undefined
      expect(await ask(() => c.getName('example.dusk', w.newest))).toEqual(['08.resolve'])
    } finally {
      clock.mockRestore()
    }
  })
})

describe('a lens bootstrap', () => {
  it('feeds no signed call at any depth, through any builder, and a direct one does', async () => {
    const w = await lensWorld(4)
    const viaLens = await (await w.client()).bootstrap()
    const direct = await (await w.client({ useLens: false })).bootstrap()
    expect(viaLens).toEqual(direct)
    const actions = (b: typeof viaLens) => ({
      AddStore: { AddStore: { expected_allocation_version: b.allocation.version, admission: b.stores[1] } },
      SetRenewal: { SetRenewal: { expected_version: b.config.renewal.version, annual_lux: b.config.renewal.annual_lux, referral_bps: 10 } },
      SetRetiring: { SetRetiring: { store: b.stores[1].id, expected_version: b.stores[1].governance_version, value: true } },
      // A value nested deep in the config.
      SetRecipient: { SetRecipient: { expected_operator_epoch: 1n, expected_recipient_version: 1n, recipient: b.config.operator.recipient } },
    })
    for (const [name, action] of Object.entries(actions(viaLens))) {
      expect(() => directoryProposeCall(id(1), { action } as never), name).toThrow('A lens bootstrap reply is not evidence for a signed call')
      expect(() => buildCall('directory', id(1), 'propose', { action } as never), name).toThrow('A lens bootstrap reply is not evidence for a signed call')
    }
    expect(() => setRetiringProposalCall(id(1), viaLens.stores[1], true)).toThrow('directly (not through the lens)')
    expect(() => setAcceptsMovesProposalCall(id(1), viaLens.stores[1], true)).toThrow('directly (not through the lens)')
    expect(() => setRecipientProposalCall(id(1), viaLens.config, endpoint)).toThrow('directly (not through the lens)')
    for (const [name, action] of Object.entries(actions(direct)))
      expect(directoryProposeCall(id(1), { action } as never).functionName, name).toBe('propose')
    expect(setRetiringProposalCall(id(1), direct.stores[1], true).functionName).toBe('propose')
    // Before any copy the SDK makes: a registration and marketplace orders.
    const c = await w.client()
    await expect(c.prepareRegistration({
      actor: bytes(10), label: 'fresh', years: 1, secret: bytes(33), commitHeight: 100n, referrer: viaLens.config.guardian,
    })).rejects.toThrow('A lens bootstrap reply is not evidence for a signed call')
    const market = createMarketplaceCalls(id(6), id(1), jsonDriver)
    const order = structuredClone(fixtures('market-v1')['input:cancel_order'].json) as { terms: { directory: number[] } }
    order.terms.directory = viaLens.config.binding.directory
    expect(() => market.cancel(order as never)).toThrow('A lens bootstrap reply is not evidence for a signed call')
    // Copied primitives carry no brand (documented residual).
    const copied = { SetRetiring: { store: [...viaLens.stores[1].id], expected_version: viaLens.stores[1].governance_version, value: true } }
    expect(directoryProposeCall(id(1), { action: copied } as never).functionName).toBe('propose')
  })
})

describe('an optional lens', () => {
  const serve = (lens: (url: string) => Promise<Response>) => (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/lens.wasm')) return lens(url)
    return new Response(Uint8Array.from(driverBytes(/\/(\w+)\.wasm$/u.exec(url)![1] as 'store')))
  }) as unknown as typeof fetch
  const load = async (entry: unknown, lens: (url: string) => Promise<Response>, options = {}) => {
    const r = await wasmRelease()
    let fetched = 0
    const f = serve(async (url) => {
      fetched++
      return lens(url)
    })
    const loaded = await loadReleaseManifest({ ...r.manifest, lens: entry }, { artifactBaseUrl: r.artifactBaseUrl, fetch: f, ...options })
    return { loaded, fetched }
  }
  const unreachable = async (): Promise<Response> => {
    throw new TypeError('fetch failed')
  }

  it('is never fetched when it is off or has no commitments', async () => {
    const off = await load(lensEntry(), unreachable, { useLens: false })
    expect(off).toMatchObject({ fetched: 0 })
    expect(off.loaded.lens).toBeUndefined()
    expect(off.loaded.lensError).toBeUndefined()
    for (const entry of [lensEntry({ codeHash: undefined }), lensEntry({ initHash: undefined })]) {
      const uncommitted = await load(entry, unreachable)
      expect(uncommitted.fetched).toBe(0)
      expect(uncommitted.loaded.lens).toBeUndefined()
      expect((uncommitted.loaded.lensError as Error).message).toBe('The release lens has no code or init commitment')
    }
  })

  it('whose driver cannot be fetched is left out, and the client reads directly and says so once', async () => {
    for (const lens of [unreachable, async () => new Response('missing', { status: 404 })]) {
      const { loaded, fetched } = await load(lensEntry(), lens)
      expect(fetched).toBe(1)
      expect(loaded.lens).toBeUndefined()
      expect(loaded.lensError).toBeInstanceOf(Error)
    }
    // A client over such a release: reported once, as turning the lens off, then direct reads only.
    const w = await lensWorld(4)
    w.release.lensError = new TypeError('fetch failed')
    delete w.release.lens
    const c = await w.client()
    for (let i = 0; i < 3; i++) expect((await c.getName('child.example.dusk', w.newest)).store).toBe(w.newest)
    expect(w.fallbacks.map((f) => [f.method, f.reason, f.disabled])).toEqual([['getName', 'deployment', true]])
    expect(lensCalls(w.log)).toEqual([])
  })

  it('whose driver bytes are not the pinned ones fails the release, as for every driver', async () => {
    const entry = lensEntry({ dataDriver: { path: 'lens.wasm', sha256: 'ab'.repeat(32) } })
    await expect(load(entry, async () => new Response(Uint8Array.from([0, 1, 2])))).rejects.toThrow('Driver sha256 mismatch')
  })

  it('off, makes a client from a manifest whose lens cannot load', async () => {
    const r = await wasmRelease()
    const f = serve(unreachable)
    const client = await createClientFromManifest(
      { ...r.manifest, lens: lensEntry() },
      { artifactBaseUrl: r.artifactBaseUrl, fetch: f, useLens: false, transport: { currentBlockHeight: async () => 1n, read: async () => Uint8Array.from([1]) } },
    ).catch((error: unknown) => error)
    // The directory check fails on this stub transport; what matters is that the lens did not stop it first.
    expect(String(client)).not.toContain('fetch failed')
  })
})

void [authority, hex, ref]

describe('registration through the lens', () => {
  it('quotes only what the store would let register: no stop flag, registration open, not denied', async () => {
    for (const [name, close] of [
      ['operator paused', (ok: any) => (ok.context.operator_paused = true)],
      ['guardian suspended', (ok: any) => (ok.context.guardian_suspended = true)],
      ['registration closed', (ok: any) => (ok.status.Registrable.quote.quote.registration_open = false)],
      ['a denied label', (ok: any) => (ok.status.Registrable.quote.quote.label_status = 'Denied')],
    ] as const) {
      const w = await lensWorld(4)
      tamper(w, (ok, fn) => fn === 'availability' && ok.status.Registrable && close(ok))
      const r = await both(w, (c) => c.previewRegistration(preview('fresh')))
      expect(r.viaLens, name).toEqual(r.direct)
      expect(r.reasons, name).toEqual(['evidence'])
    }
  })

  it('reads directly, without a strike, under a policy whose pricing this SDK does not know', async () => {
    const w = await lensWorld(4)
    // A governance SetPolicy selected a replacement policy the manifest lists, of other code.
    const replacement = id(9)
    w.release.contracts.set(replacement, { ...w.release.contracts.get(id(3))!, contractId: replacement, codeHash: 'ee'.repeat(32) })
    w.release.drivers.set(replacement, jsonDriver)
    w.chain.policy = fromHex(replacement, 32)
    w.chain.policyVersion = 2n
    const c = await w.client()
    for (let i = 0; i < 4; i++) {
      w.chain.height++
      for (const read of [(x: FrozenClient) => x.previewRegistration(preview('fresh')), (x: FrozenClient) => x.pricing()]) {
        const r = await both(w, read, c)
        expect(r.viaLens).toEqual(r.direct)
        expect(r.reasons).toEqual(['unsupported'])
      }
    }
    expect(w.fallbacks.every((f) => !f.disabled)).toBe(true)
  })

  it('holds a lens reply to the selection this client read directly', async () => {
    let w: LensWorld
    for (const read of [
      (c: FrozenClient) => c.directory.registration_context(),
      (c: FrozenClient) => c.directory.config(),
      async (c: FrozenClient) => {
        // pricing() through the lens refused: its direct read is the observation.
        const { lensReply } = w.chain
        w.chain.lensReply = (fn, reply) => (fn === 'pricing' && reply.Ok ? { Refused: { code: 'StagedImport', contract: null, cause: null, height: reply.Ok.height } } : reply)
        await c.pricing()
        w.chain.lensReply = lensReply
      },
    ]) {
      w = await lensWorld(4)
      const other = id(9)
      w.release.contracts.set(other, { ...w.release.contracts.get(id(3))!, contractId: other })
      w.release.drivers.set(other, jsonDriver)
      const c = await w.client()
      await read(c)
      tamper(w, (ok) => {
        if (!ok.policy) return
        ok.context.policy = fromHex(other, 32)
        ok.policy.policy = fromHex(other, 32)
      })
      w.chain.height++
      const r = await both(w, (x) => x.pricing(), c)
      expect(r.viaLens).toEqual(r.direct)
      expect(r.reasons).toEqual(['evidence'])
    }
  })
})
