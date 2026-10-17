import { it, expect } from 'vitest'
import {
  ContractRefusedError,
  FrozenClient,
  UnverifiedContractError,
  createClientFromManifest,
  type ClientOptions,
} from '../src/frozen/client.ts'
import { parseJson, stringifyJson } from '../src/frozen/json.ts'
import { authority, fromHex, hex, nameKey } from '../src/frozen/bytes.ts'
import { estimateRegistrationQuote, launchPolicyConfig } from '../src/core/pricing.ts'
import { registrationCalls } from '../src/frozen/actions.ts'
import { buildCall } from '../src/frozen/calls.ts'
import { createDuskDomainsConnectApp } from '../src/wallet/duskConnectApp.ts'
import { bytes, driverBytes, id, jsonRelease, release as wasmRelease, sample, verificationTransport } from './helpers.ts'
import type { ReadTransport } from '../src/frozen/transport.ts'
import type { LoadedRelease } from '../src/frozen/manifest.ts'
import type { Admission, Forward, Home, NameKey, NameView, PrimaryView } from '../src/frozen/types.ts'

const encode = (v: unknown) => new TextEncoder().encode(stringifyJson(v))
const decode = (b: Uint8Array) => parseJson(new TextDecoder().decode(b)) as Record<string, any>
// Fixture rows, parsed once: `sample` reads the whole fixture file on every call.
const samples = {
  Admission: sample('Admission'),
  NameView: sample('NameView'),
  RegistrationContext: sample('RegistrationContext'),
  DirectoryConfig: sample('DirectoryConfig'),
  Market: sample('Market'),
  Capacity: sample('Capacity'),
}
const H = 'height'
const child = nameKey('child.example.dusk')
const endpoint = bytes(12, 96)
const incarnation = { generation: 7n, serial: 2n }
const ref = { key: child, incarnation }
/**
 * Store `i` has ordinal `i`, as resolver `j` has `j`: ordinal 0 is the directory's init's, every other
 * one an AddStore's or AddResolver's. Store 4 is in the release but never admitted.
 */
const store = (i: number) => id(0x40 + i)
const resolver = (j: number) => id(0xc0 + j)
const unadmitted = id(4)
const kinds: Record<number, string> = { 1: 'Directory', 2: 'Vault', 3: 'Policy', 6: 'Marketplace' }
/** The reads that check a contract's interface and binding on chain. */
const probes = (calls: string[]) => calls.filter((call) => /\.(interface_version|binding)$/u.test(call))
const admission = (contract: string, ordinal: number): Admission => ({
  ...samples.Admission, id: fromHex(contract, 32), ordinal, interface_version: 1, admitted_at: 1n, retiring: false,
})
const forward = (root: number[], to: string, ordinal: number): Forward => ({
  root, destination: fromHex(to, 32), destination_ordinal: ordinal, move_id: bytes(10), generation: 7n, completed_at: 90n,
})
function view(k: NameKey, change: Partial<NameView['name']> = {}): NameView {
  const v = structuredClone(samples.NameView)
  v.name = {
    ...v.name, key: k, label: 'child', incarnation, expires_at: 1000n, grace_end: 2000n,
    owner: authority({ kind: 'Moonlight', bytes: endpoint }), ...change,
  }
  v.active = true
  v.move_pending = null
  return v
}
const isForward = (h: unknown): h is { Forwarded: Forward } => typeof h === 'object' && h !== null && 'Forwarded' in h
const isStaged = (h: unknown) => typeof h === 'object' && h !== null && 'Staged' in h

/**
 * `n` admitted stores and `r` resolvers, with the directory, vault, policy and marketplace, answering
 * as the frozen contracts do. child.example.dusk lives at the newest store, with a primary there.
 * `quote_registration` checks placement as the store contract does: at the canonical non-retiring
 * home, or, for a root no store holds, at the newest store only. The policy and the preferred
 * marketplace are the directory's init's (version 1) until a test selects others.
 */
