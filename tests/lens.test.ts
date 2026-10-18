import { describe, it, expect } from 'vitest'
import { FrozenClient, UnverifiedContractError, type ClientOptions, type LensFallbackReason, type NamePage } from '../src/frozen/client.ts'
import { bytes, driverBytes, id, release as wasmRelease } from './helpers.ts'
import { fromHex, hex, nameKey } from '../src/frozen/bytes.ts'
import { registrationCalls } from '../src/frozen/actions.ts'
import { buildCall } from '../src/frozen/calls.ts'
import { storeRenewCall } from '../src/frozen/builders.ts'
import { verifiedContract } from '../src/frozen/trust.ts'
import { fetchDriver, loadReleaseManifest, validateReleaseManifest } from '../src/frozen/manifest.ts'
import { readFileSync } from 'node:fs'
import { lensDefinitions } from '../src/frozen/lens-schema.ts'
import { definitions } from '../src/frozen/schema.ts'
import { createDuskDomainsConnectApp } from '../src/wallet/duskConnectApp.ts'
import { launchPolicyConfig } from '../src/core/pricing.ts'
import {
  H, child, endpoint, forward, lensEntry, lensId, lensWorld, ref, released, resolver, root, store,
  unadmitted, view, type LensWorld,
} from './lens-world.ts'
import type { NameView } from '../src/frozen/types.ts'

const lensCalls = (log: string[]) => log.filter((call) => call.startsWith('08.'))
const preview = (label: string) => ({ label, years: 1, actor: bytes(10) })
const registration = (label: string) => ({ actor: bytes(10), label, years: 1, secret: bytes(33), commitHeight: 100n })
const wallet = { request: async (method: string) => (method === 'dusk_chainId' ? 'dusk:1' : { median: '1' }) }
const commit = (s: string) => buildCall('store', s, 'commit', { hash: bytes(1) })
/** Every lens-backed read, as a page makes them. */
const reads = (w: LensWorld): Record<string, (c: FrozenClient) => Promise<unknown>> => ({
  'getName (hinted)': (c) => c.getName('child.example.dusk', w.newest),
  'getName (no hint)': (c) => c.getName('child.example.dusk'),
  'getName (absent)': (c) => c.getName('absent.dusk', w.newest),
  'resolve (records)': (c) => c.resolve('child.example.dusk', ['moonlight_address', 'avatar', 'missing'], w.newest),
  'resolve (root)': (c) => c.resolve('example.dusk', ['moonlight_address']),
  'resolve (absent)': (c) => c.resolve('absent.dusk', ['moonlight_address']),
  'verifyPrimary (hinted)': (c) => c.verifyPrimary(endpoint, w.newest),
  'verifyPrimary (no hint)': (c) => c.verifyPrimary(endpoint),
  'verifyPrimary (none)': (c) => c.verifyPrimary(bytes(13, 96)),
  'namePage (subname)': (c) => c.namePage('child.example.dusk', w.newest),
  'namePage (root)': (c) => c.namePage('example.dusk'),
  'namePage (absent)': (c) => c.namePage('absent.dusk'),
  'previewRegistration (unseen)': (c) => c.previewRegistration(preview('fresh')),
  pricing: (c) => c.pricing(),
  bootstrap: (c) => c.bootstrap(),
})
/** What a read returns or throws. */
/** What a read returns, or the class and message of what it throws. */
const outcome = (run: Promise<unknown>) =>
  run.then((value) => ({ value }), (error: Error) => ({ error: { class: error?.constructor?.name, message: error.message } }))

describe.each([1, 4, 64])('with %i stores', (n) => {
  it('answers every lens read as the direct reads do, with one lens query and no fallback', async () => {
    const w = await lensWorld(n)
    released(w, 'gone', 0)
    const all = {
      ...reads(w),
      'previewRegistration (released)': (c: FrozenClient) => c.previewRegistration(preview('gone')),
      'previewRegistration (registered)': (c: FrozenClient) => c.previewRegistration(preview('example')),
    }
    for (const [name, read] of Object.entries(all)) {
      const direct = await outcome(read(await w.client({ useLens: false })))
      w.log.length = 0
      const viaLens = await outcome(read(await w.client()))
      expect(viaLens, name).toEqual(direct)
      expect(lensCalls(w.log), name).toEqual(['08.binding', '08.lens_interface', expect.stringMatching(/^08\.\w+$/u)])
      expect(w.fallbacks, name).toEqual([])
    }
  })
})

describe.each([2, 4, 64])('with %i stores and a moved root', (n) => {
  it('answers a route from the old home as the direct reads do, for the name and an absent subname', async () => {
    const w = await lensWorld(n)
    // example.dusk moved from store 0 to the newest store, which holds it now.
    w.chain.homes.set(`${store(0)}:${hex(child.root)}`, { Forwarded: forward(child.root, w.newest, n - 1) })
    const all: Record<string, (c: FrozenClient) => Promise<unknown>> = {
      'getName from the old home': (c) => c.getName('child.example.dusk', store(0)),
      'getName of an absent subname': (c) => c.getName('nosub.example.dusk', store(0)),
      'resolve from the old home': (c) => c.resolve('child.example.dusk', ['avatar'], store(0)),
      'namePage of an absent subname': (c) => c.namePage('nosub.example.dusk', store(0)),
      'namePage from the old home': (c) => c.namePage('child.example.dusk', store(0)),
    }
    for (const [name, read] of Object.entries(all)) {
      const direct = await outcome(read(await w.client({ useLens: false })))
      expect(direct, name).toMatchObject({ value: { forwards: [{ destination: fromHex(w.newest, 32) }] } })
      expect(await outcome(read(await w.client())), name).toEqual(direct)
      expect(w.fallbacks, name).toEqual([])
    }
  })
})

