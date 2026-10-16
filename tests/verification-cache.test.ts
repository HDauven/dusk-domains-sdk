import { it, expect } from 'vitest'
import { FrozenClient, type ClientOptions } from '../src/frozen/client.ts'
import { parseJson, stringifyJson } from '../src/frozen/json.ts'
import { fromHex } from '../src/frozen/bytes.ts'
import { estimateRegistrationQuote, launchPolicyConfig } from '../src/core/pricing.ts'
import { createDuskDomainsConnectApp } from '../src/wallet/duskConnectApp.ts'
import { buildCall } from '../src/frozen/calls.ts'
import { bytes, id, jsonRelease, sample } from './helpers.ts'
import type { ReadTransport } from '../src/frozen/transport.ts'
import type { LoadedRelease, ReleaseContract } from '../src/frozen/manifest.ts'

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
 * like the frozen contracts. `binding` overrides a contract's binding, by its byte.
 */
async function world() {
  const release = await jsonRelease()
  const chain = { height: 100n, binding: new Map<number, unknown>(), onHeight: undefined as undefined | (() => void) }
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
      const args = decode(data)
      const registration = { ...samples.RegistrationContext, policy: bytes(3), policy_version: 1n, newest_store: bytes(4) }
      const reply = (() => {
        if (fn === 'interface_version')
          return { kind: kinds[n], version: 1, move_version: n === 4 ? 1 : 0, custody_version: n === 4 || n === 6 ? 1 : 0 }
        if (fn === 'binding') return chain.binding.get(n) ?? { directory: bytes(1), vault: bytes(2), network: 1 }
        if (fn === 'order_api_version') return 1
        if (n === 1 && fn === 'config')
          return {
            ...samples.DirectoryConfig, binding: { directory: bytes(1), vault: bytes(2), network: 1 },
            store_count: 1, resolver_count: 1, registration, preferred_marketplace: bytes(6),
          }
        if (n === 1 && fn === 'members')
          return { rows: [{ ...samples.Admission, id: bytes(args.kind === 'Store' ? 4 : 5), ordinal: 0, interface_version: 1, retiring: false }], next: null }
        if (n === 1 && fn === 'member') return { ...samples.Admission, id: args.id, ordinal: 0, interface_version: 1, retiring: false }
        if (n === 1 && fn === 'market') return { ...samples.Market, id: args.id, interface_version: 1, state: 'Listed' }
        if (n === 1 && fn === 'registration_context') return registration
        if (n === 3 && fn === 'config') return launchPolicyConfig()
        if (n === 4 && fn === 'home') return 'Absent'
        if (n === 4 && fn === 'capacity') return { ...samples.Capacity, sealed: false }
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
  const client = (options: ClientOptions = {}, r: LoadedRelease = release) => new FrozenClient(r, { transport, ...options })
  return { chain, release, log, client }
}
const registration = { actor: bytes(10), label: 'fresh', years: 1, secret: bytes(33), commitHeight: 100n }
const withDescriptor = (r: LoadedRelease, n: number, change: Partial<ReleaseContract>): LoadedRelease => {
  const contracts = new Map(r.contracts)
  contracts.set(id(n), { ...contracts.get(id(n))!, ...change })
  return { ...r, contracts, manifest: { ...r.manifest, contracts: [...contracts.values()] } }
}

it('verifies a contract a client verified before from what it read then, and only its own state', async () => {
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
  expect(w.log.filter((call) => verification.test(call))).toEqual([])
  // The policy's config is still read as the directory's selection; only its verification was kept.
  expect(w.log.filter((call) => call === '03.config')).toHaveLength(1)
  // What it verified is signable as if it had read everything again.
  const app = createDuskDomainsConnectApp(wallet, second.release)
  expect((await app.prepare(prepared.calls.reveal)).fnName).toBe('register')
  expect((await app.prepare(buildCall('store', id(4), 'commit', { hash: bytes(1) }))).contractId).toBe(id(4))
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