async function scaled(n: number, r = 3) {
  const base = await jsonRelease()
  const release: LoadedRelease = {
    ...base, manifest: structuredClone(base.manifest), contracts: new Map(base.contracts), drivers: new Map(base.drivers),
  }
  const ids = [
    ...Array.from({ length: n }, (_, i) => [store(i), id(4)]),
    ...Array.from({ length: r }, (_, j) => [resolver(j), id(5)]),
  ]
  for (const [contract, template] of ids) {
    release.contracts.set(contract, { ...release.contracts.get(template)!, contractId: contract })
    release.drivers.set(contract, release.drivers.get(id(4))!)
  }
  const newest = store(n - 1)
  const chain = {
    height: 100n,
    stores: Array.from({ length: n }, (_, i) => admission(store(i), i)),
    resolvers: Array.from({ length: r }, (_, j) => admission(resolver(j), j)),
    /** The directory's policy version: past 1, a SetPolicy selected the policy. */
    policyVersion: 1n,
    /** The marketplace's record version: past 1, a SetMarketplace wrote it. */
    marketVersion: 1n,
    /** The directory's market version: past 1, a SetPreferredMarketplace selected the preferred one. */
    preferredVersion: 1n,
    homes: new Map<string, Home>([[`${newest}:${hex(child.root)}`, 'Local']]),
    // The active root example.dusk and its subname child.example.dusk.
    names: new Map<string, NameView>([
      [`${newest}:${hex(child.root)}`, view({ root: child.root, node: child.root }, { label: 'example' })],
      [`${newest}:${hex(child.node)}`, view(child)],
    ]),
    primaries: new Map<string, PrimaryView>([[newest, {
      primary: { endpoint, name: ref, mapping_id: 22n, updated_at: 90n }, spelling: 'child.example.dusk',
    }]]),
    replies: new Map<string, unknown>(),
    onRead: undefined as undefined | ((call: string) => void | Promise<void>),
  }
  const log: string[] = []
  const home = (s: string, root: number[]) => chain.homes.get(`${s}:${hex(root)}`) ?? 'Absent'
  const located = (s: string, root: number[], local: () => unknown) => {
    const h = home(s, root)
    return isForward(h) ? h : h === 'Local' ? local() : 'Absent'
  }
  const context = () => ({
    ...samples.RegistrationContext, policy: bytes(3), policy_version: chain.policyVersion, operator_paused: false,
    guardian_suspended: false, newest_store: chain.stores.at(-1)!.id,
  })
  const trap = (target: string, code: string) => new Error(`Contract read failed (${target}.quote_registration): ${code}`)
  // The store's own placement check (entrypoints/paid.rs), for the cases these tests use.
  const quote = (target: string, args: Record<string, any>) => {
    const root: number[] = args.node,
      here = home(target, root),
      self = chain.stores.find((a) => hex(a.id) === target)!
    let previous: NameView | undefined
    if (here === 'Local') {
      if (self.retiring) return trap(target, 'WrongHome')
      previous = chain.names.get(`${target}:${hex(args.node)}`)
      if (previous && chain.height < previous.name.grace_end) return trap(target, 'NotAvailable')
    } else if (isForward(here)) return trap(target, 'Moved')
    else if (isStaged(here)) return trap(target, 'WrongHome')
    else {
      const others = chain.stores.map((a) => (hex(a.id) === target ? 'Absent' : home(hex(a.id), root)))
      if (others.some(isStaged) || !others.every((h) => h === 'Absent') || chain.stores.at(-1) !== self)
        return trap(target, 'WrongHome')
    }
    const { estimate, total_lux, ...q } = estimateRegistrationQuote(launchPolicyConfig(), {
      version: 1, directory: bytes(1), store: fromHex(target, 32), node: args.node, label: args.label,
      actor: args.actor, years: args.years, height: chain.height,
      previous_generation: previous?.name.incarnation.generation ?? 0n,
      previous_grace_end: previous ? previous.name.grace_end : null, policy_version: chain.policyVersion,
    })
    void estimate
    return { policy: bytes(3), policy_version: chain.policyVersion, quote: q, total_lux, height: chain.height }
  }
  const answer = (target: string, fn: string, args: Record<string, any>): unknown => {
    const t = Number.parseInt(target.slice(0, 2), 16),
      isStore = t === 4 || (t >= 0x40 && t < 0x80),
      isResolver = t >= 0xc0
    if (fn === 'interface_version')
      return {
        kind: isStore ? 'Store' : isResolver ? 'Resolver' : kinds[t], version: 1,
        move_version: isStore ? 1 : 0, custody_version: isStore || t === 6 ? 1 : 0,
      }
    if (fn === 'binding') return { directory: bytes(1), vault: bytes(2), network: 1 }
    if (fn === 'order_api_version') return 1
    if (t === 1) {
      const rows = args.kind === 'Store' ? chain.stores : chain.resolvers
      if (fn === 'config')
        return {
          ...samples.DirectoryConfig, binding: { directory: bytes(1), vault: bytes(2), network: 1 },
          store_count: chain.stores.length, resolver_count: chain.resolvers.length, registration: context(),
          preferred_marketplace: bytes(6), market_version: chain.preferredVersion,
        }
      if (fn === 'members')
        return { rows: rows.slice(args.start, args.start + args.limit), next: args.start + args.limit < rows.length ? args.start + args.limit : null }
      if (fn === 'member') return rows.find((a) => hex(a.id) === hex(args.id)) ?? null
      if (fn === 'market')
        return hex(args.id) === id(6)
          ? { ...samples.Market, id: bytes(6), interface_version: 1, state: 'Listed', version: chain.marketVersion }
          : null
      if (fn === 'registration_context') return context()
      if (fn === 'allocation') return { version: 1n, newest_store: chain.stores.at(-1)!.id, newest_resolver: chain.resolvers.at(-1)!.id }
    }
    if (t === 3 && fn === 'config') return launchPolicyConfig()
    if (isStore) {
      if (fn === 'home') return home(target, args.root)
      if (fn === 'get_name')
        return located(target, args.root, () => {
          const v = chain.names.get(`${target}:${hex(args.node)}`)
          return v ? { Local: v } : 'Absent'
        })
      if (fn === 'read_records') return located(target, args.root, () => ({ Local: { pointer: null, records: [] } }))
      if (fn === 'resolve_record')
        return located(target, args.key.root, () => ({
          Local: { key: 'moonlight_address', value: endpoint, ttl_seconds: 3600n, updated_at: 90n },
        }))
      if (fn === 'quote_renewal')
        return located(target, args.name.key.root, () => ({
          Local: { schedule_version: 3n, total_lux: '123', referral_lux: '12', new_expiry: 2000n, new_grace_end: 3000n },
        }))
      if (fn === 'resolve_primary') return chain.primaries.get(target) ?? null
      if (fn === 'capacity') return { ...samples.Capacity, sealed: false }
      if (fn === 'stats') return sample('StoreStats')
      if (fn === 'quote_registration') return quote(target, args)
    }
    throw new Error(`Unexpected read ${target}.${fn}`)
  }
  // As the default HTTP transport reads it: the tip's height and block hash in one request.
  const transport: ReadTransport = {
    currentBlock: async () => {
      log.push(H)
      return { height: chain.height, hash: `${chain.height}` }
    },
    currentBlockHeight: async () => {
      log.push(H)
      return chain.height
    },
    namespace: 'scaled',
    read: async (target, fn, data) => {
      const call = `${target.slice(0, 2)}.${fn}`
      log.push(call)
      await chain.onRead?.(call)
      const reply = chain.replies.has(call) ? chain.replies.get(call) : answer(target, fn, decode(data) ?? {})
      if (reply instanceof Error) throw reply
      return encode(reply)
    },
  }
  /**
   * A client as `createClientFromManifest` makes one: the directory verified, nothing else. Each
   * snapshot reads its own height (`heightReuseMs: 0`), so counts do not depend on timing.
   */
  const client = async (options: ClientOptions = {}) => {
    const c = new FrozenClient(release, { transport, heightReuseMs: 0, ...options })
    await c.verifyContract('directory', id(1))
    return c
  }
  /** The calls `run` makes, at a height none of them was read at. */
  const count = async (run: () => Promise<unknown>) => {
    chain.height++
    log.length = 0
    await run()
    return log.length
  }
  return { chain, release, log, transport, client, count, newest }
}
type Scaled = Awaited<ReturnType<typeof scaled>>
const registration = (label: string) => ({ actor: bytes(10), label, years: 1, secret: bytes(33), commitHeight: 100n })
const preview = (label: string) => ({ label, years: 1, actor: bytes(10) })
/** A root released at store `i`: registered once, past its grace end now. */
function released(w: Scaled, label: string, i = 0): NameKey {
  const k = nameKey(`${label}.dusk`)
  w.chain.homes.set(`${store(i)}:${hex(k.root)}`, 'Local')
  w.chain.names.set(`${store(i)}:${hex(k.node)}`, view(k, { label, expires_at: 40n, grace_end: 50n }))
  return k
}
const pages = (n: number) => Math.ceil(n / 16)
const sizes = [1, 4, 16, 64] as const