it('passes the hint through, where it only orders the lens reads', async () => {
  const w = await lensWorld(4)
  const sent: unknown[] = []
  w.chain.lensReply = (fn, reply) => reply
  const c = await w.client()
  const { read } = w.transport
  w.transport.read = async (target, fn, data) => {
    if (target === lensId && fn !== 'binding' && fn !== 'lens_interface') sent.push(JSON.parse(new TextDecoder().decode(data)).hint)
    return read(target, fn, data)
  }
  await c.getName('child.example.dusk', w.newest)
  await c.namePage('child.example.dusk', `0x${w.newest.toUpperCase()}`)
  await c.verifyPrimary(endpoint, store(0))
  await c.getName('child.example.dusk', 'not a contract')
  expect(sent).toEqual([[...fromHex(w.newest, 32)], [...fromHex(w.newest, 32)], [...fromHex(store(0), 32)], null])
  // Each view sends its own query: with no height read, an earlier reply is not known to be the tip's.
  await c.getName('child.example.dusk')
  expect(sent).toHaveLength(5)
  w.chain.height++
  await c.getName('child.example.dusk')
  expect(sent).toHaveLength(6)
})

it('keeps the lens types apart from the frozen ones', () => {
  for (const name of Object.keys(lensDefinitions)) expect(definitions[name], name).toBeUndefined()
})

/** The admission lists a reply carries: its evidence's, or bootstrap's own. */
const storesOf = (ok: any) => (ok.consulted ?? ok).stores as any[]
const resolversOf = (ok: any) => (ok.consulted ?? ok).resolvers as any[]
const tamper = (w: LensWorld, change: (ok: any, fn: string) => void) => {
  w.chain.lensReply = (fn, reply) => {
    if (reply.Ok) change(reply.Ok, fn)
    return reply
  }
}
type Case = [string, LensFallbackReason, (w: LensWorld) => void | Promise<void>, string[]]
const everyMethod = ['getName (hinted)', 'resolve (records)', 'verifyPrimary (hinted)', 'namePage (subname)', 'previewRegistration (unseen)', 'bootstrap']
const cases: Case[] = [
  ['an admission of other code', 'evidence', (w) => tamper(w, (ok) => (storesOf(ok).at(-1).code_hash = bytes(8))), everyMethod],
  ['an admission of another init', 'evidence', (w) => tamper(w, (ok) => (storesOf(ok)[0].init_hash = bytes(8))), everyMethod],
  ['an admission at another interface version', 'evidence', (w) => tamper(w, (ok) => (storesOf(ok)[0].interface_version = 2)), everyMethod],
  ['a resolver admitted as a store', 'evidence', (w) => tamper(w, (ok) => (storesOf(ok)[0].id = fromHex(resolver(0), 32))), everyMethod],
  ['a store the release does not list', 'evidence', (w) => tamper(w, (ok) => (storesOf(ok)[0].id = bytes(0x99))), everyMethod],
  ['stores out of admission order', 'evidence', (w) => tamper(w, (ok) => (storesOf(ok)[0].ordinal = 5)), everyMethod],
  ['no store at all', 'evidence', (w) => tamper(w, (ok) => storesOf(ok).splice(0)), everyMethod],
  ['a missing resolver admission for records used', 'evidence', (w) => tamper(w, (ok) => resolversOf(ok).splice(0)),
    ['resolve (records)', 'verifyPrimary (hinted)', 'namePage (subname)']],
  ['a resolver admission of other code', 'evidence', (w) => tamper(w, (ok) => resolversOf(ok).forEach((a) => (a.code_hash = bytes(8)))),
    ['resolve (records)', 'verifyPrimary (hinted)', 'namePage (subname)', 'bootstrap']],
  ['a policy config that does not hash to its init commitment', 'evidence', (w) => tamper(w, (ok) => ok.policy && (ok.policy.config.annual_lux[0] = '1')),
    ['previewRegistration (unseen)', 'pricing']],
  ['a policy of another binding', 'evidence', (w) => tamper(w, (ok) => ok.policy && (ok.policy.binding.network = 2)),
    ['previewRegistration (unseen)', 'pricing']],
  ['a policy that is not the selection', 'evidence', (w) => tamper(w, (ok) => ok.policy && (ok.policy.policy_version = 9n)),
    ['previewRegistration (unseen)', 'pricing']],
  ['a market record of other code', 'evidence', (w) => tamper(w, (ok) => ok.market && (ok.market.market.code_hash = bytes(8))), ['bootstrap']],
  ['a home outside the evidence', 'evidence', (w) => tamper(w, (ok) => ok.store && (ok.store = bytes(0x99))),
    ['getName (hinted)', 'resolve (records)', 'namePage (subname)']],
  ['a forward to an unadmitted store', 'evidence', (w) => tamper(w, (ok) => ok.forwards?.push({
    root: child.root, destination: fromHex(unadmitted, 32), destination_ordinal: 1, move_id: bytes(10), generation: 7n, completed_at: 90n,
  })), ['getName (hinted)', 'namePage (subname)']],
  ['a status its name does not give', 'evidence', (w) => tamper(w, (ok) => ok.status && (ok.status = 'Grace')),
    ['getName (hinted)', 'resolve (records)', 'namePage (subname)']],
  ['records for other keys', 'evidence', (w) => tamper(w, (ok, fn) => fn === 'resolve' && ok.records.reverse()), ['resolve (records)']],
  ['a primary for another endpoint', 'evidence', (w) => tamper(w, (ok, fn) => {
    if (fn === 'reverse') ok.primary.record.value = bytes(13, 96)
    if (fn === 'name_page') ok.primary.verified.record.value = bytes(13, 96)
  }), ['verifyPrimary (hinted)', 'namePage (subname)']],
  ['a page that misreports its primary', 'evidence', (w) => tamper(w, (ok, fn) => fn === 'name_page' && (ok.primary.is_primary = false)), ['namePage (subname)']],
  ['renewal inputs its name does not give', 'evidence', (w) => tamper(w, (ok, fn) => fn === 'name_page' && ok.renewal && (ok.renewal.max_years = 10)), ['namePage (root)']],
  ['a quote for another request', 'evidence', (w) => tamper(w, (ok, fn) => fn === 'availability' && (ok.status.Registrable.request.label = 'other')),
    ['previewRegistration (unseen)']],
  ['a quote whose hash is not its request', 'evidence', (w) => tamper(w, (ok, fn) => fn === 'availability' && (ok.status.Registrable.quote.quote.request_hash = bytes(1))),
    ['previewRegistration (unseen)']],
  ['a refused primary on the page', 'refused', (w) => tamper(w, (ok, fn) => fn === 'name_page' && (ok.primary.refused = { code: 'MultiplePrimaries', contract: null, cause: null, height: ok.height })),
    ['namePage (subname)']],
  // A reply's height, or a refusal's, is the view's: 'a view the lens answers in one query' holds it to the tip.
  ['a reply that does not decode', 'decode', (w) => {
    w.chain.lensReply = (fn, reply) => (fn === 'binding' || fn === 'lens_interface' ? reply : { Ok: { ...reply.Ok, extra: 1 } })
  }, everyMethod],
  ['bytes that are no reply', 'decode', (w) => {
    const { read } = w.transport
    w.transport.read = async (target, fn, data) => {
      if (target !== lensId || fn === 'binding' || fn === 'lens_interface') return read(target, fn, data)
      w.log.push(`08.${fn}`)
      return new Uint8Array([0xff, 0])
    }
  }, everyMethod],
  ['a failed lens query', 'read', (w) => {
    const { read } = w.transport
    w.transport.read = async (target, fn, data) => {
      if (target !== lensId || fn === 'binding' || fn === 'lens_interface') return read(target, fn, data)
      w.log.push(`08.${fn}`)
      throw new Error('Contract read failed: unavailable')
    }
  }, everyMethod],
]
const lensErrors = [
  'InvalidName', 'InvalidArgument', 'ReadFailed', 'InvalidMembership', 'UnadmittedStore', 'InvalidForward', 'HopLimit',
  'ContractMismatch', 'InconsistentStore', 'StagedImport', 'MultipleHomes', 'ForwardNotTerminating', 'NoSuccessor',
  'NewestUnavailable', 'NewestSealed', 'LineageChanged', 'MultiplePrimaries', 'PrimarySpellingMismatch', 'UnadmittedMarket',
  'UnadmittedResolver', 'QuoteRefused', 'GasBudget',
]
for (const code of lensErrors)
  cases.push([`a ${code} refusal`, 'refused', (w) => {
    w.chain.lensReply = (fn, reply) =>
      fn === 'binding' || fn === 'lens_interface' ? reply : { Refused: { code, contract: bytes(4), cause: 'Closed', height: (reply.Ok ?? reply.Refused).height } }
  }, everyMethod])

