import { it, expect, vi } from 'vitest'
import { FrozenClient, type ClientOptions } from '../src/frozen/client.ts'
import { parseJson, stringifyJson } from '../src/frozen/json.ts'
import { authority, fromHex, hex, nameKey } from '../src/frozen/bytes.ts'
import { estimateRegistrationQuote, launchPolicyConfig } from '../src/core/pricing.ts'
import { bytes, id, jsonDriver, jsonRelease, sample } from './helpers.ts'
import type { ReadTransport } from '../src/frozen/transport.ts'
import type { LoadedRelease } from '../src/frozen/manifest.ts'
import type { Admission, Forward, NameKey, NameView } from '../src/frozen/types.ts'

const encode = (v: unknown) => new TextEncoder().encode(stringifyJson(v))
const decode = (b: Uint8Array) => parseJson(new TextDecoder().decode(b)) as Record<string, any>
const child = nameKey('child.example.dusk')
const endpoint = bytes(12, 96)
/** A call as the test transport logs it: `height`, or `nn.function` for contract id(nn). */
const c = (n: number, fn: string) => `${n.toString(16).padStart(2, '0')}.${fn}`
const H = 'height'
const roleOf: Record<number, string> = { 1: 'Directory', 2: 'Vault', 3: 'Policy', 5: 'Resolver', 6: 'Marketplace' }
const located = new Set(['get_name', 'read_records', 'resolve_record', 'quote_renewal', 'read_record', 'record_slot', 'children', 'move_cooldowns'])
// Fixture rows, parsed once: `sample` reads the whole fixture file on every call.
const samples = Object.fromEntries(
  (['Admission', 'NameView', 'RegistrationContext', 'DirectoryConfig', 'Market', 'RenewalSchedule', 'Capacity', 'StoreStats'] as const)
    .map((type) => [type, sample(type)]),
) as { [T in 'Admission' | 'NameView' | 'RegistrationContext' | 'DirectoryConfig' | 'Market' | 'RenewalSchedule' | 'Capacity' | 'StoreStats']: ReturnType<typeof sample<T>> }

interface Chain {
  height: bigint
  /** Bumped when a block replaces the tip at the same height: part of the tip's hash. */
  fork: number
  stores: Admission[]
  preferred: boolean
  /** Each store's home for a root, by `store:root`; absent means Absent. */
  homes: Map<string, unknown>
  /** Each store's local name view, by `store:node`. */
  names: Map<string, NameView>
  /** Each store's resolved primary for the endpoint. */
  primaries: Map<string, unknown>
  /** Replies that override the contract's, by logged call; an Error is thrown. */
  replies: Map<string, unknown>
  /** Runs as a read arrives, before it is answered: a block can land here. */
  onRead?: (call: string) => void | Promise<void>
  /** Runs as a height read arrives, before it is answered. */
  onHeight?: () => void | Promise<void>
}
const admission = (n: number, ordinal: number): Admission => ({
  ...samples.Admission, id: bytes(n), ordinal, interface_version: 1, admitted_at: 1n, retiring: false,
})
const forward = (root: number[], to: number, ordinal: number): Forward => ({
  root, destination: bytes(to), destination_ordinal: ordinal, move_id: bytes(10), generation: 7n, completed_at: 90n,
})
function view(k: NameKey, change: Partial<NameView['name']> = {}): NameView {
  const v = structuredClone(samples.NameView)
  v.name = {
    ...v.name, key: k, label: 'child', incarnation: { generation: 7n, serial: 2n }, expires_at: 1000n,
    grace_end: 2000n, owner: authority({ kind: 'Moonlight', bytes: endpoint }), ...change,
  }
  v.active = true
  v.move_pending = null
  return v
}

/**
 * The frozen deployment the client tests use: directory 1, vault 2, policy 3, stores 4, 8 and 9
 * (ordinals 0, 1 and 2), resolver 5 and marketplace 6. child.example.dusk lives at store 9:
 * store 4 forwards its root to 8, and 8 to 9. State changes only with the height, as on chain.
 */
