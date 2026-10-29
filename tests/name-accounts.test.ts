/**
 * `resolveAccounts` (`./accounts`), through a light reader of the simulated lens world: what a name
 * points to, as the wallets, the explorer and the bridge send to it, on the cases of the apps' own
 * checks (web wallet resolveDuskName, extension duskNames, explorer and bridge name lookups).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fetchDriver } from '../src/frozen/manifest.ts'
import { createLensReader, decodeBase58, encodeBase58 } from '../src/lens-reader.ts'
import { resolveAccounts } from '../src/accounts.ts'
import { accountsOf } from '../src/core/accounts.ts'
import { hasClaimableReferrerShape, isMoonlightEndpoint } from '../src/core/principal.ts'
import { hex } from '../src/frozen/bytes.ts'
import type { RecordValue } from '../src/frozen/types.ts'
import { jsonDriver } from './helpers.ts'
import { child, lensWorld, pointer, root, view, type LensWorld } from './lens-world.ts'

vi.mock('../src/frozen/manifest.ts', async (actual) => ({ ...(await actual<object>()), fetchDriver: vi.fn() }))
beforeEach(() => void vi.mocked(fetchDriver).mockResolvedValue(jsonDriver))

// A testnet account that registered names (a valid key), and a shielded address, as wallets show them.
const ACCOUNT: string = JSON.parse(readFileSync(new URL('fixtures/testnet-registrations.json', import.meta.url), 'utf8')).registrations[0].sender
const ADDRESS = '47jNTgAhzn9KCKF3msCfvKg3k1P1QpPCLZ3HG3AoNp87sQ5WNS3QyjckYHWeuXqW7uvLmbKgejpP8Xkcip89vnMM'
const key = Array.from(decodeBase58(ACCOUNT)!)
const utf8 = (text: string) => Array.from(new TextEncoder().encode(text))
const record = (k: string, value: number[]): RecordValue => ({ key: k, value, ttl_seconds: 300n, updated_at: 1n })
const moonlight = (value: number[]) => record('moonlight_address', value)
const phoenix = (value: string | number[]) => record('phoenix_payment_endpoint', typeof value === 'string' ? utf8(value) : value)

/** A light reader of the world, and child.example.dusk holding `records`. */
async function named(...records: RecordValue[]) {
  const w = await lensWorld(1)
  w.chain.records.set(`${w.newest}:${hex(child.node)}`, { pointer, records })
  const reader = await createLensReader(
    { chainId: 'dusk:1', network: 1, contracts: [...w.release.contracts.values()], lens: w.release.manifest.lens },
    {
      nodeUrl: 'https://node.invalid',
      artifactBaseUrl: 'https://release.invalid/',
      fetch: (async (input: string, init: RequestInit) => {
        const [, target, fn] = /contracts:([\da-f]{64})\/(\w+)$/u.exec(input)!
        return w.transport.read(target, fn, init.body as Uint8Array).then((b) => new Response(b))
      }) as unknown as typeof fetch,
    },
  )
  return { w, reader, read: () => resolveAccounts(reader, 'child.example.dusk') }
}
const resolves = (w: LensWorld) => w.log.filter((call) => call.endsWith('.resolve')).length

