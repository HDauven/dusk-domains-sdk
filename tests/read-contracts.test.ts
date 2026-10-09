import { expect, it } from 'vitest'
import { FrozenClient } from '../src/frozen/client.ts'
import { methodCatalog } from '../src/frozen/catalog.ts'
import { parseJson, stringifyJson } from '../src/frozen/json.ts'
import { fromHex, hex } from '../src/frozen/bytes.ts'
import { wireValue } from '../src/frozen/wire.ts'
import { fixtures, release, id, bytes, sample } from './helpers.ts'
import type { DataDriver } from '../src/frozen/driver.ts'
const rows = [
  ...Object.values(fixtures()),
  ...Object.values(fixtures('market-v1')),
  // rkyv Option<Controller>::None: tag plus padding and the 56-byte payload.
  { type: 'Option<Controller>', json: null, rkyv: '00'.repeat(64) },
]
const jsonDriver: DataDriver = {
  encodeInput: (_, json) => new TextEncoder().encode(json),
  decodeInput: (_, b) => parseJson(new TextDecoder().decode(b)),
  decodeOutput: (_, b) => parseJson(new TextDecoder().decode(b)),
  decodeEvent: (_, b) => parseJson(new TextDecoder().decode(b)),
  version: () => 'test',
  schema: () => ({}),
}
const encode = (v: unknown) => new TextEncoder().encode(stringifyJson(v))
for (const [role, methods] of Object.entries(methodCatalog))
  for (const method of methods.filter((m) => m.mode === 'read'))
    it(`${role}.${method.name}: public read API, protocol input/output and fresh height`, async () => {
      const original = await release(),
        r = { ...original, drivers: new Map(original.drivers) },
        descriptor = r.manifest.contracts.find((c) => c.role === role)!,
        target = descriptor.contractId
      let verifying = true,
        heights = 0,
        observed = false
      r.drivers.set(target, jsonDriver)
      const input = rows.find((row) => row.type === method.input)!
      const output = rows.find(
        (row) =>
          row.type === method.output &&
          !(
            typeof row.json === 'object' &&
            row.json &&
            'Forwarded' in row.json
          ),
      )!
      expect(input, `${method.input} fixture`).toBeDefined()
      expect(output, `${method.output} fixture`).toBeDefined()
      const client = new FrozenClient(r, {
        transport: {
          currentBlockHeight: async () => {
            heights++
            return 100n
          },
          read: async (contract, fn, args) => {
            if (verifying) {
              if (fn === 'interface_version')
                return encode({
                  kind: role[0].toUpperCase() + role.slice(1),
                  version: 1,
                  move_version: role === 'store' ? 1 : 0,
                  custody_version: ['store', 'marketplace'].includes(role)
                    ? 1
                    : 0,
                })
              if (fn === 'binding')
                return encode({
                  directory: bytes(1),
                  vault: bytes(2),
                  network: 1,
                })
              if (fn === 'order_api_version') return encode(1)
            }
            if (contract === target && fn === method.name) {
              observed = true
              expect(hex(args)).toBe(input.rkyv)
              return Uint8Array.from(fromHex(output.rkyv))
            }
            if (fn === 'members')
              return encode({
                rows: [
                  {
                    ...sample('Admission'),
                    id: bytes(4),
                    ordinal: 0,
                    interface_version: 1,
                  },
                ],
                next: null,
              })
            if (fn === 'home')
              return Uint8Array.from(
                fromHex(
                  rows.find(
                    (row) => row.type === 'Home' && row.json === 'Local',
                  )!.rkyv,
                ),
              )
            throw new Error(`Unexpected ${contract}.${fn}`)
          },
        },
      })
      await client.verifyContract(role as never, target)
      verifying = false
      r.drivers.set(target, original.drivers.get(target)!)
      if (role === 'store') r.drivers.set(id(1), jsonDriver)
      const api =
        role === 'directory'
          ? client.directory
          : role === 'vault'
            ? client.vault
            : (client as any)[role](target)
      const actual = await api[method.name](wireValue(method.input, input.json))
      expect(actual).toEqual(wireValue(method.output, output.json))
      expect(observed).toBe(true)
      expect(heights).toBe(2)
    })
