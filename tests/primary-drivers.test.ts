import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { expect, it } from 'vitest'
import { FrozenClient } from '../src/frozen/client.ts'
import { fromHex } from '../src/frozen/bytes.ts'
import { parseJson, stringifyJson, u64 } from '../src/frozen/json.ts'
import { wireValue } from '../src/frozen/wire.ts'
import { primaryNameStatus } from '../src/core/primary.ts'
import { createDuskDomainsIndexerClient } from '../src/indexer/client.ts'
import {
  createProjectionState,
  nameStateKey,
  primaryStateKey,
  projectedPrimary,
  slotStateKey,
} from '../src/frozen/projection.ts'
import { bytes, id, release } from './helpers.ts'

interface Reply {
  json: unknown
  rkyv: string
}
interface Scenario {
  height: bigint
  get_name: Reply
  resolve_primary: Reply
  resolve_record: Reply
}
const fixtures = parseJson(
  gunzipSync(readFileSync(
    new URL('fixtures/primary-verification.json.gz', import.meta.url),
  )).toString(),
) as Record<string, Reply> & { cases: Record<string, Scenario> }
for (const scenario of Object.values(fixtures.cases))
  scenario.height = u64(scenario.height)
const endpoint = bytes(12, 96)

async function setup(initial = 'holder', twoStores = false) {
  const original = await release()
  const r = {
    ...original,
    contracts: new Map(original.contracts),
    drivers: new Map(original.drivers),
  }
  if (twoStores) {
    r.contracts.set(id(8), {
      ...r.contracts.get(id(4))!, contractId: id(8), ordinal: 1,
    })
    r.drivers.set(id(8), r.drivers.get(id(4))!)
  }
  let scenario = fixtures.cases[initial]
  const calls: string[] = []
  const overrides = new Map<string, Reply | Error>()
  // Both input encoding/decoding and output decoding use the pinned real WASM
  // drivers. Only transport is simulated, with Rust-generated rkyv replies.
  const client = new FrozenClient(r, {
    transport: {
      currentBlockHeight: async () => scenario.height,
      read: async (target, method, input) => {
        const args = r.drivers.get(target)!.decodeInput(method, input)
        calls.push(`${target}:${method}`)
        if (method === 'read_primary' || method === 'resolve_primary')
          expect(args).toEqual({ endpoint })
        const override = overrides.get(`${target}:${method}`)
        if (override instanceof Error) throw override
        let reply = override
        if (!reply) {
          if (method === 'members')
            reply = fixtures[twoStores ? 'members_two' : 'members']
          else if (method === 'get_name' || method === 'resolve_primary' || method === 'resolve_record')
            reply = scenario[method]
          else reply = fixtures[method]
        }
        if (!reply) throw new Error(`Unexpected ${target}.${method}`)
        return Uint8Array.from(fromHex(reply.rkyv))
      },
    },
  })
  return {
    client, calls, overrides,
    select: (name: string) => {
      scenario = fixtures.cases[name]
    },
  }
}

