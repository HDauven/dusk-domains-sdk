import { expect, it } from 'vitest'
import { wireValue } from '../../src/frozen/wire.ts'
import { stringifyJson } from '../../src/frozen/json.ts'
import { definitions } from '../../src/frozen/schema.ts'
import { indexerEventCatalog } from '../../src/indexer/events/indexerEventCatalog.ts'
import { release, bytes, fixtures, id } from '../helpers.ts'
import { minimum } from './arbitraries.ts'

// Open findings: the SDK's strict schemas allow version tags rejected by the
// frozen protocol's Archived*::wire_bounds implementations. These tests fail
// until the SDK schemas express the protocol's version == 1 invariants.
const drivers = async () => (await release()).drivers
const ref = { key: { root: bytes(0), node: bytes(0) }, incarnation: { generation: 0n, serial: 0n } }
const rows = [...Object.values(fixtures()), ...Object.values(fixtures('frozen-v1-max')), ...Object.values(fixtures('market-v1'))]
const sample = (type: string) => wireValue(type, rows.find(row => row.type === type)!.json)

// policy.quote is a read call. prepareRegistration always assembles version 1,
// and no public wallet builder emits QuoteRequest.
it('finding_quote_request_version: SDK acceptance must imply driver acceptance', async () => {
  const value = wireValue('QuoteRequest', { ...minimum({ $ref: '#/$defs/QuoteRequest' }), version: 0 })
  const driver = (await drivers()).get(id(3))!
  expect(() => driver.encodeInput('quote', stringifyJson({ ...value, version: 1 }))).not.toThrow()
  expect(() => driver.encodeInput('quote', stringifyJson(value))).not.toThrow()
})

// marketplace.on_name_received is an internal callback, not a wallet call.
it('finding_custody_notice_version: SDK acceptance must imply driver acceptance', async () => {
  const value = wireValue('CustodyNotice', {
    version: 0, directory: bytes(0), store: bytes(0), name: ref,
    nonce: 0n, previous_owner: bytes(0), previous_manager: bytes(0), data: [],
  })
  const driver = (await drivers()).get(id(6))!
  expect(() => driver.encodeInput('on_name_received', stringifyJson({ ...value, version: 1 }))).not.toThrow()
  expect(() => driver.encodeInput('on_name_received', stringifyJson(value))).not.toThrow()
})

// Same class on decode-only catalog types: Rust requires version == 1 for
// every Event<T>, PolicyQuote, CustodyAck, FeeMetadata, Interface and
// MarketWindDown. Driver decoding can never produce another version, but the
// SDK's corresponding strict schemas accept it.
it('finding_wire_version_tags: SDK schema must reject versions the wire bounds reject', () => {
  const eventTypes = Object.values(indexerEventCatalog).map(spec => spec.type)
    .filter(type => (definitions as any)[type]?.properties?.version)
  const types = [...new Set([...eventTypes, 'PolicyQuote', 'CustodyAck', 'FeeMetadata', 'Interface', 'MarketWindDown'])]
  const accepted = types.filter(type => {
    const value = { ...sample(type), version: 0 }
    try { wireValue(type, value); return true } catch { return false }
  })
  expect(accepted).toEqual([])
})