it.each(sizes)('reads a hinted name, its records, renewal and primary with the same calls at any number of stores (%i)', async (n) => {
  const w = await scaled(n)
  const ops: Record<string, (c: FrozenClient) => Promise<unknown>> = {
    getName: (c) => c.getName('child.example.dusk', w.newest),
    locate: (c) => c.locate(w.newest, child.root, 'read_records', child),
    'store().read_records': (c) => c.store(w.newest).read_records(child),
    quoteRenewal: (c) => c.quoteRenewal(w.newest, { name: ref, years: 1 }),
    verifyPrimary: (c) => c.verifyPrimary(endpoint, w.newest),
  }
  const cold: Record<string, number> = {},
    warm: Record<string, number> = {}
  for (const [name, op] of Object.entries(ops)) {
    const c = await w.client()
    cold[name] = await w.count(() => op(c))
    warm[name] = await w.count(() => op(c))
  }
  // Each read is the store's admission and the name's state. The first through a store the directory
  // probed reads nothing more; through the init's store, the only one when n is 1, it also reads that
  // store's interface and binding, once.
  const verified = n === 1 ? 2 : 0
  expect(cold).toEqual({
    getName: 5 + verified, locate: 5 + verified, 'store().read_records': 5 + verified,
    quoteRenewal: 5 + verified, verifyPrimary: 7 + verified,
  })
  expect(warm).toEqual({ getName: 5, locate: 5, 'store().read_records': 5, quoteRenewal: 5, verifyPrimary: 7 })
  // The exact calls: one admission, never a membership page or another store.
  const c = await w.client()
  await c.getName('child.example.dusk', w.newest)
  w.chain.height++
  w.log.length = 0
  await c.getName('child.example.dusk', w.newest)
  const s = w.newest.slice(0, 2)
  expect(w.log).toEqual([H, '01.member', `${s}.home`, `${s}.get_name`, H])
  // The indexer's `homeShard` is 0x-prefixed hex: the same hint.
  w.chain.height++
  w.log.length = 0
  await c.getName('child.example.dusk', `0x${w.newest.toUpperCase()}`)
  expect(w.log).toEqual([H, '01.member', `${s}.home`, `${s}.get_name`, H])
})

