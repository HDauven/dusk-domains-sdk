/**
 * The light reader (`./lens-reader`) over the real lens driver and the testnet lens goldens
 * (tests/fixtures/README.md), behind a fake fetch that logs every request: what it fetches, what it
 * answers, and that whatever fails throws without another read.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLensReader, LensReaderError, type LensReader } from '../src/lens-reader.ts'
import { moonlightAccount } from '../src/frozen/lens-reader.ts'
import { FrozenClient, type LensFallback } from '../src/frozen/client.ts'
import { loadDataDriver } from '../src/frozen/driver.ts'
import { contractId, fromHex, hex } from '../src/frozen/bytes.ts'
import { parseJson } from '../src/frozen/json.ts'
import { validateReleaseManifest, type ReleaseContract } from '../src/frozen/manifest.ts'
import { encodeBase58 } from '../src/core/principal.ts'
import { driverBytes } from './helpers.ts'
import { clocks } from './lens-world.ts'

interface Case { export: string; note: string; args: any; argsHex: string; replyHex: string; reply: any }
const fixture = (name: string) => readFileSync(new URL(`fixtures/${name}`, import.meta.url))
const golden = parseJson(gunzipSync(fixture('testnet-lens-golden.json.gz')).toString()) as { lens: string; fixtures: Case[] }
const testnet = JSON.parse(fixture('testnet-release.json').toString()) as {
  chainId: string; network: number; binding: { directory: number[]; vault: number[]; network: number }
  contracts: ReleaseContract[]; lens: { dataDriver: { path: string } } & Record<string, unknown>
}
const lensBytes = new Uint8Array(gunzipSync(fixture('lens.wasm.gz')))
const unhex = (s: string) => Uint8Array.from(fromHex(s))
const height = 4618370n
const NODE = 'https://node.invalid'
const ARTIFACTS = 'https://release.invalid/'
const DRIVER = `${ARTIFACTS}${testnet.lens.dataDriver.path}`
const LENS = `POST ${NODE}/on/contracts:${golden.lens}/`
const cases = (exported: string) => golden.fixtures.filter((c) => c.export === exported)
const [owned, subname, absent] = cases('resolve')
const [verified, unmapped] = cases('reverse')
const of = (role: string) => testnet.contracts.find((c) => c.role === role)!
/** The testnet release as an app pins it: no node or indexer URL. */
const pinned = (): Record<string, any> =>
  structuredClone({ chainId: testnet.chainId, network: testnet.network, contracts: testnet.contracts, lens: testnet.lens })
/** The golden reply to a lens query, by method and argument bytes. */
const goldenReply = (fn: string, args: string) => {
  const c = golden.fixtures.find((x) => x.export === fn && x.argsHex === args)
  return c && unhex(c.replyHex)
}
/** `bytes` with every copy of the 32 bytes `from` (hex) replaced by `to`. */
const swap = (bytes: Uint8Array, from: string, to: string) => unhex(hex(bytes).replaceAll(from, to))
const other = 'ee'.repeat(32)

type Answer = Uint8Array | Response | undefined
/**
 * The artifact host and node: the lens driver (or `driver`), and the golden reply to each lens query
 * unless `reply` answers it. Any other request is a 404. Every request is in `log`.
 */
function host(options: { driver?: Uint8Array; reply?: (fn: string, args: string, golden: Uint8Array | undefined, signal?: AbortSignal | null) => Answer | Promise<Answer> } = {}) {
  const log: string[] = []
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    log.push(`${init?.method ?? 'GET'} ${url}`)
    if (url === DRIVER) return new Response(options.driver ?? lensBytes)
    const call = /^https:\/\/node\.invalid\/on\/contracts:([\da-f]{64})\/(\w+)$/u.exec(url)
    if (!call || init?.method !== 'POST') return new Response('Not found', { status: 404 })
    const args = hex(init.body as Uint8Array),
      reply = call[1] === golden.lens ? goldenReply(call[2], args) : undefined,
      answer = options.reply ? await options.reply(call[2], args, reply, init.signal) : reply
    return answer instanceof Response ? answer : answer ? new Response(answer) : new Response('No golden', { status: 500 })
  }) as typeof fetch
  return { fetch, log }
}
const reader = (h = host(), release = pinned(), options: { timeoutMs?: number } = {}) =>
  createLensReader(release, { nodeUrl: NODE, artifactBaseUrl: ARTIFACTS, fetch: h.fetch, ...options })
