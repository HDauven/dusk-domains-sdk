import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { FrozenClient, type ClientOptions } from '../src/frozen/client.ts'
import { registrationCalls } from '../src/frozen/actions.ts'
import { buildCall } from '../src/frozen/calls.ts'
import { createDuskDomainsConnectApp } from '../src/wallet/duskConnectApp.ts'
import {
  estimateRegistrationQuote,
  launchPolicyConfig,
} from '../src/core/pricing.ts'
import { fromHex, hash, hex, nameKey } from '../src/frozen/bytes.ts'
import { validateReleaseContract } from '../src/frozen/manifest.ts'
import { parseJson, stringifyJson } from '../src/frozen/json.ts'
import { wireValue } from '../src/frozen/wire.ts'
import {
  bytes,
  driverBytes,
  fixtures,
  id,
  jsonDriver,
  jsonRelease,
  policyInitHash,
  release as wasmRelease,
  sample,
  sevens,
} from './helpers.ts'
import type { ReadTransport } from '../src/frozen/transport.ts'
import type {
  ContractRole,
  LoadedRelease,
  ReleaseContract,
} from '../src/frozen/manifest.ts'
import type {
  Admission,
  CustodyIntent,
  Market,
  Order,
  PolicyConfig,
  Register,
  RegistrationQuote,
} from '../src/frozen/types.ts'

const encode = (v: unknown) => new TextEncoder().encode(stringifyJson(v))
const decode = (b: Uint8Array) => parseJson(new TextDecoder().decode(b))
const provenance = JSON.parse(
  readFileSync(new URL('fixtures/drivers.json', import.meta.url), 'utf8'),
)
const kinds = ['directory', 'store', 'resolver', 'vault', 'policy', 'marketplace']
const liveInterface = (role: ContractRole) => ({
  kind: role[0].toUpperCase() + role.slice(1),
  version: 1,
  move_version: role === 'store' ? 1 : 0,
  custody_version: role === 'store' || role === 'marketplace' ? 1 : 0,
})
// A contract resolved after the release runs the reviewed WASM driver, which reads rkyv replies.
const rkyvInterface = (role: ContractRole, version = 1) =>
  Uint8Array.from([
    kinds.indexOf(role), 0, version, 0, role === 'store' ? 1 : 0, 0,
    role === 'store' || role === 'marketplace' ? 1 : 0, 0,
  ])
const rkyvBinding = (directory = 1) =>
  Uint8Array.from([...bytes(directory), ...bytes(2), 1])
const binding = { directory: bytes(1), vault: bytes(2), network: 1 }
const admission = (n: number, ordinal = 0): Admission => ({
  ...sample('Admission'),
  id: bytes(n),
  ordinal,
  interface_version: 1,
  admitted_at: 1n,
  retiring: false,
})
/** A record at version 1, as the directory's init lists a market: checked from the chain. */
const market = (n: number): Market => ({
  ...sample('Market'),
  id: bytes(n),
  state: 'Listed',
  interface_version: 1,
  version: 1n,
})
const orderRows = { ...fixtures(), ...fixtures('market-v1') }
const order = wireValue(
  'Order',
  Object.values(orderRows).find((r) => r.type === 'Order')!.json,
) as Order
const custodyIntent = (store = 4): CustodyIntent => {
  const intent = wireValue('CustodyIntent', Object.values(orderRows).find((r) => r.type === 'CustodyIntent')!.json) as CustodyIntent
  intent.terms.directory = bytes(1)
  intent.terms.store = bytes(store)
  return intent
}
const wallet = {
  request: async (method: string) =>
    method === 'dusk_chainId' ? 'dusk:1' : { median: '1' },
}
// The init commitment of a policy running the reviewed WASM driver: over the golden config it answers.
const wasmPolicyInit = (await wasmRelease()).contracts.get(id(3))!.initHash!
/** Reviewed release metadata for contract `n`, with its code and init commitments unless `hashless`. */
const resolvedArtifact = (role: ContractRole, n: number, { hashless = false } = {}): ReleaseContract => ({
  role,
  contractId: id(n),
  dataDriver: { path: `${role}.wasm`, ...provenance[role] },
  ...(hashless ? {} : { codeHash: sevens, initHash: role === 'policy' ? wasmPolicyInit : sevens }),
})
const serveDriver = (role: ContractRole) => async () =>
  new Response(Uint8Array.from(driverBytes(role)))

