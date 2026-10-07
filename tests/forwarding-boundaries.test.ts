import { expect, it } from 'vitest'
import { FrozenClient } from '../src/frozen/client.ts'
import { parseJson, stringifyJson } from '../src/frozen/json.ts'
import { nameKey, hex } from '../src/frozen/bytes.ts'
import { id, bytes, sample, release } from './helpers.ts'
import type { DataDriver } from '../src/frozen/driver.ts'
const enc = (v: unknown) => new TextEncoder().encode(stringifyJson(v))
const dec = (v: Uint8Array) => parseJson(new TextDecoder().decode(v))
const driver: DataDriver = {
  encodeInput: (_, text) => new TextEncoder().encode(text),
  decodeInput: (_, b) => dec(b),
  decodeOutput: (_, b) => dec(b),
  decodeEvent: (_, b) => dec(b),
  schema: () => ({}),
  version: () => 'test',
}
async function chain(
  hopLimit = 63,
  change:
    | 'wrong_root'
    | 'wrong_ordinal'
    | 'unadmitted'
    | 'offline'
    | 'cycle'
    | null = null,
) {
  const original = await release(),
    r = {
      ...original,
      contracts: new Map(original.contracts),
      drivers: new Map(original.drivers),
    }
  const key = nameKey('example.dusk'),
    admissions = Array.from({ length: 64 }, (_, ordinal) => ({
      ...sample('Admission'),
      id: bytes(ordinal + 10),
      ordinal,
      interface_version: 1,
    }))
  for (const a of admissions) {
    r.contracts.set(hex(a.id), {
      ...r.contracts.get(id(4))!,
      contractId: hex(a.id),
    })
    r.drivers.set(hex(a.id), driver)
  }
  for (const c of r.contracts.values()) r.drivers.set(c.contractId, driver)
  const client = new FrozenClient(r, {
    hopLimit,
    transport: {
      currentBlockHeight: async () => 100n,
      read: async (contract, fn, data) => {
        const role = r.contracts.get(contract)!.role
        if (fn === 'interface_version')
          return enc({
            kind: role === 'store' ? 'Store' : 'Directory',
            version: 1,
            move_version: role === 'store' ? 1 : 0,
            custody_version: role === 'store' ? 1 : 0,
          })
        if (fn === 'binding')
          return enc({ directory: bytes(1), vault: bytes(2), network: 1 })
        if (fn === 'members') {
          const { start, limit } = dec(data) as { start: number; limit: number }
          return enc({
            rows: admissions.slice(start, start + limit),
            next: start + limit < 64 ? start + limit : null,
          })
        }
        if (fn === 'home') {
          const at = admissions.findIndex((a) => hex(a.id) === contract)
          if (at === 63) {
            if (change === 'offline') throw new Error('offline')
            return enc('Local')
          }
          return enc({
            Forwarded: {
              root: change === 'wrong_root' ? bytes(9) : key.root,
              destination:
                change === 'unadmitted'
                  ? bytes(99)
                  : change === 'cycle'
                    ? bytes(10)
                    : admissions[at + 1].id,
              destination_ordinal: change === 'wrong_ordinal' ? at + 2 : at + 1,
              move_id: bytes(8),
              generation: 1n,
              completed_at: 99n,
            },
          })
        }
        if (fn === 'get_name') return enc('Absent')
        throw new Error(fn)
      },
    },
  })
  return { client, key }
}
it('accepts exactly 63 monotone hops across all 64 admitted stores', async () => {
  const { client, key } = await chain()
  const result = await client.locate(id(10), key.root, 'get_name', key)
  expect(result.store).toBe(id(73))
  expect(result.forwards).toHaveLength(63)
  expect(result.value).toBe('Absent')
})
it('rejects the same chain at a 62-hop configured limit', async () => {
  const { client, key } = await chain(62)
  await expect(
    client.locate(id(10), key.root, 'get_name', key),
  ).rejects.toThrow('hop limit')
})
it.each([
  'wrong_root',
  'wrong_ordinal',
  'unadmitted',
  'offline',
  'cycle',
] as const)('never falls back for %s', async (change) => {
  const { client, key } = await chain(63, change)
  await expect(
    client.locate(id(10), key.root, 'get_name', key),
  ).rejects.toThrow()
})
it.each([0, -1, 64, 1.5, NaN])(
  'rejects invalid hop limit %s',
  async (hopLimit) => {
    const r = await release()
    expect(() => new FrozenClient(r, { hopLimit })).toThrow()
  },
)
