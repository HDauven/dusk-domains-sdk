import { expect } from 'vitest'
import fc from 'fast-check'
import { wireValue } from '../../src/frozen/wire.ts'
import { parseJson, stringifyJson } from '../../src/frozen/json.ts'
import type { DataDriver } from '../../src/frozen/driver.ts'
import { fixtures, release } from '../helpers.ts'
import { repairKnown, reportKnown } from './findings.ts'
import { count } from './support.ts'

// The SDK has no binary codec of its own: every call it builds is the SDK's
// strict JSON normalization handed to the release's Rust data driver
// (tests/fixtures/*.wasm.gz). The catalog properties compare that pipeline
// with the driver itself, byte for byte.
let loaded: Awaited<ReturnType<typeof release>> | undefined
export async function loadDrivers() { loaded = await release() }
export const contractFor = (role: string) => loaded!.manifest.contracts.find(c => c.role === role)!.contractId
export const driverFor = (role: string): DataDriver => loaded!.drivers.get(contractFor(role))!
export const contractsFor = (role: string) => loaded!.manifest.contracts.filter(c => role === '*' || c.role === role)
  .map(c => ({ contractId: c.contractId, driver: loaded!.drivers.get(c.contractId)! }))
export const allFixtures = Object.values(fixtures()).concat(Object.values(fixtures('frozen-v1-max')), Object.values(fixtures('market-v1')))
export const seedsFor = (type: string) => allFixtures.filter(row => row.type === type).map(row => Uint8Array.from(Buffer.from(row.rkyv, 'hex')))
export const lossless = (type: string, value: unknown) =>
  expect(wireValue(type, parseJson(stringifyJson(value)))).toEqual(value)

/** Repair known findings (counting them); with FUZZ_REPORT_KNOWN=1 fail instead. */
export function known(role: string, method: string, value: unknown, metrics: Record<string, number>) {
  const repaired = repairKnown(role, method, value)
  for (const hit of repaired.hits) count(metrics, `known:${hit}`)
  if (repaired.hits.length && reportKnown) throw new Error(`Known finding ${repaired.hits.join(', ')}`)
  return repaired
}
/** Byte-level mutations of a valid wire envelope: bytes, bits, aligned words, length. */
export const byteChoices = fc.array(fc.record({ op: fc.nat(), at: fc.nat(), value: fc.nat() }), { minLength: 1, maxLength: 3 })
const WORDS = [0n, 1n, 0xffn, 1n << 53n, (1n << 64n) - 1n, 0x8000000000000000n]
export function mutateBytes(bytes: Uint8Array, steps: { op: number; at: number; value: number }[]): Uint8Array {
  let b = Uint8Array.from(bytes)
  for (const c of steps) {
    if (!b.length) break
    const op = ['byte', 'byte', 'bit', 'word', 'zero', 'truncate', 'extend'][c.op % 7], at = c.at % b.length
    if (op === 'byte') b[at] = c.value & 0xff
    else if (op === 'bit') b[at] ^= 1 << (c.value % 8)
    else if (op === 'zero') b[at] = 0
    else if (op === 'word') {
      const start = at & ~7, word = WORDS[c.value % WORDS.length]
      for (let k = 0; k < 8 && start + k < b.length; k++) b[start + k] = Number((word >> BigInt(8 * k)) & 0xffn)
    } else if (op === 'truncate') b = b.slice(0, at)
    else b = Uint8Array.from([...b, ...Array.from({ length: 1 + (c.value % 16) }, (_, k) => (c.value >> k) & 0xff)])
  }
  return b
}
