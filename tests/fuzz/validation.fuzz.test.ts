import { beforeAll, expect, it, vi } from 'vitest'
import fc from 'fast-check'
import { methodCatalog } from '../../src/frozen/catalog.ts'
import { decodeInputJson, wireInput, wireValue } from '../../src/frozen/wire.ts'
import { stringifyJson } from '../../src/frozen/json.ts'
import { arbitrary, examples, mutate, choices, mutateText, textChoice } from './arbitraries.ts'
import { serdeCanonical } from './findings.ts'
import { driverFor, known, loadDrivers } from './catalog.ts'
import { accepts, check, count, testTimeout } from './support.ts'

vi.setConfig({ testTimeout })
beforeAll(loadDrivers)

const catalogEntries = Object.entries(methodCatalog).flatMap(([role, methods]) =>
  methods.map(method => `${role}.${method.name}:${method.input}`))
const coveredEntries: string[] = []

for (const [role, methods] of Object.entries(methodCatalog)) {
  for (const method of methods) {
    const name = `${role}.${method.name}`, type = method.input
    const driver = () => driverFor(role)
    coveredEntries.push(`${name}:${type}`)

    // Validation agreement on valid, mutated (at any depth) and arbitrary JSON values.
    it(`validation ${name}: SDK strict schema and driver accept the same values`, async () => {
      const metrics: Record<string, number> = {}
      const agree = (candidate: unknown) => {
        let normalized: unknown
        const sdk = accepts(() => { normalized = wireInput(role, method.name, type, candidate) })
        let json: string | undefined
        try { json = stringifyJson(candidate) } catch { json = undefined }
        const rust = json !== undefined && accepts(() => driver().encodeInput(method.name, json!))
        count(metrics, `${sdk ? 'sdk' : 'no-sdk'}/${rust ? 'driver' : 'no-driver'}`)
        if (sdk === rust) return
        if (!sdk) {
          const canonical = serdeCanonical(type, candidate)
          if (canonical === null || !accepts(() => wireValue(type, canonical)) ||
              !accepts(() => expect(driver().encodeInput(method.name, stringifyJson(canonical))).toEqual(driver().encodeInput(method.name, json!))))
            throw new Error(`Driver accepts a value the SDK rejects: ${json}`)
          count(metrics, 'known:driver_serde_spellings')
          return
        }
        const { value, hits } = known(role, method.name, normalized, metrics)
        if (!hits.length) throw new Error(`SDK accepts a value the driver rejects: ${json}`)
        expect(accepts(() => wireValue(type, value))).toBe(true)
        expect(accepts(() => driver().encodeInput(method.name, stringifyJson(value)))).toBe(true)
      }
      for (const [value] of examples(type)) { agree(value); count(metrics, 'examples') }
      await check(`validation/${name}`, fc.property(arbitrary(type), choices, fc.nat(3), (valid, steps, mode) =>
        agree(mode === 0 ? valid : mode === 3 ? steps[0].json : mutate(type, valid, steps))), { metrics })
    })

    // Validation agreement on JSON text: SDK decodeJson versus the driver's parser.
    it(`text ${name}: SDK decodeJson and driver agree on re-spelled JSON text`, async () => {
      const metrics: Record<string, number> = {}
      await check(`text/${name}`, fc.property(arbitrary(type), textChoice, (valid, choice) => {
        let text = mutateText(stringifyJson(valid), choice)
        for (let attempt = 0; attempt < 2; attempt++) {
          let value: unknown, bytes: Uint8Array | undefined
          const sdk = accepts(() => { value = decodeInputJson(role, method.name, type, text) })
          const rust = accepts(() => { bytes = driver().encodeInput(method.name, text) })
          count(metrics, `${sdk ? 'sdk' : 'no-sdk'}/${rust ? 'driver' : 'no-driver'}`)
          if (sdk && rust) {
            expect(driver().encodeInput(method.name, stringifyJson(value))).toEqual(bytes)
            return
          }
          if (sdk === rust) return
          if (!sdk) throw new Error(`Driver accepts JSON text the SDK rejects: ${text}`)
          const { value: repaired, hits } = known(role, method.name, value, metrics)
          if (!hits.length) throw new Error(`SDK accepts JSON text the driver rejects: ${text}`)
          expect(accepts(() => driver().encodeInput(method.name, stringifyJson(repaired)))).toBe(true)
          return
        }
      }), { metrics })
    })

  }
}

// Agreement is contextual per entrypoint rather than deduplicated by input
// type: the vault's ReceiveFromContract limit is stricter than the store and
// marketplace limits. Keep this audit beside the generated loop so future
// catalog additions cannot silently miss validation fuzzing.
it('validation catalog coverage: every method entrypoint has value and JSON-text agreement properties', () => {
  expect(coveredEntries.sort()).toEqual(catalogEntries.sort())
})
