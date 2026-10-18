/**
 * A frozen deployment with a read lens, for lens tests: `n` admitted stores and `r` resolvers answering
 * as the frozen contracts do (as in store-scaling.test.ts), and a lens whose replies are built from the
 * lens ABI (`dusk-domains-lens` `abi.rs` and `lens.rs`) over the same chain state. Its replies restate
 * the lens's reads independently of the SDK, so a client that reads through it can be compared with one
 * that reads the contracts directly.
 */
import { FrozenClient, type ClientOptions, type LensFallback } from '../src/frozen/client.ts'
import { parseJson, stringifyJson } from '../src/frozen/json.ts'
import { authority, equalBytes, fromHex, hex, nameKey } from '../src/frozen/bytes.ts'
import { estimateRegistrationQuote, launchPolicyConfig } from '../src/core/pricing.ts'
import { PRICED_POLICIES, lensInitCommitment } from '../src/frozen/lens.ts'
import { bytes, id, jsonDriver, jsonRelease, sample, sevens } from './helpers.ts'
import type { ReadTransport } from '../src/frozen/transport.ts'
import type { LensContract, LoadedRelease } from '../src/frozen/manifest.ts'
import type {
  Admission, Forward, Home, Located, NameKey, NameView, PrimaryView, RecordValue, RecordsView, RenewalSchedule,
} from '../src/frozen/types.ts'

export const encode = (v: unknown) => new TextEncoder().encode(stringifyJson(v))
const decode = (b: Uint8Array) => parseJson(new TextDecoder().decode(b)) as Record<string, any>
const samples = {
  Admission: sample('Admission'),
  NameView: sample('NameView'),
  RegistrationContext: sample('RegistrationContext'),
  DirectoryConfig: sample('DirectoryConfig'),
  Market: sample('Market'),
  Capacity: sample('Capacity'),
}
export const H = 'height'
export const child = nameKey('child.example.dusk')
export const root = nameKey('example.dusk')
export const endpoint = bytes(12, 96)
export const incarnation = { generation: 7n, serial: 2n }
export const ref = { key: child, incarnation }
export const store = (i: number) => id(0x40 + i)
export const resolver = (j: number) => id(0xc0 + j)
export const lensId = id(8)
export const unadmitted = id(4)
const kinds: Record<number, string> = { 1: 'Directory', 2: 'Vault', 3: 'Policy', 6: 'Marketplace' }
export const admission = (contract: string, ordinal: number): Admission => ({
  ...samples.Admission, id: fromHex(contract, 32), ordinal, interface_version: 1, admitted_at: 1n, retiring: false,
})
export const forward = (rootNode: number[], to: string, ordinal: number): Forward => ({
  root: rootNode, destination: fromHex(to, 32), destination_ordinal: ordinal, move_id: bytes(10), generation: 7n, completed_at: 90n,
})
/** The records child.example.dusk holds, at resolver 0. */
export const pointer = { resolver: fromHex(resolver(0), 32), epoch: 1n, count: 2, digest: bytes(9) }
export const address: RecordValue = { key: 'moonlight_address', value: endpoint, ttl_seconds: 3600n, updated_at: 90n }
export const avatar: RecordValue = { key: 'avatar', value: bytes(5, 3), ttl_seconds: 60n, updated_at: 91n }
export function view(k: NameKey, change: Partial<NameView['name']> = {}): NameView {
  const v = structuredClone(samples.NameView)
  v.name = {
    ...v.name, key: k, label: 'child', incarnation, expires_at: 1000n, grace_end: 2000n,
    owner: authority({ kind: 'Moonlight', bytes: endpoint }), records: null, ...change,
  }
  v.active = true
  v.renewable = true
  v.move_pending = null
  return v
}
const isForward = (h: unknown): h is { Forwarded: Forward } => typeof h === 'object' && h !== null && 'Forwarded' in h
const isStaged = (h: unknown) => typeof h === 'object' && h !== null && 'Staged' in h
const testBinding = () => ({ directory: bytes(1), vault: bytes(2), network: 1 })