describe.each([1, 4, 64])('with %i stores, a lens reply falls back to the direct answer on', (n) => {
  it.each(cases)('%s', async (_, reason, fault, methods) => {
    const w = await lensWorld(n)
    const all = reads(w)
    const truth: Record<string, unknown> = {}
    for (const name of methods) truth[name] = await outcome(all[name](await w.client({ useLens: false })))
    await fault(w)
    for (const name of methods) {
      w.fallbacks.length = 0
      w.log.length = 0
      expect(await outcome(all[name](await w.client())), name).toEqual(truth[name])
      // One lens query, refused or not used, then the direct reads.
      expect(lensCalls(w.log).filter((call) => !/binding|lens_interface/u.test(call)), name).toHaveLength(1)
      expect(w.fallbacks.map((f) => [f.method, f.reason]), name).toEqual([[expect.any(String), reason]])
    }
  })
})

describe('the lens deployment', () => {
  it.each([
    ['an entry without a code commitment', (w: LensWorld) => (w.release.lens!.contract = { ...lensEntry(), codeHash: undefined })],
    ['an entry without an init commitment', (w: LensWorld) => (w.release.lens!.contract = { ...lensEntry(), initHash: undefined })],
    ['an entry bound to another directory', (w: LensWorld) => (w.release.lens!.contract = { ...lensEntry(), initHash: 'cd'.repeat(32) })],
    ['a lens bound to another directory', (w: LensWorld) => w.chain.replies.set('08.binding', { directory: bytes(11), vault: bytes(2), network: 1 })],
    ['a lens bound to another vault', (w: LensWorld) => w.chain.replies.set('08.binding', { directory: bytes(1), vault: bytes(12), network: 1 })],
    ['a lens bound to another network', (w: LensWorld) => w.chain.replies.set('08.binding', { directory: bytes(1), vault: bytes(2), network: 2 })],
    ['another lens interface', (w: LensWorld) => w.chain.replies.set('08.lens_interface', { version: 2, max_stores: 64, max_hops: 63, max_record_keys: 16 })],
  ])('that fails a check is not used by this client for 10 minutes: %s', async (_, fault) => {
    const w = await lensWorld(4)
    const truth = await (await w.client({ useLens: false })).getName('child.example.dusk', w.newest)
    fault(w)
    const c = await w.client()
    for (let i = 0; i < 3; i++) {
      w.log.length = 0
      expect(await c.getName('child.example.dusk', w.newest)).toEqual({ ...truth, height: w.chain.height })
      expect(lensCalls(w.log).filter((call) => !/binding|lens_interface/u.test(call))).toEqual([])
      w.chain.height++
    }
    // Reported once, when it failed; later reads go direct without asking again.
    expect(w.fallbacks.map((f) => f.reason)).toEqual(['deployment'])
  })

  it('is checked once per client, by concurrent reads together, and again by the next call after a failed check read', async () => {
    const w = await lensWorld(4)
    const c = await w.client()
    w.chain.replies.set('08.binding', new Error('Contract read failed: unavailable'))
    expect((await c.getName('child.example.dusk', w.newest)).store).toBe(w.newest)
    expect(w.fallbacks.map((f) => f.reason)).toEqual(['deployment'])
    w.chain.replies.delete('08.binding')
    w.log.length = 0
    await Promise.all([c.getName('child.example.dusk', w.newest), c.namePage('child.example.dusk', w.newest), c.pricing()])
    expect(lensCalls(w.log).filter((call) => /binding|lens_interface/u.test(call))).toEqual(['08.binding', '08.lens_interface'])
    w.log.length = 0
    await c.bootstrap()
    expect(lensCalls(w.log)).toEqual(['08.bootstrap'])
    expect(w.fallbacks).toHaveLength(1)
  })

  it('reads through a directory this client verified, and never through one it refused', async () => {
    const w = await lensWorld(4)
    const c = new FrozenClient(w.release, { transport: w.transport, heightReuseMs: 0 })
    w.log.length = 0
    await c.getName('child.example.dusk', w.newest)
    expect(w.log.slice(0, 2)).toEqual(['01.interface_version', '01.binding'])
    // A directory the client refused stops every read, through the lens too.
    w.chain.replies.set('01.binding', { directory: bytes(11), vault: bytes(2), network: 1 })
    const refused = new FrozenClient(w.release, { transport: w.transport, heightReuseMs: 0 })
    await expect(refused.getName('child.example.dusk', w.newest)).rejects.toThrow('Contract deployment binding mismatch')
    w.log.length = 0
    await expect(refused.namePage('child.example.dusk', w.newest)).rejects.toThrow('Contract deployment binding mismatch')
    expect(lensCalls(w.log)).toEqual([])
  })
})