interface Live {
  role: ContractRole
  /** Runs the reviewed WASM driver, so its verification reads answer in rkyv. */
  wasm?: boolean
  /** The role its interface reports, when another than its own. */
  reports?: ContractRole
  binding?: unknown
  bindingDirectory?: number
  orderApi?: number
}
interface Chain {
  height: bigint
  tick?: (fn: string, target: string) => void
  /** Runs before each height read. */
  onHeight?: () => void
  policy: string
  policyVersion: bigint
  /** The selection a store's quote names, when it differs from the directory's. */
  quoteClaims?: { policy: string; version: bigint }
  policyConfig: PolicyConfig
  preferred: string | null
  stores: Admission[]
  resolvers: Admission[]
  markets: Map<string, Market>
  live: Map<string, Live>
}
// A deployment whose directory (1), vault (2), launch policy (3), store (4), resolver (5) and
// marketplace (6) answer like the frozen contracts.
async function world(change: (chain: Chain) => void = () => {}, base?: LoadedRelease) {
  const release = base ?? (await jsonRelease())
  const chain: Chain = {
    height: 100n,
    policy: id(3),
    policyVersion: 1n,
    policyConfig: launchPolicyConfig(),
    preferred: null,
    stores: [admission(4)],
    resolvers: [admission(5)],
    markets: new Map([[id(6), market(6)]]),
    live: new Map(
      (
        [
          [1, 'directory'], [2, 'vault'], [3, 'policy'],
          [4, 'store'], [5, 'resolver'], [6, 'marketplace'],
        ] as const
      ).map(([n, role]) => [id(n), { role }]),
    ),
  }
  change(chain)
  const reads: string[] = []
  const transport: ReadTransport = {
    currentBlockHeight: async () => {
      chain.onHeight?.()
      return chain.height
    },
    read: async (target, fn, data) => {
      chain.tick?.(fn, target)
      reads.push(`${target}.${fn}`)
      const c = chain.live.get(target)
      if (!c) throw new Error(`No contract ${target}`)
      if (c.wasm) {
        if (fn === 'interface_version') return rkyvInterface(c.reports ?? c.role)
        if (fn === 'binding') return rkyvBinding(c.bindingDirectory)
        if (fn === 'order_api_version') return Uint8Array.from([c.orderApi ?? 1, 0])
        // The golden config, which a WASM policy's release init commitment covers.
        if (fn === 'config' && c.role === 'policy') return Uint8Array.from(Buffer.from(fixtures().PolicyConfig.rkyv, 'hex'))
        throw new Error(`Unexpected WASM read ${target}.${fn}`)
      }
      const args = decode(data) as Record<string, any>
      if (fn === 'interface_version') return encode(liveInterface(c.role))
      if (fn === 'binding') return encode(c.binding ?? binding)
      if (fn === 'order_api_version') return encode(c.orderApi ?? 1)
      if (c.role === 'directory') {
        const registration = {
          ...sample('RegistrationContext'),
          policy: fromHex(chain.policy, 32),
          policy_version: chain.policyVersion,
          newest_store: chain.stores.at(-1)!.id,
        }
        if (fn === 'config')
          return encode({
            ...sample('DirectoryConfig'),
            binding,
            store_count: chain.stores.length,
            resolver_count: chain.resolvers.length,
            registration,
            preferred_marketplace: chain.preferred ? fromHex(chain.preferred, 32) : null,
          })
        if (fn === 'registration_context') return encode(registration)
        if (fn === 'members')
          return encode({ rows: args.kind === 'Store' ? chain.stores : chain.resolvers, next: null })
        if (fn === 'member')
          return encode(
            (args.kind === 'Store' ? chain.stores : chain.resolvers).find(
              (a) => hex(a.id) === hex(args.id),
            ) ?? null,
          )
        if (fn === 'market') return encode(chain.markets.get(hex(args.id)) ?? null)
      }
      if (c.role === 'store') {
        if (fn === 'home') return encode('Absent')
        if (fn === 'capacity') return encode({ ...sample('Capacity'), sealed: false })
        if (fn === 'stats') return encode(sample('StoreStats'))
        if (fn === 'quote_registration') {
          const { estimate, total_lux, ...quote } = estimateRegistrationQuote(chain.policyConfig, {
            version: 1, directory: bytes(1), store: fromHex(target, 32), node: args.node,
            label: args.label, actor: args.actor, years: args.years, height: chain.height,
            previous_generation: 0n, previous_grace_end: null, policy_version: chain.policyVersion,
          })
          void estimate
          return encode({
            policy: fromHex(chain.quoteClaims?.policy ?? chain.policy, 32),
            policy_version: chain.quoteClaims?.version ?? chain.policyVersion,
            quote,
            total_lux,
            height: chain.height,
          })
        }
      }
      if (c.role === 'policy' && fn === 'config') return encode(chain.policyConfig)
      if (c.role === 'marketplace' && fn === 'config') return encode(sample('Config'))
      throw new Error(`Unexpected read ${target}.${fn}`)
    },
  }
  return {
    chain,
    release,
    reads,
    client: (options: ClientOptions = {}, r: LoadedRelease = release) =>
      new FrozenClient(r, { transport, ...options }),
  }
}
const root = nameKey('example.dusk').root
const quoteArgs = (version = 1n) => ({
  node: root, label: 'example', years: 1, actor: bytes(10),
  expected_policy_version: version, expected_policy_config_version: 1n,
})
const registration = {
  actor: bytes(10), label: 'example', years: 1, secret: bytes(33), commitHeight: 100n,
}
const registerAt = (version: bigint) =>
  buildCall('store', id(4), 'register', {
    ...(sample('Register') as Register),
    expected_policy_version: version,
  })
const withDescriptor = (r: LoadedRelease, n: number, change: Partial<ReleaseContract>) => {
  // Descriptors are shared with the cached test release; replace, never mutate.
  r.contracts.set(id(n), { ...r.contracts.get(id(n))!, ...change })
  return r
}
const listPolicy = (r: LoadedRelease, n: number) => {
  r.contracts.set(id(n), { ...r.contracts.get(id(3))!, contractId: id(n) })
  r.drivers.set(id(n), jsonDriver)
  return r
}

