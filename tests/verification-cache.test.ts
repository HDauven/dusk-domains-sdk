import { describe, it, expect, vi } from 'vitest'
import { ContractRefusedError, FrozenClient, UnverifiedContractError, type ClientOptions, type VerificationCache } from '../src/frozen/client.ts'
import { registrationCalls } from '../src/frozen/actions.ts'
import { parseJson, stringifyJson } from '../src/frozen/json.ts'
import { fromHex, nameKey } from '../src/frozen/bytes.ts'
import { estimateRegistrationQuote, launchPolicyConfig } from '../src/core/pricing.ts'
import { createDuskDomainsConnectApp } from '../src/wallet/duskConnectApp.ts'
import { buildCall } from '../src/frozen/calls.ts'
import { bytes, id, jsonRelease, sample } from './helpers.ts'
import type { ReadTransport } from '../src/frozen/transport.ts'
import type { LoadedRelease, ReleaseContract } from '../src/frozen/manifest.ts'
import type { Forward } from '../src/frozen/types.ts'
import { clocks, lensEntry, lensWorld, store, type LensWorld } from './lens-world.ts'
import { verifiedContract } from '../src/frozen/trust.ts'

const encode = (v: unknown) => new TextEncoder().encode(stringifyJson(v))
const decode = (b: Uint8Array) => parseJson(new TextDecoder().decode(b)) as Record<string, any>
const kinds: Record<number, string> = { 1: 'Directory', 2: 'Vault', 3: 'Policy', 4: 'Store', 5: 'Resolver', 6: 'Marketplace' }
const verification = /\.(interface_version|binding|order_api_version)$/u
const wallet = { request: async (method: string) => (method === 'dusk_chainId' ? 'dusk:1' : { median: '1' }) }
// Fixture rows, parsed once: `sample` reads the whole fixture file on every call.
const samples = {
  RegistrationContext: sample('RegistrationContext'),
  DirectoryConfig: sample('DirectoryConfig'),
  Admission: sample('Admission'),
  Market: sample('Market'),
  Capacity: sample('Capacity'),
}

/** sessionStorage as an app passes it: string values by string key. */
function storage() {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value)
    },
  }
}
/**
 * Directory 1, vault 2, policy 3, store 4, resolver 5 and the preferred marketplace 6, answering
 * like the frozen contracts. All are the directory's init's, which probes none of them, so the
 * client reads each one's interface and binding. `binding` overrides a contract's binding, by its byte.
 * With `probed`, store 7 is admitted too, at ordinal 1: an AddStore's, which the directory probed.
 */
