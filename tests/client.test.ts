import { it, expect } from 'vitest'
import { FrozenClient } from '../src/frozen/client.ts'
import { createHttpTransport } from '../src/frozen/transport.ts'
import { parseJson, stringifyJson } from '../src/frozen/json.ts'
import { wireValue } from '../src/frozen/wire.ts'
import { bytes, id, sample, release } from './helpers.ts'
import type { DataDriver } from '../src/frozen/driver.ts'
import type { ReadTransport } from '../src/frozen/transport.ts'
import type { LoadedRelease, ContractRole } from '../src/frozen/manifest.ts'
import type { NameView, Admission, Forward } from '../src/frozen/types.ts'
import { nameKey, hex } from '../src/frozen/bytes.ts'
const encode = (v: unknown) => new TextEncoder().encode(stringifyJson(v))
const decode = (v: Uint8Array) => parseJson(new TextDecoder().decode(v))
const jsonDriver: DataDriver = {
  encodeInput: (_, json) => new TextEncoder().encode(json),
  decodeInput: (_, b) => decode(b),
  decodeOutput: (_, b) => decode(b),
  decodeEvent: (_, b) => decode(b),
  version: () => '1.0.0',
  schema: () => ({}),
}
async function setup(
  options: {
    hopLimit?: number
    errorDestination?: boolean
    nonMonotone?: boolean
    height?: () => Promise<bigint>
  } = {},
) {
  const original = await release(),
    r: LoadedRelease = {
      ...original,
      manifest: structuredClone(original.manifest),
      contracts: new Map(original.contracts),
      drivers: new Map(),
    }
  for (const [i, ordinal] of [
    [8, 1],
    [9, 2],
  ])
    r.contracts.set(id(i), {
      ...r.contracts.get(id(4))!,
      contractId: id(i),
      ordinal,
    })
  for (const c of r.contracts.values()) r.drivers.set(c.contractId, jsonDriver)
  const admissions = [4, 8, 9].map((i, ordinal) => ({
    ...sample('Admission'),
    id: bytes(i),
    ordinal,
    interface_version: 1,
    admitted_at: 1n,
  }))
  const resolver = {
    ...sample('Admission'),
    id: bytes(5),
    ordinal: 0,
    interface_version: 1,
  }
  const key = nameKey('child.example.dusk'),
    n = sample('NameView')
  n.name.key = key
  n.name.expires_at = 1000n
  n.name.incarnation = { generation: 7n, serial: 2n }
  const calls: { id: string; fn: string; args: unknown }[] = []
  let heights = 0
  const responses = new Map<string, unknown>()
  const forward = (to: number, ordinal: number): Forward => ({
    root: key.root,
    destination: bytes(to),
    destination_ordinal: ordinal,
    move_id: bytes(10),
    generation: 7n,
    completed_at: 100n,
  })
  const transport: ReadTransport = {
    currentBlockHeight: async () => {
      heights++
      return options.height ? options.height() : 100n
    },
    read: async (target, fn, data) => {
      const args = decode(data)
      calls.push({ id: target, fn, args })
      if (options.errorDestination && target === id(9))
        throw new Error('unavailable destination')
      if (responses.has(`${target}:${fn}`))
        return encode(responses.get(`${target}:${fn}`))
      const role = r.contracts.get(target)!.role
      if (fn === 'interface_version')
        return encode({
          kind: role[0].toUpperCase() + role.slice(1),
          version: 1,
          move_version: role === 'store' ? 1 : 0,
          custody_version: role === 'store' || role === 'marketplace' ? 1 : 0,
        })
      if (fn === 'binding')
        return encode({ directory: bytes(1), vault: bytes(2), network: 1 })
      if (fn === 'order_api_version') return encode(1)
      if (fn === 'config' && role === 'directory')
        return encode({
          ...sample('DirectoryConfig'),
          binding: { directory: bytes(1), vault: bytes(2), network: 1 },
          store_count: 3,
          resolver_count: 1,
          registration: { ...sample('RegistrationContext'), policy: bytes(3) },
          preferred_marketplace: null,
        })
      if (fn === 'members')
        return encode({
          rows: (args as any).kind === 'Store' ? admissions : [resolver],
          next: null,
        })
      if (fn === 'home')
        return encode(
          target === id(4)
            ? { Forwarded: forward(options.nonMonotone ? 4 : 8, 1) }
            : target === id(8)
              ? { Forwarded: forward(9, 2) }
              : 'Local',
        )
      if (fn === 'get_name') return encode({ Local: n })
      if (fn === 'quote_renewal')
        return encode({
          Local: {
            schedule_version: 9007199254740993n,
            total_lux: '123',
            referral_lux: '12',
            new_expiry: 1000n,
            new_grace_end: 2000n,
          },
        })
      if (fn === 'read_primary') return encode(null)
      if (fn === 'pending_commitment') return encode(null)
      throw new Error(`${target}.${fn}`)
    },
  }
  const client = new FrozenClient(r, { transport, hopLimit: options.hopLimit })
  return {
    client,
    calls,
    responses,
    key,
    n,
    r,
    transport,
    heights: () => heights,
    admissions,
  }
}
it('canonical reads acquire block heights and follow monotone forwarding across shards', async () => {
  const t = await setup()
  await t.client.discover()
  t.calls.length = 0
  const result = await t.client.getName('child.example.dusk', id(4))
  expect(result.store).toBe(id(9))
  expect(result.forwards).toHaveLength(2)
  expect(result.height).toBe(100n)
  expect(t.calls.filter((c) => c.fn === 'get_name').map((c) => c.id)).toEqual([
    id(9),
  ])
  const renewal = await t.client.quoteRenewal(id(4), {
    name: { key: t.key, incarnation: t.n.name.incarnation },
    years: 1,
  })
  expect(renewal.store).toBe(id(9))
  expect(renewal.value).toMatchObject({
    Local: { schedule_version: 9007199254740993n, total_lux: '123' },
  })
  expect(t.heights()).toBeGreaterThanOrEqual(6)
})
it('every Located ABI read follows, including absent and unknown descendants', async () => {
  const t = await setup()
  await t.client.discover()
  for (const [method, args, value] of [
    [
      'children',
      { parent: t.key, after: null, limit: 16 },
      { Local: { rows: [], next: null } },
    ],
    ['record_slot', t.key, { Local: null }],
    ['read_record', { key: t.key, record_key: 'x' }, 'Absent'],
    ['read_records', t.key, { Local: { pointer: null, records: [] } }],
    ['resolve_record', { key: t.key, record_key: 'x' }, { Local: null }],
    [
      'move_cooldowns',
      { root: t.key.root, initiator: bytes(1) },
      { Local: { root_cancelled_at: 123n, initiator_cancelled_at: null } },
    ],
  ] as const) {
    t.responses.set(`${id(9)}:${method}`, value)
    const result = await (t.client.store(id(4)) as any)[method](args)
    expect(result).toEqual(value)
  }
  t.responses.set(`${id(9)}:get_name`, 'Absent')
  expect((await t.client.getName('child.example.dusk', id(4))).value).toBe(
    'Absent',
  )
})
it('commitments remain on the original shard and do not follow a name move', async () => {
  const t = await setup()
  await t.client.discover()
  t.calls.length = 0
  await t.client
    .store(id(4))
    .pending_commitment({ actor: bytes(2), hash: bytes(3) })
  expect(t.calls.map((c) => c.fn)).toEqual(['pending_commitment'])
  expect(t.calls[0].id).toBe(id(4))
})
it('rejects hop exhaustion, cycles and unavailable destinations without fallback', async () => {
  for (const options of [
    { hopLimit: 1 },
    { nonMonotone: true },
    { errorDestination: true },
  ]) {
    const t = await setup(options)
    await expect(
      t.client.getName('child.example.dusk', id(4)),
    ).rejects.toThrow()
    expect(
      t.calls.filter((c) => c.fn === 'get_name' && c.id === id(4)),
    ).toHaveLength(0)
  }
})
it('rejects wrong interface, binding and directory admission versions', async () => {
  for (const [method, value] of [
    [
      'interface_version',
      { kind: 'Store', version: 2, move_version: 1, custody_version: 1 },
    ],
    ['binding', { directory: bytes(11), vault: bytes(2), network: 1 }],
  ] as const) {
    const t = await setup()
    t.responses.set(`${id(4)}:${method}`, value)
    await expect(t.client.discover()).rejects.toThrow()
  }
  const t = await setup()
  t.admissions[0].interface_version = 2
  await expect(t.client.discover()).rejects.toThrow('version')
})
it('propagates missing height and retries reads at a stable height', async () => {
  const t = await setup({
    height: async () => {
      throw new Error('height offline')
    },
  })
  await expect(t.client.getName('child.example.dusk', id(4))).rejects.toThrow(
    'height offline',
  )
  let h = 0
  const stable = await setup({ height: async () => BigInt(++h < 3 ? h : 3) })
  expect(
    (await stable.client.getName('child.example.dusk', id(4))).height,
  ).toBe(3n)
})
it('HTTP transport reads latest height losslessly and rejects missing GraphQL data', async () => {
  const urls: string[] = []
  const t = createHttpTransport(
    'https://node.invalid/',
    async (input, init) => {
      urls.push(String(input))
      expect(init?.method).toBe('POST')
      return new Response('{"block":{"header":{"height":9007199254740993}}}')
    },
  )
  expect(await t.currentBlockHeight()).toBe(9007199254740993n)
  expect(urls[0]).toBe('https://node.invalid/on/graphql/query')
  await expect(
    createHttpTransport(
      'https://node.invalid',
      async () => new Response('{}'),
    ).currentBlockHeight(),
  ).rejects.toThrow()
})
it('primary verification requires matching incarnation, active lifecycle and forward endpoint; resolver errors propagate', async () => {
  const t = await setup()
  await t.client.discover()
  const endpoint = bytes(12, 96),
    primary = {
      primary: {
        endpoint,
        name: { key: t.key, incarnation: t.n.name.incarnation },
        mapping_id: 22n,
        updated_at: 90n,
      },
      spelling: 'child.example.dusk',
    }
  t.responses.set(`${id(9)}:read_primary`, primary)
  t.responses.set(`${id(9)}:resolve_record`, {
    Local: {
      key: 'moonlight_address',
      value: endpoint,
      ttl_seconds: 3600n,
      updated_at: 90n,
    },
  })
  expect((await t.client.verifyPrimary(endpoint))?.store).toBe(id(9))
  t.responses.set(`${id(9)}:resolve_record`, { Local: null })
  expect(await t.client.verifyPrimary(endpoint)).toBeNull()
  t.responses.delete(`${id(9)}:resolve_record`)
  await expect(t.client.verifyPrimary(endpoint)).rejects.toThrow(
    'resolve_record',
  )
  t.n.name.expires_at = 100n
  expect(await t.client.verifyPrimary(endpoint)).toBeNull()
})
