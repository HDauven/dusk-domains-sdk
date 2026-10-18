/**
 * The real lens data driver and real lens replies: testnet goldens (tests/fixtures/README.md) read from
 * the deployed testnet lens, its deployment handoff, and the testnet release it is bound to.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { sha256 } from '@noble/hashes/sha2.js'
import { FrozenClient, type LensFallback } from '../src/frozen/client.ts'
import { loadDataDriver, type DataDriver } from '../src/frozen/driver.ts'
import { contractId, fromHex, hex, nameKey } from '../src/frozen/bytes.ts'
import { parseJson, stringifyJson } from '../src/frozen/json.ts'
import { wireValue } from '../src/frozen/wire.ts'
import { fetchDriver, validateReleaseManifest, type LoadedRelease, type ReleaseContract } from '../src/frozen/manifest.ts'
import { lensCatalog } from '../src/frozen/lens-schema.ts'
import {
  checkAvailability, checkBootstrap, checkNamePage, checkPricing, checkResolution, checkReverse,
  lensInitCommitment, lensInput, type EvidenceContext,
} from '../src/frozen/lens.ts'
import { driverBytes } from './helpers.ts'

interface Case { export: string; note: string; args: any; argsHex: string; replyHex: string; reply: any }
const fixture = (name: string) => readFileSync(new URL(`fixtures/${name}`, import.meta.url))
const golden = parseJson(gunzipSync(fixture('testnet-lens-golden.json.gz')).toString()) as {
  lens: string; directory: string; driver: { sha256: string }; init: { args: unknown; argsHex: string; initHash: string }; fixtures: Case[]
}
const testnet = JSON.parse(fixture('testnet-release.json').toString()) as {
  chainId: string; network: number; binding: { directory: number[]; vault: number[]; network: number }
  contracts: ReleaseContract[]; lens: Record<string, unknown>; lensDeployment: { init: unknown; initArchive: string; initHash: string }
}
const lensBytes = new Uint8Array(gunzipSync(fixture('lens.wasm.gz')))
const cases = (exported: string) => golden.fixtures.filter((c) => c.export === exported)
const unhex = (s: string) => Uint8Array.from(fromHex(s))
let driver: DataDriver
beforeAll(async () => {
  driver = await loadDataDriver(lensBytes)
})

it('is the pinned lens driver, which the SDK loads as the lens role', async () => {
  expect(hex(sha256(lensBytes))).toBe(golden.driver.sha256)
  expect(testnet.lens).toMatchObject({ role: 'lens', dataDriver: { sha256: golden.driver.sha256, bytes: lensBytes.length } })
  const entry = validateReleaseManifest({
    chainId: testnet.chainId, network: testnet.network, nodeUrl: 'https://node.invalid', indexerUrl: 'https://indexer.invalid',
    contracts: testnet.contracts, lens: testnet.lens,
  }).lens!
  expect(entry.contractId).toBe(golden.lens)
  const loaded = await fetchDriver(entry, 'https://release.invalid/', (async () => new Response(lensBytes)) as unknown as typeof fetch)
  expect(loaded.schema()).toMatchObject({ lens_version: 1, functions: lensCatalog.map(({ name, input, output }) => ({ name, input, output })) })
})

it('recomputes the deployment\'s init commitment byte for byte', () => {
  const { lensDeployment } = testnet
  expect(lensDeployment.init).toEqual(golden.init.args)
  expect(hex(driver.encodeInput('init', stringifyJson(lensDeployment.init)))).toBe(lensDeployment.initArchive)
  expect(lensDeployment.initArchive).toBe(golden.init.argsHex)
  expect(lensInitCommitment(driver, contractId(testnet.binding.directory))).toBe(golden.init.initHash)
  expect(lensDeployment.initHash).toBe(golden.init.initHash)
  expect(testnet.lens.initHash).toBe(golden.init.initHash)
  // The protocol's entrypoint e2e handoff (local chain, its own directory), from the same deploy tool.
  const e2e = {
    directory: 'b656d85cdf3a2e61361c63887ff604bd0b10849d2ebe29bfc9996069b10dc48c',
    initHash: 'cb6cebdd5b77cf7b0ef43ed269f418973c1b0cf0dec63debbf9b445b47e45df5',
  }
  expect(hex(driver.encodeInput('init', stringifyJson({ directory: fromHex(e2e.directory, 32) })))).toBe(e2e.directory)
  expect(lensInitCommitment(driver, e2e.directory)).toBe(e2e.initHash)
})

it('holds every testnet golden: 18 replies over every export, read at one height', () => {
  expect(golden.fixtures).toHaveLength(18)
  expect(new Set(golden.fixtures.map((c) => c.export))).toEqual(new Set(lensCatalog.filter((m) => m.name !== 'init').map((m) => m.name)))
})

it('records the lens\'s block_height as the GraphQL tip height, never tip + 1', () => {
  // 12 back-to-back samples on testnet: a tip read, a lens query, a tip read.
  const { heights } = golden as unknown as { heights: { before: number; lens: number; after: number }[] }
  expect(heights).toHaveLength(12)
  for (const h of heights) expect([h.lens, h.after]).toEqual([h.before, h.before])
  expect(new Set(heights.map((h) => h.lens)).size).toBe(3)
})

describe('every golden reply', () => {
  it.each(golden.fixtures.map((c) => [`${c.export}: ${c.note}`, c] as const))('%s decodes with the real driver to its JSON, and its argument encodes to its bytes', (_, c) => {
    const spec = lensCatalog.find((m) => m.name === c.export)!
    const decoded = driver.decodeOutput(c.export, unhex(c.replyHex))
    expect(decoded).toEqual(c.reply)
    // The SDK's strict schema takes the real reply as it is.
    expect(wireValue(spec.output, decoded)).toEqual(wireValue(spec.output, c.reply))
    if (c.args === null) {
      expect(c.argsHex).toBe('')
      return
    }
    expect(hex(driver.encodeInput(c.export, stringifyJson(c.args)))).toBe(c.argsHex)
    // Through the SDK's own validation, where the SDK would send it (an invalid name is refused locally).
    try {
      expect(hex(lensInput(driver, c.export as never, c.args))).toBe(c.argsHex)
    } catch (error) {
      expect(c.reply.Refused?.code).toMatch(/^Invalid/u)
      expect(String(error)).toMatch(/Invalid/u)
    }
  })
})

/** The testnet release, as a client loads it, with the reviewed policy driver for init commitments. */
function testnetRelease(): LoadedRelease {
  const manifest = validateReleaseManifest({
    chainId: testnet.chainId, network: testnet.network, nodeUrl: 'https://node.invalid', indexerUrl: 'https://indexer.invalid',
    contracts: testnet.contracts, lens: testnet.lens,
  })
  const contracts = new Map(manifest.contracts.map((c) => [c.contractId, c]))
  // The frozen ABI's archives do not depend on the driver build: the pinned fixtures encode them.
  const drivers = new Map<string, DataDriver>()
  return { manifest, contracts, drivers, artifactBaseUrl: 'https://release.invalid/', lens: { contract: manifest.lens!, driver } }
}
const context = async (release: LoadedRelease): Promise<EvidenceContext> => {
  for (const c of release.manifest.contracts)
    release.drivers.set(c.contractId, await loadDataDriver(new Uint8Array(driverBytes(c.role))))
  return {
    release, refused: new Map(), known: () => undefined, selection: () => undefined, storeMark: -1,
    directoryId: contractId(testnet.binding.directory), vaultId: contractId(testnet.binding.vault),
  }
}