async function world({ probed = false } = {}) {
  const base = await jsonRelease()
  // Descriptors are shared with the cached test release; replace, never mutate.
  const release: LoadedRelease = probed
    ? { ...base, contracts: new Map([...base.contracts, [id(7), { ...base.contracts.get(id(4))!, contractId: id(7) }]]), drivers: new Map([...base.drivers, [id(7), base.drivers.get(id(4))!]]) }
    : base
  const stores = [{ ...samples.Admission, id: bytes(4), ordinal: 0, interface_version: 1, retiring: false }]
  if (probed) stores.push({ ...samples.Admission, id: bytes(7), ordinal: 1, interface_version: 1, retiring: false })
  const chain = {
    height: 100n,
    binding: new Map<number, unknown>(),
    onHeight: undefined as undefined | (() => void),
    /** Runs as a read arrives, before it is answered. */
    onRead: undefined as undefined | ((call: string) => void | Promise<void>),
    /** A root store 4 forwards to store 7, which holds it no more than any other store. */
    forward: undefined as undefined | Forward,
    /** The policy's live config, when it differs from the one the release committed to. */
    policyConfig: undefined as undefined | ReturnType<typeof launchPolicyConfig>,
  }
  const log: string[] = []
  const transport: ReadTransport = {
    currentBlockHeight: async () => {
      log.push('height')
      chain.onHeight?.()
      return chain.height
    },
    read: async (target, fn, data) => {
      const n = Number.parseInt(target.slice(0, 2), 16)
      log.push(`${target.slice(0, 2)}.${fn}`)
      await chain.onRead?.(`${target.slice(0, 2)}.${fn}`)
      const args = decode(data)
      const registration = { ...samples.RegistrationContext, policy: bytes(3), policy_version: 1n, newest_store: bytes(4) }
      const reply = (() => {
        if (fn === 'interface_version')
          return { kind: kinds[n], version: 1, move_version: n === 4 || n === 7 ? 1 : 0, custody_version: n === 4 || n === 6 || n === 7 ? 1 : 0 }
        if (fn === 'binding') return chain.binding.get(n) ?? { directory: bytes(1), vault: bytes(2), network: 1 }
        if (fn === 'order_api_version') return 1
        if (n === 1 && fn === 'config')
          return {
            ...samples.DirectoryConfig, binding: { directory: bytes(1), vault: bytes(2), network: 1 },
            store_count: stores.length, resolver_count: 1, registration, preferred_marketplace: bytes(6), market_version: 1n,
          }
        if (n === 1 && fn === 'members')
          return args.kind === 'Store'
            ? { rows: stores, next: null }
            : { rows: [{ ...samples.Admission, id: bytes(5), ordinal: 0, interface_version: 1, retiring: false }], next: null }
        if (n === 1 && fn === 'member')
          return stores.find((a) => a.id[0] === args.id[0]) ?? { ...samples.Admission, id: args.id, ordinal: 0, interface_version: 1, retiring: false }
        if (n === 1 && fn === 'market') return { ...samples.Market, id: args.id, interface_version: 1, state: 'Listed', version: 1n }
        if (n === 1 && fn === 'registration_context') return registration
        if (n === 3 && fn === 'config') return chain.policyConfig ?? launchPolicyConfig()
        if ((n === 4 || n === 7) && (fn === 'home' || fn === 'read_records'))
          return n === 4 && chain.forward ? { Forwarded: chain.forward } : 'Absent'
        if ((n === 4 || n === 7) && fn === 'capacity') return { ...samples.Capacity, sealed: false }
        if (n === 4 && fn === 'quote_registration') {
          const { estimate, total_lux, ...quote } = estimateRegistrationQuote(launchPolicyConfig(), {
            version: 1, directory: bytes(1), store: fromHex(target, 32), node: args.node, label: args.label,
            actor: args.actor, years: args.years, height: chain.height, previous_generation: 0n,
            previous_grace_end: null, policy_version: 1n,
          })
          void estimate
          return { policy: bytes(3), policy_version: 1n, quote, total_lux, height: chain.height }
        }
        throw new Error(`Unexpected read ${target}.${fn}`)
      })()
      return encode(reply)
    },
  }
  // The test transport stands for the manifest's node, and says so for the cache's keys.
  const client = (options: ClientOptions = {}, r: LoadedRelease = release) =>
    new FrozenClient(r, { transport, transportNamespace: r.manifest.nodeUrl, ...options })
  return { chain, release, log, transport, client }
}
const commitAt = (n: number) => buildCall('store', id(n), 'commit', { hash: bytes(1) })
/** A fetch that serves the node's HTTP API from `transport`, as a proxy in front of it would. */
function serving(transport: ReadTransport): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/on/graphql/query'))
      return new Response(`{"block":{"header":{"height":${await transport.currentBlockHeight()},"hash":"${'ab'.repeat(32)}"}}}`)
    const [, target, fn] = /\/on\/contracts:([\da-f]{64})\/(\w+)$/u.exec(url)!
    return new Response(await transport.read(target, fn, new Uint8Array(await new Response(init!.body).arrayBuffer())))
  }) as typeof fetch
}
const registration = { actor: bytes(10), label: 'fresh', years: 1, secret: bytes(33), commitHeight: 100n }
const withDescriptor = (r: LoadedRelease, n: number, change: Partial<ReleaseContract>): LoadedRelease => {
  const contracts = new Map(r.contracts)
  contracts.set(id(n), { ...contracts.get(id(n))!, ...change })
  return { ...r, contracts, manifest: { ...r.manifest, contracts: [...contracts.values()] } }
}

it('reads through what an earlier client verified, and verifies from the chain what it quotes under or signs for', async () => {
  const w = await world()
  const cache = storage()
  const first = w.client({ verificationCache: cache })
  await first.discover()
  await first.prepareRegistration(registration)
  // Directory, vault, store, resolver, marketplace and policy.
  expect(cache.items.size).toBe(6)
  w.log.length = 0
  const second = w.client({ verificationCache: cache })
  await second.discover()
  expect(w.log).toEqual(['height', '01.config', '01.members', '01.members', '01.market', 'height'])
  w.chain.height++
  w.log.length = 0
  const prepared = await second.prepareRegistration(registration)
  // A quote that can be signed: its policy, and the directory vouching for it, are read again.
  expect(w.log.filter((call) => verification.test(call))).toEqual([
    '01.interface_version', '01.binding', '03.interface_version', '03.binding',
  ])
  // The policy's config is read as the directory's selection once per attempt (the first may open at
  // the height discovery closed with, which the block left): the first attempt's is the one its init
  // commitment read.
  expect(w.log.filter((call) => call === '03.config')).toHaveLength(
    w.log.filter((call) => call === '04.quote_registration').length,
  )
  // Signing for a contract only the cache vouched for verifies it from the chain first, once.
  const app = createDuskDomainsConnectApp(wallet, second.release)
  w.log.length = 0
  expect((await app.prepare(prepared.calls.reveal)).fnName).toBe('register')
  expect(w.log.filter((call) => verification.test(call))).toEqual(['04.interface_version', '04.binding'])
  w.log.length = 0
  expect((await app.prepare(buildCall('store', id(4), 'commit', { hash: bytes(1) }))).contractId).toBe(id(4))
  expect(w.log).toEqual([])
})