/** The release's lens entry: its init commitment binds it to the test directory, under `driver`. */
export function lensEntry(change: Partial<LensContract> = {}): LensContract {
  return {
    role: 'lens', contractId: lensId, codeHash: sevens, initHash: lensInitCommitment(jsonDriver, id(1)),
    dataDriver: { path: 'lens.wasm', sha256: 'ab'.repeat(32) }, ...change,
  }
}

export async function lensWorld(n: number, r = 3, { lens = true }: { lens?: boolean } = {}) {
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
  // The policy is the published v1 policy, whose pricing the SDK recomputes.
  release.contracts.set(id(3), { ...release.contracts.get(id(3))!, codeHash: [...PRICED_POLICIES][0] })
  if (lens) {
    release.manifest.lens = lensEntry()
    release.lens = { contract: release.manifest.lens, driver: jsonDriver }
  }
  const newest = store(n - 1)
  const chain = {
    height: 100n,
    stores: Array.from({ length: n }, (_, i) => admission(store(i), i)),
    resolvers: Array.from({ length: r }, (_, j) => admission(resolver(j), j)),
    /** The policy the directory selects, and its selection version: past 1, a SetPolicy selected it. */
    policy: bytes(3),
    policyVersion: 1n,
    marketVersion: 1n,
    preferredVersion: 1n,
    homes: new Map<string, Home>([[`${newest}:${hex(child.root)}`, 'Local']]),
    names: new Map<string, NameView>([
      [`${newest}:${hex(child.root)}`, view(root, { label: 'example' })],
      [`${newest}:${hex(child.node)}`, view(child, { records: pointer })],
    ]),
    records: new Map<string, RecordsView>([[`${newest}:${hex(child.node)}`, { pointer, records: [avatar, address] }]]),
    primaries: new Map<string, PrimaryView>([[newest, {
      primary: { endpoint, name: ref, mapping_id: 22n, updated_at: 90n }, spelling: 'child.example.dusk',
    }]]),
    schedule: {
      version: 3n, effective_at: 1n, annual_lux: ['500', '400', '300', '200', '100'], referral_bps: 1000,
    } as RenewalSchedule,
    replies: new Map<string, unknown>(),
    /** Change a lens reply before it is sent, as a faulty lens or node would. */
    lensReply: undefined as undefined | ((fn: string, reply: any) => unknown),
    onRead: undefined as undefined | ((call: string) => void | Promise<void>),
  }
  const log: string[] = []
  const fallbacks: LensFallback[] = []
  const home = (s: string, rootNode: number[]) => chain.homes.get(`${s}:${hex(rootNode)}`) ?? 'Absent'
  const located = (s: string, rootNode: number[], local: () => unknown) => {
    const h = home(s, rootNode)
    return isForward(h) ? h : h === 'Local' ? local() : 'Absent'
  }
  // As the directory derives them (state.rs): the newest store and resolver are the last admissions,
  // and the context's allocation version is the allocation's.
  const context = () => ({
    ...samples.RegistrationContext, policy: chain.policy, policy_version: chain.policyVersion, operator_paused: false,
    guardian_suspended: false, newest_store: chain.stores.at(-1)!.id, allocation_version: 1n,
  })
  const directoryConfig = () => ({
    ...samples.DirectoryConfig, binding: testBinding(),
    store_count: chain.stores.length, resolver_count: chain.resolvers.length, registration: context(),
    preferred_marketplace: bytes(6), market_version: chain.preferredVersion,
  })
  const market = () => ({ ...samples.Market, id: bytes(6), interface_version: 1, state: 'Listed', version: chain.marketVersion })
  const allocation = () => ({ version: 1n, newest_store: chain.stores.at(-1)!.id, newest_resolver: chain.resolvers.at(-1)!.id })
  const recordOf = (s: string, k: NameKey, key: string): RecordValue | null =>
    chain.records.get(`${s}:${hex(k.node)}`)?.records.find((rec) => rec.key === key) ?? null
  const trap = (target: string, code: string) => new Error(`Contract read failed (${target}.quote_registration): ${code}`)
  // The store's own placement check (entrypoints/paid.rs), for the cases these tests use.
  const quote = (target: string, args: Record<string, any>) => {
    const rootNode: number[] = args.node,
      here = home(target, rootNode),
      self = chain.stores.find((a) => hex(a.id) === target)!
    let previous: NameView | undefined
    if (here === 'Local') {
      if (self.retiring) return trap(target, 'WrongHome')
      previous = chain.names.get(`${target}:${hex(args.node)}`)
      if (previous && chain.height < previous.name.grace_end) return trap(target, 'NotAvailable')
    } else if (isForward(here)) return trap(target, 'Moved')
    else if (isStaged(here)) return trap(target, 'WrongHome')
    else {
      const others = chain.stores.map((a) => (hex(a.id) === target ? 'Absent' : home(hex(a.id), rootNode)))
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
    return { policy: chain.policy, policy_version: chain.policyVersion, quote: q, total_lux, height: chain.height }
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
    if (fn === 'binding') return testBinding()
    if (fn === 'order_api_version') return 1
    if (t === 1) {
      const rows = args.kind === 'Store' ? chain.stores : chain.resolvers
      if (fn === 'config') return directoryConfig()
      if (fn === 'members')
        return { rows: rows.slice(args.start, args.start + args.limit), next: args.start + args.limit < rows.length ? args.start + args.limit : null }
      if (fn === 'member') return rows.find((a) => hex(a.id) === hex(args.id)) ?? null
      if (fn === 'market') return hex(args.id) === id(6) ? market() : null
      if (fn === 'registration_context') return context()
      if (fn === 'allocation') return allocation()
      if (fn === 'renewal_schedule') return chain.schedule
    }
    if (target === hex(chain.policy) && fn === 'config') return launchPolicyConfig()
    if (isStore) {
      if (fn === 'home') return home(target, args.root)
      if (fn === 'get_name')
        return located(target, args.root, () => {
          const v = chain.names.get(`${target}:${hex(args.node)}`)
          return v ? { Local: v } : 'Absent'
        })
      if (fn === 'read_records')
        return located(target, args.root, () => ({
          Local: chain.records.get(`${target}:${hex(args.node)}`) ?? { pointer: null, records: [] },
        }))
      if (fn === 'resolve_record')
        return located(target, args.key.root, () => {
          const v = chain.names.get(`${target}:${hex(args.key.node)}`)
          return { Local: v?.active ? recordOf(target, args.key, args.record_key) : null }
        })
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

  // The lens, restated from abi.rs/lens.rs over the chain above.
  const storeIds = () => chain.stores.map((a) => hex(a.id))
  const evidence = (resolvers: Admission[] = []) => ({ stores: chain.stores, resolvers })
  const resolverRow = (pointerResolver: number[]) => chain.resolvers.find((a) => equalBytes(a.id, pointerResolver))!
  const route = (start: string, rootNode: number[]) => {
    const forwards: Forward[] = []
    for (let at = start; ; ) {
      const h = home(at, rootNode)
      if (!isForward(h)) return { end: at, forwards, local: h === 'Local' }
      forwards.push(h.Forwarded)
      at = hex(h.Forwarded.destination)
    }
  }
  /** `locate_name`: the one Local home, the route from the hint or the first store leading there. */
  const nameAt = (k: NameKey, hint: number[] | null) => {
    const all = storeIds(),
      homeStore = all.find((s) => home(s, k.root) === 'Local')
    if (!homeStore) return { store: hex(chain.stores.at(-1)!.id), forwards: [] as Forward[], name: 'Absent' as Located<NameView>, view: undefined }
    const h = hint && hex(hint)
    for (const s of [...(h && all.includes(h) ? [h] : []), ...all]) {
      const rt = route(s, k.root)
      if (rt.local) {
        const v = chain.names.get(`${rt.end}:${hex(k.node)}`)
        return { store: rt.end, forwards: rt.forwards, name: (v ? { Local: v } : 'Absent') as Located<NameView>, view: v }
      }
    }
    throw new Error('unreachable')
  }
  const lifecycleOf = (v: NameView | undefined, k: NameKey) =>
    !v ? 'Absent' : v.active ? 'Active' : equalBytes(k.root, k.node) ? (v.renewable ? 'Grace' : 'Released') : 'Expired'
  /** `verify_primary`: the one store mapping the endpoint, and its primary if every check passes. */
  const primaryOf = (e: number[]) => {
    const mapped = storeIds().filter((s) => {
      const p = chain.primaries.get(s)
      return p && equalBytes(p.primary.endpoint, e)
    })
    if (!mapped.length) return { primary: null, resolvers: [] as Admission[] }
    const s = mapped[0],
      p = chain.primaries.get(s)!,
      v = chain.names.get(`${s}:${hex(p.primary.name.key.node)}`),
      rec = v && recordOf(s, p.primary.name.key, 'moonlight_address')
    const holder = authority({ kind: 'Moonlight', bytes: e })
    const ok =
      home(s, p.primary.name.key.root) === 'Local' && v && v.active && chain.height < v.name.expires_at &&
      v.name.incarnation.generation === p.primary.name.incarnation.generation &&
      v.name.incarnation.serial === p.primary.name.incarnation.serial &&
      (equalBytes(v.name.owner, holder) || equalBytes(v.name.manager, holder)) &&
      rec && equalBytes(rec.value, e)
    if (!ok) return { primary: null, resolvers: [] as Admission[] }
    return {
      primary: { store: fromHex(s, 32), primary: p, record: rec! },
      resolvers: v!.name.records ? [resolverRow(v!.name.records.resolver)] : [],
    }
  }
  const renewal = (v: NameView) => {
    const tier = Math.min(Math.max(v.name.label.length, 1), 5) - 1
    let max = 0
    for (let y = 10; y >= 1 && chain.height < v.name.grace_end; y--)
      if (v.name.expires_at + BigInt(y) * 3_153_600n <= chain.height + 31_536_000n) {
        max = y
        break
      }
    return { schedule: chain.schedule, annual_lux: chain.schedule.annual_lux[tier], referral: v.name.referrer !== null, max_years: max }
  }
  const policyEvidence = () => ({ policy: chain.policy, policy_version: chain.policyVersion, binding: testBinding(), config: launchPolicyConfig() })
  const lensAnswer = (fn: string, args: Record<string, any>): unknown => {
    if (fn === 'binding') return testBinding()
    if (fn === 'lens_interface') return { version: 1, max_stores: 64, max_hops: 63, max_record_keys: 16 }
    const height = chain.height
    if (fn === 'resolve') {
      const k = nameKey(args.name),
        at = nameAt(k, args.hint)
      const records = (args.record_keys as string[]).map((key) => (at.view?.active ? recordOf(at.store, k, key) : null))
      const resolvers = at.view?.active && args.record_keys.length && at.view.name.records ? [resolverRow(at.view.name.records.resolver)] : []
      return { Ok: { height, key: k, store: fromHex(at.store, 32), forwards: at.forwards, name: at.name, status: lifecycleOf(at.view, k), records, consulted: evidence(resolvers) } }
    }
    if (fn === 'reverse') {
      const p = primaryOf(args.endpoint)
      return { Ok: { height, endpoint: args.endpoint, primary: p.primary, consulted: evidence(p.resolvers) } }
    }
    if (fn === 'name_page') {
      const k = nameKey(args.name),
        at = nameAt(k, args.hint),
        empty = { endpoint: null, verified: null, is_primary: false, refused: null }
      if (!at.view)
        return { Ok: { height, key: k, store: fromHex(at.store, 32), forwards: at.forwards, name: at.name, status: lifecycleOf(at.view, k), records: null, primary: empty, renewal: null, consulted: evidence() } }
      const records = chain.records.get(`${at.store}:${hex(k.node)}`) ?? { pointer: null, records: [] },
        value = records.records.find((rec) => rec.key === 'moonlight_address')?.value,
        e = value?.length === 96 ? value : null,
        p = e ? primaryOf(e) : { primary: null, resolvers: [] as Admission[] }
      const own = Boolean(p.primary && equalBytes(p.primary.primary.primary.name.key.node, k.node) &&
        p.primary.primary.primary.name.incarnation.serial === at.view.name.incarnation.serial &&
        p.primary.primary.primary.name.incarnation.generation === at.view.name.incarnation.generation)
      const resolvers = [...(at.view.name.records ? [resolverRow(at.view.name.records.resolver)] : [])]
      for (const row of p.resolvers) if (!resolvers.includes(row)) resolvers.push(row)
      return {
        Ok: {
          height, key: k, store: fromHex(at.store, 32), forwards: at.forwards, name: at.name, status: lifecycleOf(at.view, k),
          records, primary: { endpoint: e, verified: p.primary, is_primary: own, refused: null },
          renewal: equalBytes(k.root, k.node) ? renewal(at.view) : null, consulted: evidence(resolvers),
        },
      }
    }
    if (fn === 'availability') {
      const node = nameKey(`${args.label}.dusk`).node,
        canonical = storeIds().find((s) => home(s, node) === 'Local')
      let placement = { store: chain.stores.at(-1)!.id, canonical_store: null as number[] | null, released_root: null },
        previous: [bigint, bigint | null] = [0n, null]
      if (canonical) {
        const v = chain.names.get(`${canonical}:${hex(node)}`)!
        if (height < v.name.grace_end)
          return { Ok: { height, node, context: context(), status: { Registered: { store: fromHex(canonical, 32), name: v } }, consulted: evidence(), policy: null } }
        placement = { store: fromHex(canonical, 32), canonical_store: fromHex(canonical, 32), released_root: null }
        previous = [v.name.incarnation.generation, v.name.grace_end]
      }
      const request = {
        version: 1, directory: bytes(1), store: placement.store, node, label: args.label, actor: args.actor, years: args.years,
        height, previous_generation: previous[0], previous_grace_end: previous[1], policy_version: chain.policyVersion,
      }
      const q = quote(hex(placement.store), { node, label: args.label, actor: args.actor, years: args.years })
      if (q instanceof Error) return { Refused: { code: 'QuoteRefused', contract: placement.store, cause: 'NotAvailable', height } }
      return { Ok: { height, node, context: context(), status: { Registrable: { placement, request, quote: q } }, consulted: evidence(), policy: policyEvidence() } }
    }
    if (fn === 'bootstrap')
      return { Ok: { height, config: directoryConfig(), allocation: allocation(), stores: chain.stores, resolvers: chain.resolvers, market: { market: market(), order_api_version: 1 } } }
    if (fn === 'pricing') return { Ok: { height, context: context(), policy: policyEvidence() } }
    throw new Error(`Unexpected lens read ${fn}`)
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
    namespace: 'lens-world',
    read: async (target, fn, data) => {
      const call = `${target.slice(0, 2)}.${fn}`
      log.push(call)
      await chain.onRead?.(call)
      if (chain.replies.has(call)) {
        const reply = chain.replies.get(call)
        if (reply instanceof Error) throw reply
        return reply instanceof Uint8Array ? reply : encode(reply)
      }
      const args = decode(data) ?? {}
      if (target === lensId) {
        const reply = lensAnswer(fn, args)
        return encode(chain.lensReply ? chain.lensReply(fn, structuredClone(reply)) : reply)
      }
      const reply = answer(target, fn, args)
      if (reply instanceof Error) throw reply
      return encode(reply)
    },
  }
  /**
   * A client as `createClientFromManifest` makes one: the directory verified, nothing else. Each
   * snapshot reads its own height (`heightReuseMs: 0`) unless the test says otherwise.
   */
  const client = async (options: ClientOptions = {}) => {
    const c = new FrozenClient(release, {
      transport, heightReuseMs: 0, onLensFallback: (f) => void fallbacks.push(f), ...options,
    })
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
  return { chain, release, log, fallbacks, transport, client, count, newest }
}
export type LensWorld = Awaited<ReturnType<typeof lensWorld>>
/** A root released at store `i`: registered once, past its grace end now. */
export function released(w: LensWorld, label: string, i = 0): NameKey {
  const k = nameKey(`${label}.dusk`)
  w.chain.homes.set(`${store(i)}:${hex(k.root)}`, 'Local')
  const v = view(k, { label, expires_at: 40n, grace_end: 50n })
  v.active = false
  v.renewable = false
  w.chain.names.set(`${store(i)}:${hex(k.node)}`, v)
  return k
}
export const pages = (n: number) => Math.ceil(n / 16)