it.each(sizes)('bootstraps and previews a registration with the same calls at any number of stores (%i)', async (n) => {
  const w = await scaled(n)
  // createClientFromManifest: the directory only.
  w.log.length = 0
  const c = await w.client()
  expect(w.log).toEqual(['01.interface_version', '01.binding'])
  // An unseen root: the newest store's own placement check proves no store holds it. The first preview
  // also verifies the init's policy, and the newest store when it is the init's.
  expect(await w.count(() => c.previewRegistration(preview('fresh')))).toBe(n === 1 ? 11 : 9)
  expect(await w.count(() => c.previewRegistration(preview('fresh')))).toBe(6)
  // A released root at store 0, hinted: quoted at its home.
  released(w, 'gone', 0)
  const h = await w.client()
  expect(await w.count(() => h.previewRegistration(preview('gone'), store(0)))).toBe(12)
  expect(await w.count(() => h.previewRegistration(preview('gone'), store(0)))).toBe(7)
})

it.each(sizes)('scans every store where only every store can answer, as before (%i)', async (n) => {
  const w = await scaled(n)
  const p = pages(n)
  const rows: Record<string, [number, number]> = {}
  const twice = async (name: string, op: (c: FrozenClient) => Promise<unknown>) => {
    const c = await w.client()
    rows[name] = [await w.count(() => op(c)), await w.count(() => op(c))]
  }
  await twice('getName without a hint', (c) => c.getName('child.example.dusk'))
  await twice('getName of an unregistered name', (c) => c.getName('absent.dusk'))
  await twice('verifyPrimary without a hint', (c) => c.verifyPrimary(endpoint))
  await twice('registrationPlacement', (c) => c.registrationPlacement(nameKey('fresh.dusk').root))
  await twice('prepareRegistration', (c) => c.prepareRegistration(registration('fresh')))
  await twice('discover', (c) => c.discover())
  // The first time, each also reads the init's store's interface and binding: the only store the
  // directory did not probe.
  expect(rows).toEqual({
    // Every home in admission order until the name's.
    'getName without a hint': [5 + p + n, 3 + p + n],
    // Every home, then the newest store from the allocation.
    'getName of an unregistered name': [5 + p + n, 3 + p + n],
    // Every store's resolved primary: pool uniqueness needs them all.
    'verifyPrimary without a hint': [7 + p + n, 5 + p + n],
    // Signing needs every home to place a root and prove an unseen one is held nowhere.
    registrationPlacement: [5 + p + n, 3 + p + n],
    // Also the init's policy, verified once.
    prepareRegistration: [11 + p + n, 6 + p + n],
    // Membership pages, then the interface and binding of the init's store, resolver and the vault,
    // and the init's marketplace with its order API: whatever the number of stores.
    discover: [14 + p, 5 + p],
  })
})

it.each(sizes)('pays one admission for a wrong hint, then reads as without one (%i)', async (n) => {
  const w = await scaled(n)
  const p = pages(n)
  const c = await w.client()
  await c.getName('child.example.dusk')
  // An admission the directory does not have: one read, then the scan.
  expect(await w.count(() => c.getName('child.example.dusk', unadmitted))).toBe(4 + p + n)
  // A malformed hint costs nothing.
  expect(await w.count(() => c.getName('child.example.dusk', 'not a contract'))).toBe(3 + p + n)
  if (n > 1) {
    // An admitted store that does not hold the root: its admission and home, then the scan.
    expect(await w.count(() => c.getName('child.example.dusk', store(0)))).toBe(4 + p + n)
  }
})

it.each([4, 16, 64])('follows a moved name from its old home with one admission per hop (%i)', async (n) => {
  const w = await scaled(n)
  w.chain.homes.set(`${store(0)}:${hex(child.root)}`, { Forwarded: forward(child.root, w.newest, n - 1) })
  const c = await w.client()
  await c.getName('child.example.dusk', store(0))
  w.chain.height++
  w.log.length = 0
  const moved = await c.getName('child.example.dusk', store(0))
  expect(moved).toMatchObject({ store: w.newest, value: { Local: { name: { label: 'child' } } } })
  expect(moved.forwards.map((f) => hex(f.destination))).toEqual([w.newest])
  const s = w.newest.slice(0, 2)
  expect(w.log).toEqual([H, '01.member', '40.home', '01.member', `${s}.home`, `${s}.get_name`, H])
})