async function world() {
  const base = await jsonRelease()
  const release: LoadedRelease = {
    ...base, manifest: structuredClone(base.manifest), contracts: new Map(base.contracts), drivers: new Map(base.drivers),
  }
  for (const [n, ordinal] of [[8, 1], [9, 2]]) {
    release.contracts.set(id(n), { ...release.contracts.get(id(4))!, contractId: id(n), ordinal })
    release.drivers.set(id(n), jsonDriver)
  }
  const chain: Chain = {
    height: 100n,
    fork: 0,
    stores: [admission(4, 0), admission(8, 1), admission(9, 2)],
    preferred: false,
    homes: new Map<string, unknown>([
      [`${id(4)}:${hex(child.root)}`, { Forwarded: forward(child.root, 8, 1) }],
      [`${id(8)}:${hex(child.root)}`, { Forwarded: forward(child.root, 9, 2) }],
      [`${id(9)}:${hex(child.root)}`, 'Local'],
    ]),
    names: new Map([[`${id(9)}:${hex(child.node)}`, view(child)]]),
    primaries: new Map([[id(9), {
      primary: { endpoint, name: { key: child, incarnation: { generation: 7n, serial: 2n } }, mapping_id: 22n, updated_at: 90n },
      spelling: 'child.example.dusk',
    }]]),
    replies: new Map(),
  }
  const log: string[] = []
  const home = (store: string, root: number[]) => chain.homes.get(`${store}:${hex(root)}`) ?? 'Absent'
  const answer = (target: string, fn: string, args: Record<string, any>): unknown => {
    const n = Number.parseInt(target.slice(0, 2), 16),
      store = release.contracts.get(target)?.role === 'store'
    if (fn === 'interface_version')
      return { kind: store ? 'Store' : roleOf[n], version: 1, move_version: store ? 1 : 0, custody_version: store || n === 6 ? 1 : 0 }
    if (fn === 'binding') return { directory: bytes(1), vault: bytes(2), network: 1 }
    if (fn === 'order_api_version') return 1
    const registration = {
      ...samples.RegistrationContext, policy: bytes(3), policy_version: 1n, operator_paused: false,
      guardian_suspended: false, newest_store: chain.stores.at(-1)!.id,
    }
    if (n === 1) {
      if (fn === 'config')
        return {
          ...samples.DirectoryConfig, binding: { directory: bytes(1), vault: bytes(2), network: 1 },
          store_count: chain.stores.length, resolver_count: 1, registration,
          preferred_marketplace: chain.preferred ? bytes(6) : null,
        }
      if (fn === 'members') return { rows: args.kind === 'Store' ? chain.stores : [admission(5, 0)], next: null }
      if (fn === 'member')
        return [...chain.stores, admission(5, 0)].find((a) => hex(a.id) === hex(args.id)) ?? null
      if (fn === 'market') return hex(args.id) === id(6) ? { ...samples.Market, id: bytes(6), interface_version: 1, state: 'Listed' } : null
      if (fn === 'registration_context') return registration
      if (fn === 'allocation') return { version: 1n, newest_store: chain.stores.at(-1)!.id, newest_resolver: bytes(5) }
      if (fn === 'renewal_schedule') return samples.RenewalSchedule
    }
    if (n === 3 && fn === 'config') return launchPolicyConfig()
    if (store) {
      if (fn === 'home') return home(target, args.root)
      const root: number[] | undefined = args.root ?? args.key?.root ?? args.name?.key.root ?? args.parent?.root
      if (located.has(fn) && root) {
        const h = home(target, root) as any
        if (typeof h === 'object' && 'Forwarded' in h) return h
        if (h === 'Absent') return 'Absent'
        if (fn === 'get_name') {
          const v = chain.names.get(`${target}:${hex(args.node)}`)
          return v ? { Local: v } : 'Absent'
        }
        if (fn === 'read_records') return { Local: { pointer: null, records: [] } }
        if (fn === 'resolve_record')
          return { Local: { key: 'moonlight_address', value: endpoint, ttl_seconds: 3600n, updated_at: 90n } }
        if (fn === 'quote_renewal')
          return { Local: { schedule_version: 3n, total_lux: '123', referral_lux: '12', new_expiry: 2000n, new_grace_end: 3000n } }
      }
      if (fn === 'resolve_primary') return chain.primaries.get(target) ?? null
      if (fn === 'capacity') return { ...samples.Capacity, sealed: false }
      if (fn === 'stats') return samples.StoreStats
      if (fn === 'quote_registration') {
        const previous = chain.names.get(`${target}:${hex(args.node)}`)
        const { estimate, total_lux, ...quote } = estimateRegistrationQuote(launchPolicyConfig(), {
          version: 1, directory: bytes(1), store: fromHex(target, 32), node: args.node, label: args.label,
          actor: args.actor, years: args.years, height: chain.height,
          previous_generation: previous?.name.incarnation.generation ?? 0n,
          previous_grace_end: previous ? previous.name.grace_end : null, policy_version: 1n,
        })
        void estimate
        return { policy: bytes(3), policy_version: 1n, quote, total_lux, height: chain.height }
      }
    }
    throw new Error(`Unexpected read ${target}.${fn}`)
  }
  // As the default HTTP transport reads it: the tip's height and block hash in one request.
  const tip = async () => {
    log.push(H)
    await chain.onHeight?.()
    return { height: chain.height, hash: `${chain.height}/${chain.fork}` }
  }
  const transport: ReadTransport = {
    currentBlock: tip,
    currentBlockHeight: async () => (await tip()).height,
    read: async (target, fn, data) => {
      const call = `${target.slice(0, 2)}.${fn}`
      log.push(call)
      await chain.onRead?.(call)
      const reply = chain.replies.has(call) ? chain.replies.get(call) : answer(target, fn, decode(data) ?? {})
      if (reply instanceof Error) throw reply
      return encode(reply)
    },
  }
  // Each snapshot opens with a height read of its own, as with `heightReuseMs: 0`, unless a test
  // passes another window.
  const client = (options: ClientOptions = {}) =>
    new FrozenClient(release, { transport, heightReuseMs: 0, ...options })
  /** A client that discovered the deployment, at a height after discovery's. */
  const bootstrapped = async (options: ClientOptions = {}) => {
    const fresh = client(options)
    await fresh.discover()
    chain.height++
    log.length = 0
    return fresh
  }
  /** The calls `run` makes, in order. */
  const calls = async (run: () => Promise<unknown>): Promise<string[]> => {
    log.length = 0
    await run()
    return [...log]
  }
  return { chain, release, log, transport, client, bootstrapped, calls }
}
type World = Awaited<ReturnType<typeof world>>
const registration = (label: string) => ({ actor: bytes(10), label, years: 1, secret: bytes(33), commitHeight: 100n })
/** A root released at store 9, in grace no longer: registration there succeeds it. */
function released(w: World, label: string): NameKey {
  const k = nameKey(`${label}.dusk`)
  w.chain.homes.set(`${id(9)}:${hex(k.root)}`, 'Local')
  w.chain.names.set(`${id(9)}:${hex(k.node)}`, view(k, { label, expires_at: 40n, grace_end: 50n }))
  return k
}
const nameRef = { key: child, incarnation: { generation: 7n, serial: 2n } }
/** A gate a test opens to answer reads it holds. */
function gate() {
  let open!: () => void
  const opened = new Promise<void>((resolve) => { open = resolve })
  return { opened, open }
}

it('discovers reading the interface and binding of only what the directory did not probe, and again at the same height with one height read', async () => {
  const w = await world()
  const client = w.client()
  // Stores 8 and 9, past ordinal 0, were probed by the AddStore that admitted them.
  expect(await w.calls(() => client.discover())).toEqual([
    c(1, 'interface_version'), c(1, 'binding'),
    H, c(1, 'config'), c(1, 'members'), c(1, 'members'),
    c(4, 'interface_version'), c(4, 'binding'), c(5, 'interface_version'), c(5, 'binding'),
    c(2, 'interface_version'), c(2, 'binding'), H,
  ])
  // Nothing changed at this height: every read is already known, and the height read opens and closes it.
  expect(await w.calls(() => client.discover())).toEqual([H])
  w.chain.height++
  expect(await w.calls(() => client.discover())).toEqual([H, c(1, 'config'), c(1, 'members'), c(1, 'members'), H])
})

