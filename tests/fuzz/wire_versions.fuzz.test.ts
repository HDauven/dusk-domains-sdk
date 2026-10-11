import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { wireValue } from '../../src/frozen/wire.ts'
import { stringifyJson } from '../../src/frozen/json.ts'
import { definitions } from '../../src/frozen/schema.ts'
import { indexerEventCatalog } from '../../src/indexer/events/indexerEventCatalog.ts'
import { release, bytes, fixtures, id } from '../helpers.ts'
import { minimum } from './arbitraries.ts'

// The SDK mirrors the frozen protocol's Archived*::wire_bounds version tags.
const drivers = async () => (await release()).drivers
const ref = { key: { root: bytes(0), node: bytes(0) }, incarnation: { generation: 0n, serial: 0n } }
const rows = [...Object.values(fixtures()), ...Object.values(fixtures('frozen-v1-max')), ...Object.values(fixtures('market-v1'))]
const sample = (type: string) => wireValue(type, rows.find(row => row.type === type)!.json)

it('generates a literal version 1 generic event type', () => {
  const generated = readFileSync(new URL('../../src/frozen/types.ts', import.meta.url), 'utf8')
  expect(generated).toContain('export type Event<T> = { version: 1; op_seq: bigint; body: T }')
})

// policy.quote is a read call. prepareRegistration always assembles version 1,
// and no public wallet builder emits QuoteRequest.
it('requires QuoteRequest wire version 1', async () => {
  const invalid = { ...minimum({ $ref: '#/$defs/QuoteRequest' }), version: 0 }
  const driver = (await drivers()).get(id(3))!
  expect(() => wireValue('QuoteRequest', invalid)).toThrow()
  expect(() => driver.encodeInput('quote', stringifyJson({ ...invalid, version: 1 }))).not.toThrow()
})

// marketplace.on_name_received is an internal callback, not a wallet call.
it('requires CustodyNotice wire version 1', async () => {
  const invalid = {
    version: 0, directory: bytes(0), store: bytes(0), name: ref,
    nonce: 0n, previous_owner: bytes(0), previous_manager: bytes(0), data: [],
  }
  const driver = (await drivers()).get(id(6))!
  expect(() => wireValue('CustodyNotice', invalid)).toThrow()
  expect(() => driver.encodeInput('on_name_received', stringifyJson({ ...invalid, version: 1 }))).not.toThrow()
})

// Same class on decode-only catalog types: Rust requires version == 1 for
// every Event<T>, PolicyQuote, CustodyAck, FeeMetadata, Interface and
// MarketWindDown. Driver decoding can never produce another version, but the
// SDK's corresponding strict schemas accept it.
it('requires version 1 on every protocol-tagged output and event', () => {
  const eventTypes = Object.values(indexerEventCatalog).map(spec => spec.type)
    .filter(type => (definitions as any)[type]?.properties?.version)
  const types = [...new Set([...eventTypes, 'PolicyQuote', 'CustodyAck', 'FeeMetadata', 'Interface', 'MarketWindDown'])]
  const accepted = types.filter(type => {
    const value = { ...sample(type), version: 0 }
    try { wireValue(type, value); return true } catch { return false }
  })
  expect(accepted).toEqual([])
})
