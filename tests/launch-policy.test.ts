/**
 * The launch policy (tests/fixtures/README.md): its contract, whose code hash this SDK prices, and its
 * data driver, which has the v1 policy's five functions and `start_release` and `release`. The SDK loads
 * it as the policy role, and it reads and writes every golden archive of the five as the v1 driver does.
 * These fixtures prove the artifacts and the codec, not the policy: its own behaviour (the one-shot
 * operator start, the opening boundaries, the halving release premium, 3+ quotes identical to v1) is
 * proven by the protocol repository's VM tests at the release commit (d42877d2).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { sha256 } from '@noble/hashes/sha2.js'
import { blake3 } from '@noble/hashes/blake3.js'
import type { DataDriver } from '../src/frozen/driver.ts'
import { fetchDriver } from '../src/frozen/manifest.ts'
import { methodCatalog } from '../src/frozen/catalog.ts'
import { indexerEventCatalog } from '../src/indexer/events/indexerEventCatalog.ts'
import { LAUNCH_POLICY_CODE_HASH, PRICED_POLICIES } from '../src/frozen/lens.ts'
import { fromHex, hex } from '../src/frozen/bytes.ts'
import { stringifyJson } from '../src/frozen/json.ts'
import { wireValue } from '../src/frozen/wire.ts'
import { fixtures, type Golden } from './helpers.ts'

const fixture = (name: string) => new Uint8Array(gunzipSync(readFileSync(new URL(`fixtures/${name}`, import.meta.url))))
const contract = fixture('launch-policy.wasm.gz'),
  wasm = fixture('launch-policy-driver.wasm.gz')
/** The driver as the launch release pins it. */
const pinned = { sha256: '4d4d3d4e01e52beb46dbf721c573c471fdbdad0fddd16765483528c31ebbcf61', bytes: 1_624_064 }
let loaded: Promise<DataDriver> | undefined
/** The driver as a client loads a release's policy driver: digests checked, then its schema against the role. */
const driver = () =>
  (loaded ??= fetchDriver(
    { role: 'policy', contractId: '03'.repeat(32), codeHash: LAUNCH_POLICY_CODE_HASH, dataDriver: { path: 'policy.wasm', ...pinned } },
    'https://release.invalid/',
    (async () => new Response(wasm)) as unknown as typeof fetch,
  ))

it('is the contract whose code hash this SDK prices, with the driver the launch release pins', () => {
  expect(hex(blake3(contract))).toBe(LAUNCH_POLICY_CODE_HASH)
  expect(PRICED_POLICIES.has(LAUNCH_POLICY_CODE_HASH)).toBe(true)
  expect({ sha256: hex(sha256(wasm)), bytes: wasm.length }).toEqual(pinned)
})

it('loads as the policy role at driver version 1.0.0: the five functions this SDK reads, and two it does not', async () => {
  const d = await driver()
  expect(d.version()).toBe('1.0.0')
  const functions = (d.schema() as { functions: Record<string, unknown>[] }).functions.map(({ name, input, output }) => ({ name, input, output }))
  expect(functions).toEqual([
    ...methodCatalog.policy.map(({ name, input, output }) => ({ name, input, output })),
    { name: 'start_release', input: 'u8', output: 'Height' },
    { name: 'release', input: '()', output: '[Option<Height>; 2]' },
  ])
})

describe('every golden archive of the five, as the v1 driver reads and writes it', () => {
  const events = Object.entries(indexerEventCatalog).filter(([, e]) => e.role === 'policy' || e.role === '*')
  const cases = ['frozen-v1', 'frozen-v1-max'].flatMap((suite) =>
    Object.entries(fixtures(suite)).flatMap(([key, row]): [string, 'input' | 'output' | 'event', string, Golden][] => [
      ...methodCatalog.policy.flatMap((m) => [
        ...(row.type === m.input ? [[`${suite} / ${m.name} input / ${key}`, 'input', m.name, row] as [string, 'input', string, Golden]] : []),
        ...(row.type === m.output ? [[`${suite} / ${m.name} output / ${key}`, 'output', m.name, row] as [string, 'output', string, Golden]] : []),
      ]),
      ...events.filter(([, e]) => e.type === row.type).map(([topic]) => [`${suite} / ${topic} event / ${key}`, 'event', topic, row] as [string, 'event', string, Golden]),
    ]),
  )
  it('covers the init and quote requests, the config, the quote and the policy\'s event', () => {
    const covered = new Set(cases.map(([, kind, fn]) => `${fn} ${kind}`))
    for (const c of ['init input', 'quote input', 'config output', 'quote output', 'interface_version output', 'binding output', 'policy_initialized event'])
      expect(covered, c).toContain(c)
  })
  it.each(cases)('%s', async (_, kind, fn, row) => {
    const d = await driver(),
      bytes = Uint8Array.from(fromHex(row.rkyv)),
      value = wireValue(row.type, row.json)
    if (kind === 'input') {
      expect(hex(d.encodeInput(fn, stringifyJson(value)))).toBe(row.rkyv)
      expect(wireValue(row.type, d.decodeInput(fn, bytes))).toEqual(value)
    } else expect(wireValue(row.type, kind === 'output' ? d.decodeOutput(fn, bytes) : d.decodeEvent(fn, bytes))).toEqual(value)
  })
})