it.each([
  ['getName', undefined, [c(1, 'members'), c(4, 'home'), c(8, 'home'), c(9, 'home')]],
  // A hint reads the admission of each store on its route, not the whole list.
  ['getName from the name\'s first home', id(4), [
    c(1, 'member'), c(4, 'home'), c(1, 'member'), c(8, 'home'), c(1, 'member'), c(9, 'home'),
  ]],
  ['getName from the name\'s home', id(9), [c(1, 'member'), c(9, 'home')]],
])('%s reads each admission and home on its route once, then the name at its home', async (_label, hint, route) => {
  const w = await world()
  const client = await w.bootstrapped()
  const run = () => client.getName('child.example.dusk', hint)
  expect(await w.calls(run)).toEqual([H, ...route, c(9, 'get_name'), H])
  const result = await run()
  expect(result).toMatchObject({ store: id(9), height: 101n, value: { Local: view(child) } })
  expect(result.forwards.map((f) => hex(f.destination))).toEqual(hint === id(9) ? [] : [id(8), id(9)])
  expect(await w.calls(run)).toEqual([H])
})

it('getName of an absent name reads every home and the allocation once', async () => {
  const w = await world()
  const client = await w.bootstrapped()
  expect(await w.calls(() => client.getName('absent.dusk'))).toEqual([
    H, c(1, 'members'), c(4, 'home'), c(8, 'home'), c(9, 'home'), c(1, 'allocation'), H,
  ])
  expect(await client.getName('absent.dusk')).toEqual({ store: id(9), value: 'Absent', forwards: [], height: 101n })
})

it('verifyPrimary reads membership once and the primary\'s home and name once', async () => {
  const w = await world()
  const client = await w.bootstrapped()
  expect(await w.calls(() => client.verifyPrimary(endpoint))).toEqual([
    H, c(1, 'members'), c(4, 'resolve_primary'), c(8, 'resolve_primary'), c(9, 'resolve_primary'),
    c(9, 'home'), c(9, 'get_name'), c(9, 'resolve_record'), H,
  ])
  expect(await client.verifyPrimary(endpoint)).toMatchObject({ store: id(9), height: 101n, record: { value: endpoint } })
  expect(await w.calls(() => client.verifyPrimary(endpoint))).toEqual([H])
})

it('locate, Located reads and renewal quotes reuse the routing a name read made at their height', async () => {
  const w = await world()
  const client = await w.bootstrapped()
  const route = [H, c(1, 'member'), c(4, 'home'), c(1, 'member'), c(8, 'home'), c(1, 'member'), c(9, 'home')]
  expect(await w.calls(() => client.locate(id(4), child.root, 'read_records', child))).toEqual([...route, c(9, 'read_records'), H])
  expect(await w.calls(() => client.store(id(4)).resolve_record({ key: child, record_key: 'moonlight_address' }))).toEqual([
    H, c(9, 'resolve_record'), H,
  ])
  expect(await w.calls(() => client.quoteRenewal(id(4), { name: nameRef, years: 1 }))).toEqual([H, c(9, 'quote_renewal'), H])
  expect(await w.calls(() => client.store(id(4)).home({ root: child.root }))).toEqual([H])
  expect((await client.quoteRenewal(id(4), { name: nameRef, years: 1 })).store).toBe(id(9))
})

it('a plain read is read once per height', async () => {
  const w = await world()
  const client = await w.bootstrapped()
  expect(await w.calls(() => client.directory.config())).toEqual([H, c(1, 'config'), H])
  expect(await w.calls(() => client.directory.config())).toEqual([H])
  w.chain.height++
  expect(await w.calls(() => client.directory.config())).toEqual([H, c(1, 'config'), H])
})

it('registrationPlacement and prepareRegistration read each home and the selection once', async () => {
  const w = await world()
  const client = await w.bootstrapped()
  const placement = [H, c(1, 'members'), c(4, 'home'), c(8, 'home'), c(9, 'home'), c(9, 'capacity')]
  expect(await w.calls(() => client.registrationPlacement(nameKey('fresh.dusk').root))).toEqual([...placement, H])
  w.chain.height++
  expect(await w.calls(() => client.prepareRegistration(registration('fresh')))).toEqual([
    ...placement, c(1, 'registration_context'),
    // The policy is verified once; its config is read again as the selection's.
    c(3, 'interface_version'), c(3, 'binding'), c(3, 'config'), c(3, 'config'),
    c(9, 'quote_registration'), H,
  ])
  const again = await client.prepareRegistration(registration('fresh'))
  expect(again).toMatchObject({ store: id(9), canonicalStore: null, height: 102n })
  w.log.length = 0
  await client.prepareRegistration(registration('fresh'))
  expect(w.log).toEqual([H])
})

it('prepareRegistration reads a released root\'s name once', async () => {
  const w = await world()
  const client = await w.bootstrapped()
  released(w, 'gone')
  expect(await w.calls(() => client.prepareRegistration(registration('gone')))).toEqual([
    H, c(1, 'members'), c(4, 'home'), c(8, 'home'), c(9, 'home'), c(9, 'get_name'),
    c(1, 'registration_context'), c(3, 'interface_version'), c(3, 'binding'), c(3, 'config'), c(3, 'config'),
    c(9, 'quote_registration'), H,
  ])
  const prepared = await client.prepareRegistration(registration('gone'))
  expect(prepared).toMatchObject({ store: id(9), canonicalStore: id(9), releasedRoot: null })
  expect(prepared.quoteRequest).toMatchObject({ previous_generation: 7n, previous_grace_end: 50n, height: 101n })
})

it('quoteRegistration reads the selection, config and quote once per height', async () => {
  const w = await world()
  const client = await w.bootstrapped()
  await client.prepareRegistration(registration('fresh'))
  const args = {
    node: nameKey('fresh.dusk').node, label: 'fresh', years: 1, actor: bytes(10),
    expected_policy_version: 1n, expected_policy_config_version: 1n,
  }
  expect(await w.calls(() => client.quoteRegistration(id(9), args))).toEqual([H])
  w.chain.height++
  expect(await w.calls(() => client.quoteRegistration(id(9), args))).toEqual([
    H, c(1, 'registration_context'), c(3, 'config'), c(9, 'quote_registration'), H,
  ])
})