it('never signs for a contract only the cache vouched for: the chain refuses it then, for reads too', async () => {
  const w = await world()
  const cache = storage()
  await w.client({ verificationCache: cache }).discover()
  // The node now binds store 4 to another directory; the cache holds what it read before.
  w.chain.binding.set(4, { directory: bytes(9), vault: bytes(2), network: 1 })
  const client = w.client({ verificationCache: cache })
  await client.discover()
  expect(await client.store(id(4)).capacity()).toMatchObject({ sealed: false })
  const app = createDuskDomainsConnectApp(wallet, client.release)
  const commit = buildCall('store', id(4), 'commit', { hash: bytes(1) })
  // Verified from the chain before signing, it is refused: then and for good.
  for (let i = 0; i < 2; i++) {
    const error = await app.prepare(commit).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(UnverifiedContractError)
    expect((error as Error).cause).toBeInstanceOf(ContractRefusedError)
    expect((error as Error).cause).toMatchObject({ contractId: id(4), message: 'Contract deployment binding mismatch' })
  }
  await expect(client.store(id(4)).capacity()).rejects.toThrow('Contract deployment binding mismatch')
  // The live result replaced nothing in the cache: a new client reads from it, and signs nothing.
  const next = w.client({ verificationCache: cache })
  await next.discover()
  const error = await createDuskDomainsConnectApp(wallet, next.release).prepare(commit).catch((e: unknown) => e)
  expect(error).toBeInstanceOf(UnverifiedContractError)
  expect((error as Error).cause).toMatchObject({ contractId: id(4), message: 'Contract deployment binding mismatch' })
})

it('quotes a registration only under a policy the chain shows, never under the cache\'s word', async () => {
  const w = await world()
  const cache = storage()
  const first = w.client({ verificationCache: cache })
  await first.discover()
  const prepared = await first.prepareRegistration(registration)
  // The node's policy now has a configuration the release did not commit to; the cache holds the
  // init commitment it read before.
  w.chain.policyConfig = { ...launchPolicyConfig(), minimum_root_bytes: 4 }
  const client = w.client({ verificationCache: cache })
  await client.discover()
  // A preview is for display, and may rest on the cache; it never builds a call.
  const preview = await client.previewRegistration({ label: 'fresh', years: 1, actor: bytes(10) })
  expect(() => registrationCalls(preview.store, { ...registration, commitmentStore: preview.store, quote: preview.quote })).toThrow('quote again')
  // A quote that can be signed reads the policy from the chain, which refuses it, for good.
  await expect(client.prepareRegistration(registration)).rejects.toThrow(ContractRefusedError)
  await expect(client.prepareRegistration(registration)).rejects.toThrow('Policy initialization does not match its init commitment')
  await expect(client.policy(id(3)).config()).rejects.toThrow('Policy initialization does not match its init commitment')
  // Nothing this client quoted can be signed, nor another client's reveal.
  await expect(createDuskDomainsConnectApp(wallet, client.release).prepare(prepared.calls.reveal)).rejects.toThrow('is not verified against this release')
})

it('keys entries by the chain state the transport reads, and keeps none for a custom transport that names none', async () => {
  const w = await world()
  const cache = storage()
  await w.client({ verificationCache: cache }).discover()
  expect(cache.items.size).toBe(5)
  // A custom transport that names no chain state reads and writes no entry.
  w.log.length = 0
  await w.client({ verificationCache: cache, transportNamespace: undefined }).discover()
  expect(w.log.filter((call) => verification.test(call))).toHaveLength(11)
  expect(cache.items.size).toBe(5)
  // Another node behind the same manifest has entries of its own.
  w.log.length = 0
  await w.client({ verificationCache: cache, transportNamespace: 'https://other-node.invalid' }).discover()
  expect(w.log.filter((call) => verification.test(call))).toHaveLength(11)
  expect(cache.items.size).toBe(10)
  w.log.length = 0
  await w.client({ verificationCache: cache }).discover()
  expect(w.log.filter((call) => verification.test(call))).toEqual([])
})

it('keeps only what a deployed contract cannot change', async () => {
  const w = await world()
  const cache = storage()
  const client = w.client({ verificationCache: cache })
  await client.discover()
  await client.prepareRegistration(registration)
  expect(cache.items.size).toBe(6)
  for (const value of cache.items.values()) {
    const entry = parseJson(value) as Record<string, unknown>
    expect(Object.keys(entry).every((k) => ['version', 'interface', 'binding', 'orderApi', 'init'].includes(k))).toBe(true)
    expect(entry).toHaveProperty('interface')
    expect(entry).toHaveProperty('binding')
  }
  const text = [...cache.items.values()].join('\n')
  for (const state of ['members', 'store_count', 'registration', 'quote', 'home', 'records', 'policy_version'])
    expect(text).not.toContain(state)
})