it.each([
  ['holder', 'verified'],
  ['escrow', 'unauthorized'],
  ['transfer with identity kept', 'unauthorized'],
  ['manager-only', 'verified'],
  ['owner-only', 'verified'],
  ['before expiry', 'verified'],
  ['expiry', 'inactive'],
  ['grace', 'inactive'],
  ['re-registration', 'stale'],
  ['transfer back', 'verified'],
] as const)('agrees with protocol primary authority after %s through real drivers', async (change, status) => {
  const t = await setup(change)
  const scenario = fixtures.cases[change]
  const resolved = await t.client.store(id(4)).resolve_primary({ endpoint })
  const verified = await t.client.verifyPrimary(endpoint)
  const expected = status === 'verified'
  expect(resolved !== null).toBe(expected)
  const expectedForward = wireValue(
    'Located<Option<RecordValue>>', fixtures.read_record.json,
  )
  if (typeof expectedForward !== 'object' || !('Local' in expectedForward))
    throw new Error('Expected local forward record fixture')
  expect(verified).toEqual(expected
    ? { store: id(4), primary: resolved, record: expectedForward.Local, height: scenario.height }
    : null)
  expect(t.calls.some((c) => c.endsWith(':resolve_primary'))).toBe(true)
  expect(t.calls.some((c) => c.endsWith(':read_primary'))).toBe(false)

  const raw = await t.client.store(id(4)).read_primary({ endpoint })
  expect(raw).toEqual(
    wireValue('Option<PrimaryView>', fixtures.read_primary.json),
  )
  expect(raw!.primary.mapping_id).toBe(42n)
  const located = await t.client.store(id(4)).get_name(raw!.primary.name.key)
  const forward = await t.client.store(id(4)).read_record({
    key: raw!.primary.name.key, record_key: 'moonlight_address',
  })
  if (
    typeof located !== 'object' || !('Local' in located) ||
    typeof forward !== 'object' || !('Local' in forward)
  )
    throw new Error('Expected local name and forward record')
  // The address and raw mapping deliberately survive every authority change.
  expect(forward.Local!.value).toEqual(endpoint)
  const observation = {
    endpoint, primary: raw, name: located.Local,
    record: forward.Local, height: scenario.height,
  }
  expect(primaryNameStatus(observation)).toEqual({ status, verified: expected })

  const state = createProjectionState({
    directoryId: id(1),
    contracts: { [id(1)]: 'directory', [id(4)]: 'store', [id(5)]: 'resolver' },
  })
  const name = located.Local.name
  state.names[nameStateKey(id(4), name.key)] = name
  state.primaries[primaryStateKey(id(4), endpoint)] = raw!.primary
  const slot = { registry: bytes(4), node: name.key.node, epoch: name.records!.epoch }
  state.slots[slotStateKey(id(5), slot)] = {
    records: [forward.Local!], count: 1, digest: name.records!.digest,
  }
  expect(projectedPrimary(state, endpoint, scenario.height)?.primary ?? null)
    .toEqual(resolved?.primary ?? null)

  const indexer = createDuskDomainsIndexerClient({
    baseUrl: 'https://indexer.invalid', chainId: 'dusk:1', directory: id(1),
    fetch: async () => new Response(stringifyJson({
      apiVersion: 1, chainId: 'dusk:1', directory: id(1),
      snapshot: { height: scenario.height, blockHash: 'head' },
      data: { store: id(4), endpoint, value: raw },
    })),
  })
  const indexed = await indexer.getRawPrimary(id(4), endpoint)
  expect(indexed.data.value).toEqual(raw)
  expect(await indexer.getPrimary(id(4), endpoint)).toEqual(indexed)
  expect(primaryNameStatus({
    ...observation, primary: indexed.data.value, height: indexed.snapshot.height,
  })).toEqual({ status, verified: expected })
})

it.each(['escrow', 'transfer with identity kept'])('restores the same mapping after %s and transfer back', async (change) => {
  const t = await setup()
  const before = await t.client.verifyPrimary(endpoint)
  expect(before).not.toBeNull()
  t.select(change)
  expect(await t.client.verifyPrimary(endpoint)).toBeNull()
  expect(await t.client.store(id(4)).read_primary({ endpoint })).toEqual(before!.primary)
  t.select('transfer back')
  expect(await t.client.verifyPrimary(endpoint)).toEqual({ ...before, height: 150n })
})

it.each(['resolve_primary', 'resolve_record'])('propagates %s failures instead of treating them as absence', async (method) => {
  const t = await setup()
  t.overrides.set(`${id(4)}:${method}`, new Error(`${method} unavailable`))
  await expect(t.client.verifyPrimary(endpoint)).rejects.toThrow(`${method} unavailable`)
})

it('retains forward-record verification even when resolve_primary returns a candidate', async () => {
  const t = await setup()
  t.overrides.set(`${id(4)}:resolve_record`, fixtures.no_record)
  expect(await t.client.verifyPrimary(endpoint)).toBeNull()
})

it.each(['expiry', 're-registration', 'escrow'])('independently rejects an inconsistent resolution after %s', async (change) => {
  const t = await setup(change)
  t.overrides.set(`${id(4)}:resolve_primary`, fixtures.read_primary)
  expect(await t.client.verifyPrimary(endpoint)).toBeNull()
})

it('retains cross-store uniqueness checks', async () => {
  const t = await setup('holder', true)
  await expect(t.client.verifyPrimary(endpoint)).rejects.toThrow('Multiple verified pool primaries')
})

it('rejects a resolved mapping on a store that is no longer the current home', async () => {
  const t = await setup('holder', true)
  t.overrides.set(`${id(4)}:home`, fixtures.forwarded_home)
  t.overrides.set(`${id(8)}:resolve_primary`, fixtures.no_primary)
  expect(await t.client.verifyPrimary(endpoint)).toBeNull()
})