it('a name page reads each fact once at one height', async () => {
  const w = await world()
  const client = await w.bootstrapped()
  const page = async () => {
    const name = await client.getName('child.example.dusk')
    await client.locate(name.store, child.root, 'read_records', child)
    await client.locate(name.store, child.root, 'resolve_record', { key: child, record_key: 'moonlight_address' })
    await client.verifyPrimary(endpoint)
    await client.quoteRenewal(name.store, { name: nameRef, years: 1 })
    await client.directory.config()
  }
  const sequential = await w.calls(page)
  expect(sequential).toEqual([
    H, c(1, 'members'), c(4, 'home'), c(8, 'home'), c(9, 'home'), c(9, 'get_name'), H,
    H, c(9, 'read_records'), H,
    H, c(9, 'resolve_record'), H,
    H, c(4, 'resolve_primary'), c(8, 'resolve_primary'), c(9, 'resolve_primary'), H,
    H, c(9, 'quote_renewal'), H,
    H, c(1, 'config'), H,
  ])
  // The same page concurrently, after a block: one height read opens every snapshot.
  w.chain.height++
  const concurrent = await w.calls(async () => {
    await Promise.all([page(), page(), page()])
  })
  // Three pages read what one does, and open and close their snapshots with as many height reads.
  expect(concurrent.filter((call) => call !== H).sort()).toEqual(sequential.filter((call) => call !== H).sort())
  expect(concurrent.filter((call) => call === H).length).toBeLessThanOrEqual(sequential.filter((call) => call === H).length)
})

it('concurrent identical reads share one request, and their snapshots one height read on each side', async () => {
  const w = await world()
  const client = await w.bootstrapped()
  const results = await Promise.all(Array.from({ length: 5 }, () => client.getName('child.example.dusk', id(4))))
  expect(w.log).toEqual([
    H, c(1, 'member'), c(4, 'home'), c(1, 'member'), c(8, 'home'), c(1, 'member'), c(9, 'home'), c(9, 'get_name'), H,
  ])
  for (const r of results) expect(r).toEqual(results[0])
  // Each caller gets its own objects.
  results[0].forwards.pop()
  expect(results[1].forwards).toHaveLength(2)
})

it('does not keep a failed read: every caller sharing it sees the failure, and the next read asks again', async () => {
  const w = await world()
  const client = await w.bootstrapped()
  const failure = new Error('Contract read failed (get_name): unavailable')
  w.chain.replies.set(c(9, 'get_name'), failure)
  const runs = await Promise.allSettled(Array.from({ length: 3 }, () => client.getName('child.example.dusk')))
  expect(runs.map((r) => r.status)).toEqual(['rejected', 'rejected', 'rejected'])
  for (const r of runs) expect((r as PromiseRejectedResult).reason).toBe(failure)
  expect(w.log.filter((call) => call === c(9, 'get_name'))).toHaveLength(1)
  w.chain.replies.delete(c(9, 'get_name'))
  w.log.length = 0
  expect((await client.getName('child.example.dusk')).store).toBe(id(9))
  // Membership and homes were kept: only the failed read is asked again.
  expect(w.log).toEqual([H, c(9, 'get_name'), H])
})

it('does not keep a failed height read, and every snapshot sharing it sees the failure', async () => {
  const w = await world()
  const client = await w.bootstrapped()
  let fail = true
  w.chain.onHeight = async () => {
    await new Promise((r) => setTimeout(r, 5))
    if (fail) throw new Error('height offline')
  }
  const runs = await Promise.allSettled([client.directory.config(), client.getName('child.example.dusk')])
  expect(runs.map((r) => (r as PromiseRejectedResult).reason?.message)).toEqual(['height offline', 'height offline'])
  expect(w.log).toEqual([H])
  fail = false
  expect((await client.directory.config()).store_count).toBe(3)
})

it('forgets what it read at a height once it sees another', async () => {
  const w = await world()
  const client = await w.bootstrapped()
  expect((await client.getName('child.example.dusk')).value).toMatchObject({ Local: { name: { label: 'child' } } })
  // A block renews the name: the next read sees the new state, never the old one.
  w.chain.height++
  w.chain.names.set(`${id(9)}:${hex(child.node)}`, view(child, { expires_at: 5000n }))
  const renewed = await client.getName('child.example.dusk')
  expect(renewed).toMatchObject({ height: 102n, value: { Local: { name: { expires_at: 5000n } } } })
  // A block that only another snapshot sees clears it too.
  w.chain.height++
  w.chain.names.set(`${id(9)}:${hex(child.node)}`, view(child, { expires_at: 6000n }))
  await client.directory.config()
  expect((await client.getName('child.example.dusk')).value).toMatchObject({ Local: { name: { expires_at: 6000n } } })
})

it('reads again at the new height when a block lands while a read is answered', async () => {
  const w = await world()
  const client = await w.bootstrapped()
  await client.getName('child.example.dusk')
  // The block lands at the node while it answers get_name: that reply is the new state.
  w.chain.height++
  let landed = false
  w.chain.onRead = (call) => {
    if (call === c(9, 'get_name') && !landed) {
      landed = true
      w.chain.height++
      w.chain.names.set(`${id(9)}:${hex(child.node)}`, view(child, { expires_at: 7000n }))
    }
  }
  w.log.length = 0
  const result = await client.getName('child.example.dusk')
  expect(result).toMatchObject({ height: 103n, value: { Local: { name: { expires_at: 7000n } } } })
  // The first attempt read at 102 and saw 103 when it closed; the second read everything at 103.
  expect(w.log).toEqual([
    H, c(1, 'members'), c(4, 'home'), c(8, 'home'), c(9, 'home'), c(9, 'get_name'), H,
    c(1, 'members'), c(4, 'home'), c(8, 'home'), c(9, 'home'), c(9, 'get_name'), H,
  ])
})

it('never closes a snapshot with a height read sent before a read it shared was answered', async () => {
  // A opens at 102 and waits on get_name. B opens later with height reads of its own and joins A's
  // get_name, and the block lands while get_name is answered. No height read B sent before that reply
  // may close B: each result is the state at the height it reports.
  const w = await world()
  const client = await w.bootstrapped()
  await client.getName('child.example.dusk')
  w.chain.height++
  const held = gate()
  let holding = true
  w.chain.onRead = async (call) => {
    if (call === c(9, 'get_name') && holding) {
      holding = false
      await held.opened
      w.chain.height++
      w.chain.names.set(`${id(9)}:${hex(child.node)}`, view(child, { expires_at: 8000n }))
    }
  }
  const a = client.getName('child.example.dusk')
  while (!w.log.includes(c(9, 'get_name'))) await new Promise((r) => setTimeout(r, 1))
  const b = client.directory.config().then(() => client.getName('child.example.dusk', id(9)))
  while (!w.log.includes(c(1, 'config'))) await new Promise((r) => setTimeout(r, 1))
  await new Promise((r) => setTimeout(r, 20))
  held.open()
  for (const result of await Promise.all([a, b])) {
    const expires = (result.value as { Local: NameView }).Local.name.expires_at
    expect([result.height, expires]).toEqual(result.height === 103n ? [103n, 8000n] : [102n, 1000n])
  }
  expect((await a).height).toBe(103n)
})