it('binds what it keeps to the node, the deployment and the contract\'s release descriptor', async () => {
  const w = await world()
  const cache = storage()
  await w.client({ verificationCache: cache }).discover()
  // Another node: everything is read from it again.
  const elsewhere = { ...w.release, manifest: { ...w.release.manifest, nodeUrl: 'https://other-node.invalid' } }
  w.log.length = 0
  await w.client({ verificationCache: cache }, elsewhere).discover()
  expect(w.log.filter((call) => verification.test(call))).toHaveLength(11)
  // A release that commits to other code for the store: compared with its admission, and refused.
  const other = withDescriptor(w.release, 4, { codeHash: 'aa'.repeat(32) })
  await expect(w.client({ verificationCache: cache }, other).discover()).rejects.toThrow('Admission artifact/version mismatch')
  // Another driver for the resolver: read again, never answered from the old one's entry.
  const driver = withDescriptor(w.release, 5, { dataDriver: { ...w.release.contracts.get(id(5))!.dataDriver, sha256: 'bb'.repeat(32) } })
  w.log.length = 0
  await w.client({ verificationCache: cache }, driver).discover()
  expect(w.log.filter((call) => verification.test(call))).toEqual(['05.interface_version', '05.binding'])
})

it('ignores an entry that fails a check, and verifies from the chain', async () => {
  const w = await world()
  const cache = storage()
  await w.client({ verificationCache: cache }).discover()
  expect(cache.items.size).toBe(5)
  const forged = (change: (entry: Record<string, any>) => unknown) => {
    for (const [key, value] of cache.items) cache.items.set(key, stringifyJson(change(parseJson(value) as Record<string, any>)))
  }
  // Every entry now claims another deployment's binding.
  forged((entry) => ({ ...entry, binding: { ...entry.binding, directory: bytes(9) } }))
  w.log.length = 0
  const live = w.client({ verificationCache: cache })
  await live.discover()
  expect(w.log.filter((call) => verification.test(call))).toHaveLength(11)
  // A wrong entry neither refuses a good contract nor survives its live verification.
  expect(await live.directory.config()).toMatchObject({ store_count: 1 })
  for (const value of cache.items.values()) expect((parseJson(value) as any).binding.directory).toEqual(bytes(1))
  // Malformed entries are ignored too.
  forged(() => ({ interface: 'garbage' }))
  for (const [key] of cache.items) cache.items.set(key, '{not json')
  w.log.length = 0
  await w.client({ verificationCache: cache }).discover()
  expect(w.log.filter((call) => verification.test(call))).toHaveLength(11)
})

it('keeps nothing for a contract the chain refuses', async () => {
  const w = await world()
  w.chain.binding.set(4, { directory: bytes(9), vault: bytes(2), network: 1 })
  const cache = storage()
  await expect(w.client({ verificationCache: cache }).discover()).rejects.toThrow('Contract deployment binding mismatch')
  // Only the directory, verified before the store, was kept.
  expect([...cache.items.values()].map((v) => (parseJson(v) as any).interface.kind)).toEqual(['Directory'])
  await expect(w.client({ verificationCache: cache }).discover()).rejects.toThrow('Contract deployment binding mismatch')
})

it('keeps nothing a snapshot it abandoned verified, until one commits', async () => {
  const w = await world()
  const cache = storage()
  // Every discovery attempt sees a block land before it closes.
  let reads = 0
  w.chain.onHeight = () => {
    if (reads++ > 0) w.chain.height++
  }
  const client = w.client({ verificationCache: cache })
  await expect(client.discover()).rejects.toThrow('Chain tip changed during read; retry the snapshot')
  // Only the directory, verified before discovery's snapshot, was kept.
  expect([...cache.items.values()].map((v) => (parseJson(v) as any).interface.kind)).toEqual(['Directory'])
  w.chain.onHeight = undefined
  await client.discover()
  expect([...cache.items.values()].map((v) => (parseJson(v) as any).interface.kind).sort()).toEqual(
    ['Directory', 'Marketplace', 'Resolver', 'Store', 'Vault'],
  )
})

it('verifies from the chain when the storage fails, and accepts storage that answers asynchronously', async () => {
  const w = await world()
  const broken = {
    getItem: () => {
      throw new Error('SecurityError')
    },
    setItem: () => {
      throw new Error('QuotaExceededError')
    },
  }
  await expect(w.client({ verificationCache: broken }).discover()).resolves.toMatchObject({ height: 100n })
  const items = new Map<string, string>()
  const slow = {
    getItem: async (key: string) => items.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      items.set(key, value)
    },
  }
  await w.client({ verificationCache: slow }).discover()
  await new Promise((r) => setTimeout(r, 1))
  expect(items.size).toBe(5)
  w.log.length = 0
  await w.client({ verificationCache: slow }).discover()
  expect(w.log.filter((call) => verification.test(call))).toEqual([])
  const rejecting = { getItem: async () => Promise.reject(new Error('gone')), setItem: async () => Promise.reject(new Error('gone')) }
  await expect(w.client({ verificationCache: rejecting }).discover()).resolves.toMatchObject({ height: 100n })
})

