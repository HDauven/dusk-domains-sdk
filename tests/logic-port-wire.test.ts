import { expect, it } from 'vitest'
import * as builders from '../src/frozen/builders.ts'
import { methodDefinition, buildCall } from '../src/frozen/calls.ts'
import { wireValue } from '../src/frozen/wire.ts'
import { stringifyJson } from '../src/frozen/json.ts'
import { hex, fromHex } from '../src/frozen/bytes.ts'
import { indexerEventCatalog } from '../src/indexer/events/indexerEventCatalog.ts'
import { fixtures, release, id, bytes } from './helpers.ts'

const methods = [
  ['directory', 'controllers', '()', 'Controllers', 'read'],
  ['directory', 'controller', 'ControllerQuery', 'Option<Controller>', 'read'],
  ['directory', 'set_controller_suspension', 'ControllerSuspension', '()', 'write'],
  ['store', 'delegated', 'Delegated', '()', 'internal'],
  ['store', 'released_root', 'StoreHomeArgs', 'ReleasedRoot', 'read'],
  ['store', 'cede_released', 'CedeReleased', 'ReleasedRoot', 'internal'],
] as const
for (const [role, method, input, output, mode] of methods) {
  it(`${role}.${method} has the exact protocol signature and client mode`, () => {
    expect(methodDefinition(role, method)).toMatchObject({ input, output, mode })
  })
}
for (const suite of ['frozen-v1', 'frozen-v1-max']) {
  const rows = fixtures(suite)
  for (const [key, row] of Object.entries(rows).filter(([key]) =>
    /Controller|Delegated|Released|Ceded|RegisterFor|Retiring/.test(key) || key === 'Admission')) {
    it(`${suite} logic port / ${key}: validates the golden wire value`, () => {
      expect(wireValue(row.type, row.json)).toBeDefined()
    })
  }
  for (const [role, method, input, output] of methods) {
    for (const [key, row] of Object.entries(rows).filter(([, r]) => r.type === input || r.type === output)) {
      it(`${suite} logic port / ${method} / ${key}: matches archive bytes`, async () => {
        const r = await release(), driver = r.drivers.get(id(role === 'store' ? 4 : 1))!
        const value = wireValue(row.type, row.json)
        if (row.type === input) {
          expect(hex(driver.encodeInput(method, stringifyJson(value)))).toBe(row.rkyv)
          expect(wireValue(row.type, driver.decodeInput(method, Uint8Array.from(fromHex(row.rkyv))))).toEqual(value)
        }
        if (row.type === output)
          expect(wireValue(row.type, driver.decodeOutput(method, Uint8Array.from(fromHex(row.rkyv))))).toEqual(value)
      })
    }
  }
}
for (const [topic, type, role] of [
  ['controller_changed', 'ControllerChanged', 'directory'],
  ['controller_suspension_changed', 'ControllerSuspensionChanged', 'directory'],
  ['controller_used', 'ControllerUsed', 'store'],
  ['root_ceded', 'RootCeded', 'store'],
]) {
  it(`decodes ${topic} using the golden event archive`, async () => {
    const row = fixtures()[`Event<${type}>`], r = await release()
    expect(indexerEventCatalog[topic as keyof typeof indexerEventCatalog]).toEqual({ role, type: row.type })
    const driver = r.drivers.get(id(role === 'store' ? 4 : 1))!
    expect(wireValue(row.type, driver.decodeEvent(topic, Uint8Array.from(fromHex(row.rkyv))))).toEqual(wireValue(row.type, row.json))
  })
}
it('builds guardian suspension, but keeps contract-only ports out of wallet calls', () => {
  for (const [method, args] of [
    ['set_controller_suspension', { controller: bytes(41), suspended: true }],
  ] as const) {
    const call = buildCall('directory', id(1), method, args)
    expect(call.deposit).toBe('0')
    expect(call.gasLimit).toBeGreaterThan(0n)
  }
  for (const method of ['delegated', 'cede_released'])
    expect(() => buildCall('store', id(4), method as never, {} as never)).toThrow('public wallet action')
  expect(builders).not.toHaveProperty('storeCedeReleasedCall')
  expect(builders).not.toHaveProperty('storeDelegatedCall')
})
it.each(Object.entries(fixtures()).filter(([key]) => key.startsWith('DelegatedOp::')))(
  'roundtrips every delegated operation through the store driver: %s', async (_key, row) => {
    const driver = (await release()).drivers.get(id(4))!
    const value = wireValue('Delegated', { principal: { kind: 'Contract', bytes: bytes(41) }, op: row.json })
    expect(wireValue('Delegated', driver.decodeInput('delegated', driver.encodeInput('delegated', stringifyJson(value))))).toEqual(value)
  },
)
it.each(Object.keys(fixtures()).filter(key => key.startsWith('Action::')).map(key => key.slice('Action::'.length)))('matches the golden archive for the %s proposal action', async variant => {
  const rows = fixtures(), driver = (await release()).drivers.get(id(1))!
  const propose = wireValue('Propose', { ...rows.Propose.json as object, action: rows[`Action::${variant}`].json })
  const encoded = driver.encodeInput('propose', stringifyJson(propose))
  // Propose wraps one Action, so its archive has the same layout as that Action.
  expect(hex(encoded)).toBe(rows[`Action::${variant}`].rkyv)
  expect(wireValue('Propose', driver.decodeInput('propose', encoded))).toEqual(propose)
})
it('decodes both controller query option replies', async () => {
  const row = fixtures().Controller, driver = (await release()).drivers.get(id(1))!
  // rkyv enum tag, seven alignment bytes, then ArchivedController (56 bytes).
  const some = Uint8Array.from(fromHex('0100000000000000' + row.rkyv))
  expect(wireValue('Option<Controller>', driver.decodeOutput('controller', some))).toEqual(wireValue('Controller', row.json))
  expect(wireValue('Option<Controller>', driver.decodeOutput('controller', new Uint8Array(64)))).toBeNull()
})