/** What a read returns, or the reason, message and refusal code of the `LensReaderError` it throws. */
const outcome = (run: Promise<unknown>) =>
  run.then(
    (value) => ({ value }),
    (error: unknown) => {
      if (!(error instanceof LensReaderError)) throw error
      return { reason: error.reason, message: error.message, ...(error.refusal ? { refusal: error.refusal.code } : {}) }
    },
  )
/** Every request a reader sent but the lens driver's, as `<method>` of a lens query, or the request itself. */
const queries = (log: string[]) => log.filter((l) => l !== `GET ${DRIVER}`).map((l) => (l.startsWith(LENS) ? l.slice(LENS.length) : l))

describe('a light reader of the testnet lens', () => {
  it('fetches the lens driver alone, checks the deployment once and sends one lens query per read, no tip read', async () => {
    const h = host(),
      r = await reader(h)
    expect(h.log).toEqual([`GET ${DRIVER}`])
    expect(await r.resolve(owned.args.name, owned.args.record_keys)).toMatchObject({ status: 'Active', height })
    expect((await r.resolve(subname.args.name)).records).toEqual([null])
    expect(await r.resolve(absent.args.name)).toMatchObject({ value: 'Absent', status: 'Absent', records: [null], height })
    expect((await r.verifyPrimary(verified.args.endpoint))?.primary.spelling).toBe('lenscheck1018.dusk')
    expect(await r.verifyPrimary(Uint8Array.from(unmapped.args.endpoint))).toBeNull()
    expect(h.log.filter((l) => l.startsWith('GET'))).toEqual([`GET ${DRIVER}`])
    // The first read's query goes out beside the deployment check's two reads, used once they passed.
    expect(queries(h.log).sort()).toEqual(['binding', 'lens_interface', 'resolve', 'resolve', 'resolve', 'reverse', 'reverse'])
  })

  it('answers as the full client does through the lens, over the same replies', async () => {
    const manifest = validateReleaseManifest({ ...pinned(), nodeUrl: NODE, indexerUrl: 'https://indexer.invalid' }),
      drivers = new Map(await Promise.all(manifest.contracts.map(async (c) => [c.contractId, await loadDataDriver(driverBytes(c.role))] as const))),
      lens = { contract: manifest.lens!, driver: await loadDataDriver(lensBytes) },
      directory = contractId(testnet.binding.directory),
      fallbacks: LensFallback[] = []
    const client = new FrozenClient(
      { manifest, contracts: new Map(manifest.contracts.map((c) => [c.contractId, c])), drivers, artifactBaseUrl: ARTIFACTS, lens },
      {
        onLensFallback: (f) => void fallbacks.push(f),
        transport: {
          namespace: 'testnet-golden',
          currentBlock: async () => ({ height, hash: 'ab'.repeat(32) }),
          currentBlockHeight: async () => height,
          read: async (target, fn, data) => {
            // The client verifies the directory, which the reader cannot read.
            if (target === directory && fn === 'interface_version') return Uint8Array.from([0, 0, 1, 0, 0, 0, 0, 0])
            if (target === directory && fn === 'binding') return Uint8Array.from([...testnet.binding.directory, ...testnet.binding.vault, 2])
            return (target === golden.lens && goldenReply(fn, hex(data))) || Promise.reject(new Error(`No golden for ${fn}`))
          },
        },
      },
    )
    const r = await reader()
    for (const c of [owned, subname, absent])
      expect(await r.resolve(c.args.name, c.args.record_keys), c.note).toEqual(await client.resolve(c.args.name, c.args.record_keys))
    for (const c of [verified, unmapped]) expect(await r.verifyPrimary(c.args.endpoint), c.note).toEqual(await client.verifyPrimary(c.args.endpoint))
    expect(fallbacks).toEqual([])
  })

  it("gives a name's Moonlight account only for an active name with a 96-byte record", async () => {
    const r = await reader()
    expect(await r.resolveMoonlightAccount(absent.args.name)).toEqual({ status: 'Absent', height })
    expect(await r.resolveMoonlightAccount(subname.args.name)).toEqual({ status: 'Active', height })
    // No golden resolves lenscheck1018.dusk for its moonlight_address alone: the same records, among others.
    const resolved = await r.resolve(owned.args.name, owned.args.record_keys),
      key = verified.args.endpoint as number[]
    expect(resolved.records[0]).toMatchObject({ key: 'moonlight_address', value: key })
    expect(moonlightAccount(resolved)).toEqual({ status: 'Active', height, account: encodeBase58(key) })
    const record = resolved.records[0]!,
      account = (value: number[]) => moonlightAccount({ ...resolved, records: [{ ...record, value }] })
    // Not a compressed key: too short, all zeros, the identity, a coordinate past the field.
    for (const value of [key.slice(1), Array(96).fill(0), [0xc0, ...Array(95).fill(0)], [0x9f, ...Array(95).fill(0xff)]])
      expect(account(value)).toEqual({ status: 'Active', height })
    expect(moonlightAccount({ ...resolved, status: 'Grace' })).toEqual({ status: 'Grace', height })
  })
})

