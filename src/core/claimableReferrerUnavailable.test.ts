import { expect, it, vi } from 'vitest'
import { coreCompleteRegistrationRuntimeCall } from '../contracts/callBuilders'
import { toDuskDomainWireArgs } from '../contracts/callWireArgs'
import { encodeDuskDomainCall } from '../contracts/calls'
import { isClaimableReferrer, typedPrincipalFromWalletAccount } from './principal'
import { claimableAccount } from './claimableReferrer.test-fixtures'

vi.mock('@noble/curves/bls12-381.js', () => { throw new Error('BLS module unavailable') })

it('keeps encoding synchronous when BLS is unavailable but rejects full validation', async () => {
  const parsed = typedPrincipalFromWalletAccount(claimableAccount)
  if (!parsed.ok) throw new Error(parsed.reason)
  const args = {
    commitment: `0x${'01'.repeat(32)}`,
    secret: `0x${'02'.repeat(32)}`,
    node: `0x${'03'.repeat(32)}`,
    label: 'aurora',
    durationYears: 1,
    feeLux: 10_000_000_000,
    records: [],
    referrer: parsed.principal,
  }
  const call = coreCompleteRegistrationRuntimeCall(args)
  expect(call.args.referrer).toEqual(parsed.principal)
  expect(toDuskDomainWireArgs(call)).toMatchObject({ referrer: parsed.principal })
  const driver = { encodeInputFn: (_name: string, json: string) => new TextEncoder().encode(json), decodeOutputFn: () => null }
  const encoded = encodeDuskDomainCall(driver, call)
  expect(encoded).toBeInstanceOf(Uint8Array)
  expect(JSON.parse(new TextDecoder().decode(encoded))).toMatchObject({ referrer: parsed.principal })
  await expect(isClaimableReferrer(parsed.principal)).rejects.toThrow()
})
