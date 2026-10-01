import { expect, it } from 'vitest'
import { routerIssueReservedNameRuntimeCall, toDuskDomainWireArgs, encodeDuskDomainCall, decodedDuskDomainContext, duskDomainCallDepositLux, DUSK_DOMAINS_CONTRACTS } from './calls'

const hex = (byte: number) => `0x${byte.toString(16).padStart(2, '0').repeat(32)}`
const args = { node: hex(1), label: 'wallet', owner: hex(2), manager: hex(3), durationYears: 2 }

it('encodes reserved issuance as an operator router call with no deposit or commitment', () => {
  const call = routerIssueReservedNameRuntimeCall(args)
  expect(call).toMatchObject({ contract: 'router', functionName: 'issue_reserved_name_runtime', kind: 'write' })
  const wire = { node: Array(32).fill(1), label: 'wallet', owner: Array(32).fill(2), manager: Array(32).fill(3), duration_years: 2 }
  expect(toDuskDomainWireArgs(call)).toEqual(wire)
  expect(duskDomainCallDepositLux(call)).toBeUndefined()
  expect(DUSK_DOMAINS_CONTRACTS.router.methodSigs.issue_reserved_name_runtime).toBe('issue_reserved_name_runtime(IssueReservedNameRuntime)')
  expect(decodedDuskDomainContext(call)?.fields).toContainEqual({ label: 'Owner', value: args.owner })
  const driver = {
    encodeInputFn: (name: string, json: string) => {
      expect(name).toBe('issue_reserved_name_runtime')
      expect(JSON.parse(json)).toEqual(wire)
      return new Uint8Array([1, 2])
    },
    decodeOutputFn: () => null,
  }
  expect(encodeDuskDomainCall(driver, call)).toEqual(new Uint8Array([1, 2]))
})

it('rejects malformed issuance authorities and unsafe durations before encoding', () => {
  for (const invalid of [{ ...args, owner: 'bad' }, { ...args, manager: 'bad' }, { ...args, durationYears: -1 }, { ...args, durationYears: Number.MAX_SAFE_INTEGER + 1 }]) {
    expect(() => toDuskDomainWireArgs(routerIssueReservedNameRuntimeCall(invalid))).toThrow()
  }
})