describe('a light reader fails closed', () => {
  const [store, resolver] = ['store', 'resolver'].map(of)
  const pin = (role: string, change: Record<string, unknown>) => (release: Record<string, any>) =>
    Object.assign(release.contracts.find((c: ReleaseContract) => c.role === role), change)
  const bytesOf = (c: Case) => unhex(c.replyHex)
  const refusal = cases('resolve').find((c) => c.note === 'Refused: InvalidArgument')!
  type Bad = [
    string,
    { reply?: (fn: string, args: string, golden: Uint8Array | undefined) => Answer; release?: (release: Record<string, any>) => void },
    (r: LensReader) => Promise<unknown>,
    { reason: string; message: RegExp; refusal?: string },
  ]
  const owns = (r: LensReader) => r.resolve(owned.args.name, owned.args.record_keys)
  const bad: Bad[] = [
    ['a store admission of other code', { reply: (_, __, g) => g && swap(g, store.codeHash!, other) }, owns,
      { reason: 'evidence', message: /store \w+ does not match the release/u }],
    ['a resolver admission of other code', { reply: (_, __, g) => g && swap(g, resolver.codeHash!, other) }, owns,
      { reason: 'evidence', message: /resolver \w+ does not match the release/u }],
    ['a store of other code than the release pins', { release: pin('store', { codeHash: other }) }, (r) => r.resolve(absent.args.name),
      { reason: 'evidence', message: /store \w+ does not match the release/u }],
    ['a resolver of another init than the release pins', { release: pin('resolver', { initHash: other }) }, (r) => r.verifyPrimary(verified.args.endpoint),
      { reason: 'evidence', message: /resolver \w+ does not match the release/u }],
    ['a store the release does not list', { reply: (_, __, g) => g && swap(g, store.contractId, other) }, (r) => r.resolve(subname.args.name),
      { reason: 'evidence', message: /store e{64}, which the release does not list/u }],
    ['a resolver the release does not list', { reply: (_, __, g) => g && swap(g, resolver.contractId, other) }, (r) => r.verifyPrimary(verified.args.endpoint),
      { reason: 'evidence', message: /resolver e{64}, which the release does not list/u }],
    ['a reply for another name', { reply: (fn, _, g) => (fn === 'resolve' ? bytesOf(subname) : g) }, (r) => r.resolve(absent.args.name),
      { reason: 'evidence', message: /for another name/u }],
    ['a reply for other record keys', { reply: (fn, _, g) => (fn === 'resolve' ? bytesOf(owned) : g) }, (r) => r.resolve(owned.args.name),
      { reason: 'evidence', message: /not those requested/u }],
    ['a reply for another endpoint', { reply: (fn, _, g) => (fn === 'reverse' ? bytesOf(unmapped) : g) }, (r) => r.verifyPrimary(verified.args.endpoint),
      { reason: 'evidence', message: /for another endpoint/u }],
    ['a reply that does not decode', { reply: (fn, _, g) => (fn === 'resolve' ? g!.slice(0, -8) : g) }, (r) => r.resolve(absent.args.name),
      { reason: 'decode', message: /does not decode/u }],
    ["the lens's refusal", { reply: (fn, _, g) => (fn === 'resolve' ? bytesOf(refusal) : g) }, (r) => r.resolve(absent.args.name),
      { reason: 'refused', message: /refused: InvalidArgument/u, refusal: 'InvalidArgument' }],
    ['a lens that reports another binding', { reply: (fn, _, g) => (fn === 'binding' ? Uint8Array.from([...g!.slice(0, 64), 1]) : g) },
      (r) => r.resolve(absent.args.name), { reason: 'deployment', message: /binding mismatch/u }],
    ['a lens bound to another vault than the release pins', { release: pin('vault', { contractId: other }) }, (r) => r.verifyPrimary(unmapped.args.endpoint),
      { reason: 'deployment', message: /binding mismatch/u }],
    ['a lens that reports another interface', { reply: (fn, _, g) => (fn === 'lens_interface' ? Uint8Array.from([1, 0, 65, 0, 63, 0, 16, 0]) : g) },
      (r) => r.resolve(absent.args.name), { reason: 'deployment', message: /Unsupported lens interface/u }],
  ]
  it.each(bad)('throws for %s, and reads nothing else', async (_, change, read, expected) => {
    const h = host({ reply: change.reply }),
      release = pinned()
    change.release?.(release)
    const { message, ...rest } = expected
    expect(await outcome(read(await reader(h, release)))).toEqual({ ...rest, message: expect.stringMatching(message) })
    expect(h.log.filter((l) => !l.startsWith(LENS))).toEqual([`GET ${DRIVER}`])
  })
  it('changes the binding and interface replies where the cases above assume', () => {
    expect(cases('binding')[0].replyHex).toBe(`${hex(testnet.binding.directory)}${hex(testnet.binding.vault)}02`)
    expect(cases('lens_interface')[0].replyHex).toBe('010040003f001000')
  })

  it('rejects a lens driver other than the one the release pins, before running it', async () => {
    const tampered = lensBytes.slice()
    tampered[4096] ^= 1
    const h = host({ driver: tampered })
    expect(await outcome(reader(h))).toEqual({ reason: 'deployment', message: 'The lens driver did not load: Driver sha256 mismatch' })
    expect(h.log).toEqual([`GET ${DRIVER}`])
    const release = pinned()
    release.lens.dataDriver.sha256 = other
    expect(await outcome(reader(host(), release))).toMatchObject({ reason: 'deployment', message: expect.stringMatching(/sha256 mismatch/u) })
    expect(await outcome(reader(host({ driver: lensBytes.slice(1) })))).toMatchObject({ message: expect.stringMatching(/byte count mismatch/u) })
  })
  it.each([
    ['no lens', (r: Record<string, any>) => delete r.lens, /has no lens/u, []],
    ['a lens without its code hash', (r: Record<string, any>) => delete r.lens.codeHash, /lens has no code or init commitment/u, []],
    ['a store without its init hash', pin('store', { initHash: null }), /store \w+ has no code or init commitment/u, []],
    ['a resolver without its code hash', pin('resolver', { codeHash: null }), /resolver \w+ has no code or init commitment/u, []],
    ['a lens bound to another directory', pin('directory', { contractId: other }), /init commitment is not bound to the release's directory/u, [`GET ${DRIVER}`]],
  ])('refuses a release with %s before any node query', async (_, change, message, fetched) => {
    const h = host(),
      release = pinned()
    change(release)
    expect(await outcome(reader(h, release))).toEqual({ reason: 'deployment', message: expect.stringMatching(message) })
    expect(h.log).toEqual(fetched)
  })
  it('holds a lens that failed its deployment check off for 10 minutes, sending nothing, then checks it again', async () => {
    const clock = clocks()
    try {
      let mismatch = true
      const h = host({ reply: (fn, _, g) => (fn === 'binding' && mismatch ? Uint8Array.from([...g!.slice(0, 64), 1]) : g) }),
        r = await reader(h)
      expect(await outcome(r.resolve(absent.args.name))).toEqual({ reason: 'deployment', message: 'Lens deployment binding mismatch' })
      expect(queries(h.log).sort()).toEqual(['binding', 'lens_interface', 'resolve'])
      clock.advance(599_999)
      expect(await outcome(r.verifyPrimary(verified.args.endpoint))).toEqual({ reason: 'deployment', message: 'Lens deployment binding mismatch' })
      expect(queries(h.log)).toHaveLength(3)
      mismatch = false
      clock.advance(1)
      expect((await r.resolve(absent.args.name)).status).toBe('Absent')
      expect(queries(h.log).sort()).toEqual(['binding', 'binding', 'lens_interface', 'lens_interface', 'resolve', 'resolve'])
    } finally {
      clock.restore()
    }
  })
  it('checks the deployment again for a read that joined a check another read started, when that fails to read', async () => {
    let busy = 1
    const h = host({ reply: (fn, _, g) => (fn === 'binding' && busy-- > 0 ? new Response('busy', { status: 500 }) : g) }),
      r = await reader(h)
    // The second read joins the first's check, which fails for the first read; it checks again itself.
    const [first, second] = await Promise.all([outcome(r.resolve(absent.args.name)), outcome(r.resolve(subname.args.name))])
    expect(first).toMatchObject({ reason: 'read', message: expect.stringMatching(/^Lens binding query failed/u) })
    expect(second).toMatchObject({ value: { status: 'Active' } })
    expect(queries(h.log).filter((q) => q === 'binding')).toHaveLength(2)
  })
  it('does not hold off a deployment check whose reply did not decode', async () => {
    let garbled = true
    const h = host({ reply: (fn, _, g) => (fn === 'binding' && garbled ? g!.slice(0, 10) : g) }),
      r = await reader(h)
    expect(await outcome(r.resolve(absent.args.name))).toMatchObject({ reason: 'decode', message: expect.stringMatching(/^Lens binding reply does not decode/u) })
    garbled = false
    expect((await r.resolve(absent.args.name)).status).toBe('Absent')
  })
  it('checks the deployment again on the next read after a check that failed, and never after one passed', async () => {
    let fail = true
    const h = host({ reply: (fn, _, g) => (fn === 'binding' && fail ? new Response('busy', { status: 500 }) : g) }),
      r = await reader(h)
    expect(await outcome(r.resolve(absent.args.name))).toEqual({ reason: 'read', message: expect.stringMatching(/^Lens binding query failed/u) })
    fail = false
    for (let i = 0; i < 3; i++) expect((await r.resolve(absent.args.name)).status).toBe('Absent')
    expect(queries(h.log).filter((q) => q !== 'resolve')).toEqual(['binding', 'lens_interface', 'binding', 'lens_interface'])
  })
  it('throws for arguments the full client refuses, before any request', async () => {
    const h = host(),
      r = await reader(h)
    for (const read of [
      () => r.resolve('Not A Name'),
      () => r.resolve(owned.args.name, ['website', 'website']),
      () => r.resolve(owned.args.name, Array.from({ length: 17 }, (_, i) => `k${i}`)),
      () => r.resolveMoonlightAccount('dusk'),
      () => r.verifyPrimary(verified.args.endpoint.slice(1)),
    ]) {
      const error = await read().catch((e: unknown) => e)
      expect(error).toBeInstanceOf(Error)
      expect(error).not.toBeInstanceOf(LensReaderError)
    }
    expect(h.log).toEqual([`GET ${DRIVER}`])
  })
})

describe('rate limits, timeouts and options', () => {
  const limited = (wait: string) => new Response('Too many requests', { status: 429, headers: { 'retry-after': wait } })
  const resolves = (log: string[]) => queries(log).filter((q) => q === 'resolve').length
  it("sends a rate-limited query again after the node's wait, three times a read, then throws its 429", async () => {
    let limits = 2
    const h = host({ reply: (fn, _, g) => (fn === 'resolve' && limits-- > 0 ? limited('0') : g) }),
      r = await reader(h)
    expect((await r.resolve(absent.args.name)).status).toBe('Absent')
    expect(resolves(h.log)).toBe(3)
    limits = Infinity
    const error = await r.resolve(absent.args.name).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(LensReaderError)
    expect(error).toMatchObject({ reason: 'read', cause: { name: 'NodeReadError', status: 429, retryAfterMs: 0 } })
    expect(resolves(h.log)).toBe(3 + 4)
  })
  it('shares a read\'s three retries with the deployment check it starts', async () => {
    const h = host({ reply: () => limited('0') }),
      error = await (await reader(h)).resolve(absent.args.name).catch((e: unknown) => e)
    expect(error).toMatchObject({ reason: 'read', cause: { status: 429 } })
    // The query and the check's two reads, then at most three retries among them: a failed check stops the rest.
    expect(queries(h.log).length).toBeGreaterThan(3)
    expect(queries(h.log).length).toBeLessThanOrEqual(3 + 3)
  })
  it('never waits for a retry over 10 s', async () => {
    const h = host({ reply: (fn, _, g) => (fn === 'resolve' ? limited('11') : g) }),
      r = await reader(h),
      started = Date.now()
    expect(await outcome(r.resolve(absent.args.name))).toMatchObject({ reason: 'read' })
    expect(Date.now() - started).toBeLessThan(5_000)
    expect(resolves(h.log)).toBe(1)
  })
  it('gives up at timeoutMs and aborts what is in flight, and so does its creation', async () => {
    const signals: AbortSignal[] = []
    const stall = (signal?: AbortSignal | null) =>
      new Promise<never>((_, reject) => {
        signals.push(signal!)
        signal!.addEventListener('abort', () => reject(signal!.reason))
      })
    // Long enough for its creation, which loads the driver, under any test load.
    const h = host({ reply: (fn, _, g, signal) => (fn === 'resolve' ? stall(signal) : g) }),
      r = await reader(h, pinned(), { timeoutMs: 1_000 })
    expect(await outcome(r.resolve(absent.args.name))).toEqual({ reason: 'timeout', message: 'The lens reader took over 1000 ms' })
    expect(signals.map((s) => s.aborted)).toEqual([true])
    const stuck = ((_: unknown, init?: RequestInit) => stall(init?.signal)) as typeof fetch
    expect(await outcome(createLensReader(pinned(), { nodeUrl: NODE, artifactBaseUrl: ARTIFACTS, fetch: stuck, timeoutMs: 50 }))).toEqual({
      reason: 'timeout', message: 'The lens reader took over 50 ms',
    })
  })
  it("takes the artifact base from the release when the options leave it out, and checks its options", async () => {
    const h = host()
    const r = await createLensReader({ ...pinned(), artifactBaseUrl: ARTIFACTS, site: 'https://site.invalid' }, { nodeUrl: `${NODE}/`, fetch: h.fetch })
    expect((await r.resolve(absent.args.name)).status).toBe('Absent')
    expect(h.log.filter((l) => !l.startsWith(LENS))).toEqual([`GET ${DRIVER}`])
    await expect(createLensReader(pinned(), { nodeUrl: NODE, fetch: h.fetch })).rejects.toThrow('artifactBaseUrl')
    await expect(createLensReader(pinned(), { nodeUrl: NODE, artifactBaseUrl: ARTIFACTS, timeoutMs: 0 })).rejects.toThrow(RangeError)
    // Past the longest a timer waits, it would fire at once.
    await expect(createLensReader(pinned(), { nodeUrl: NODE, artifactBaseUrl: ARTIFACTS, timeoutMs: 2 ** 31 })).rejects.toThrow(RangeError)
    await expect(createLensReader(pinned(), { nodeUrl: 'ftp://node.invalid' })).rejects.toThrow('HTTP(S) URL')
    await expect(createLensReader(pinned(), {} as never)).rejects.toThrow('nodeUrl')
    await expect(createLensReader('https://release.invalid/manifest.json', { nodeUrl: NODE })).rejects.toThrow('Expected an object')
  })
})

it('loads none of the full client, writes, marketplace, indexer or Connect code', () => {
  const root = fileURLToPath(new URL('../src/', import.meta.url)),
    seen = new Set<string>()
  // Every import and re-export a module runs: `import type` and `export type` load nothing.
  const visit = (file: string) => {
    if (seen.has(file)) return
    seen.add(file)
    for (const [, type, from] of readFileSync(file, 'utf8').matchAll(/^\s*(?:import|export)\s+(type\s)?[^'"]*?from\s+'(\.[^']+)'/gmu))
      if (!type) visit(resolve(dirname(file), from))
  }
  visit(resolve(root, 'lens-reader.ts'))
  const graph = [...seen].map((file) => relative(root, file))
  expect(graph).toEqual(expect.arrayContaining(['frozen/lens-reader.ts', 'frozen/lens.ts', 'frozen/manifest.ts', 'frozen/transport.ts']))
  for (const file of graph)
    expect(file).not.toMatch(/^(?:index|writes|marketplace|indexer|projection|connect)|^(?:writes|indexer|wallet)\/|^frozen\/(?:client|actions|builders|calls|gas|wallet-gas|journal|projection)/u)
})
