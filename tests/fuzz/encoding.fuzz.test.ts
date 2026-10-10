import { beforeAll, expect, it, vi } from 'vitest'
import fc from 'fast-check'
import { methodCatalog } from '../../src/frozen/catalog.ts'
import { wireValue } from '../../src/frozen/wire.ts'
import { stringifyJson } from '../../src/frozen/json.ts'
import { buildCall } from '../../src/frozen/calls.ts'
import { arbitrary, examples } from './arbitraries.ts'
import { driverFor, contractFor, known, loadDrivers } from './catalog.ts'
import { check, count, testTimeout } from './support.ts'

vi.setConfig({ testTimeout })
beforeAll(loadDrivers)

for (const [role, methods] of Object.entries(methodCatalog)) {
  for (const method of methods) {
    const name = `${role}.${method.name}`, type = method.input
    const driver = () => driverFor(role)

    // Differential encoding of SDK-valid values, both directions.
    it(`input ${name}: SDK normalization encodes to the driver's bytes and decodes back exactly`, async () => {
      const metrics: Record<string, number> = {}
      await check(`input/${name}`, fc.property(arbitrary(type), raw => {
        const checked = wireValue(type, raw)
        const { value, hits } = known(role, method.name, checked, metrics)
        if (hits.length) expect(() => driver().encodeInput(method.name, stringifyJson(checked))).toThrow()
        const input = hits.length ? value : raw
        const direct = driver().encodeInput(method.name, stringifyJson(input))
        const normalized = wireValue(type, input)
        const bytes = driver().encodeInput(method.name, stringifyJson(normalized))
        expect(bytes).toEqual(direct)
        const decoded = driver().decodeInput(method.name, bytes)
        expect(wireValue(type, decoded)).toEqual(normalized)
        expect(driver().encodeInput(method.name, stringifyJson(decoded))).toEqual(bytes)
        count(metrics, 'encoded')
      }), { examples: examples(type), metrics })
    })

    // Builders: every public write call encodes and keeps exact u64 values.
    if (method.mode === 'write') it(`builder ${name}: immutable args, exact deposits and driver-encodable calls`, async () => {
      const metrics: Record<string, number> = {}
      const target = () => contractFor(role)
      await check(`builder/${name}`, fc.property(arbitrary(type), raw => {
        const call = (buildCall as Function)(role, target(), method.name, raw)
        expect(call.args).toEqual(wireValue(type, raw))
        expect(Object.isFrozen(call.args)).toBe(true)
        expect(typeof call.gasLimit).toBe('bigint')
        const { value, hits } = known(role, method.name, call.args, metrics)
        if (hits.length) {
          expect(() => driver().encodeInput(method.name, stringifyJson(call.args))).toThrow()
          return
        }
        const bytes = driver().encodeInput(method.name, stringifyJson(value))
        expect(wireValue(type, driver().decodeInput(method.name, bytes))).toEqual(call.args)
        const lux = (v: string) => BigInt(v).toString()
        const expected = role === 'store' && ['register', 'renew'].includes(method.name) ? lux(raw.expected_fee_lux)
          : role === 'marketplace' && method.name === 'buy_fixed' ? lux(raw.order.terms.amount_lux)
          : role === 'marketplace' && method.name === 'place_bid' ? lux(raw.amount_lux)
          : role === 'marketplace' && method.name === 'place_offer' ? lux(raw.terms.amount_lux)
          : role === 'marketplace' && method.name === 'renew_escrow' ? lux(raw.renewal.expected_fee_lux) : '0'
        expect(call.deposit).toBe(expected)
        count(metrics, 'encoded')
      }), { metrics })
    })
  }
}