it.each([
  ['another contract kind\'s interface', (c: Chain) => { c.live.set(id(33), { role: 'marketplace', wasm: true, reports: 'store' }) }, 'interface'],
  ['another deployment\'s binding', (c: Chain) => { c.live.set(id(33), { role: 'marketplace', wasm: true, bindingDirectory: 9 }) }, 'binding mismatch'],
  ['an unsupported order API', (c: Chain) => { c.live.set(id(33), { role: 'marketplace', wasm: true, orderApi: 2 }) }, 'order API'],
  ['a directory record with another interface version', (c: Chain) => {
    c.live.set(id(33), { role: 'marketplace', wasm: true })
    c.markets.set(id(33), { ...market(33), interface_version: 2 })
  }, 'Admission artifact/version mismatch'],
])('keeps a contract that fails verification on %s out of the release, unreadable and unsignable', async (_label, change, message) => {
  const w = await world((c) => {
    c.markets.set(id(33), market(33))
    change(c)
  })
  let resolved = 0
  const client = w.client({
    resolveContract: async (role) => {
      resolved++
      return resolvedArtifact(role, 33)
    },
    fetch: serveDriver('marketplace'),
  })
  await expect(client.verifyContract('marketplace', id(33))).rejects.toThrow(message)
  expect(client.release.contracts.has(id(33))).toBe(false)
  expect(client.release.drivers.has(id(33))).toBe(false)
  const app = createDuskDomainsConnectApp(wallet, client.release)
  await expect(app.prepare(buildCall('marketplace', id(33), 'expire_order', order))).rejects.toThrow(
    'Target is absent from verified release',
  )
  // Refused for good: no read accepts it and its artifact is not fetched again.
  await expect(client.marketplace(id(33)).config()).rejects.toThrow(message)
  await expect(client.verifyContract('marketplace', id(33))).rejects.toThrow(message)
  expect(resolved).toBe(1)
})

it('takes a market\'s interface and binding from the record a SetMarketplace probed it for, and still checks its order API', async () => {
  for (const orderApi of [1, 2]) {
    // Record version 2: a SetMarketplace wrote it, after reading the market's interface and binding.
    // The live binding names another directory here, which no read sees.
    const w = await world((c) => {
      c.markets.set(id(33), { ...market(33), version: 2n })
      c.live.set(id(33), { role: 'marketplace', wasm: true, bindingDirectory: 9, orderApi })
    })
    const client = w.client({ resolveContract: async (role) => resolvedArtifact(role, 33), fetch: serveDriver('marketplace') })
    const verified = client.verifyContract('marketplace', id(33))
    if (orderApi === 1) await verified
    else await expect(verified).rejects.toThrow('order API')
    expect(w.reads.filter((call) => call.startsWith(id(33)))).toEqual([`${id(33)}.order_api_version`])
    expect(client.release.contracts.has(id(33))).toBe(orderApi === 1)
  }
})

it('admits a resolved contract only after every check passes, and signs for it then', async () => {
  const w = await world((c) => {
    c.markets.set(id(33), market(33))
    c.live.set(id(33), { role: 'marketplace', wasm: true })
  })
  const client = w.client({
    resolveContract: async (role) => resolvedArtifact(role, 33),
    fetch: serveDriver('marketplace'),
  })
  await client.verifyContract('marketplace', id(33))
  expect(client.release.contracts.get(id(33))?.role).toBe('marketplace')
  const app = createDuskDomainsConnectApp(wallet, client.release)
  expect((await app.prepare(buildCall('marketplace', id(33), 'expire_order', order))).contractId).toBe(id(33))
})

it('signs only for contracts its client verified, not whatever the release maps hold', async () => {
  const w = await world()
  const client = w.client()
  await client.discover()
  const app = createDuskDomainsConnectApp(wallet, client.release)
  const commit = (n: number) => buildCall('store', id(n), 'commit', { hash: bytes(1) })
  expect((await app.prepare(commit(4))).contractId).toBe(id(4))
  // An entry written into the release maps is not a verification.
  client.release.contracts.set(id(40), { ...client.release.contracts.get(id(4))!, contractId: id(40) })
  client.release.drivers.set(id(40), jsonDriver)
  await expect(app.prepare(commit(40))).rejects.toThrow('Target is absent from verified release')
  // Nor is being listed in the release manifest: this store failed its live checks.
  const bad = await world((c) => { c.live.set(id(4), { role: 'store', binding: { ...binding, network: 2 } }) })
  const refused = bad.client()
  await expect(refused.discover()).rejects.toThrow('binding mismatch')
  await expect(createDuskDomainsConnectApp(wallet, refused.release).prepare(commit(4))).rejects.toThrow(
    'Target is absent from verified release',
  )
})

it('keeps refusing a store whose admission failed the release comparison when it is read again', async () => {
  const w = await world()
  withDescriptor(w.release, 4, { codeHash: 'aa'.repeat(32) })
  const client = w.client()
  await expect(client.discover()).rejects.toThrow('Admission artifact/version mismatch')
  // A read re-verifies without discovery's admission; it must not accept the store this time.
  await expect(client.store(id(4)).stats()).rejects.toThrow('Admission artifact/version mismatch')
  await expect(client.verifyContract('store', id(4))).rejects.toThrow('Admission artifact/version mismatch')
  await expect(
    createDuskDomainsConnectApp(wallet, client.release).prepare(buildCall('store', id(4), 'commit', { hash: bytes(1) })),
  ).rejects.toThrow('Target is absent from verified release')
})