describe('a lens reply', () => {
  it('that crossed a block is read again at the new height, through the lens', async () => {
    const w = await lensWorld(4)
    const c = await w.client()
    await c.getName('child.example.dusk', w.newest)
    let landed = false
    w.chain.onRead = (call) => {
      if (call === '08.name_page' && !landed) {
        landed = true
        w.chain.height++
        w.chain.names.set(`${w.newest}:${hex(child.node)}`, view(child, { records: (w.chain.names.get(`${w.newest}:${hex(child.node)}`)!).name.records, expires_at: 7000n }))
      }
    }
    const page = await c.namePage('child.example.dusk', w.newest)
    expect(page.height).toBe(w.chain.height)
    expect(page.value).toMatchObject({ Local: { name: { expires_at: 7000n } } })
    expect(w.fallbacks).toEqual([])
  })

  it('never rests on a contract this client refused', async () => {
    const w = await lensWorld(4)
    const c = await w.client()
    w.chain.replies.set('40.binding', { directory: bytes(11), vault: bytes(2), network: 1 })
    await expect(c.verifyContract('store', store(0))).rejects.toThrow('Contract deployment binding mismatch')
    // Every lens reply lists store 0: the direct reads answer, here without needing it.
    expect((await c.getName('child.example.dusk', w.newest)).store).toBe(w.newest)
    expect(w.fallbacks.map((f) => [f.reason, String((f.error as Error).message)])).toEqual([
      ['evidence', `Lens evidence names store ${store(0)}, which this client refused`],
    ])
    // Where the direct reads need it, they throw its refusal, as without a lens.
    await expect(c.getName('child.example.dusk')).rejects.toThrow('Contract deployment binding mismatch')
  })

  it('is compared with the commitments this client verified a contract with', async () => {
    const w = await lensWorld(4)
    // The release carries no code hash for the newest store: only what the client read can disagree.
    w.release.contracts.set(w.newest, { ...w.release.contracts.get(w.newest)!, codeHash: undefined })
    const c = await w.client()
    await c.verifyContract('store', w.newest)
    tamper(w, (ok) => (storesOf(ok).at(-1).code_hash = bytes(8)))
    expect((await c.getName('child.example.dusk', w.newest)).store).toBe(w.newest)
    expect(w.fallbacks.map((f) => f.reason)).toEqual(['evidence'])
  })

  it('reports its fallback even when the diagnostics hook throws', async () => {
    const w = await lensWorld(4)
    const c = await w.client({ onLensFallback: () => { throw new Error('hook') } })
    tamper(w, (ok) => (storesOf(ok)[0].code_hash = bytes(8)))
    expect((await c.getName('child.example.dusk', w.newest)).store).toBe(w.newest)
    const p = await w.client({ onLensFallback: () => Promise.reject(new Error('hook')) })
    expect((await p.getName('child.example.dusk', w.newest)).store).toBe(w.newest)
  })
})