it.each([1, 4, 64])('gives every hint the result no hint gives: a wrong or lying one only costs reads (%i)', async (n) => {
  const w = await scaled(n)
  const truth = await (await w.client()).getName('child.example.dusk')
  const same = (r: { store: string; value: unknown; height: bigint }) => ({ store: r.store, value: r.value, height: r.height })
  const hints = [w.newest, unadmitted, id(0x99), 'not a contract', '', store(0)]
  for (const hint of hints)
    expect(same(await (await w.client()).getName('child.example.dusk', hint)), hint).toEqual(same(truth))
  // Absent everywhere: every hint gives the newest store and Absent, as no hint does.
  const none = await (await w.client()).getName('absent.dusk')
  for (const hint of hints) expect(same(await (await w.client()).getName('absent.dusk', hint)), hint).toEqual(same(none))
  // A primary hinted at the wrong store, or at no store at all, verifies as without the hint.
  const primary = await (await w.client()).verifyPrimary(endpoint)
  expect(primary).toMatchObject({ store: w.newest })
  for (const hint of hints) expect(await (await w.client()).verifyPrimary(endpoint, hint), hint).toEqual(primary)
  // Located reads that start at the wrong store reach the name's home.
  for (const start of [store(0), unadmitted]) {
    const c = await w.client()
    expect(await c.locate(start, child.root, 'read_records', child)).toMatchObject({ store: w.newest, value: { Local: { records: [] } } })
    expect((await c.quoteRenewal(start, { name: ref, years: 1 })).store).toBe(w.newest)
    expect(await c.store(start).read_records(child)).toEqual({ Local: { pointer: null, records: [] } })
  }
  // A store that forwards a root it never held, to a lower ordinal: the scan rejects it too, before
  // reaching the name's home, so a hint naming it fails as no hint does.
  if (n > 1) {
    w.chain.homes.set(`${store(1)}:${hex(child.root)}`, { Forwarded: forward(child.root, store(0), 0) })
    for (const hint of [store(1), undefined])
      await expect((await w.client()).getName('child.example.dusk', hint)).rejects.toThrow('Non-monotone or invalid shard forwarding')
    // The name's own home still answers a hint that leads straight to it.
    expect(same(await (await w.client()).getName('child.example.dusk', w.newest))).toEqual(same(truth))
  }
})

it('follows each route once when looking for a root no store holds', async () => {
  const w = await scaled(4)
  // A root that moved from store to store and is held by none now: every store forwards it on.
  const gone = nameKey('gone.dusk')
  for (let i = 0; i < 3; i++)
    w.chain.homes.set(`${store(i)}:${hex(gone.root)}`, { Forwarded: forward(gone.root, store(i + 1), i + 1) })
  // By height alone, with heightReuseMs 0, no answered read is shared: each home read is a request.
  const { currentBlock: _, ...heightOnly } = w.transport
  const c = new FrozenClient(w.release, { transport: heightOnly, heightReuseMs: 0 })
  await c.verifyContract('directory', id(1))
  const homes = async (hint?: string) => {
    w.log.length = 0
    expect(await c.getName('gone.dusk', hint)).toMatchObject({ store: w.newest, value: 'Absent' })
    return w.log.filter((call) => call.endsWith('.home'))
  }
  // Store 0's route passes every other store, which then starts no route of its own: a route from
  // one is the rest of that route, and ends where it did.
  expect(await homes()).toEqual(['40.home', '41.home', '42.home', '43.home'])
  // A route is still followed whole: one cut short where another passed could miss its hop limit.
  expect(await homes(store(1))).toEqual(['41.home', '42.home', '43.home', '40.home', '41.home', '42.home', '43.home'])
})

it('answers from the scan when the hinted admission cannot be read', async () => {
  const w = await scaled(4)
  const c = await w.client()
  w.chain.replies.set('01.member', new Error('Contract read failed (member): unavailable'))
  expect((await c.getName('child.example.dusk', w.newest)).store).toBe(w.newest)
  expect((await c.verifyPrimary(endpoint, w.newest))?.store).toBe(w.newest)
  expect((await c.quoteRenewal(w.newest, { name: ref, years: 1 })).store).toBe(w.newest)
})

it('rejects a hint whose store a move is staging into, and finds the name at its source', async () => {
  const w = await scaled(4)
  // The name moves from store 0 to store 2: still Local at 0, staged at 2.
  w.chain.homes.set(`${store(3)}:${hex(child.root)}`, 'Absent')
  w.chain.homes.set(`${store(0)}:${hex(child.root)}`, 'Local')
  w.chain.homes.set(`${store(2)}:${hex(child.root)}`, { Staged: bytes(5) })
  w.chain.names.set(`${store(0)}:${hex(child.node)}`, view(child))
  w.chain.primaries.clear()
  for (const hint of [store(2), undefined]) expect((await (await w.client()).getName('child.example.dusk', hint)).store).toBe(store(0))
})

it('refuses a read through a refused store, and only reads that need it', async () => {
  const w = await scaled(4)
  w.chain.replies.set('40.binding', { directory: bytes(11), vault: bytes(2), network: 1 })
  const c = await w.client()
  // The hinted name lives at the newest store: store 0 is not on its way.
  expect((await c.getName('child.example.dusk', w.newest)).store).toBe(w.newest)
  // A hint naming the refused store is only a wrong hint: the scan needs store 0 too, and refuses it.
  await expect(c.getName('child.example.dusk', store(0))).rejects.toThrow('Contract deployment binding mismatch')
  await expect(c.getName('child.example.dusk')).rejects.toThrow('Contract deployment binding mismatch')
  await expect(c.store(store(0)).stats()).rejects.toThrow('Contract deployment binding mismatch')
  await expect(c.discover()).rejects.toThrow('Contract deployment binding mismatch')
  // Refused for good, even once the node answers otherwise.
  w.chain.replies.delete('40.binding')
  await expect(c.getName('child.example.dusk')).rejects.toThrow('Contract deployment binding mismatch')
  expect((await c.getName('child.example.dusk', w.newest)).store).toBe(w.newest)
})