it('closes a snapshot with a fresh height read when its operation reads through the transport itself', async () => {
  const w = await world()
  const client = await w.bootstrapped()
  await client.getName('child.example.dusk')
  let read = 0
  const seen: bigint[] = []
  const result = await client.snapshot(async (height) => {
    seen.push(height)
    // A read the client cannot see; a block lands while the node answers the first one.
    const reply = await w.transport.read(id(1), 'config', encode(null))
    if (read++ === 0) w.chain.height++
    return { height, reply: decode(reply) }
  })
  expect(seen).toEqual([101n, 102n])
  expect(result.height).toBe(102n)
})

it('runs nested snapshots, as an integration composes them, at one height', async () => {
  const w = await world()
  const client = await w.bootstrapped()
  let attempts = 0
  const result = await client.snapshot(async (height) => {
    attempts++
    const name = await client.getName('child.example.dusk')
    // A block lands once, after the inner snapshot committed: the outer one must read again.
    if (attempts === 1) w.chain.height++
    return { height, inner: name.height }
  })
  expect(attempts).toBe(2)
  expect(result).toEqual({ height: 102n, inner: 102n })
})

it('gives up after three crossed attempts, and rethrows a failure that repeats at every height', async () => {
  const w = await world()
  const client = await w.bootstrapped()
  w.chain.onRead = (call) => {
    if (call === c(9, 'get_name')) w.chain.height++
  }
  await expect(client.getName('child.example.dusk')).rejects.toThrow('Chain tip changed during read; retry the snapshot')
  expect(w.log.filter((call) => call === c(9, 'get_name'))).toHaveLength(3)
  w.chain.replies.set(c(9, 'get_name'), new Error('Contract read failed (get_name): trapped'))
  await expect(client.getName('child.example.dusk')).rejects.toThrow('Contract read failed (get_name): trapped')
  // A failure at an unchanged height is final after one attempt.
  w.chain.onRead = undefined
  w.log.length = 0
  await expect(client.getName('child.example.dusk')).rejects.toThrow('Contract read failed (get_name): trapped')
  expect(w.log.filter((call) => call === c(9, 'get_name'))).toHaveLength(1)
})

it('validates every hop of a forward that appears at a new height, with the old route known', async () => {
  const w = await world()
  const client = await w.bootstrapped()
  await client.getName('child.example.dusk', id(4))
  // Store 9 forwards back to store 8: a lower ordinal, never accepted.
  w.chain.height++
  w.chain.homes.set(`${id(9)}:${hex(child.root)}`, { Forwarded: forward(child.root, 8, 1) })
  await expect(client.getName('child.example.dusk', id(4))).rejects.toThrow('Non-monotone or invalid shard forwarding')
  await expect(client.locate(id(4), child.root, 'read_records', child)).rejects.toThrow('Non-monotone or invalid shard forwarding')
  // A forward to a store the directory does not admit.
  w.chain.height++
  w.chain.homes.set(`${id(9)}:${hex(child.root)}`, { Forwarded: forward(child.root, 0x77, 3) })
  await expect(client.getName('child.example.dusk', id(4))).rejects.toThrow('Unadmitted store')
  // The name read at its home forwards again, to a lower ordinal: rejected after the home said Local.
  w.chain.height++
  w.chain.homes.set(`${id(9)}:${hex(child.root)}`, 'Local')
  w.chain.replies.set(c(9, 'get_name'), { Forwarded: forward(child.root, 4, 0) })
  await expect(client.getName('child.example.dusk', id(4))).rejects.toThrow('Non-monotone or invalid shard forwarding')
  // A hint outside the directory only costs its admission read: the search finds the same route.
  await expect(client.getName('child.example.dusk', id(0x77))).rejects.toThrow('Non-monotone or invalid shard forwarding')
  await expect(client.getName('child.example.dusk')).rejects.toThrow('Non-monotone or invalid shard forwarding')
})

it('enforces the hop limit with the route already known at that height', async () => {
  const w = await world()
  const client = await w.bootstrapped({ hopLimit: 2 })
  expect((await client.getName('child.example.dusk', id(4))).store).toBe(id(9))
  const limited = w.client({ hopLimit: 1 })
  await limited.discover()
  await expect(limited.getName('child.example.dusk', id(4))).rejects.toThrow('Forwarding hop limit exceeded')
  await expect(limited.locate(id(4), child.root, 'read_records', child)).rejects.toThrow('Forwarding hop limit exceeded')
})

it('follows a move completed at a new height to the newly admitted store', async () => {
  const w = await world()
  const client = await w.bootstrapped()
  await client.getName('child.example.dusk')
  w.chain.height++
  w.release.contracts.set(id(16), { ...w.release.contracts.get(id(4))!, contractId: id(16), ordinal: 3 })
  w.release.drivers.set(id(16), jsonDriver)
  const moved = w.client()
  await moved.discover()
  w.chain.height++
  w.chain.stores.push(admission(16, 3))
  w.chain.homes.set(`${id(9)}:${hex(child.root)}`, { Forwarded: forward(child.root, 16, 3) })
  w.chain.homes.set(`${id(16)}:${hex(child.root)}`, 'Local')
  w.chain.names.set(`${id(16)}:${hex(child.node)}`, view(child))
  const result = await moved.getName('child.example.dusk', id(4))
  expect(result.store).toBe(id(16))
  expect(result.forwards.map((f) => hex(f.destination))).toEqual([id(8), id(9), id(16)])
})

it('never answers a verification read from what a state read left', async () => {
  const w = await world()
  const client = w.client()
  await client.verifyContract('directory', id(1))
  // State reads of the directory's admissions of stores 4 and 8, kept at this height.
  await client.directory.member({ kind: 'Store', id: bytes(4) })
  await client.directory.member({ kind: 'Store', id: bytes(8) })
  w.log.length = 0
  // Verification asks the directory itself, and the init's store for its own interface and binding.
  await client.verifyContract('store', id(4))
  expect(w.log).toEqual([c(1, 'member'), c(4, 'interface_version'), c(4, 'binding')])
  // An AddStore admission, past ordinal 0: the directory's own record is the proof of the rest.
  w.log.length = 0
  await client.verifyContract('store', id(8))
  expect(w.log).toEqual([c(1, 'member')])
})