describe('signing never uses lens data', () => {
  it('a lens read verifies nothing a signature needs', async () => {
    const w = await lensWorld(4)
    const c = await w.client()
    const app = createDuskDomainsConnectApp(wallet, c.release)
    const page = await c.namePage('child.example.dusk', w.newest)
    await c.getName('child.example.dusk', w.newest)
    await c.verifyPrimary(endpoint, w.newest)
    await c.bootstrap()
    await c.pricing()
    expect(w.fallbacks).toEqual([])
    for (const contract of [page.store, store(0), resolver(0), id(3), id(6)]) expect(verifiedContract(c.release, contract)).toBeUndefined()
    const unread = await app.prepare(commit(page.store)).catch((error: unknown) => error)
    expect(unread).toBeInstanceOf(UnverifiedContractError)
    // Verified directly, it is signable, as without a lens.
    await c.verifyContract('store', page.store)
    expect((await app.prepare(commit(page.store))).contractId).toBe(page.store)
  })

  it('a lens quote is for display: it builds no registration, and registration quotes read directly', async () => {
    const w = await lensWorld(4)
    const c = await w.client()
    const shown = await c.previewRegistration(preview('fresh'))
    expect(lensCalls(w.log)).toContain('08.availability')
    expect(() => registrationCalls(shown.store, { ...registration('fresh'), commitmentStore: shown.store, quote: shown.quote })).toThrow('quote again')
    w.log.length = 0
    const prepared = await c.prepareRegistration(registration('fresh'))
    const quoted = await c.quoteRegistration(shown.store, {
      node: nameKey('fresh.dusk').node, label: 'fresh', actor: bytes(10), years: 1,
      expected_policy_version: 1n, expected_policy_config_version: launchPolicyConfig().config_version,
    })
    await c.quoteRenewal(w.newest, { name: ref, years: 1 })
    expect(lensCalls(w.log)).toEqual([])
    expect(prepared.quote.total_lux).toBe(shown.quote.total_lux)
    expect(quoted.total_lux).toBe(shown.quote.total_lux)
    const app = createDuskDomainsConnectApp(wallet, c.release)
    expect((await app.prepare(prepared.calls.reveal)).fnName).toBe('register')
  })
})

describe('without a lens', () => {
  it('a release makes the same reads, and useLens false the same as a release without one', async () => {
    const run = async (w: LensWorld, options = {}) => {
      const c = await w.client(options)
      const counts: number[] = []
      for (const read of Object.values(reads(w))) counts.push(await w.count(() => outcome(read(c))))
      return { counts, lens: lensCalls(w.log) }
    }
    const none = await run(await lensWorld(4, 3, { lens: false }))
    const off = await run(await lensWorld(4), { useLens: false })
    expect(off).toEqual(none)
    expect(none.lens).toEqual([])
  })

  it('a manifest validates as before, and takes the lens only at its top level', () => {
    const manifest = (contracts: unknown, lens?: unknown) => ({
      chainId: 'dusk:1', network: 1, nodeUrl: 'https://node.invalid', indexerUrl: 'https://indexer.invalid', contracts,
      ...(lens === undefined ? {} : { lens }),
    })
    const frozen = ['directory', 'vault', 'policy', 'store', 'resolver', 'marketplace'].map((role, i) => ({
      role, contractId: id(i + 1), dataDriver: { path: `${role}.wasm`, sha256: 'aa'.repeat(32) },
    }))
    const plain = validateReleaseManifest(manifest(frozen))
    expect('lens' in plain).toBe(false)
    const entry = { ...lensEntry(), contractId: `0x${lensId}` }
    // With or without the redundant role, as the deploy handoff's SDK entry gives it.
    for (const lens of [entry, { ...entry, role: undefined }]) {
      const m = validateReleaseManifest(manifest(frozen, lens))
      expect(m.contracts).toEqual(plain.contracts)
      expect(m.lens).toEqual({ ...lensEntry(), role: 'lens' })
      // Validating it again keeps it, as a loader does with a manifest the app validated.
      expect(validateReleaseManifest(m).lens).toEqual(m.lens)
    }
    // In `contracts`, the lens is an unknown role, as for every SDK before it.
    expect(() => validateReleaseManifest(manifest([...frozen, entry]))).toThrow('Unknown contract role lens')
    expect(() => validateReleaseManifest(manifest({ ...Object.fromEntries(frozen.map((c) => [c.role, c])), lens: entry }))).toThrow('Unknown contract role lens')
    expect(() => validateReleaseManifest(manifest(frozen, { ...entry, role: 'store' }))).toThrow('Expected the lens role')
    expect(() => validateReleaseManifest(manifest(frozen, { ...entry, contractId: id(1) }))).toThrow('Duplicate contract ID')
    expect(() => validateReleaseManifest(manifest(frozen, { ...entry, codeHash: 'xyz' }))).toThrow('Invalid contract code hash')
    expect(() => validateReleaseManifest(manifest(frozen, { ...entry, dataDriver: { path: 'lens.wasm' } }))).toThrow('Missing driver hash')
  })
})