it('compares a store with its directory admission on a cold read, before any discovery', async () => {
  const w = await world()
  withDescriptor(w.release, 4, { codeHash: 'aa'.repeat(32) })
  await expect(w.client().store(id(4)).stats()).rejects.toThrow('Admission artifact/version mismatch')
  // A store the release lists before its admission is unavailable, not refused: it can be admitted later.
  const later = await world((c) => {
    c.stores = [admission(8)]
    c.live.set(id(8), { role: 'store' })
  })
  later.release.contracts.set(id(8), { ...later.release.contracts.get(id(4))!, contractId: id(8) })
  later.release.drivers.set(id(8), jsonDriver)
  const client = later.client()
  await expect(client.store(id(4)).stats()).rejects.toThrow('not admitted')
  later.chain.stores = [admission(8), admission(4, 1)]
  expect(await client.store(id(4)).stats()).toEqual(sample('StoreStats'))
})

it('never lets one client authorize a policy for a client whose release does not list it', async () => {
  // The drill's three steps: a release-only client refuses policy 33, a client whose maintained
  // manifest lists it verifies it, and the release-only client must still refuse it.
  const w = await world((c) => {
    c.policy = id(33)
    c.policyVersion = 2n
    c.live.set(id(33), { role: 'policy' })
  })
  const releaseOnly = w.client()
  const maintained = w.client({}, listPolicy(await jsonRelease(), 33))
  await releaseOnly.discover()
  const placement = await releaseOnly.registrationPlacement(root)
  const raw = await releaseOnly.store(placement.store).quote_registration(quoteArgs(2n))
  const build = () =>
    registrationCalls(placement.store, { ...registration, commitmentStore: placement.store, quote: raw })
  expect(build).toThrow('quote again')
  const verified = await maintained.quoteRegistration(placement.store, quoteArgs(2n))
  expect(build).toThrow('quote again')
  // The maintained client's own quote builds; the release-only client still cannot quote or sign.
  const { reveal } = registrationCalls(placement.store, { ...registration, commitmentStore: placement.store, quote: verified })
  expect(reveal.args.expected_policy_version).toBe(2n)
  await expect(releaseOnly.quoteRegistration(placement.store, quoteArgs(2n))).rejects.toThrow(
    `Missing release artifact for admitted policy ${id(33)}`,
  )
  await expect(createDuskDomainsConnectApp(wallet, releaseOnly.release).prepare(reveal)).rejects.toThrow(
    'is not verified against this release',
  )
  expect((await createDuskDomainsConnectApp(wallet, maintained.release).prepare(reveal)).fnName).toBe('register')
})

it('keeps a policy one client resolved out of another client built on the same release object', async () => {
  const shared = await jsonRelease()
  const w = await world((c) => {
    c.policy = id(33)
    c.policyVersion = 2n
    c.live.set(id(33), { role: 'policy', wasm: true })
  }, shared)
  const resolving = w.client({ resolveContract: async (role) => resolvedArtifact(role, 33), fetch: serveDriver('policy') })
  const other = w.client()
  const quote = await resolving.quoteRegistration(id(4), quoteArgs(2n))
  const { reveal } = registrationCalls(id(4), { ...registration, commitmentStore: id(4), quote })
  expect((await createDuskDomainsConnectApp(wallet, resolving.release).prepare(reveal)).fnName).toBe('register')
  await expect(other.policy(id(33)).binding()).rejects.toThrow(`Missing release artifact for admitted policy ${id(33)}`)
  await expect(other.quoteRegistration(id(4), quoteArgs(2n))).rejects.toThrow('Missing release artifact')
  await expect(createDuskDomainsConnectApp(wallet, other.release).prepare(reveal)).rejects.toThrow(
    'is not verified against this release',
  )
  expect(shared.contracts.has(id(33))).toBe(false)
})

it.each([
  ['its code hash', { codeHash: 'aa'.repeat(32) }, (m: Market) => m],
  ['its init hash', { initHash: 'bb'.repeat(32) }, (m: Market) => m],
  ['its interface version', {}, (m: Market) => ({ ...m, interface_version: 2 })],
])('discovery compares the preferred marketplace with its directory record: %s', async (_label, descriptor, record) => {
  const w = await world((c) => {
    c.preferred = id(6)
    c.markets.set(id(6), record(market(6)))
  })
  withDescriptor(w.release, 6, descriptor)
  await expect(w.client().discover()).rejects.toThrow('Admission artifact/version mismatch')
  // The same release with matching evidence discovers.
  const ok = await world((c) => { c.preferred = id(6) })
  withDescriptor(ok.release, 6, { codeHash: hex(bytes(7)), initHash: hex(bytes(7)) })
  expect((await ok.client().discover()).config.preferred_marketplace).toEqual(bytes(6))
})

it('discovery refuses a preferred marketplace the directory has no record of', async () => {
  const w = await world((c) => {
    c.preferred = id(6)
    c.markets.clear()
  })
  await expect(w.client().discover()).rejects.toThrow('not admitted')
})

it('compares store and resolver admissions\' init commitments with the release', async () => {
  for (const n of [4, 5]) {
    const w = await world()
    withDescriptor(w.release, n, { initHash: 'cc'.repeat(32) })
    await expect(w.client().discover()).rejects.toThrow('Admission artifact/version mismatch')
    const ok = await world()
    withDescriptor(ok.release, n, { initHash: hex(bytes(7)) })
    await expect(ok.client().discover()).resolves.toBeDefined()
  }
})

it('compares a policy\'s live initialization with the release\'s init commitment before quoting with it', async () => {
  const init = wireValue('InitPolicy', { binding, config: launchPolicyConfig() })
  const initHash = hex(hash('duskds:init:v1', jsonDriver.encodeInput('init', stringifyJson(init))))
  const ok = await world()
  withDescriptor(ok.release, 3, { initHash })
  expect((await ok.client().quoteRegistration(id(4), quoteArgs())).policy).toEqual(bytes(3))
  const w = await world((c) => { c.policyConfig = { ...launchPolicyConfig(), base_referral_bps: 3000 } })
  withDescriptor(w.release, 3, { initHash })
  await expect(w.client().quoteRegistration(id(4), quoteArgs())).rejects.toThrow('init commitment')
})