it('keeps refusing a contract that failed a check, while reads of other contracts are shared', async () => {
  const w = await world()
  w.chain.replies.set(c(4, 'binding'), { directory: bytes(11), vault: bytes(2), network: 1 })
  const client = w.client()
  await expect(client.discover()).rejects.toThrow('Contract deployment binding mismatch')
  w.chain.replies.delete(c(4, 'binding'))
  w.chain.height++
  await expect(client.discover()).rejects.toThrow('Contract deployment binding mismatch')
  await expect(client.getName('child.example.dusk', id(4))).rejects.toThrow('Contract deployment binding mismatch')
  await expect(client.store(id(4)).stats()).rejects.toThrow('Contract deployment binding mismatch')
  // Reads that do not go through store 4 still answer.
  expect((await client.getName('child.example.dusk', id(9))).store).toBe(id(9))
})

it('reads a contract\'s interface and binding once, even when the attempt that verified it is abandoned', async () => {
  const w = await world()
  w.chain.preferred = true
  let last = ''
  w.chain.onRead = (call) => {
    last = call
  }
  // The first discovery attempt verifies everything, then sees a block land.
  w.chain.onHeight = () => {
    if (last === c(6, 'order_api_version')) {
      w.chain.height++
      last = ''
    }
  }
  const client = w.client()
  const state = await client.discover()
  expect(state.height).toBe(101n)
  const verification = w.log.filter((call) => /interface_version|binding|order_api_version/u.test(call))
  // What the directory probed (stores 8 and 9, and marketplace 6, past record version 1) is not read.
  expect(verification).toEqual([
    c(1, 'interface_version'), c(1, 'binding'),
    c(4, 'interface_version'), c(4, 'binding'), c(5, 'interface_version'), c(5, 'binding'),
    c(2, 'interface_version'), c(2, 'binding'), c(6, 'order_api_version'),
  ])
  // Both attempts read the directory's state: the second at the new height.
  expect(w.log.filter((call) => call === c(1, 'market'))).toHaveLength(2)
})

