import { expect, it } from 'vitest'
import { routerSetRegistrationsPausedRuntimeCall, marketplaceSetTradingPausedRuntimeCall, toDuskDomainWireArgs, isRuntimeBoundDuskDomainWrite, decodedDuskDomainContext, encodeDuskDomainCall } from './calls'

for (const [builder, contract, functionName] of [
  [routerSetRegistrationsPausedRuntimeCall, 'router', 'set_registrations_paused_runtime'],
  [marketplaceSetTradingPausedRuntimeCall, 'marketplace', 'set_trading_paused_runtime'],
] as const) {
  it(`encodes ${contract} pause changes and rejects non-boolean wire arguments`, () => {
    for (const paused of [false, true]) {
      const call = builder({ paused })
      expect(call).toEqual({ contract, functionName, kind: 'write', args: { paused } })
      expect(isRuntimeBoundDuskDomainWrite(call)).toBe(true)
      expect(toDuskDomainWireArgs(call)).toEqual({ paused })
      expect(decodedDuskDomainContext(call)?.title).toMatch(paused ? /^Pause/ : /^Resume/)
      expect(encodeDuskDomainCall({ encodeInputFn: (name, json) => {
        expect(name).toBe(functionName)
        expect(JSON.parse(json)).toEqual({ paused })
        return new Uint8Array([1])
      }, decodeOutputFn: () => null }, call)).toEqual(new Uint8Array([1]))
      for (const args of [undefined, {}, { paused: 1 }, { paused: 'false' }, { paused: null }]) {
        expect(() => toDuskDomainWireArgs({ ...call, args })).toThrow('Invalid Dusk Domains')
      }
    }
  })
}
