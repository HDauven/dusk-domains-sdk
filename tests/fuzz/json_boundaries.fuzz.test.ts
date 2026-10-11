import { expect, it } from 'vitest'
import { wireValue, decodeJson } from '../../src/frozen/wire.ts'
import { stringifyJson } from '../../src/frozen/json.ts'
import { storeCreateSubnameCall } from '../../src/frozen/builders.ts'
import { release, bytes, id } from '../helpers.ts'

// Canonical JSON spelling regressions at the shared SDK/driver boundary.
const drivers = async () => (await release()).drivers
const ref = { key: { root: bytes(0), node: bytes(0) }, incarnation: { generation: 0n, serial: 0n } }

// JavaScript strings may hold unpaired UTF-16 surrogates; Rust strings cannot.
// stringifyJson can write them as "\ud800", but neither SDK wire validation nor
// serde_json may admit them. This case is reduced to the label alone.
it('rejects lone UTF-16 surrogates before building a wire call', async () => {
  const args = {
    parent: ref, node: bytes(0), label: '\ud800', owner: bytes(0), manager: bytes(0), expires_at: 0n, expiry_policy: 'InheritsParent',
  } as const
  const store = (await drivers()).get(id(4))!
  expect(() => storeCreateSubnameCall(id(4), args)).toThrow()
  expect(() => store.encodeInput('create_subname', stringifyJson({ ...args, label: '�' }))).not.toThrow()
})

// Integral fields accept only integer JSON tokens; 0.0, 1e0 and -0 are rejected
// before schema normalization just as they are by the frozen drivers.
it('rejects non-integer JSON token spellings for integral wire fields', async () => {
  const text = `{"root":[0.0${',0'.repeat(31)}],"node":[0${',0'.repeat(31)}]}`
  const store = (await drivers()).get(id(4))!
  expect(() => decodeJson('NameKey', text)).toThrow()
  expect(() => store.encodeInput('get_name', text)).toThrow()
})

it('requires canonical object and unit-enum JSON spellings', async () => {
  const vault = (await drivers()).get(id(2))!
  const recipient = Array(96).fill(0)
  const rows = [
    [[{ Exact: '0' }, recipient], { amount: { Exact: '0' }, recipient }],
    [{ amount: { All: null }, recipient }, { amount: 'All', recipient }],
  ]
  for (const [serde, canonical] of rows) {
    expect(() => vault.encodeInput('claim_referral', stringifyJson(serde))).toThrow()
    expect(() => wireValue('ClaimReferral', serde)).toThrow()
    expect(() => wireValue('ClaimReferral', canonical)).not.toThrow()
    expect(() => vault.encodeInput('claim_referral', stringifyJson(canonical))).not.toThrow()
  }
})