it('compares a policy verified before any init commitment with the admission that arrives later', async () => {
  const init = wireValue('InitPolicy', { binding, config: launchPolicyConfig() })
  const live = hash('duskds:init:v1', jsonDriver.encodeInput('init', stringifyJson(init)))
  const setPolicy = (init_hash: number[]) => {
    const evidence = { ...admission(3), init_hash }
    return { version: 1, body: { ...sample('ActionApplied'), action: { SetPolicy: { expected_version: 1n, admission: evidence } }, admission: evidence } }
  }
  // A release descriptor without the policy's init commitment: the admission brings one.
  const hashless = async () => {
    const w = await world()
    withDescriptor(w.release, 3, { initHash: undefined })
    return w.client()
  }
  const client = await hashless()
  await client.quoteRegistration(id(4), quoteArgs())
  await client.admitDirectoryEvent('action_applied', setPolicy(live) as never)
  const other = await hashless()
  await other.quoteRegistration(id(4), quoteArgs())
  await expect(other.admitDirectoryEvent('action_applied', setPolicy(bytes(9)) as never)).rejects.toThrow('init commitment')
  // An event is its caller's claim: it is rejected, and the policy the client verified stays usable.
  expect((await other.quoteRegistration(id(4), quoteArgs())).policy).toEqual(bytes(3))
})

it('rejects admission evidence that contradicts the directory, without refusing the contract', async () => {
  const w = await world()
  const forged = { ...admission(4), code_hash: bytes(66), retiring: true }
  const retiring = { version: 1, body: { ...sample('ActionApplied'),
    action: { SetRetiring: { store: bytes(4), expected_version: 1n, value: true } }, admission: forged } }
  const client = w.client()
  await client.discover()
  await expect(client.admitDirectoryEvent('action_applied', retiring as never)).rejects.toThrow('Admission artifact/version mismatch')
  // The store still reads, routes and signs.
  expect(await client.store(id(4)).stats()).toEqual(sample('StoreStats'))
  expect((await client.registrationPlacement(root)).store).toBe(id(4))
  expect((await createDuskDomainsConnectApp(wallet, client.release).prepare(buildCall('store', id(4), 'commit', { hash: bytes(1) }))).contractId).toBe(id(4))
  // Before it is verified, a caller's evidence is checked against the directory's own record.
  const fresh = w.client()
  await expect(fresh.verifyContract('store', id(4), forged)).rejects.toThrow('Admission artifact/version mismatch')
  await expect(fresh.verifyContract('store', id(4))).resolves.toBeUndefined()
})

it('signs a custody hand-off only to a marketplace its client verified, with an intent for that call', async () => {
  const w = await world((c) => {
    c.preferred = id(6)
    c.markets.set(id(33), market(33))
    c.live.set(id(33), { role: 'marketplace', wasm: true, bindingDirectory: 9 })
  })
  const client = w.client({ resolveContract: async (role) => resolvedArtifact(role, 33), fetch: serveDriver('marketplace') })
  await client.discover()
  const app = createDuskDomainsConnectApp(wallet, client.release)
  const handOff = (target: number, intent = custodyIntent()) => buildCall('store', id(4), 'transfer_and_call', {
    name: intent.terms.name, target: bytes(target), callback_gas: 500_000_000n,
    data: Array.from(jsonDriver.encodeInput('custody_intent', stringifyJson(intent))),
  })
  expect((await app.prepare(handOff(6))).fnName).toBe('transfer_and_call')
  // An unknown contract, or a market this client refused, never receives the name.
  await expect(app.prepare(handOff(0x99))).rejects.toThrow('not a marketplace verified')
  await expect(client.verifyContract('marketplace', id(33))).rejects.toThrow('binding mismatch')
  await expect(app.prepare(handOff(33))).rejects.toThrow('not a marketplace verified')
  // The intent must be the verified market's encoding of terms for this store and name.
  await expect(app.prepare(handOff(6, custodyIntent(5)))).rejects.toThrow('Custody intent does not match')
  const garbled = { ...handOff(6), args: { ...handOff(6).args, data: [1, 2, 3] } }
  await expect(app.prepare(buildCall('store', id(4), 'transfer_and_call', garbled.args))).rejects.toThrow('Custody intent does not decode')
})

it('rethrows a failure that repeats at every height instead of a retry error', async () => {
  const w = await world((c) => {
    c.tick = (fn) => {
      c.height++
      if (fn === 'stats') throw new Error('Contract read failed (stats): trapped')
    }
  })
  await expect(w.client().store(id(4)).stats()).rejects.toThrow('Contract read failed (stats): trapped')
})

it('treats a null code or init hash in a release descriptor as absent', () => {
  const c = validateReleaseContract({ role: 'store', contractId: id(4), dataDriver: { path: 'store.wasm', ...provenance.store },
    codeHash: null, initHash: null })
  expect(c).not.toHaveProperty('codeHash')
  expect(c).not.toHaveProperty('initHash')
  expect(validateReleaseContract({ role: 'store', contractId: id(4), dataDriver: { path: 'store.wasm', ...provenance.store },
    codeHash: null, code_hash: 'aa'.repeat(32), init_hash: 'bb'.repeat(32) })).toMatchObject({ codeHash: 'aa'.repeat(32), initHash: 'bb'.repeat(32) })
})

