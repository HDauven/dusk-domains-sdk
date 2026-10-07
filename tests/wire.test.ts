import { describe, it, expect } from 'vitest'
import { fixtures, release } from './helpers.ts'
import { definitions } from '../src/frozen/schema.ts'
import { methodCatalog } from '../src/frozen/catalog.ts'
import { indexerEventCatalog } from '../src/indexer/events/indexerEventCatalog.ts'
import { wireValue } from '../src/frozen/wire.ts'
import { parseJson, stringifyJson } from '../src/frozen/json.ts'
import { fromHex, hex } from '../src/frozen/bytes.ts'

describe('protocol golden JSON and WASM', () => {
  for (const suite of ['frozen-v1', 'frozen-v1-max', 'market-v1']) {
    const rows = fixtures(suite)
    it(`${suite}: strict JSON shapes and lossless roundtrips`, () => {
      let tested = 0
      for (const [key, row] of Object.entries(rows)) {
        if (!definitions[row.type]) continue
        const value = wireValue(row.type, row.json)
        expect(
          wireValue(row.type, parseJson(stringifyJson(value))),
          key,
        ).toEqual(value)
        tested++
      }
      expect(tested).toBeGreaterThan(0)
    })
    it(`${suite}: encode and decode every exported input/output/event vector`, async () => {
      const r = await release()
      let encoded = 0,
        decoded = 0
      for (const c of r.contracts.values()) {
        if (suite === 'market-v1' && c.role !== 'marketplace') continue
        const driver = r.drivers.get(c.contractId)!
        for (const method of methodCatalog[c.role]) {
          for (const [key, row] of Object.entries(rows)) {
            if (
              row.type === 'ReceiveFromContract' &&
              ((key.endsWith('::Store') && c.role === 'vault') ||
                (key.endsWith('::Vault') && c.role !== 'vault'))
            )
              continue
            const data = Uint8Array.from(fromHex(row.rkyv))
            if (row.type === method.input) {
              const value = wireValue(row.type, row.json)
              let result: Uint8Array
              try {
                result = driver.encodeInput(method.name, stringifyJson(value))
              } catch (error) {
                throw new Error(`${c.role}.${method.name} ${key}`, {
                  cause: error,
                })
              }
              expect(hex(result), `${c.role}.${method.name} / ${key}`).toBe(
                row.rkyv,
              )
              expect(
                wireValue(row.type, driver.decodeInput(method.name, data)),
                key,
              ).toEqual(value)
              encoded++
            }
            if (row.type === method.output && method.mode !== 'metadata') {
              expect(
                wireValue(row.type, driver.decodeOutput(method.name, data)),
                `${c.role}.${method.name} / ${key}`,
              ).toEqual(wireValue(row.type, row.json))
              decoded++
            }
          }
        }
        for (const [topic, event] of Object.entries(indexerEventCatalog)) {
          if (event.role !== '*' && event.role !== c.role) continue
          for (const [key, row] of Object.entries(rows))
            if (row.type === event.type) {
              expect(
                wireValue(
                  row.type,
                  driver.decodeEvent(topic, Uint8Array.from(fromHex(row.rkyv))),
                ),
                key,
              ).toEqual(wireValue(row.type, row.json))
              decoded++
            }
        }
      }
      expect(encoded + decoded).toBeGreaterThan(0)
    })
  }
  it('rejects ambiguous numbers, unknown/missing fields, bytes and overflow', () => {
    expect(() =>
      wireValue('CommitArgs', { hash: Array(32).fill(1), extra: true }),
    ).toThrow()
    expect(() => wireValue('CommitArgs', {})).toThrow()
    expect(() =>
      wireValue('CommitArgs', { hash: Array(32).fill(256) }),
    ).toThrow()
    expect(() => wireValue('u64', Number.MAX_SAFE_INTEGER + 1)).toThrow()
    expect(() => wireValue('Lux', 5)).toThrow()
    expect(() => wireValue('Lux', '18446744073709551616')).toThrow()
    expect(() => parseJson('{"x":1,"x":2}')).toThrow()
    expect(
      parseJson('{"x":18446744073709551615,"lux":"18446744073709551615"}'),
    ).toEqual({ x: 18446744073709551615n, lux: '18446744073709551615' })
  })
})