it('signs only for stores a read verified, and prepareRegistration verifies every store it places among', async () => {
  const w = await scaled(4)
  const c = await w.client()
  const wallet = { request: async (method: string) => (method === 'dusk_chainId' ? 'dusk:1' : { median: '1' }) }
  const app = createDuskDomainsConnectApp(wallet, c.release)
  const commit = (s: string) => buildCall('store', s, 'commit', { hash: bytes(1) })
  await expect(app.prepare(commit(w.newest))).rejects.toThrow('Target is absent from verified release')
  await c.getName('child.example.dusk', w.newest)
  expect((await app.prepare(commit(w.newest))).contractId).toBe(w.newest)
  await expect(app.prepare(commit(store(0)))).rejects.toThrow('Target is absent from verified release')
  const prepared = await c.prepareRegistration(registration('fresh'))
  for (let i = 0; i < 4; i++) expect((await app.prepare(commit(store(i)))).contractId).toBe(store(i))
  expect((await app.prepare(prepared.calls.reveal)).fnName).toBe('register')
})

it('tells a target this client has not verified from one it refused', async () => {
  const w = await scaled(4)
  const c = await w.client()
  const wallet = { request: async (method: string) => (method === 'dusk_chainId' ? 'dusk:1' : { median: '1' }) }
  const app = createDuskDomainsConnectApp(wallet, c.release)
  const commit = (s: string) => buildCall('store', s, 'commit', { hash: bytes(1) })
  const unread = await app.prepare(commit(w.newest)).catch((error: unknown) => error)
  expect(unread).toBeInstanceOf(UnverifiedContractError)
  expect(unread).toMatchObject({ contractId: w.newest, role: 'store', message: 'Target is absent from verified release' })
  expect((unread as Error).cause).toBeUndefined()
  // Refused by this client: its refusal, which the factory threw before lazy verification, is the cause.
  w.chain.replies.set('40.binding', { directory: bytes(11), vault: bytes(2), network: 1 })
  await expect(c.verifyContract('store', store(0))).rejects.toThrow(ContractRefusedError)
  const refused = await app.prepare(commit(store(0))).catch((error: unknown) => error)
  expect(refused).toBeInstanceOf(UnverifiedContractError)
  expect(refused).toMatchObject({ contractId: store(0), message: 'Target is absent from verified release' })
  expect((refused as Error).cause).toBeInstanceOf(ContractRefusedError)
  expect((refused as Error).cause).toMatchObject({ contractId: store(0), message: 'Contract deployment binding mismatch' })
})

it('makes nothing signable that only an abandoned attempt verified', async () => {
  const w = await scaled(4)
  const c = await w.client()
  // Every attempt sees a block land while it reads the name.
  w.chain.onRead = (call) => {
    if (call.endsWith('.get_name')) w.chain.height++
  }
  await expect(c.getName('child.example.dusk', w.newest)).rejects.toThrow('Chain tip changed during read; retry the snapshot')
  const wallet = { request: async (method: string) => (method === 'dusk_chainId' ? 'dusk:1' : { median: '1' }) }
  const app = createDuskDomainsConnectApp(wallet, c.release)
  await expect(app.prepare(buildCall('store', w.newest, 'commit', { hash: bytes(1) }))).rejects.toThrow('Target is absent from verified release')
  w.chain.onRead = undefined
  await c.getName('child.example.dusk', w.newest)
  expect((await app.prepare(buildCall('store', w.newest, 'commit', { hash: bytes(1) }))).contractId).toBe(w.newest)
})

it('reads a hinted name again at the new height when a block lands while it reads', async () => {
  const w = await scaled(16)
  const c = await w.client()
  let landed = false
  w.chain.onRead = (call) => {
    if (call.endsWith('.get_name') && !landed) {
      landed = true
      w.chain.height++
      w.chain.names.set(`${w.newest}:${hex(child.node)}`, view(child, { expires_at: 7000n }))
    }
  }
  const r = await c.getName('child.example.dusk', w.newest)
  expect(r).toMatchObject({ height: w.chain.height, value: { Local: { name: { expires_at: 7000n } } } })
})