describe('resolveAccounts', () => {
  it("points an active name to the public account and the shielded address in its records, in one lens query", async () => {
    const { w, read } = await named(phoenix(ADDRESS), record('avatar', [1]), moonlight(key))
    expect(await read()).toEqual({ status: 'Active', height: 100n, account: ACCOUNT, address: ADDRESS })
    expect(resolves(w)).toBe(1)
  })

  it.each([
    ['a key with its last bit changed, the right shape off the curve', [...key.slice(0, 95), key[95] ^ 1]],
    ["a shielded address's 64 bytes", Array.from(decodeBase58(ADDRESS)!)],
    ['96 bytes without a compressed key flag', Array(96).fill(0)],
    ['the identity', [0xc0, ...Array(95).fill(0)]],
    ['a coordinate outside the field', [0x9f, ...Array(95).fill(0xff)]],
    ['a byte short', key.slice(1)],
    ["the account's text rather than its key", utf8(ACCOUNT)],
  ])('leaves out a public account record holding %s', async (_, value) => {
    const { read } = await named(moonlight(value), phoenix(ADDRESS))
    expect(await read()).toEqual({ status: 'Active', height: 100n, address: ADDRESS })
  })

  it("checks the key on the curve, as the protocol checks a key, where a shape check takes it", () => {
    const shaped = [...key.slice(0, 95), key[95] ^ 1]
    expect(hasClaimableReferrerShape({ kind: 'Moonlight', bytes: shaped })).toBe(true)
    expect([isMoonlightEndpoint(key), isMoonlightEndpoint(shaped)]).toEqual([true, false])
  })

  it.each([
    ['a public account', ACCOUNT],
    ['text that is no Base58', '0OIl'],
    ['a shortened address', ADDRESS.slice(0, -4)],
    ['an address with a space before it', ` ${ADDRESS}`],
    ['an address with a line break after it', `${ADDRESS}\n`],
    ['an address after a byte order mark', `﻿${ADDRESS}`],
    ['an address and a byte that is no UTF-8', [...utf8(ADDRESS), 0xff]],
    ["the address's 64 bytes rather than its text", Array.from(decodeBase58(ADDRESS)!)],
  ])('leaves out a shielded address record holding %s', async (_, value) => {
    const { read } = await named(moonlight(key), phoenix(value))
    expect(await read()).toEqual({ status: 'Active', height: 100n, account: ACCOUNT })
  })

  it('points a name without either record, or with neither valid, nowhere', async () => {
    expect(await (await named(record('website', utf8('https://example.org')))).read()).toEqual({ status: 'Active', height: 100n })
    expect(await (await named(moonlight(key.slice(1)), phoenix('not an address'))).read()).toEqual({ status: 'Active', height: 100n })
  })

  it('points a name that is not active nowhere: absent, expired, in grace or released', async () => {
    const { w, reader } = await named(moonlight(key), phoenix(ADDRESS))
    expect(await resolveAccounts(reader, 'absent.dusk')).toEqual({ status: 'Absent', height: 100n })
    const at = `${w.newest}:${hex(child.node)}`
    w.chain.names.set(at, { ...w.chain.names.get(at)!, active: false })
    expect(await resolveAccounts(reader, 'child.example.dusk')).toEqual({ status: 'Expired', height: 100n })
    const rootAt = `${w.newest}:${hex(root.node)}`
    w.chain.records.set(rootAt, { pointer, records: [moonlight(key)] })
    w.chain.names.set(rootAt, { ...view(root, { label: 'example', records: pointer }), active: false, renewable: true })
    expect(await resolveAccounts(reader, 'example.dusk')).toEqual({ status: 'Grace', height: 100n })
    w.chain.names.set(rootAt, { ...view(root, { label: 'example', records: pointer }), active: false, renewable: false })
    expect(await resolveAccounts(reader, 'example.dusk')).toEqual({ status: 'Released', height: 100n })
  })

  it('points a name nowhere unless it is active, whatever records a reply holds', async () => {
    const { reader } = await named(moonlight(key), phoenix(ADDRESS))
    const resolved = await reader.resolve('child.example.dusk', ['moonlight_address', 'phoenix_payment_endpoint'])
    expect(accountsOf(resolved)).toEqual({ status: 'Active', height: 100n, account: ACCOUNT, address: ADDRESS })
    for (const status of ['Grace', 'Expired', 'Released', 'Absent'] as const) expect(accountsOf({ ...resolved, status })).toEqual({ status, height: 100n })
  })

  it("rejects with the reader's error", async () => {
    const failure = new Error('Lens resolve query failed')
    await expect(resolveAccounts({ resolve: () => Promise.reject(failure) }, 'alice.dusk')).rejects.toBe(failure)
    expect(encodeBase58(key)).toBe(ACCOUNT)
  })
})
