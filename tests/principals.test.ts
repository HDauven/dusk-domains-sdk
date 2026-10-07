import { expect, it } from 'vitest'
import { bls12_381 } from '@noble/curves/bls12-381.js'
import {
  contractPrincipal,
  contractPrincipalFromWalletAccount,
  typedPrincipalFromWalletAccount,
  decodeBase58,
  encodeBase58,
  isMoonlightEndpoint,
  hasClaimableReferrerShape,
  isClaimableReferrer,
  principalKey,
  principalLabel,
  principalShortValue,
  authorityHexFromPublicSender,
} from '../src/core/principal.ts'
import { bytes, id } from './helpers.ts'
const endpoint = bls12_381.G2.Point.BASE.toBytes()
it.each(
  [[0], [0, 0], [0, 1], [0, 0, 255], [1], [255], Array(96).fill(7)].map(
    (value) => ({ value }),
  ),
)('Base58 preserves leading zeroes $value', ({ value }) =>
  expect(Array.from(decodeBase58(encodeBase58(value))!)).toEqual(value),
)
it.each(['', '0', 'O', 'I', 'l', 'abc 123', '1'.repeat(513)])(
  'rejects invalid Base58 %j',
  (value) => expect(decodeBase58(value)).toBeNull(),
)
it('encodes empty bytes as empty text, without introducing a zero', () =>
  expect(encodeBase58([])).toBe(''))
it('parses canonical public wallet accounts and derives authority', () => {
  const account = encodeBase58(endpoint),
    typed = typedPrincipalFromWalletAccount(account)
  expect(typed).toEqual({
    ok: true,
    principal: { kind: 'Moonlight', bytes: Array.from(endpoint) },
    source: 'moonlight_account',
  })
  expect(contractPrincipalFromWalletAccount(account)).toEqual({
    ok: true,
    principal: authorityHexFromPublicSender(endpoint),
    source: 'moonlight_account',
  })
})
it('ports the 0.2 wallet authority vector', () => {
  expect(
    contractPrincipalFromWalletAccount(
      '24bfNr8MDUo5xJBecmeGzXDEraax4Cmbnhjyyt5GaL1Vbe6H48ZSYTpmjRDcFRDFzgzuePAPUNcdGMnBzBQBk4zAMgBCtPsY27tBJtKmB1st6qcmpzRR4Er5imxrzvMRnfWc',
    ),
  ).toEqual({
    ok: true,
    principal:
      '0xfa95da9c6c860cc3d5506de45b01ea84b9d2cad24a23be36003e505222d8d644',
    source: 'moonlight_account',
  })
})
it('distinguishes contract IDs from bare legacy authority bytes', () => {
  expect(typedPrincipalFromWalletAccount(`contract:0x${id(2)}`)).toEqual({
    ok: true,
    principal: contractPrincipal(id(2)),
    source: 'contract_id',
  })
  expect(typedPrincipalFromWalletAccount(`0x${id(2)}`)).toMatchObject({
    ok: false,
    reason: 'ambiguous_principal',
  })
  expect(typedPrincipalFromWalletAccount(`contract:0x${id(0)}`)).toMatchObject({
    ok: false,
  })
})
it.each([95, 97, 193, 32])(
  'rejects uncompressed/wrong-length %s byte wallet accounts',
  (length) =>
    expect(
      typedPrincipalFromWalletAccount(encodeBase58(bytes(7, length))),
    ).toMatchObject({ ok: false }),
)
it('distinguishes cheap claimable shape from full curve validation', () => {
  const shape = {
    kind: 'Moonlight' as const,
    bytes: [0x80, ...Array(95).fill(0)],
  }
  expect(hasClaimableReferrerShape(shape)).toBe(true)
  expect(isClaimableReferrer(shape)).toBe(false)
  expect(isMoonlightEndpoint(endpoint)).toBe(true)
  expect(isClaimableReferrer({ kind: 'Phoenix', bytes: bytes(1) })).toBe(false)
  expect(isClaimableReferrer(contractPrincipal(id(2)))).toBe(true)
})
it.each([0, 0x40, 0xc0])('rejects compressed flag %s', (flag) => {
  const b = Array.from(endpoint)
  b[0] = (b[0] & 0x3f) | flag
  expect(isMoonlightEndpoint(b)).toBe(false)
})
it('keys match the projection and labels contain only protocol kind', () => {
  const p = contractPrincipal(id(2))
  expect(principalKey(p)).toBe(`Contract:${id(2)}`)
  expect(principalLabel(p)).toBe('Contract')
  expect(principalShortValue(p)).toBe('0x02020202...020202')
  expect(principalKey(null)).toBe('')
})