it('loads the lens driver as every other, and refuses a driver that is not the lens\'s', async () => {
  const provenance = JSON.parse(readFileSync(new URL('fixtures/drivers.json', import.meta.url), 'utf8'))
  const serve = (role: 'store' | 'directory') => (async () => new Response(Uint8Array.from(driverBytes(role)))) as unknown as typeof fetch
  // A reviewed frozen driver, served as the lens's with its own correct digest: not the lens ABI.
  const entry = lensEntry({ dataDriver: { path: 'lens.wasm', ...provenance.store } })
  await expect(fetchDriver(entry, 'https://release.invalid/', serve('store'))).rejects.toThrow('Unsupported lens driver version')
  // Other bytes than the entry pins never instantiate.
  await expect(fetchDriver(entry, 'https://release.invalid/', serve('directory'))).rejects.toThrow('mismatch')
  // A release that lists a lens fails to load without a valid lens driver, as it would for any role.
  const r = await wasmRelease()
  const fetcher = (async (input: RequestInfo | URL) => {
    const role = /\/(\w+)\.wasm$/u.exec(String(input))![1]
    return new Response(Uint8Array.from(driverBytes((role === 'lens' ? 'store' : role) as 'store')))
  }) as unknown as typeof fetch
  await expect(loadReleaseManifest({ ...r.manifest, lens: entry }, { artifactBaseUrl: r.artifactBaseUrl, fetch: fetcher }))
    .rejects.toThrow('Unsupported lens driver version')
  const plain = await loadReleaseManifest(r.manifest, { artifactBaseUrl: r.artifactBaseUrl, fetch: fetcher })
  expect(plain.lens).toBeUndefined()
})

/** The published v1 store's code hash (`tests/fixtures/testnet-release.json`). */
const V1_STORE = 'ab7c6e22b4bda3707cee67e584b0070b158821bf404d0da37c1b6c69f84094b2'
/** Tip reads and lens queries, in order, without the lens deployment check. */
const queries = (log: string[]) => log.filter((call) => call === H || /^08\.(?!binding|lens_interface)/u.test(call))
/** A world whose root example.dusk lives at the newest store, of `storeCode`. */
async function rootWorld(lens = true, storeCode = V1_STORE) {
  const w = await lensWorld(4, 3, { lens, storeCode })
  w.chain.names.set(`${w.newest}:${hex(root.node)}`, view(root, { label: 'example', expires_at: 1000n, grace_end: 1000n + 259_200n, subname: null }))
  return w
}
const memory = () => {
  const items = new Map<string, string>()
  return { items, getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v) }
}

describe('the reads a visit makes', () => {
  const page = [H, '01.member', '43.home', '43.get_name', '43.read_records', '01.renewal_schedule', H]
  const discover = [H, '01.config', '01.members', '01.members', '40.interface_version', '40.binding', 'c0.interface_version', 'c0.binding',
    '02.interface_version', '02.binding', '01.market', '06.interface_version', '06.binding', '06.order_api_version', '01.allocation', H]
  /** Each view's reads, in order: through the lens, by a later client of the same session, and directly. */
  const pins: Record<string, [string[], string[], string[]]> = {
    'client creation': [['01.interface_version', '01.binding'], [], ['01.interface_version', '01.binding']],
    'name page': [['08.binding', '08.lens_interface', '08.name_page', '08.bootstrap'], ['08.name_page', '08.bootstrap'], [...page, ...discover]],
    home: [['08.bootstrap', '08.pricing'], ['08.bootstrap', '08.pricing'], [H, '01.config', '01.members', '01.members', '01.market',
      '01.allocation', H, H, '01.registration_context', '03.interface_version', '03.binding', '03.config', H]],
    search: [['08.availability'], ['08.availability'], [H, '01.registration_context', '03.config', '01.member', '43.quote_registration', H]],
    'reverse lookup': [['08.reverse'], ['08.reverse'], [H, '01.member', '43.resolve_primary', '43.home', '43.get_name', '43.resolve_record', H]],
  }
  async function visit(w: LensWorld, options: ClientOptions) {
    w.log.length = 0
    const c = new FrozenClient(w.release, { transport: w.transport, heightReuseMs: 0, ...options })
    await c.verifyContract('directory', id(1))
    const reads: Record<string, string[]> = { 'client creation': [...w.log] }
    const views: Record<string, () => Promise<unknown>> = {
      // The name, its records and primary, its renewal price, and the market the page offers into.
      'name page': async () => {
        await c.previewRenewal(await c.namePage('example.dusk', w.newest), 1)
        await c.bootstrap()
      },
      home: async () => {
        await c.bootstrap()
        await c.pricing()
      },
      search: () => c.previewRegistration(preview('fresh')),
      'reverse lookup': () => c.verifyPrimary(endpoint, w.newest),
    }
    for (const [name, run] of Object.entries(views)) {
      w.chain.height++
      w.log.length = 0
      await run()
      reads[name] = [...w.log]
    }
    return reads
  }
  it('makes exactly these: one lens query a view and no tip read, the deployment checked once a session', async () => {
    const column = (i: number) => Object.fromEntries(Object.entries(pins).map(([name, reads]) => [name, reads[i]]))
    const w = await rootWorld(),
      verificationCache = memory()
    expect(await visit(w, { verificationCache })).toEqual(column(0))
    expect(await visit(w, { verificationCache })).toEqual(column(1))
    expect(await visit(await rootWorld(false), {})).toEqual(column(2))
    expect(await visit(await rootWorld(), { useLens: false })).toEqual(column(2))
    expect(w.fallbacks).toEqual([])
  })
})

