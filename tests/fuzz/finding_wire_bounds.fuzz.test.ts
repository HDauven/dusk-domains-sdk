import { expect, it } from 'vitest'
import { wireValue } from '../../src/frozen/wire.ts'
import { stringifyJson } from '../../src/frozen/json.ts'
import { buildCall } from '../../src/frozen/calls.ts'
import { storeMutateRecordsCall } from '../../src/frozen/builders.ts'
import { release, bytes, id } from '../helpers.ts'

// Open findings: the SDK's strict schema accepts values that the frozen Rust
// wire bounds reject (dusk-domains-types src/frozen/schema.rs WireBounds and
// driver.rs). These tests fail until the SDK schema carries those bounds; they
// pin each disagreement rather than blessing it. Counterexamples were found by
// the validation/input properties (fast-check 4.10.2, seed 20261010) and
// shrunk or reduced to the boundary.
const drivers = async () => (await release()).drivers
const ref = { key: { root: bytes(0), node: bytes(0) }, incarnation: { generation: 0n, serial: 0n } }

// vault.receive_fee: the driver caps callback data at MAX_FEE_METADATA_BYTES
// (512); the shared ReceiveFromContract schema allows 12,288 bytes, which is
// correct for store and marketplace receive_payment. A length property shrank
// to 513 (path 0:1:0:0:1:0:0:0:0:0:0:1, 11 shrinks).
it('finding_vault_fee_metadata_bound: SDK acceptance must imply driver acceptance', async () => {
  const receipt = (n: number) => wireValue('ReceiveFromContract', { contract: '00'.repeat(32), value: '0', data: '00'.repeat(n) })
  const driver = (await drivers()).get(id(2))!
  expect(() => driver.encodeInput('receive_fee', stringifyJson(receipt(512)))).not.toThrow()
  expect(() => driver.encodeInput('receive_fee', stringifyJson(receipt(513)))).not.toThrow()
})

// store.mutate_records (a public wallet write), resolver.apply_mutations and
// store.delegated (DelegatedOp::MutateRecords): wire::mutation_bounds caps the
// summed key + value bytes at 4,096; the SDK schema only bounds each row
// (64 + 512 bytes, 8 rows = 4,608). Found by the all-maximum example (and by
// input/store.delegated in the long run, seed 20261013), reduced to the
// boundary: 8 rows of 1 + 511 bytes pass, one more value byte gives a call that
// the wallet adapter cannot encode.
it('finding_record_mutation_payload: built calls must be driver-encodable', async () => {
  const rows = (extra: number) => Array.from({ length: 8 }, (_, i) =>
    ({ action: 'Set', key: String(i), value: Array(511 + (i === 7 ? extra : 0)).fill(1), ttl_seconds: 0n }))
  const store = (await drivers()).get(id(4))!, resolver = (await drivers()).get(id(5))!
  const ok = storeMutateRecordsCall(id(4), { name: ref, mutations: rows(0) })
  expect(() => store.encodeInput('mutate_records', stringifyJson(ok.args))).not.toThrow()
  const call = storeMutateRecordsCall(id(4), { name: ref, mutations: rows(1) })
  expect(buildCall('store', id(4), 'mutate_records', call.args).args).toEqual(call.args)
  expect.soft(() => store.encodeInput('mutate_records', stringifyJson(call.args))).not.toThrow()
  expect.soft(() => resolver.encodeInput('apply_mutations', stringifyJson(wireValue('ApplyMutations', { node: bytes(0), epoch: 0n, mutations: rows(1) })))).not.toThrow()
  const delegated = wireValue('Delegated', { principal: { kind: 'Contract', bytes: bytes(1) }, op: { MutateRecords: { name: ref, mutations: rows(1) } } })
  expect.soft(() => store.encodeInput('delegated', stringifyJson(delegated))).not.toThrow()
})