it('keeps a refusal to its client and never shares one through the cache', async () => {
  const w = await world()
  const cache = storage()
  w.chain.binding.set(5, { directory: bytes(1), vault: bytes(2), network: 2 })
  const refused = w.client({ verificationCache: cache })
  await expect(refused.discover()).rejects.toThrow('Contract deployment binding mismatch')
  // The node answers correctly again: a new client verifies the resolver from the chain and accepts it.
  w.chain.binding.delete(5)
  w.log.length = 0
  const next = w.client({ verificationCache: cache })
  await next.discover()
  // Only the directory was kept: the store the refused attempt verified is verified again.
  expect(w.log.filter((call) => verification.test(call))).toEqual([
    '04.interface_version', '04.binding', '05.interface_version', '05.binding',
    '02.interface_version', '02.binding', '06.interface_version', '06.binding', '06.order_api_version',
  ])
  await expect(refused.discover()).rejects.toThrow('Contract deployment binding mismatch')
})

it('never signs through a directory the chain refused, however prepares and submits follow or overlap', async () => {
  const w = await world({ probed: true })
  const cache = storage()
  await w.client({ verificationCache: cache }).discover()
  // The node's directory now names another vault; the cache holds the directory's facts as read
  // before. Store 7, an AddStore's, needs nothing from the cache: its admission is its proof.
  w.chain.binding.set(1, { directory: bytes(1), vault: bytes(9), network: 1 })
  const fresh = async () => {
    const client = w.client({ verificationCache: cache })
    await client.discover()
    expect(await client.store(id(7)).capacity()).toMatchObject({ sealed: false })
    return { client, app: createDuskDomainsConnectApp(wallet, client.release) }
  }
  const refusedDirectory = (error: unknown) => {
    expect(error).toBeInstanceOf(UnverifiedContractError)
    expect((error as Error).cause).toBeInstanceOf(ContractRefusedError)
    expect((error as Error).cause).toMatchObject({ contractId: id(1), message: 'Contract deployment binding mismatch' })
  }
  // One after another: the first verifies the directory from the chain and refuses it; every later
  // one stops at that refusal.
  const { client, app } = await fresh()
  for (let i = 0; i < 3; i++) {
    refusedDirectory(await app.prepare(commitAt(7)).catch((e: unknown) => e))
    refusedDirectory(await app.submit(commitAt(7)).catch((e: unknown) => e))
  }
  // Nothing the directory vouched for is read through it any more.
  await expect(client.store(id(7)).capacity()).rejects.toThrow('Contract deployment binding mismatch')
  // Overlapping: both start before the directory's verification from the chain answers.
  const racing = await fresh()
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let bindings = 0
  w.chain.onRead = async (call) => {
    if (call !== '01.binding') return
    bindings++
    await held
  }
  const settled = Promise.allSettled([
    racing.app.prepare(commitAt(7)),
    racing.app.submit(commitAt(7)),
    racing.app.prepare(commitAt(4)),
  ])
  await vi.waitFor(() => expect(bindings).toBe(1))
  release()
  const results = await settled
  expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected', 'rejected'])
  for (const r of results) refusedDirectory((r as PromiseRejectedResult).reason)
  expect(bindings).toBe(1)
})

it('keeps no entries for a custom fetch without a transport namespace, which may send a node URL anywhere', async () => {
  const w = await world()
  const cache = storage()
  const viaFetch = (options: ClientOptions = {}) =>
    new FrozenClient(w.release, { fetch: serving(w.transport), verificationCache: cache, ...options })
  // The same node URL behind two fetchers: neither keeps nor reads an entry.
  await viaFetch().discover()
  expect(cache.items.size).toBe(0)
  w.log.length = 0
  await viaFetch().discover()
  expect(w.log.filter((call) => verification.test(call))).toHaveLength(11)
  expect(cache.items.size).toBe(0)
  // Named, each keeps its own, and the name wins over the transport's.
  await viaFetch({ transportNamespace: 'backend-a' }).discover()
  expect(cache.items.size).toBe(5)
  w.log.length = 0
  await viaFetch({ transportNamespace: 'backend-b' }).discover()
  expect(w.log.filter((call) => verification.test(call))).toHaveLength(11)
  expect(cache.items.size).toBe(10)
  w.log.length = 0
  await viaFetch({ transportNamespace: 'backend-a' }).discover()
  expect(w.log.filter((call) => verification.test(call))).toEqual([])
  // The default fetch sends a node URL's requests to it: entries are keyed by that URL.
  const defaults = storage()
  vi.stubGlobal('fetch', serving(w.transport))
  try {
    await new FrozenClient(w.release, { verificationCache: defaults }).discover()
    expect(defaults.items.size).toBe(5)
  } finally {
    vi.unstubAllGlobals()
  }
})