describe('a view the lens answers in one query', () => {
  /** The lens answers as though its node were `by()` blocks behind; the tip reads are not. */
  const lag = (w: LensWorld, by: () => bigint) => {
    w.chain.lensReply = (fn, reply) => {
      if (fn === 'binding' || fn === 'lens_interface') return reply
      const behind = by()
      if (reply.Ok) reply.Ok.height -= behind
      if (reply.Refused) reply.Refused.height -= behind
      return reply
    }
  }
  it('is held to the highest height the client saw, from a tip read or a reply: below it, it is read again between tip reads', async () => {
    const w = await lensWorld(4)
    const c = await w.client()
    // A tip read at 105, then a reply a block behind once: read again between tip reads, at 105.
    w.chain.height = 105n
    await c.directory.config()
    let once = true
    lag(w, () => (once ? ((once = false), 1n) : 0n))
    w.log.length = 0
    expect((await c.getName('child.example.dusk', w.newest)).height).toBe(105n)
    expect(queries(w.log)).toEqual(['08.resolve', H, '08.resolve', H])
    // A reply it used, at 110, is the floor too. A lens that stays behind it reads directly, and strikes nothing.
    w.chain.height = 110n
    w.log.length = 0
    await c.getName('child.example.dusk', w.newest)
    expect(w.log).toEqual(['08.resolve'])
    lag(w, () => 1n)
    for (let i = 0; i < 4; i++) expect((await c.getName('child.example.dusk', w.newest)).height).toBe(110n)
    expect(w.fallbacks.map((f) => [f.reason, f.disabled])).toEqual(Array(4).fill(['height', false]))
    // The node itself a block back, as after a reorganisation: its tip is read, and answered at (documented residual).
    w.chain.lensReply = undefined
    w.chain.height = 109n
    w.log.length = 0
    expect((await c.getName('child.example.dusk', w.newest)).height).toBe(109n)
    expect(w.log).toEqual(['08.resolve', H, '08.resolve', H])
  })

  it('reads a request the lens refused at the highest height seen between tip reads, and directly while the tip is there', async () => {
    const w = await lensWorld(4)
    const c = await w.client()
    w.chain.lensReply = (fn, reply) => (reply.Ok ? { Refused: { code: 'StagedImport', contract: null, cause: null, height: reply.Ok.height } } : reply)
    await c.getName('child.example.dusk', w.newest)
    w.log.length = 0
    await c.getName('child.example.dusk', w.newest)
    expect(lensCalls(w.log)).toEqual([])
    // At a new block: asked again between tip reads, then in one query once seen past the refusal.
    w.chain.height++
    w.chain.lensReply = undefined
    w.log.length = 0
    await c.getName('child.example.dusk', w.newest)
    await c.getName('child.example.dusk', w.newest)
    expect(w.log).toEqual([H, '08.resolve', H, '08.resolve'])
    expect(w.fallbacks.map((f) => f.reason)).toEqual(['refused', 'refused'])
  })

  it.each([false, true])(
    'returns the state at the height it reports, never above the tip nor below what was seen, under random delays and blocks (lagging lens %s)',
    async (lagging) => {
      // Seeded: every read waits a random number of turns before the node answers and again in transit;
      // blocks land on their own schedule; the name's expiry is its height. A lagging lens answers a block
      // behind, at times.
      let seed = 20261018 + Number(lagging)
      const random = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32
      const sleep = async () => {
        for (let turns = Math.floor(random() * 8); turns > 0; turns--) await null
      }
      const w = await lensWorld(4)
      const c = await w.client()
      const state = (height: bigint): NameView =>
        view(child, { records: w.chain.names.get(`${w.newest}:${hex(child.node)}`)!.name.records, expires_at: 1000n + height })
      const set = () => w.chain.names.set(`${w.newest}:${hex(child.node)}`, state(w.chain.height))
      set()
      w.chain.onRead = w.chain.onReply = w.chain.onHeight = sleep
      if (lagging)
        w.chain.lensReply = (fn, reply) => {
          if (fn !== 'resolve' || !reply.Ok || random() < 0.5) return reply
          reply.Ok.height -= 1n
          reply.Ok.name = { Local: state(reply.Ok.height) }
          return reply
        }
      let running = true
      const blocks = (async () => {
        while (running) {
          for (let turns = 30 + Math.floor(random() * 120); turns > 0 && running; turns--) await null
          w.chain.height++
          set()
        }
      })()
      let seen = 0n,
        calls = 0,
        crossed = 0
      const heights = new Set<bigint>()
      try {
        for (let round = 0; round < 12; round++)
          await Promise.all(
            Array.from({ length: 8 }, async (_, i) => {
              // A multi-read view beside them, whose tip reads raise what the client saw.
              if (i % 4 === 3) return void (await c.directory.config().catch(() => undefined))
              const floor = seen,
                start = w.chain.height
              calls++
              try {
                const r = await c.getName('child.example.dusk', w.newest)
                expect((r.value as { Local: NameView }).Local.name.expires_at).toBe(1000n + r.height)
                expect(r.height <= w.chain.height && r.height >= floor && (lagging || r.height >= start)).toBe(true)
                if (r.height > seen) seen = r.height
                heights.add(r.height)
              } catch (error) {
                // Read again between tip reads, or directly, a view can cross blocks three times.
                expect((error as Error).message).toBe('Chain tip changed during read; retry the snapshot')
                crossed++
              }
            }),
          )
      } finally {
        running = false
        await blocks
      }
      // Most views took one query; one below what the client saw by its arrival was read again.
      const sent = w.log.filter((call) => call === '08.resolve').length
      expect(calls).toBe(72)
      expect(crossed).toBeLessThan(calls / 4)
      expect(sent >= calls - crossed && sent < calls * 2 && (!lagging || sent > calls)).toBe(true)
      expect(w.fallbacks.every((f) => f.reason === 'height' && !f.disabled)).toBe(true)
      expect(heights.size).toBeGreaterThan(3)
    },
    60_000,
  )
})