it.each([0, Infinity])('returns only state read at one height, the tip during the call, under random delays and blocks (heightReuseMs %s)', async (heightReuseMs) => {
  // Seeded: every read and height reply arrives after a random number of turns, in any order;
  // blocks land on their own schedule; the name's expiry and renewal quote are functions of the
  // height they are read at. Every result must be the state at the height it reports, and that
  // height the tip at some point during the call.
  let seed = 20261016
  const random = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 2 ** 32
  const sleep = async () => {
    for (let turns = Math.floor(random() * 8); turns > 0; turns--) await null
  }
  const w = await world()
  const client = await w.bootstrapped({ heightReuseMs })
  const state = () => {
    w.chain.names.set(`${id(9)}:${hex(child.node)}`, view(child, { expires_at: 1000n + w.chain.height }))
    w.chain.replies.set(c(9, 'quote_renewal'), {
      Local: { schedule_version: 3n, total_lux: '123', referral_lux: '12', new_expiry: 5000n + w.chain.height, new_grace_end: 6000n },
    })
  }
  state()
  w.chain.onRead = sleep
  w.chain.onHeight = sleep
  let running = true
  // Often enough that some attempts see a block land, rarely enough that others commit.
  const blocks = (async () => {
    while (running) {
      for (let turns = 30 + Math.floor(random() * 120); turns > 0 && running; turns--) await null
      w.chain.height++
      state()
    }
  })()
  let committed = 0,
    crossed = 0
  for (let round = 0; round < 12; round++)
    await Promise.all(
      Array.from({ length: 8 }, async (_, i) => {
        const start = w.chain.height
        try {
          if (i % 2) {
            const r = await client.quoteRenewal(id(4), { name: nameRef, years: 1 })
            expect((r.value as { Local: { new_expiry: bigint } }).Local.new_expiry).toBe(5000n + r.height)
            expect(r.height >= start && r.height <= w.chain.height).toBe(true)
          } else {
            const r = await client.getName('child.example.dusk', random() < 0.5 ? id(4) : undefined)
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
  expect(committed + crossed).toBe(96)
  expect(committed).toBeGreaterThan(0)
  expect(crossed).toBeGreaterThan(0)
  expect(w.chain.height).toBeGreaterThan(110n)
}, 60_000)

// Opening a snapshot at the height a height read that already arrived reported.
const reuse: ClientOptions = { heightReuseMs: Infinity }
/** A client that discovered the deployment at the height the chain is still at. */
async function discovered(w: World, options: ClientOptions = reuse) {
  const client = w.client(options)
  await client.discover()
  w.log.length = 0
  return client
}
/** A name page's reads, one after another, as an integration makes them. */
const namePage = (client: FrozenClient) => async () => {
  const name = await client.getName('child.example.dusk')
  await client.locate(name.store, child.root, 'read_records', child)
  await client.locate(name.store, child.root, 'resolve_record', { key: child, record_key: 'moonlight_address' })
  await client.verifyPrimary(endpoint)
  await client.quoteRenewal(name.store, { name: nameRef, years: 1 })
  await client.directory.config()
}

it('opens each snapshot of a name page at the height the one before it closed with', async () => {
  const w = await world()
  const client = await discovered(w)
  expect(await w.calls(namePage(client))).toEqual([
    c(4, 'home'), c(8, 'home'), c(9, 'home'), c(9, 'get_name'), H,
    c(9, 'read_records'), H,
    c(9, 'resolve_record'), H,
    c(4, 'resolve_primary'), c(8, 'resolve_primary'), c(9, 'resolve_primary'), H,
    c(9, 'quote_renewal'), H,
    // Everything is known at this height, yet a snapshot still closes with a height read sent after it began.
    H,
  ])
  // heightReuseMs 0: as before, a snapshot that reads anything new also opens with a height read.
  const old = await world()
  const fresh = await discovered(old, { heightReuseMs: 0 })
  expect(await old.calls(namePage(fresh))).toEqual([
    H, c(4, 'home'), c(8, 'home'), c(9, 'home'), c(9, 'get_name'), H,
    H, c(9, 'read_records'), H,
    H, c(9, 'resolve_record'), H,
    H, c(4, 'resolve_primary'), c(8, 'resolve_primary'), c(9, 'resolve_primary'), H,
    H, c(9, 'quote_renewal'), H,
    H,
  ])
})

it('opens concurrent snapshots at the height already read, and closes them with one height read', async () => {
  const w = await world()
  const client = await discovered(w)
  const results = await Promise.all(Array.from({ length: 5 }, () => client.getName('child.example.dusk', id(4))))
  expect(w.log).toEqual([c(4, 'home'), c(8, 'home'), c(9, 'home'), c(9, 'get_name'), H])
  for (const r of results) expect(r).toEqual(results[0])
  // Three pages at once read each fact once, with no more height reads than one page alone.
  w.log.length = 0
  await Promise.all([namePage(client)(), namePage(client)(), namePage(client)()])
  const concurrent = [...w.log]
  w.log.length = 0
  await namePage(client)()
  expect(concurrent.filter((call) => call !== H).sort()).toEqual([
    c(4, 'resolve_primary'), c(8, 'resolve_primary'), c(9, 'quote_renewal'), c(9, 'read_records'),
    c(9, 'resolve_primary'), c(9, 'resolve_record'),
  ].sort())
  expect(concurrent.filter((call) => call === H).length).toBeLessThanOrEqual(6)
  expect(w.log).toEqual([H, H, H, H, H, H])
})

it('opens at a height read that arrived less than heightReuseMs ago, 1000 by default, and reads a new one after', async () => {
  vi.useFakeTimers({ toFake: ['performance'] })
  try {
    const w = await world()
    // Discovery's closing height read arrives now.
    const client = await discovered(w, { heightReuseMs: 250 })
    vi.advanceTimersByTime(249)
    expect(await w.calls(() => client.directory.renewal_schedule())).toEqual([c(1, 'renewal_schedule'), H])
    // That snapshot's closing read arrived 250 ms ago: too long.
    vi.advanceTimersByTime(250)
    expect(await w.calls(() => client.directory.allocation())).toEqual([H, c(1, 'allocation'), H])
    vi.advanceTimersByTime(249)
    expect(await w.calls(() => client.directory.registration_context())).toEqual([c(1, 'registration_context'), H])
    const byDefault = await discovered(w, { heightReuseMs: undefined })
    expect(byDefault.heightReuseMs).toBe(1000)
    vi.advanceTimersByTime(999)
    expect(await w.calls(() => byDefault.directory.renewal_schedule())).toEqual([c(1, 'renewal_schedule'), H])
    vi.advanceTimersByTime(1000)
    expect(await w.calls(() => byDefault.directory.allocation())).toEqual([H, c(1, 'allocation'), H])
  } finally {
    vi.useRealTimers()
  }
})

it('never returns the state at a reused height the chain has left: the closing height read catches it', async () => {
  const w = await world()
  const client = await discovered(w)
  await client.getName('child.example.dusk')
  // A block renews the name before the client reads the height again.
  w.chain.height++
  w.chain.names.set(`${id(9)}:${hex(child.node)}`, view(child, { expires_at: 5000n }))
  w.log.length = 0
  expect(await client.getName('child.example.dusk')).toMatchObject({
    height: 101n, value: { Local: { name: { expires_at: 5000n } } },
  })
  // The first attempt read nothing new at 100, and its closing read opened the second at 101: what
  // reading a new height to open would have cost.
  expect(w.log).toEqual([H, c(1, 'members'), c(4, 'home'), c(8, 'home'), c(9, 'home'), c(9, 'get_name'), H])
})

it('costs at most one attempt when the height it reused is stale: the reads it had not made yet', async () => {
  const w = await world()
  const client = await w.bootstrapped(reuse)
  expect(await client.getName('child.example.dusk')).toMatchObject({ height: 101n, store: id(9) })
  expect(w.log).toEqual([
    c(4, 'home'), c(8, 'home'), c(9, 'home'), c(9, 'get_name'), H,
    c(1, 'members'), c(4, 'home'), c(8, 'home'), c(9, 'home'), c(9, 'get_name'), H,
  ])
})

it('allows one attempt at a reused height besides the three: four in all, three without reuse', async () => {
  for (const [options, attempts] of [[reuse, 4], [{ heightReuseMs: 0 }, 3]] as const) {
    const w = await world()
    const client = await discovered(w, options)
    w.chain.onRead = (call) => {
      if (call === c(9, 'get_name')) w.chain.height++
    }
    await expect(client.getName('child.example.dusk')).rejects.toThrow('Chain tip changed during read; retry the snapshot')
    expect(w.log.filter((call) => call === c(9, 'get_name'))).toHaveLength(attempts)
  }
})

it('never counts the failure of an attempt at a reused height among three that must repeat', async () => {
  const w = await world()
  const client = await discovered(w)
  let first = true
  w.chain.onRead = (call) => {
    if (call !== c(9, 'get_name')) return
    w.chain.height++
    w.chain.replies.set(call, new Error(`Contract read failed (get_name): ${first ? 'busy' : 'trapped'}`))
    first = false
  }
  // Busy once at the reused height, then trapped at each of three more: the repeated failure is thrown.
  await expect(client.getName('child.example.dusk')).rejects.toThrow('Contract read failed (get_name): trapped')
  expect(w.log.filter((call) => call === c(9, 'get_name'))).toHaveLength(4)
})

it('reads again when a block lands during a read at a reused height', async () => {
  const w = await world()
  const client = await discovered(w)
  let landed = false
  w.chain.onRead = (call) => {
    if (call === c(9, 'get_name') && !landed) {
      landed = true
      w.chain.height++
      w.chain.names.set(`${id(9)}:${hex(child.node)}`, view(child, { expires_at: 7000n }))
    }
  }
  expect(await client.getName('child.example.dusk')).toMatchObject({
    height: 101n, value: { Local: { name: { expires_at: 7000n } } },
  })
  expect(w.log).toEqual([
    c(4, 'home'), c(8, 'home'), c(9, 'home'), c(9, 'get_name'), H,
    c(1, 'members'), c(4, 'home'), c(8, 'home'), c(9, 'home'), c(9, 'get_name'), H,
  ])
})

it('checks a later height before a failure at a reused height is final, and reads again when the chain moved', async () => {
  const w = await world()
  const client = await discovered(w)
  w.chain.replies.set(c(9, 'get_name'), new Error('Contract read failed (get_name): trapped'))
  await expect(client.getName('child.example.dusk')).rejects.toThrow('trapped')
  // One attempt: the height read after the failure saw the tip where the attempt read.
  expect(w.log).toEqual([c(4, 'home'), c(8, 'home'), c(9, 'home'), c(9, 'get_name'), H])
  // A block lands, and the name read fails once more at the height the client last read.
  w.chain.height++
  let reads = 0
  w.chain.onRead = (call) => {
    if (call === c(9, 'get_name') && reads++ === 1) w.chain.replies.delete(call)
  }
  w.log.length = 0
  expect(await client.getName('child.example.dusk')).toMatchObject({ height: 101n, store: id(9) })
  expect(w.log).toEqual([
    c(9, 'get_name'), H,
    c(1, 'members'), c(4, 'home'), c(8, 'home'), c(9, 'home'), c(9, 'get_name'), H,
  ])
})

it('reads again after a block replaces the tip at the same height', async () => {
  const w = await world()
  const client = await w.bootstrapped()
  await client.getName('child.example.dusk')
  // The same tip: every read is shared.
  expect(await w.calls(() => client.getName('child.example.dusk'))).toEqual([H])
  // Another block at height 101: nothing read on the one it replaced is used again.
  w.chain.fork++
  w.chain.names.set(`${id(9)}:${hex(child.node)}`, view(child, { expires_at: 4321n }))
  expect(await w.calls(() => client.getName('child.example.dusk'))).toEqual([
    H, c(1, 'members'), c(4, 'home'), c(8, 'home'), c(9, 'home'), c(9, 'get_name'), H,
  ])
  expect(await client.getName('child.example.dusk')).toMatchObject({ height: 101n, value: { Local: { name: { expires_at: 4321n } } } })
})

it('reads again when a block replaces the tip at the same height while an operation reads', async () => {
  const w = await world()
  const client = await w.bootstrapped()
  let read = false,
    replaced = false
  w.chain.onRead = (call) => {
    if (call === c(9, 'get_name')) read = true
  }
  // The block is replaced once the name was read, before the operation closes.
  w.chain.onHeight = () => {
    if (read && !replaced) {
      replaced = true
      w.chain.fork++
      w.chain.names.set(`${id(9)}:${hex(child.node)}`, view(child, { expires_at: 4321n }))
    }
  }
  expect(await client.getName('child.example.dusk')).toMatchObject({ height: 101n, value: { Local: { name: { expires_at: 4321n } } } })
  expect(w.log.filter((call) => call === c(9, 'get_name'))).toHaveLength(2)
})

it('by height alone, shares an answered read with another operation only within heightReuseMs, and one in flight always', async () => {
  vi.useFakeTimers({ toFake: ['performance'] })
  try {
    const w = await world()
    // A transport that reads heights only, without the block's hash.
    const { currentBlock: _, ...heightOnly } = w.transport
    const client = new FrozenClient(w.release, { transport: heightOnly, heightReuseMs: 250 })
    await client.verifyContract('directory', id(1))
    expect(await w.calls(() => client.directory.config())).toEqual([H, c(1, 'config'), H])
    vi.advanceTimersByTime(100)
    expect(await w.calls(() => client.directory.config())).toEqual([H])
    // Older than the window: read again, though the height is the same.
    vi.advanceTimersByTime(300)
    expect(await w.calls(() => client.directory.config())).toEqual([H, c(1, 'config'), H])
    // 0: only a read still in flight is shared.
    const strict = new FrozenClient(w.release, { transport: heightOnly, heightReuseMs: 0 })
    await strict.verifyContract('directory', id(1))
    expect(await w.calls(() => Promise.all([strict.directory.config(), strict.directory.config()]))).toEqual([H, c(1, 'config'), H])
    expect(await w.calls(() => strict.directory.config())).toEqual([H, c(1, 'config'), H])
  } finally {
    vi.useRealTimers()
  }
})

it('throws a refusal at a reused height at once', async () => {
  const w = await world()
  const client = w.client(reuse)
  await client.directory.config()
  w.chain.replies.set(c(4, 'binding'), { directory: bytes(11), vault: bytes(2), network: 1 })
  w.log.length = 0
  await expect(client.discover()).rejects.toThrow('Contract deployment binding mismatch')
  // No height read: the refusal does not depend on one.
  expect(w.log).toEqual([c(1, 'members'), c(1, 'members'), c(4, 'interface_version'), c(4, 'binding')])
})

it('prices a registration again at the new height when a quote at a reused height is priced later', async () => {
  const w = await world()
  const client = await discovered(w)
  await client.prepareRegistration(registration('fresh'))
  // A block lands; the client has not read the height since. The store prices at the new tip.
  w.chain.height++
  w.log.length = 0
  const prepared = await client.prepareRegistration(registration('other'))
  expect(prepared).toMatchObject({ height: 101n, quote: { height: 101n }, quoteRequest: { height: 101n } })
  expect(w.log).toEqual([
    c(4, 'home'), c(8, 'home'), c(9, 'home'), c(9, 'quote_registration'),
    H, c(1, 'members'), c(4, 'home'), c(8, 'home'), c(9, 'home'), c(9, 'capacity'),
    c(1, 'registration_context'), c(3, 'config'), c(9, 'quote_registration'), H,
  ])
})

it('opens a snapshot whose operation reads through the transport at a reused height, and closes it with a new one', async () => {
  const w = await world()
  const client = await discovered(w)
  w.chain.height++
  const heights: bigint[] = []
  const result = await client.snapshot(async (height) => {
    heights.push(height)
    await w.transport.read(id(1), 'config', encode(null))
    return height
  })
  expect(heights).toEqual([100n, 101n])
  expect(result).toBe(101n)
  expect(w.log).toEqual([c(1, 'config'), H, c(1, 'config'), H])
})

it('takes a reuse window of zero or more milliseconds, 1000 by default', async () => {
  const r = await jsonRelease()
  expect(new FrozenClient(r).heightReuseMs).toBe(1000)
  for (const ms of [0, 1, 1000, Infinity]) expect(new FrozenClient(r, { heightReuseMs: ms }).heightReuseMs).toBe(ms)
  for (const ms of [-1, NaN, '5' as unknown as number])
    expect(() => new FrozenClient(r, { heightReuseMs: ms })).toThrow('heightReuseMs must be zero or more')
})