it('stops a read whose route passed a store that a concurrent verification refused meanwhile', async () => {
  const w = await world({ probed: true })
  const cache = storage()
  await w.client({ verificationCache: cache }).discover()
  // Store 4, the init's, now has a binding naming another directory, which its cached facts hide. It
  // forwards a root to store 7, and no store holds that root.
  w.chain.binding.set(4, { directory: bytes(9), vault: bytes(2), network: 1 })
  const gone = nameKey('gone.dusk')
  w.chain.forward = { root: gone.root, destination: bytes(7), destination_ordinal: 1, move_id: bytes(10), generation: 1n, completed_at: 90n }
  const client = w.client({ verificationCache: cache })
  await client.discover()
  w.chain.height++
  // The read follows store 4's route to store 7, then pauses on the membership the search for the
  // root's home reads next.
  let resume!: () => void
  const held = new Promise<void>((resolve) => {
    resume = resolve
  })
  let paused = false
  w.chain.onRead = async (call) => {
    if (call !== '01.members') return
    paused = true
    await held
  }
  const reading = client.locate(id(4), gone.root, 'read_records', gone)
  reading.catch(() => {})
  await vi.waitFor(() => expect(paused).toBe(true))
  // Meanwhile, signing verifies store 4 from the chain, and refuses it.
  const signing = await createDuskDomainsConnectApp(wallet, client.release).prepare(commitAt(4)).catch((e: unknown) => e)
  expect((signing as Error).cause).toMatchObject({ contractId: id(4), message: 'Contract deployment binding mismatch' })
  resume()
  await expect(reading).rejects.toThrow(ContractRefusedError)
  await expect(reading).rejects.toThrow('Contract deployment binding mismatch')
})