it('prepares a registration when a block lands while it reads', async () => {
  let landed = false
  const w = await world((c) => {
    // The new block lands just before the store prices the quote.
    c.tick = (fn) => {
      if (fn === 'quote_registration' && !landed) {
        landed = true
        c.height = 101n
      }
    }
  })
  const client = w.client()
  await client.discover()
  const prepared = await client.prepareRegistration(registration)
  expect(prepared.height).toBe(101n)
  expect(prepared.quoteRequest.height).toBe(101n)
  expect(prepared.quote.height).toBe(101n)
  expect(prepared.calls.reveal.args.expected_fee_lux).toBe(prepared.quote.total_lux)
  // The whole preparation ran again at the new height.
  expect(w.reads.filter((r) => r.endsWith('.quote_registration'))).toHaveLength(2)
})

it('gives up with a retryable error, never a wrong quote, when every attempt crosses a block', async () => {
  const w = await world((c) => {
    c.tick = (fn) => {
      if (fn === 'quote_registration') c.height++
    }
  })
  const client = w.client()
  await client.discover()
  await expect(client.prepareRegistration(registration)).rejects.toThrow(
    'Chain tip changed during read; retry the snapshot',
  )
})

it.each(['codeHash', 'initHash'] as const)('reads a store whose release descriptor lacks its %s, but never signs for it', async (field) => {
  const w = await world()
  withDescriptor(w.release, 4, { [field]: undefined })
  const client = w.client()
  await client.discover()
  expect(await client.store(id(4)).stats()).toEqual(sample('StoreStats'))
  await expect(
    createDuskDomainsConnectApp(wallet, client.release).prepare(buildCall('store', id(4), 'commit', { hash: bytes(1) })),
  ).rejects.toThrow('code and init commitments')
})

it('signs a registration only under a policy whose release descriptor commits to its code and initialization', async () => {
  // resolveContract supplies the reviewed driver for the newly selected policy, but no commitments.
  const shared = await jsonRelease()
  const w = await world((c) => {
    c.policy = id(33)
    c.policyVersion = 2n
    c.live.set(id(33), { role: 'policy', wasm: true })
  }, shared)
  const sign = async (descriptor: ReleaseContract) => {
    const client = w.client({ resolveContract: async () => descriptor, fetch: serveDriver('policy') })
    await client.discover()
    const quote = await client.quoteRegistration(id(4), quoteArgs(2n))
    const { reveal } = registrationCalls(id(4), { ...registration, commitmentStore: id(4), quote })
    return createDuskDomainsConnectApp(wallet, client.release).prepare(reveal)
  }
  await expect(sign(resolvedArtifact('policy', 33, { hashless: true }))).rejects.toThrow('code and init commitments')
  expect((await sign(resolvedArtifact('policy', 33))).fnName).toBe('register')
})

it('never sends a call whose target its client refused while the wallet checked the balance', async () => {
  const w = await world()
  const client = w.client()
  await client.discover()
  const requests: string[] = []
  const app = createDuskDomainsConnectApp({
    request: async (method: string) => {
      requests.push(method)
      if (method === 'dusk_chainId') return 'dusk:1'
      if (method === 'dusk_getPublicBalance') {
        // Meanwhile the directory's record of the store stops matching the release: discovery refuses it.
        w.chain.stores = [{ ...admission(4), code_hash: bytes(66) }]
        w.chain.height++
        await client.discover().catch(() => {})
        return { value: '1000000000000' }
      }
      if (method === 'dusk_sendTransaction') return { hash: 'sent' }
      return { median: '1' }
    },
  }, client.release)
  await expect(app.submit(buildCall('store', id(4), 'commit', { hash: bytes(1) }))).rejects.toThrow('absent from verified release')
  expect(requests).not.toContain('dusk_sendTransaction')
})

it('never signs a reveal priced by a quote another client verified', async () => {
  // Alice's node selects policy 3 at version 1; Bob's selects policy 33, priced higher, at version 1.
  const costly = { ...launchPolicyConfig(), annual_lux: launchPolicyConfig().annual_lux.map((lux) => (BigInt(lux) * 2n).toString()) }
  const alice = (await world()).client()
  const bobRelease = listPolicy(await jsonRelease(), 33)
  withDescriptor(bobRelease, 33, { initHash: policyInitHash(jsonDriver, costly) })
  const bob = (await world((c) => {
    c.policy = id(33)
    c.policyConfig = costly
    c.live.set(id(33), { role: 'policy' })
  }, bobRelease)).client()
  await alice.discover()
  await bob.discover()
  const quote = await alice.quoteRegistration(id(4), quoteArgs())
  const { reveal } = registrationCalls(id(4), { ...registration, commitmentStore: id(4), quote })
  const bobApp = createDuskDomainsConnectApp(wallet, bob.release)
  // Bob verified selection 1 for another name only, then for this one under his own policy.
  await bob.quoteRegistration(id(4), { ...quoteArgs(), node: nameKey('another.dusk').node, label: 'another' })
  await expect(bobApp.prepare(reveal)).rejects.toThrow('is not verified against this release')
  expect((await bob.quoteRegistration(id(4), quoteArgs())).total_lux).not.toBe(quote.total_lux)
  await expect(bobApp.prepare(reveal)).rejects.toThrow('is not verified against this release')
  expect((await createDuskDomainsConnectApp(wallet, alice.release).prepare(reveal)).fnName).toBe('register')
})