it('previews a registration at the store the chain places it, whatever the hint, and never signs the preview', async () => {
  const w = await scaled(4)
  released(w, 'gone', 1)
  const expected = await (await w.client()).prepareRegistration(registration('gone'))
  expect(expected.store).toBe(store(1))
  for (const hint of [store(1), undefined, store(0), unadmitted, 'not a contract']) {
    const shown = await (await w.client()).previewRegistration(preview('gone'), hint)
    expect({ store: shown.store, total: shown.quote.total_lux, height: shown.height }, String(hint)).toEqual({
      store: store(1), total: expected.quote.total_lux, height: expected.height,
    })
    expect(() => registrationCalls(shown.store, { ...registration('gone'), commitmentStore: shown.store, quote: shown.quote })).toThrow('quote again')
  }
  // An unseen root: the newest store, as registration places it.
  const fresh = await (await w.client()).previewRegistration(preview('fresh'))
  expect(fresh.store).toBe(w.newest)
  expect(fresh.quote.total_lux).toBe((await (await w.client()).prepareRegistration(registration('fresh'))).quote.total_lux)
  // A root that is still registered is not available, as registrationPlacement reports.
  await expect((await w.client()).registrationPlacement(child.root)).rejects.toThrow('Registration root is not released')
  await expect((await w.client()).previewRegistration(preview('example'))).rejects.toThrow('Registration root is not released')
})

it('keeps the verification cache for the init\'s store on the next page load', async () => {
  // One store: the directory's init's, whose interface and binding only the chain can show.
  const w = await scaled(1)
  const items = new Map<string, string>()
  const verificationCache = { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v) }
  const first = await w.client({ verificationCache })
  expect(await w.count(() => first.getName('child.example.dusk', w.newest))).toBe(7)
  expect(probes(w.log)).toEqual(['40.interface_version', '40.binding'])
  const reload = await w.client({ verificationCache })
  expect(await w.count(() => reload.getName('child.example.dusk', w.newest))).toBe(5)
  expect(probes(w.log)).toEqual([])
})

it('takes what the directory probed at admission from its record, and checks the rest from the chain', async () => {
  const w = await scaled(4, 4)
  const reads = async (run: (c: FrozenClient) => Promise<unknown>) => {
    const c = await w.client()
    w.log.length = 0
    await run(c)
    return [...w.log]
  }
  // An AddStore or AddResolver admission, past ordinal 0: only the directory's record is read.
  expect(await reads((c) => c.verifyContract('store', store(1)))).toEqual(['01.member'])
  expect(await reads((c) => c.verifyContract('resolver', resolver(3)))).toEqual(['01.member'])
  // What the directory's init admitted, unprobed, and the vault: also its interface and binding.
  expect(await reads((c) => c.verifyContract('store', store(0)))).toEqual(['01.member', '40.interface_version', '40.binding'])
  expect(await reads((c) => c.verifyContract('resolver', resolver(0)))).toEqual(['01.member', 'c0.interface_version', 'c0.binding'])
  expect(await reads((c) => c.verifyContract('vault', id(2)))).toEqual(['02.interface_version', '02.binding'])
  // A marketplace record at version 1 may be the init's; past it, a SetMarketplace probed the market.
  // Its order API is checked either way: the directory's probe does not cover it.
  expect(await reads((c) => c.verifyContract('marketplace', id(6)))).toEqual([
    '01.market', '06.interface_version', '06.binding', '06.order_api_version',
  ])
  w.chain.marketVersion = 2n
  expect(await reads((c) => c.verifyContract('marketplace', id(6)))).toEqual(['01.market', '06.order_api_version'])
  // The preferred marketplace past market version 1: a SetPreferredMarketplace probed it.
  w.chain.marketVersion = 1n
  w.chain.preferredVersion = 2n
  expect(probes(await reads((c) => c.discover()))).toEqual(['40.interface_version', '40.binding', 'c0.interface_version', 'c0.binding', '02.interface_version', '02.binding'])
  // The policy past policy version 1: a SetPolicy probed it. Its init commitment is still checked,
  // over the directory's binding and the config it reads.
  expect(probes(await reads((c) => c.previewRegistration(preview('fresh'))))).toEqual(['03.interface_version', '03.binding'])
  w.chain.policyVersion = 2n
  const selected = await reads((c) => c.previewRegistration(preview('fresh')))
  expect(probes(selected)).toEqual([])
  expect(selected.filter((call) => call === '03.config')).toHaveLength(2)
  // The record is the proof: a probed store's live interface and binding are never read, even when
  // the node would answer them wrongly.
  w.chain.replies.set('43.binding', { directory: bytes(11), vault: bytes(2), network: 1 })
  w.chain.replies.set('43.interface_version', { kind: 'Resolver', version: 1, move_version: 0, custody_version: 0 })
  const fresh = await w.client()
  expect(await w.count(() => fresh.getName('child.example.dusk', w.newest))).toBe(5)
  expect(w.log).toEqual([H, '01.member', '43.home', '43.get_name', H])
})