describe('the lens, with a verification cache', () => {
  const check = ['08.binding', '08.lens_interface']
  const lensReads = (log: string[]) => log.filter((call) => call.startsWith('08.'))
  /** A client as a page load makes one, with the session's cache. */
  async function load(w: LensWorld, options: ClientOptions = {}, make = (o: ClientOptions) => new FrozenClient(w.release, o)) {
    const c = make({ transport: w.transport, heightReuseMs: 0, onLensFallback: (f) => void w.fallbacks.push(f), ...options })
    await c.verifyContract('directory', id(1))
    return c
  }
  const page = (c: FrozenClient, w: LensWorld) => c.namePage('child.example.dusk', w.newest)
  /** Every reply of `fn` fails its evidence check: a strike each. */
  const corrupt = (w: LensWorld, fn = 'name_page') => {
    w.chain.lensReply = (f, reply) => {
      if (f === fn && reply.Ok) reply.Ok.consulted.stores[0].code_hash = bytes(8)
      return reply
    }
  }
  const health = (cache: { items: Map<string, string> }) => [...cache.items].find(([, v]) => v.includes('strikes'))!
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

  it('checks the lens deployment once a session, keeps only checks that passed, and checks again what it keeps', async () => {
    const w = await lensWorld(4)
    const cache = storage()
    for (let i = 0; i < 3; i++) {
      w.log.length = 0
      await page(await load(w, { verificationCache: cache }), w)
      expect(lensReads(w.log), `client ${i}`).toEqual(i ? ['08.name_page'] : [...check, '08.name_page'])
    }
    w.log.length = 0
    await page(await load(w), w)
    expect(lensReads(w.log)).toEqual([...check, '08.name_page'])
    // A kept entry that fails a check, or does not parse, is read from the chain again and replaced.
    const [key, kept] = [...cache.items].find(([, v]) => v.includes('lens_interface'))!
    for (const text of [kept.replace('"max_stores":64', '"max_stores":65'), kept.replace('"network":1', '"network":2'), '{not json']) {
      cache.items.set(key, text)
      w.log.length = 0
      await page(await load(w, { verificationCache: cache }), w)
      expect(lensReads(w.log)).toEqual([...check, '08.name_page'])
      expect(cache.items.get(key)).toBe(kept)
    }
    // A check that fails is kept as nothing good.
    const v = await lensWorld(4),
      failed = storage()
    v.chain.replies.set('08.lens_interface', { version: 2, max_stores: 64, max_hops: 63, max_record_keys: 16 })
    await page(await load(v, { verificationCache: failed }), v)
    expect([...failed.items.values()].filter((e) => e.includes('lens_interface'))).toEqual([])
  })

  it('binds what it keeps to the node, chain and lens entry, and keeps nothing without a namespace or working storage', async () => {
    const w = await lensWorld(4)
    const cache = storage()
    await page(await load(w, { verificationCache: cache }), w)
    const checks = async (options: ClientOptions, change?: () => void) => {
      const saved = { lens: w.release.lens, manifest: w.release.manifest }
      change?.()
      try {
        w.log.length = 0
        await page(await load(w, { verificationCache: cache, ...options }), w)
        return lensReads(w.log).filter((call) => check.includes(call))
      } finally {
        w.release.lens = saved.lens
        w.release.manifest = saved.manifest
      }
    }
    const other = (change: Partial<ReturnType<typeof lensEntry>>) => () => void (w.release.lens = { contract: lensEntry(change), driver: w.release.lens!.driver })
    expect(await checks({})).toEqual([])
    expect(await checks({ transportNamespace: 'another node' })).toEqual(check)
    expect(await checks({}, other({ codeHash: 'ee'.repeat(32) }))).toEqual(check)
    expect(await checks({}, other({ dataDriver: { path: 'lens.wasm', sha256: 'cd'.repeat(32) } }))).toEqual(check)
    expect(await checks({}, () => void (w.release.manifest = { ...w.release.manifest, chainId: 'dusk:9' }))).toEqual(check)
    const { namespace: _, ...nameless } = w.transport
    const failing: VerificationCache = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('full')
      },
    }
    for (const options of [{ transport: nameless, verificationCache: storage() }, { verificationCache: failing }] as ClientOptions[])
      for (let i = 0; i < 2; i++) {
        w.log.length = 0
        await page(await load(w, options), w)
        expect(lensReads(w.log)).toEqual([...check, '08.name_page'])
      }
  })

  it('trusts what it keeps for read correctness: a matching entry stands in for the check (documented residual)', async () => {
    const w = await lensWorld(4)
    const cache = storage()
    await page(await load(w, { verificationCache: cache }), w)
    // Misbound on chain now, while the kept entry still says the release's directory.
    w.chain.replies.set('08.binding', { directory: bytes(11), vault: bytes(2), network: 1 })
    w.log.length = 0
    await page(await load(w, { verificationCache: cache }), w)
    expect(lensReads(w.log)).toEqual(['08.name_page'])
    await page(await load(w), w)
    expect(w.fallbacks.map((f) => [f.reason, f.disabled])).toEqual([['deployment', true]])
  })

  it('counts strikes across a session, clears them on an answer, and holds a tripped method off in later clients for 10 minutes', async () => {
    const w = await lensWorld(4)
    const cache = storage()
    const clock = clocks()
    try {
      corrupt(w)
      await page(await load(w, { verificationCache: cache }), w)
      await page(await load(w, { verificationCache: cache }), w)
      w.chain.lensReply = undefined
      await page(await load(w, { verificationCache: cache }), w)
      corrupt(w)
      for (let i = 0; i < 3; i++) await page(await load(w, { verificationCache: cache }), w)
      expect(w.fallbacks.map((f) => f.disabled)).toEqual([false, false, false, false, true])
      w.chain.lensReply = undefined
      const views = async () => {
        const c = await load(w, { verificationCache: cache })
        w.log.length = 0
        await page(c, w)
        await c.bootstrap()
        return lensReads(w.log)
      }
      clock.advance(599_999)
      expect(await views()).toEqual(['08.bootstrap'])
      clock.advance(1)
      expect(await views()).toEqual(['08.name_page', '08.bootstrap'])
    } finally {
      clock.restore()
    }
  })

  it('uses a kept health entry only whole: a malformed one is ignored, and written again', async () => {
    const w = await lensWorld(4)
    const cache = storage()
    corrupt(w)
    await page(await load(w, { verificationCache: cache }), w)
    const [key] = health(cache)
    const soon = Date.now() + 60_000
    for (const text of ['{', 'null', '{"version":2,"strikes":{},"until":{"deployment":9e15}}', '{"version":1,"strikes":{"name_page":3},"until":{}}',
      '{"version":1,"strikes":{"name_page":2},"until":null}', `{"version":1,"strikes":{"name_page":2},"until":{"name_page":${soon}.5}}`,
      '{"version":1,"strikes":{"name_page":2},"until":{"unknown":1}}', '{"version":1,"strikes":{"name_page":2},"until":{},"more":1}',
      `{"version":1,"strikes":{},"until":{"name_page":${soon}.5}}`, '{"version":1,"strikes":{},"until":{"name_page":9007199254740993}}']) {
      cache.items.set(key, text)
      w.fallbacks.length = 0
      w.log.length = 0
      await page(await load(w, { verificationCache: cache }), w)
      // Neither held off nor a strike from tripping: this page's strike is the entry's first.
      expect(lensReads(w.log), text).toContain('08.name_page')
      expect(w.fallbacks.map((f) => f.disabled), text).toEqual([false])
      await settle()
      expect(JSON.parse(cache.items.get(key)!), text).toEqual({ version: 1, strikes: { name_page: 1 }, until: {} })
    }
  })

  it('holds a client off at most 10 minutes for a kept holdoff ending later, and writes it back ending then', async () => {
    const w = await lensWorld(4)
    const cache = storage()
    const clock = clocks()
    try {
      corrupt(w)
      await page(await load(w, { verificationCache: cache }), w)
      w.chain.lensReply = undefined
      const [key] = health(cache)
      // As after the wall clock was set back an hour, and as no client of this SDK writes.
      for (const ends of [() => clock.wall() + 4_200_000, () => Number.MAX_SAFE_INTEGER]) {
        cache.items.set(key, JSON.stringify({ version: 1, strikes: {}, until: { deployment: ends(), name_page: ends() } }))
        const loaded = clock.wall()
        w.log.length = 0
        await page(await load(w, { verificationCache: cache }), w)
        expect(lensReads(w.log)).toEqual([])
        await settle()
        expect(JSON.parse(cache.items.get(key)!).until).toEqual({ deployment: loaded + 600_000, name_page: loaded + 600_000 })
        clock.advance(600_000)
        w.log.length = 0
        await page(await load(w, { verificationCache: cache }), w)
        expect(lensReads(w.log)).toContain('08.name_page')
      }
    } finally {
      clock.restore()
    }
  })

  it('adds each client\'s strike to the count kept: two clients failing once on one old count make 2, and a third trips', async () => {
    const w = await lensWorld(4)
    const cache = storage()
    const a = await load(w, { verificationCache: cache }),
      b = await load(w, { verificationCache: cache })
    await page(a, w)
    await page(b, w)
    corrupt(w)
    await page(a, w)
    await page(b, w)
    await settle()
    expect(JSON.parse(health(cache)[1]).strikes).toEqual({ name_page: 2 })
    await page(await load(w, { verificationCache: cache }), w)
    expect(w.fallbacks.map((f) => f.disabled)).toEqual([false, false, true])
  })

  it('stops using a cache whose operation does not settle within a second: later views read on', async () => {
    const w = await lensWorld(4)
    const items = new Map<string, string>()
    // Health writes that never settle.
    const stuck: VerificationCache = {
      getItem: (k) => items.get(k) ?? null,
      setItem: (k, v) => (v.includes('strikes') ? new Promise<void>(() => {}) : void items.set(k, v)),
    }
    corrupt(w)
    await page(await load(w, { verificationCache: stuck }), w)
    w.chain.lensReply = undefined
    const started = Date.now()
    const later = page(await load(w, { verificationCache: stuck }), w).then(() => 'read')
    expect(await Promise.race([later, new Promise((resolve) => setTimeout(() => resolve('stuck'), 3_000))])).toBe('read')
    expect(Date.now() - started).toBeLessThan(2_500)
  })

  it('merges health updates across clients, one at a time and each over the entry as it is: none undoes another', async () => {
    const w = await lensWorld(4)
    const cache = storage()
    const a = await load(w, { verificationCache: cache }),
      b = await load(w, { verificationCache: cache })
    await page(a, w)
    await page(b, w)
    // A trips name_page; then B, which loaded the entry before that, counts a strike of resolve.
    corrupt(w)
    for (let i = 0; i < 3; i++) await page(a, w)
    corrupt(w, 'resolve')
    await b.getName('child.example.dusk', w.newest)
    await settle()
    expect(JSON.parse(health(cache)[1])).toEqual({ version: 1, strikes: { resolve: 1 }, until: { name_page: expect.any(Number) } })
    // Storage that lands a write late: the next one waits for it, and reads it first.
    const items = new Map<string, string>(),
      late = [40]
    const slow: VerificationCache = {
      getItem: async (k) => items.get(k) ?? null,
      setItem: (k, v) =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            items.set(k, v)
            resolve()
          }, v.includes('strikes') ? (late.shift() ?? 0) : 0)),
    }
    const c = await load(w, { verificationCache: slow })
    corrupt(w)
    await page(c, w)
    await page(c, w)
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect([...items.values()].filter((v) => v.includes('strikes')).map((v) => JSON.parse(v))).toEqual([{ version: 1, strikes: { name_page: 2 }, until: {} }])
  })

  it('keeps each release\'s lens health apart', async () => {
    const w = await lensWorld(4)
    const cache = storage()
    // A release without store 0, where every reply, listing every store, fails its evidence check.
    const older = { ...w.release, manifest: { ...w.release.manifest, contracts: w.release.manifest.contracts.filter((c) => c.contractId !== store(0)) }, contracts: new Map(w.release.contracts) }
    older.contracts.delete(store(0))
    for (let i = 0; i < 3; i++) await page(await load(w, { verificationCache: cache }, (o) => new FrozenClient(older, o)), w)
    expect(w.fallbacks.map((f) => [f.reason, f.disabled])).toEqual([['evidence', false], ['evidence', false], ['evidence', true]])
    w.log.length = 0
    await page(await load(w, { verificationCache: cache }), w)
    expect(lensReads(w.log)).toEqual(['08.name_page'])
  })

  it('makes nothing signable, and is never read or written with useLens false', async () => {
    const w = await lensWorld(4)
    const cache = storage()
    const c = await load(w, { verificationCache: cache })
    const shown = await page(c, w)
    for (const contract of [shown.store, store(0)]) expect(verifiedContract(c.release, contract)).toBeUndefined()
    const off = storage()
    await page(await load(w, { verificationCache: off, useLens: false }), w)
    expect([...off.items.values()].filter((v) => /strikes|lens_interface/u.test(v))).toEqual([])
  })
})