it('refuses a verified quote whose fields changed after verification', async () => {
  const client = (await world()).client()
  await client.discover()
  const quote = await client.quoteRegistration(id(4), quoteArgs())
  const build = () => registrationCalls(id(4), { ...registration, commitmentStore: id(4), quote })
  const { reveal } = build()
  const app = createDuskDomainsConnectApp(wallet, client.release)
  expect((await app.prepare(reveal)).deposit).toBe(quote.total_lux)
  // The same object with its price lowered after verification: neither built nor signed.
  quote.quote.base_lux = '1'
  quote.quote.premium_lux = '0'
  quote.total_lux = '1'
  expect(build).toThrow('quote again')
  for (const change of [{ expected_fee_lux: '1' }, { expected_policy_config_version: 2n }, { years: 2 }])
    await expect(app.prepare(buildCall('store', id(4), 'register', { ...reveal.args, ...change }))).rejects.toThrow(
      'is not verified against this release',
    )
})

it('quotes only at the policy selection the directory reports', async () => {
  // The store's reply names policy 33 at selection 2; the directory selects policy 3 at selection 1.
  const w = await world((c) => {
    c.quoteClaims = { policy: id(33), version: 2n }
    c.live.set(id(33), { role: 'policy' })
  }, listPolicy(await jsonRelease(), 33))
  const client = w.client()
  await client.discover()
  await expect(client.quoteRegistration(id(4), quoteArgs())).rejects.toThrow('policy selection')
  await expect(createDuskDomainsConnectApp(wallet, client.release).prepare(registerAt(2n))).rejects.toThrow(
    'is not verified against this release',
  )
})

it('asks for a fresh quote instead of building from a stored one, and rebuilds a stored reservation from one', async () => {
  const w = await world()
  const client = w.client()
  await client.discover()
  const prepared = await client.prepareRegistration(registration)
  // The integration stores the reservation with the quote it showed; the page reloads.
  const stored = parseJson(stringifyJson({ commitmentStore: prepared.store, quote: prepared.quote })) as { commitmentStore: string; quote: unknown }
  const restored = wireValue('RegistrationQuote', stored.quote) as RegistrationQuote
  let error: unknown
  try {
    registrationCalls(stored.commitmentStore, { ...registration, commitmentStore: stored.commitmentStore, quote: restored })
  } catch (e) {
    error = e
  }
  expect(error).toMatchObject({ name: 'UnverifiedQuoteError', retryable: true })
  expect((error as Error).message).toContain('quote again')
  // After the reveal wait, a new client rebuilds both calls from a fresh quote at the stored commitment.
  w.chain.height = 106n
  const reloaded = w.client()
  await reloaded.discover()
  const rebuilt = await reloaded.prepareRegistration({ ...registration, commitmentStore: stored.commitmentStore })
  expect(rebuilt.calls.commit).toEqual(prepared.calls.commit)
  expect(rebuilt.quote.height).toBe(106n)
  expect((await createDuskDomainsConnectApp(wallet, reloaded.release).prepare(rebuilt.calls.reveal)).fnName).toBe('register')
})

it('verifies concurrent requests for one contract once, and admits nothing when its checks fail', async () => {
  for (const ok of [true, false]) {
    const w = await world((c) => {
      c.markets.set(id(33), market(33))
      c.live.set(id(33), { role: 'marketplace', wasm: true, ...(ok ? {} : { bindingDirectory: 9 }) })
    })
    let resolved = 0
    const client = w.client({
      resolveContract: async (role) => {
        resolved++
        return resolvedArtifact(role, 33)
      },
      fetch: serveDriver('marketplace'),
    })
    const runs = await Promise.allSettled([
      client.verifyContract('marketplace', id(33)),
      client.verifyContract('marketplace', id(33)),
      client.marketplace(id(33)).order_api_version(),
    ])
    expect(resolved).toBe(1)
    expect(runs.map((r) => r.status)).toEqual(Array(3).fill(ok ? 'fulfilled' : 'rejected'))
    expect(client.release.contracts.has(id(33))).toBe(ok)
  }
})

it('keeps a refusal to its client: a new client checks the contract again', async () => {
  // A node misreports the store's directory record once.
  const w = await world((c) => { c.stores = [{ ...admission(4), code_hash: bytes(66) }] })
  const first = w.client()
  await expect(first.discover()).rejects.toThrow('Admission artifact/version mismatch')
  w.chain.stores = [admission(4)]
  await expect(first.store(id(4)).stats()).rejects.toThrow('Admission artifact/version mismatch')
  const second = w.client()
  await second.discover()
  expect(await second.store(id(4)).stats()).toEqual(sample('StoreStats'))
})