describe('a block replaced at the same height', () => {
  /** Block A's state is the expiry 1000, block B's 2000: B replaces A at 105 once a name_page reply left A. */
  async function replaced() {
    const w = await lensWorld(4)
    const at = (fork: number) => {
      w.chain.fork = fork
      const records = w.chain.names.get(`${w.newest}:${hex(child.node)}`)!.name.records
      w.chain.names.set(`${w.newest}:${hex(child.node)}`, view(child, { records, expires_at: fork ? 2000n : 1000n }))
    }
    w.chain.height = 105n
    at(0)
    const cache = memory()
    const c = await w.client({ verificationCache: cache })
    w.chain.onReply = (call) => void (call === '08.name_page' && w.chain.fork === 0 && at(1))
    w.log.length = 0
    return { w, c, cache, page: await c.namePage('child.example.dusk', w.newest) }
  }
  const expiry = (p: { value: unknown }) => (p.value as { Local: NameView }).Local.name.expires_at

  it('shows a one-query view the block its query read and the next one the new block, and keeps nothing of the first (documented residual)', async () => {
    const { w, c, cache, page } = await replaced()
    expect([page.height, expiry(page)]).toEqual([105n, 1000n])
    w.log.length = 0
    expect(expiry(await c.namePage('child.example.dusk', w.newest))).toBe(2000n)
    expect(w.log).toEqual(['08.name_page'])
    // Direct reads read the new block; the session cache holds the lens's facts and health, never a reply.
    expect((await c.getName('child.example.dusk', w.newest)).value).toMatchObject({ Local: { name: { expires_at: 2000n } } })
    expect(cache.items.size).toBeGreaterThan(0)
    for (const value of cache.items.values()) expect(value).not.toMatch(/expires_at|"Local"|records/u)
  })
})

describe('previewRenewal', () => {
  /** Whether running it read the chain: a price computed from its page reads nothing. */
  const quoted = async (w: LensWorld, run: () => Promise<unknown>) => {
    w.log.length = 0
    await run().catch(() => undefined)
    return w.log.includes(H)
  }

  it('prices a v1 root from a page this client returned with no read, and quotes anything else directly', async () => {
    const w = await rootWorld()
    const c = await w.client()
    const page = await c.namePage('example.dusk', w.newest)
    expect(page.renewal?.max_years).toBe(9)
    for (let years = 1; years <= 9; years++) {
      w.log.length = 0
      expect(await c.previewRenewal(page, years)).toMatchObject({ store: w.newest, height: page.height, value: { Local: { schedule_version: 3n } } })
      expect(w.log).toEqual([])
    }
    // Edited after it was returned: priced from what the client returned.
    const three = await c.previewRenewal(page, 3)
    ;(page.value as { Local: NameView }).Local.name.expires_at = 5n
    expect(await c.previewRenewal(page, 3)).toEqual(three)
    // Past the horizon, a copy, another client's page, a page made by hand, a subname: the store quotes.
    const other = await (await w.client()).namePage('example.dusk', w.newest)
    for (const [what, p, years] of [['10 years', page, 10], ['a copy', structuredClone(page), 1], ['another client\'s', other, 1],
      ['by hand', { ...page }, 1], ['a subname', await c.namePage('child.example.dusk', w.newest), 1]] as const)
      expect(await quoted(w, () => c.previewRenewal(p as NamePage, years)), what).toBe(true)
    // A move pending, which may be finalizing; a home of another store code.
    w.chain.names.set(`${w.newest}:${hex(root.node)}`, { ...w.chain.names.get(`${w.newest}:${hex(root.node)}`)!, move_pending: bytes(3) })
    const moving = await c.namePage('example.dusk', w.newest)
    expect(await quoted(w, () => c.previewRenewal(moving, 1))).toBe(true)
    const v = await rootWorld(true, 'ee'.repeat(32)),
      d = await v.client()
    const elsewhere = await d.namePage('example.dusk', v.newest)
    expect(await quoted(v, () => d.previewRenewal(elsewhere, 1))).toBe(true)
    // A home the client refused since its page: its refusal.
    const u = await rootWorld(),
      e = await u.client()
    const shown = await e.namePage('example.dusk', u.newest)
    u.chain.stores[3] = { ...u.chain.stores[3], code_hash: bytes(8) }
    await expect(e.verifyContract('store', u.newest)).rejects.toThrow('Admission artifact/version mismatch')
    await expect(e.previewRenewal(shown, 1)).rejects.toThrow('Admission artifact/version mismatch')
  })

  it('never reaches a builder: every builder refuses what it returns, computed or quoted; a direct quote builds', async () => {
    const w = await rootWorld()
    const c = await w.client()
    const page = await c.namePage('example.dusk', w.newest)
    const shown = await c.previewRenewal(page, 1),
      fromStore = await c.previewRenewal(structuredClone(page), 1)
    const q = (shown.value as { Local: { schedule_version: bigint; total_lux: string } }).Local
    const name = { key: root, incarnation: (page.value as { Local: NameView }).Local.name.incarnation }
    const renew = { name, years: 1, expected_schedule_version: q.schedule_version, expected_fee_lux: q.total_lux, valid_until: 200n }
    for (const held of [shown, shown.value, q, fromStore])
      expect(() => storeRenewCall(page.store, { ...renew, quote: held } as never)).toThrow('A display quote is not evidence for a signed call')
    // A direct quote builds, and so do values copied out of a preview: the caller's, as from any read.
    expect((await c.quoteRenewal(page.store, { name, years: 1 })).store).toBe(page.store)
    expect(storeRenewCall(page.store, renew).deposit).toBe(q.total_lux)
  })
})
