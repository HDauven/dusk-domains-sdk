import { expect, it } from 'vitest'
import { FrozenClient } from '../src/frozen/client.ts'
import { methodCatalog } from '../src/frozen/catalog.ts'
import { parseJson, stringifyJson } from '../src/frozen/json.ts'
import { fromHex, hex } from '../src/frozen/bytes.ts'
import { wireValue } from '../src/frozen/wire.ts'
import { fixtures, release, id, bytes, sample, evidence, policyInitHash } from './helpers.ts'
import { launchPolicyConfig } from '../src/core/pricing.ts'
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
        r = {
          ...original,
          // Verification reads JSON, so the policy's init commitment is over the JSON launch config.
          contracts: new Map([...original.contracts].map(([cid, c]) =>
            [cid, c.role === 'policy' ? { ...c, initHash: policyInitHash(jsonDriver, launchPolicyConfig()) } : c])),
          drivers: new Map(original.drivers),
        },
        descriptor = r.manifest.contracts.find((c) => c.role === role)!,
        target = descriptor.contractId
      let verifying = true,
        heights = 0,
        observed = false
      // Verification reads answer in JSON; the public read under test runs the reviewed driver.
      const real = original.drivers.get(target)!,
        current = () => (verifying ? jsonDriver : real)
      r.drivers.set(target, {
        encodeInput: (fn, json) => current().encodeInput(fn, json),
        decodeInput: (fn, b) => current().decodeInput(fn, b),
        decodeOutput: (fn, b) => current().decodeOutput(fn, b),
        decodeEvent: (topic, b) => current().decodeEvent(topic, b),
        version: () => real.version(),
        schema: () => real.schema(),
      })
      if (role !== 'directory') r.drivers.set(id(1), jsonDriver)
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
              const kind = r.contracts.get(contract)!.role
              if (fn === 'interface_version')
                return encode({
                  kind: kind[0].toUpperCase() + kind.slice(1),
                  version: 1,
                  move_version: kind === 'store' ? 1 : 0,
                  custody_version: ['store', 'marketplace'].includes(kind)
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
              if (fn === 'config' && kind === 'policy') return encode(launchPolicyConfig())
              // The directory's own record of the contract under verification.
              if (fn === 'member' || fn === 'market')
                return encode({ ...sample(fn === 'member' ? 'Admission' : 'Market'),
                  id: (parseJson(new TextDecoder().decode(args)) as { id: number[] }).id, interface_version: 1 })
            }
            if (contract === target && fn === method.name) {
              observed = true
              expect(hex(args)).toBe(input.rkyv)
              return Uint8Array.from(fromHex(output.rkyv))
            }
            const store4 = { ...sample('Admission'), id: bytes(4), ordinal: 0, interface_version: 1 }
            if (fn === 'members') return encode({ rows: [store4], next: null })
            if (fn === 'member')
              return encode(hex((parseJson(new TextDecoder().decode(args)) as { id: number[] }).id) === id(4) ? store4 : null)
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
      await client.verifyContract(role as never, target, evidence(descriptor))
      verifying = false
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
