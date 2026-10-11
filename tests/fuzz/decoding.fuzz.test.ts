import { beforeAll, expect, it, vi } from 'vitest'
import fc from 'fast-check'
import { methodCatalog } from '../../src/frozen/catalog.ts'
import { definitions } from '../../src/frozen/schema.ts'
import { indexerEventCatalog } from '../../src/indexer/events/indexerEventCatalog.ts'
import { wireInput, wireValue } from '../../src/frozen/wire.ts'
import { stringifyJson } from '../../src/frozen/json.ts'
import { arbitrary, resolve } from './arbitraries.ts'
import { repairKnown } from './findings.ts'
import { allFixtures, byteChoices, contractsFor, driverFor, lossless, loadDrivers, mutateBytes, seedsFor } from './catalog.ts'
import { check, count, testTimeout } from './support.ts'

vi.setConfig({ testTimeout })
beforeAll(loadDrivers)

for (const [role, methods] of Object.entries(methodCatalog)) {
  for (const method of methods) {
    const name = `${role}.${method.name}`, type = method.input
    const driver = () => driverFor(role)
    const inputs = arbitrary(type).filter((value) => {
      try { wireInput(role, method.name, type, value); return true } catch { return false }
    })

    // Decoding agreement: any input envelope the driver decodes, the SDK accepts and re-encodes exactly.
    it(`decode ${name}: mutated input envelopes the driver decodes are SDK-valid and canonical`, async () => {
      const metrics: Record<string, number> = {}
      const seeds = seedsFor(type)
      await check(`decode-input/${name}`, fc.property(inputs, fc.nat(), byteChoices, (raw, seed, steps) => {
        const { value } = repairKnown(role, method.name, wireInput(role, method.name, type, raw))
        const original = seeds.length && seed % 2 ? seeds[(seed >> 1) % seeds.length]
          : driver().encodeInput(method.name, stringifyJson(value))
        const bytes = mutateBytes(original, steps)
        let decoded: unknown
        try { decoded = driver().decodeInput(method.name, bytes) } catch { count(metrics, 'driver-rejects'); return }
        count(metrics, 'driver-decodes')
        const checked = wireInput(role, method.name, type, decoded)
        expect(driver().encodeInput(method.name, stringifyJson(checked))).toEqual(bytes)
        lossless(type, checked)
      }), { metrics })
    })

    // Decoding agreement for outputs, from pinned Rust fixtures and their byte mutations.
    // Metadata encoders (custody_intent, payment_intent) have no output decoder.
    const outputSeeds = method.mode === 'metadata' ? [] : seedsFor(method.output)
    if (outputSeeds.length) it(`output ${name}: pinned and mutated outputs the driver decodes are SDK-valid`, async () => {
      const metrics: Record<string, number> = {}
      await check(`decode-output/${name}`, fc.property(fc.nat(outputSeeds.length - 1), fc.boolean(), byteChoices, (index, pristine, steps) => {
        const bytes = pristine ? outputSeeds[index] : mutateBytes(outputSeeds[index], steps)
        let decoded: unknown
        try { decoded = driver().decodeOutput(method.name, bytes) } catch {
          if (pristine) throw new Error(`Driver rejects pinned ${method.output}`)
          count(metrics, 'driver-rejects'); return
        }
        count(metrics, 'driver-decodes')
        const checked = wireValue(method.output, decoded)
        lossless(method.output, checked)
        expect(wireValue(method.output, driver().decodeOutput(method.name, bytes))).toEqual(checked)
      }), { metrics })
    })

  }
}

// Events: the drivers export decoders only, so arbitrary event values are
// checked for lossless SDK JSON, and decoding is compared on pinned Rust
// envelopes and byte mutations of them.
for (const [topic, spec] of Object.entries(indexerEventCatalog)) {
  it(`event ${topic}: lossless SDK JSON, pinned Rust decoding and mutated envelopes`, async () => {
    const metrics: Record<string, number> = {}
    const seeds = seedsFor(spec.type)
    expect(seeds.length).toBeGreaterThan(0)
    const contracts = contractsFor(spec.role)
    for (const contract of contracts) for (const row of allFixtures.filter(r => r.type === spec.type))
      expect(wireValue(spec.type, contract.driver.decodeEvent(topic, Buffer.from(row.rkyv, 'hex'))))
        .toEqual(wireValue(spec.type, row.json))
    await check(`event/${topic}`, fc.property(arbitrary(spec.type), fc.nat(), byteChoices, (value, pick, steps) => {
      lossless(spec.type, wireValue(spec.type, value))
      const contract = contracts[pick % contracts.length]
      const bytes = mutateBytes(seeds[pick % seeds.length], steps)
      let decoded: unknown
      try { decoded = contract.driver.decodeEvent(topic, bytes) } catch { count(metrics, 'driver-rejects'); return }
      count(metrics, 'driver-decodes')
      const checked = wireValue(spec.type, decoded)
      lossless(spec.type, checked)
      if (resolve((definitions as any)[spec.type]).properties?.version) expect((checked as any).version).toBe(1)
    }), { metrics })
  })
}