describe('the SDK\'s evidence checks', () => {
  it('accept every real honest Ok reply', async () => {
    const ctx = await context(testnetRelease())
    const ok = (c: Case) => wireValue(lensCatalog.find((m) => m.name === c.export)!.output, c.reply) as { Ok?: any }
    let checked = 0
    for (const c of golden.fixtures) {
      const reply = ok(c).Ok
      if (!reply || !c.args && !['bootstrap', 'pricing'].includes(c.export)) continue
      const label = `${c.export}: ${c.note}`
      if (c.export === 'resolve') {
        const r = checkResolution(ctx, reply, nameKey(c.args.name), c.args.record_keys)
        expect(r.records, label).toEqual(reply.records)
      } else if (c.export === 'reverse') expect(checkReverse(ctx, reply, c.args.endpoint)?.store ?? null, label).toBe(reply.primary ? contractId(reply.primary.store) : null)
      else if (c.export === 'name_page') expect(checkNamePage(ctx, reply, nameKey(c.args.name)).status, label).toBe(reply.status)
      else if (c.export === 'availability') {
        const shown = checkAvailability(ctx, reply, nameKey(`${c.args.label}.dusk`), c.args)
        expect(shown === 'registered' ? 'Registered' : 'Registrable', label).toBe(Object.keys(reply.status)[0])
      } else if (c.export === 'bootstrap') expect(checkBootstrap(ctx, reply).stores, label).toEqual(reply.stores)
      else if (c.export === 'pricing') expect(checkPricing(ctx, reply).config, label).toEqual(reply.policy.config)
      checked++
    }
    // resolve 3, reverse 2, name_page 2, availability 3, bootstrap and pricing.
    expect(checked).toBe(12)
  })
})

