import { expect, it } from 'vitest'
import { wireValue, decodeJson } from '../../src/frozen/wire.ts'
import { stringifyJson } from '../../src/frozen/json.ts'
import { storeCreateSubnameCall } from '../../src/frozen/builders.ts'
import { release, bytes, id } from '../helpers.ts'

// Open findings on JSON spellings. The driver parses with serde_json; the SDK
// validates JavaScript values (wireValue) and JSON text (decodeJson).
const drivers = async () => (await release()).drivers
const ref = { key: { root: bytes(0), node: bytes(0) }, incarnation: { generation: 0n, serial: 0n } }

// JavaScript strings may hold unpaired UTF-16 surrogates; Rust strings cannot.
// wireValue accepts them, stringifyJson writes "\ud800", and serde_json rejects
// it ("lone leading surrogate in hex escape"). Found by validation/store.create_subname
// (also register and mutate_records), reduced to the label alone.
it('finding_lone_surrogate_strings: built calls must be driver-encodable', async () => {
  const call = storeCreateSubnameCall(id(4), {
    parent: ref, node: bytes(0), label: '\ud800', owner: bytes(0), manager: bytes(0), expires_at: 0n, expiry_policy: 'InheritsParent',
  })
  const store = (await drivers()).get(id(4))!
  expect(() => store.encodeInput('create_subname', stringifyJson({ ...call.args, label: '�' }))).not.toThrow()
  expect(() => store.encodeInput('create_subname', stringifyJson(call.args))).not.toThrow()
})

// decodeJson (parseJson) reads an integral float token such as 0.0, 1e0 or -0
// as an integer; serde_json rejects a float for u8/u16/u64. Shrunk from
// text/store.get_name (73 shrinks): the first byte of NameKey.root spelled 0.0.
it('finding_json_number_spelling: SDK decodeJson acceptance must imply driver acceptance', async () => {
  const text = `{"root":[0.0${',0'.repeat(31)}],"node":[0${',0'.repeat(31)}]}`
  const value = decodeJson('NameKey', text)
  const store = (await drivers()).get(id(4))!
  expect(() => store.encodeInput('get_name', stringifyJson(value))).not.toThrow()
  expect(() => store.encodeInput('get_name', text)).not.toThrow()
})

// Reverse direction: serde_json also accepts a unit variant written as
// {"All": null} and a struct written as a positional array, which the SDK's
// strict schema rejects. Shrunk from validation/vault.claim_referral (103 shrinks).
it('finding_driver_serde_spellings: driver acceptance must imply SDK acceptance', async () => {
  const vault = (await drivers()).get(id(2))!
  const recipient = Array(96).fill(0)
  for (const value of [[{ Exact: '0' }, recipient], { amount: { All: null }, recipient }]) {
    expect(() => vault.encodeInput('claim_referral', stringifyJson(value))).not.toThrow()
    expect(() => wireValue('ClaimReferral', value)).not.toThrow()
  }
})