it('still refuses an unadmitted store, an admission of other code, and an init\'s store the chain contradicts', async () => {
  const w = await scaled(4)
  const wallet = { request: async (method: string) => (method === 'dusk_chainId' ? 'dusk:1' : { median: '1' }) }
  const commit = (s: string) => buildCall('store', s, 'commit', { hash: bytes(1) })
  // A store the directory does not admit.
  const c = await w.client()
  await expect(c.verifyContract('store', unadmitted)).rejects.toThrow('is not admitted')
  await expect(c.store(unadmitted).stats()).rejects.toThrow('is not admitted')
  await expect(createDuskDomainsConnectApp(wallet, c.release).prepare(commit(unadmitted))).rejects.toThrow('Target is absent from verified release')
  // An admission whose code hash is not the release's: refused with nothing read from the store.
  w.release.contracts.set(w.newest, { ...w.release.contracts.get(w.newest)!, codeHash: 'aa'.repeat(32) })
  const other = await w.client()
  w.log.length = 0
  await expect(other.verifyContract('store', w.newest)).rejects.toThrow('Admission artifact/version mismatch')
  expect(w.log).toEqual(['01.member'])
  await expect(other.getName('child.example.dusk', w.newest)).rejects.toThrow('Admission artifact/version mismatch')
  await expect(other.store(w.newest).stats()).rejects.toThrow('Admission artifact/version mismatch')
  await expect(createDuskDomainsConnectApp(wallet, other.release).prepare(commit(w.newest))).rejects.toThrow('Target is absent from verified release')
  // The init's store is checked on chain: a binding naming another directory refuses it.
  w.chain.replies.set('40.binding', { directory: bytes(11), vault: bytes(2), network: 1 })
  await expect((await w.client()).verifyContract('store', store(0))).rejects.toThrow('Contract deployment binding mismatch')
})

/**
 * A name page's reads as the frontend makes them, each step reading the name first, with `hint` as
 * the name's home store and the endpoint's primary store, as the indexer's `homeShard` gives both.
 */
function namePage(c: FrozenClient, hint: string | undefined, parallel: boolean): Promise<unknown> {
  const name = () => c.getName('child.example.dusk', hint)
  const address = { key: child, record_key: 'moonlight_address' }
  const steps = [
    name,
    async () => c.locate((await name()).store, child.root, 'read_records', child),
    async () => c.locate((await name()).store, child.root, 'resolve_record', address),
    async () => {
      await c.locate((await name()).store, child.root, 'resolve_record', address)
      return c.verifyPrimary(endpoint, hint)
    },
    async () => c.quoteRenewal((await name()).store, { name: ref, years: 1 }),
    async () => {
      await name()
      return c.directory.config()
    },
  ]
  return parallel
    ? Promise.all(steps.map((step) => step()))
    : steps.reduce<Promise<unknown>>((done, step) => done.then(step), Promise.resolve())
}

it.each(sizes)('loads a name page with the same calls at any number of stores and resolvers (%i)', async (n) => {
  const w = await scaled(n, n)
  // A first load: a client as createClientFromManifest makes one, then the page, at a new height.
  const load = async (hint: string | undefined, parallel: boolean) => {
    w.chain.height++
    w.log.length = 0
    // Opening every snapshot at a height read that already arrived, as within the default 1 s window.
    await namePage(await w.client({ heightReuseMs: Infinity }), hint, parallel)
    return w.log.length
  }
  // The directory's interface and binding, then the page: the name's admission, home and state, and
  // a height read to close each snapshot. Only the init's store, the newest when n is 1, adds its
  // interface and binding.
  const verified = n === 1 ? 2 : 0
  expect({ parallel: await load(w.newest, true), sequential: await load(w.newest, false) }).toEqual({
    parallel: 15 + verified,
    // Every step reads the name in a snapshot of its own, each closed with a height read.
    sequential: 23 + verified,
  })
  // Without a hint, the name and primary are looked for at every store, through the init's store too.
  expect(await load(undefined, true)).toBe(14 + pages(n) + 2 * n)
})

it('creates a client from a manifest with only the directory verified', async () => {
  const r = await wasmRelease()
  const transport = verificationTransport(r)
  const log: string[] = []
  const counted: ReadTransport = {
    currentBlockHeight: async () => {
      log.push(H)
      return transport.currentBlockHeight()
    },
    read: async (target, fn, data) => {
      log.push(`${target.slice(0, 2)}.${fn}`)
      return transport.read(target, fn, data)
    },
  }
  const serve = async (input: RequestInfo | URL) => {
    const role = /\/(\w+)\.wasm$/u.exec(String(input))![1] as Parameters<typeof driverBytes>[0]
    return new Response(Uint8Array.from(driverBytes(role)))
  }
  const client = await createClientFromManifest(r.manifest, {
    artifactBaseUrl: r.artifactBaseUrl, fetch: serve as typeof fetch, transport: counted,
  })
  expect(log).toEqual(['01.interface_version', '01.binding'])
  // discover() still verifies every admitted contract up front.
  expect(client.directoryId).toBe(id(1))
  // `eager` runs it before the factory returns, so its failure is the factory's.
  log.length = 0
  await expect(
    createClientFromManifest(r.manifest, { artifactBaseUrl: r.artifactBaseUrl, fetch: serve as typeof fetch, transport: counted, eager: true }),
  ).rejects.toThrow(`Unexpected test read ${id(1)}.config`)
  // A failure at an unchanged height is final: one height read closes the attempt.
  expect(log).toEqual(['01.interface_version', '01.binding', H, '01.config', H])
})