it('binds a quote to the request the store priced, not to the caller\'s object after it', async () => {
  // alpha1 and bravo2 cost the same; the caller rewrites its objects while the store prices alpha1.
  const alpha = { node: nameKey('alpha1.dusk').node, label: 'alpha1' }, bravo = { node: nameKey('bravo2.dusk').node, label: 'bravo2' }
  const priced: string[] = []
  let rewrite = (): void => {}
  const w = await world((c) => {
    c.tick = (fn) => {
      if (fn === 'quote_registration') rewrite()
    }
  })
  const client = w.client()
  await client.discover()
  const app = createDuskDomainsConnectApp(wallet, client.release)
  const args = { ...quoteArgs(), ...alpha }
  rewrite = () => {
    priced.push(args.label)
    Object.assign(args, bravo)
  }
  const quote = await client.quoteRegistration(id(4), args)
  expect(priced).toEqual(['alpha1'])
  expect(() => registrationCalls(id(4), { ...registration, ...bravo, commitmentStore: id(4), quote })).toThrow('quote again')
  const { reveal } = registrationCalls(id(4), { ...registration, ...alpha, commitmentStore: id(4), quote })
  expect((await app.prepare(reveal)).fnName).toBe('register')
  await expect(app.prepare(buildCall('store', id(4), 'register', { ...reveal.args, ...bravo }))).rejects.toThrow(
    'is not verified against this release',
  )
  // prepareRegistration builds its calls for the registration it was asked for, too.
  const input = { ...registration, ...alpha }
  rewrite = () => Object.assign(input, bravo)
  const prepared = await client.prepareRegistration(input)
  expect(prepared.calls.reveal.args.label).toBe('alpha1')
  await expect(app.prepare(buildCall('store', id(4), 'register', { ...prepared.calls.reveal.args, ...bravo }))).rejects.toThrow(
    'is not verified against this release',
  )
})

it('records nothing signable from a quote whose snapshot was abandoned', async () => {
  let last: string | undefined
  const w = await world((c) => {
    c.tick = (fn) => {
      last = fn
    }
    // Every attempt reads a consistent quote, then sees the tip move before its snapshot commits.
    c.onHeight = () => {
      if (last === 'quote_registration') {
        c.height++
        last = undefined
      }
    }
  })
  const client = w.client()
  await client.discover()
  await expect(client.quoteRegistration(id(4), quoteArgs())).rejects.toThrow('Chain tip changed during read; retry the snapshot')
  await expect(client.prepareRegistration(registration)).rejects.toThrow('Chain tip changed during read; retry the snapshot')
  // A register call with exactly the terms those attempts read is not signable.
  const { total_lux } = estimateRegistrationQuote(launchPolicyConfig(), {
    version: 1, directory: bytes(1), store: bytes(4), node: root, label: 'example', actor: bytes(10), years: 1,
    height: w.chain.height, previous_generation: 0n, previous_grace_end: null, policy_version: 1n,
  })
  const manual = buildCall('store', id(4), 'register', {
    ...(sample('Register') as Register), node: root, label: 'example', years: 1, expected_fee_lux: total_lux,
    expected_policy_version: 1n, expected_policy_config_version: 1n,
  })
  await expect(createDuskDomainsConnectApp(wallet, client.release).prepare(manual)).rejects.toThrow(
    'is not verified against this release',
  )
})

it('quotes and prepares from reactive proxies of the caller\'s objects', async () => {
  // The request is copied as it reads when called, through any Proxy a UI framework wraps it in.
  const client = (await world()).client()
  await client.discover()
  expect((await client.quoteRegistration(id(4), new Proxy(quoteArgs(), {}))).policy).toEqual(bytes(3))
  expect((await client.prepareRegistration(new Proxy({ ...registration }, {}))).calls.reveal.args.label).toBe('example')
})

it('commits no contract discovery verified only in snapshots it abandoned', async () => {
  let last: string | undefined
  const w = await world((c) => {
    c.preferred = id(6)
    c.tick = (fn) => {
      last = fn
    }
    // Every discovery attempt verifies the preferred market, then sees the tip move. A retry checks
    // what the first attempt read of the market, so it ends with the directory's market record.
    c.onHeight = () => {
      if (last === 'order_api_version' || last === 'market') {
        c.height++
        last = undefined
      }
    }
  })
  const client = w.client()
  await client.verifyContract('store', id(4))
  await expect(client.discover()).rejects.toThrow('Chain tip changed during read; retry the snapshot')
  // At the tip the market is gone from the directory: it must not receive a name.
  w.chain.onHeight = undefined
  w.chain.preferred = null
  w.chain.markets.clear()
  const intent = custodyIntent()
  const handOff = buildCall('store', id(4), 'transfer_and_call', {
    name: intent.terms.name, target: bytes(6), callback_gas: 500_000_000n,
    data: Array.from(jsonDriver.encodeInput('custody_intent', stringifyJson(intent))),
  })
  await expect(createDuskDomainsConnectApp(wallet, client.release).prepare(handOff)).rejects.toThrow('not a marketplace verified')
})

it('copies arguments without calling the caller\'s own array methods', async () => {
  const w = await world()
  const client = w.client()
  await client.discover()
  const record = (url: string) => ({ key: 'url', value: [...new TextEncoder().encode(url)], ttl_seconds: 3600n })
  // Arrays whose own .map hands back the caller's array, which it then changes mid-read.
  const records = [record('https://a.example')]
  Object.defineProperty(records, 'map', { value: () => records })
  const node = [...root]
  Object.defineProperty(node, 'map', { value: () => node })
  let rewrite = (): void => {}
  w.chain.tick = (fn) => {
    if (fn === 'quote_registration') rewrite()
  }
  rewrite = () => {
    records[0] = record('https://evil.example')
  }
  const prepared = await client.prepareRegistration({ ...registration, records })
  expect(prepared.calls.reveal.args.records).toEqual([record('https://a.example')])
  rewrite = () => {
    node.fill(9)
  }
  const quote = await client.quoteRegistration(id(4), { ...quoteArgs(), node })
  const { reveal } = registrationCalls(id(4), { ...registration, commitmentStore: id(4), quote })
  expect((await createDuskDomainsConnectApp(wallet, client.release).prepare(reveal)).fnName).toBe('register')
})