describe('a client reading the testnet lens', () => {
  const height = 4618370n
  /** A node answering the client's directory check and every golden lens query, at the golden height. */
  function transport(log: string[]) {
    const lensId = golden.lens,
      directory = contractId(testnet.binding.directory)
    return {
      namespace: 'testnet-golden',
      currentBlock: async () => ({ height, hash: 'ab'.repeat(32) }),
      currentBlockHeight: async () => height,
      read: async (target: string, fn: string, data: Uint8Array) => {
        log.push(`${target === lensId ? 'lens' : target.slice(0, 8)}.${fn}`)
        if (target === directory && fn === 'interface_version') return Uint8Array.from([0, 0, 1, 0, 0, 0, 0, 0])
        if (target === directory && fn === 'binding')
          return Uint8Array.from([...testnet.binding.directory, ...testnet.binding.vault, testnet.binding.network])
        const c = target === lensId && golden.fixtures.find((x) => x.export === fn && x.argsHex === hex(data))
        if (!c) throw new Error(`No golden for ${target}.${fn}`)
        return unhex(c.replyHex)
      },
    }
  }
  async function client() {
    const release = testnetRelease(),
      log: string[] = [],
      fallbacks: LensFallback[] = []
    await context(release)
    const c = new FrozenClient(release, { transport: transport(log), onLensFallback: (f) => void fallbacks.push(f) })
    await c.verifyContract('directory', contractId(testnet.binding.directory))
    return { c, log, fallbacks }
  }
  const actor = (label: string) => cases('availability').find((x) => x.args.label === label)!.args.actor

  it('answers each view with one lens query, from the real replies', async () => {
    const { c, log, fallbacks } = await client()
    const resolved = await c.resolve('lenscheck1018.dusk', ['moonlight_address', 'website', 'absent'])
    expect(resolved.records.map((r) => r?.key ?? null)).toEqual(['moonlight_address', 'website', null])
    expect(resolved).toMatchObject({ status: 'Active', height })
    expect((await c.resolve('sub.lenscheck1018.dusk', ['moonlight_address'])).records).toEqual([null])
    expect(await c.resolve('lens-available-1018.dusk', ['moonlight_address'])).toMatchObject({ value: 'Absent', status: 'Absent' })
    const own = await c.namePage('lenscheck1018.dusk')
    expect(own.primary).toMatchObject({ isPrimary: true, error: null })
    expect(own.renewal?.max_years).toBeGreaterThan(0)
    expect((await c.namePage('rehearsal1017.dusk')).records).toMatchObject({ records: [] })
    const [verified, none] = cases('reverse')
    expect((await c.verifyPrimary(verified.args.endpoint))?.primary.spelling).toBe('lenscheck1018.dusk')
    expect(await c.verifyPrimary(none.args.endpoint)).toBeNull()
    const quote = await c.previewRegistration({ label: 'lens-free-1018', years: 1, actor: actor('lens-free-1018') })
    expect(quote).toMatchObject({ height, quote: { total_lux: cases('availability')[0].reply.Ok.status.Registrable.quote.total_lux } })
    await expect(c.previewRegistration({ label: 'lenscheck1018', years: 2, actor: actor('lenscheck1018') })).rejects.toThrow('Registration root is not released')
    expect((await c.previewRegistration({ label: 'admin', years: 1, actor: actor('admin') })).quote.total_lux).toBe('0')
    expect((await c.bootstrap()).stores).toHaveLength(1)
    expect((await c.pricing()).policy).toBe(testnet.contracts.find((x) => x.role === 'policy')!.contractId)
    expect(fallbacks).toEqual([])
    // The lens's binding and interface once, then one lens query per view.
    expect(log.filter((call) => call.startsWith('lens.'))).toEqual([
      'lens.binding', 'lens.lens_interface', 'lens.resolve', 'lens.resolve', 'lens.resolve', 'lens.name_page', 'lens.name_page',
      'lens.reverse', 'lens.reverse', 'lens.availability', 'lens.availability', 'lens.availability', 'lens.bootstrap', 'lens.pricing',
    ])
  })

  it('falls back to the direct reads on a real refusal', async () => {
    const { c, log, fallbacks } = await client()
    // years 0: the lens refuses with InvalidArgument; the direct reads decide (here they find no golden).
    await expect(c.previewRegistration({ label: 'lens-free-1018', years: 0, actor: actor('lens-free-1018') })).rejects.toThrow(
      'No golden for',
    )
    expect(fallbacks.map((f) => [f.method, f.reason, (f.error as { refusal?: { code: string } }).refusal?.code])).toEqual([
      ['previewRegistration', 'refused', 'InvalidArgument'],
    ])
    expect(log.slice(-2)).toEqual(['lens.availability', `${contractId(testnet.binding.directory).slice(0, 8)}.registration_context`])
  })
})
