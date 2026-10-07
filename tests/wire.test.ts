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
    for (const [key, row] of Object.entries(rows)) {
      if (!definitions[row.type]) continue
      it(`${suite} / ${key}: strict JSON and lossless roundtrip`, () => {
        const value = wireValue(row.type, row.json)
        expect(wireValue(row.type, parseJson(stringifyJson(value)))).toEqual(
          value,
        )
      })
    }
    for (const [role, methods] of Object.entries(methodCatalog)) {
      if (suite === 'market-v1' && role !== 'marketplace') continue
      for (const method of methods) {
        for (const [key, row] of Object.entries(rows)) {
          if (
            row.type === 'ReceiveFromContract' &&
            ((key.endsWith('::Store') && role === 'vault') ||
              (key.endsWith('::Vault') && role !== 'vault'))
          )
            continue
          if (row.type === method.input) {
            it(`${suite} / ${role}.${method.name} / ${key}: golden input bytes`, async () => {
              const r = await release(),
                c = r.manifest.contracts.find((c) => c.role === role)!,
                driver = r.drivers.get(c.contractId)!
              const value = wireValue(row.type, row.json)
              expect(
                hex(driver.encodeInput(method.name, stringifyJson(value))),
              ).toBe(row.rkyv)
              expect(
                wireValue(
                  row.type,
                  driver.decodeInput(
                    method.name,
                    Uint8Array.from(fromHex(row.rkyv)),
                  ),
                ),
              ).toEqual(value)
            })
          }
          if (row.type === method.output && method.mode !== 'metadata') {
            it(`${suite} / ${role}.${method.name} / ${key}: golden output bytes`, async () => {
              const r = await release(),
                c = r.manifest.contracts.find((c) => c.role === role)!,
                driver = r.drivers.get(c.contractId)!
              expect(
                wireValue(
                  row.type,
                  driver.decodeOutput(
                    method.name,
                    Uint8Array.from(fromHex(row.rkyv)),
                  ),
                ),
              ).toEqual(wireValue(row.type, row.json))
            })
          }
        }
      }
      for (const [topic, event] of Object.entries(indexerEventCatalog)) {
        if (event.role !== '*' && event.role !== role) continue
        for (const [key, row] of Object.entries(rows))
          if (row.type === event.type) {
            it(`${suite} / ${role}.${topic} / ${key}: golden event bytes`, async () => {
              const r = await release(),
                c = r.manifest.contracts.find((c) => c.role === role)!,
                driver = r.drivers.get(c.contractId)!
              expect(
                wireValue(
                  row.type,
                  driver.decodeEvent(topic, Uint8Array.from(fromHex(row.rkyv))),
                ),
              ).toEqual(wireValue(row.type, row.json))
            })
          }
      }
    }
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
