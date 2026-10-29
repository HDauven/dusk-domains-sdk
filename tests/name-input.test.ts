/**
 * The name rules of `./names`, on the cases of the apps they replace: the web wallet's isDuskName,
 * asDuskName and nameSuggest specs, the extension's duskNames and nameSuggest tests, the bridge's
 * recipient tests and the explorer's name check.
 */
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { asDuskName, closeDuskName, isDuskName, nameProblem, nameToShow, toDuskName, validateName } from '../src/names.ts'

const ACCOUNT =
  '26FCH745YG5eTfL1CF7ExhifgcANFUvDTXtVPRz1MwNya7Lu23RnDZBYFLZUY6BRXnZhrhtb48Ax2Lsz3dQUX62mXaU4XRAoKm7qB9nFWpNNfhUDUVFo4teoosnwwJTck927'
const ADDRESS = '47jNTgAhzn9KCKF3msCfvKg3k1P1QpPCLZ3HG3AoNp87sQ5WNS3QyjckYHWeuXqW7uvLmbKgejpP8Xkcip89vnMM'

describe('isDuskName', () => {
  it('takes input ending in .dusk for a name, whatever its case, spacing or validity', () => {
    for (const input of ['alice.dusk', 'pay.alice.dusk', ' Alice.DUSK\n', 'bad_name.dusk', 'bad name.dusk', '.dusk'])
      expect(isDuskName(input), input).toBe(true)
  })

  it('leaves addresses, dusk: links and any other input to the address checks', () => {
    for (const input of ['', 'dusk', 'alice', 'alicedusk', 'alice.dus', 'alice.duskx', 'alice.dusk.network', ACCOUNT, ADDRESS,
      `dusk:public-${ACCOUNT}`, 'dusk:alice.dusk', ' DUSK:alice.dusk', null, undefined])
      expect(isDuskName(input as string), String(input)).toBe(false)
  })
})

describe('toDuskName and nameProblem', () => {
  it('give the canonical name a typed one means, and nothing for anything else', () => {
    expect([' Alice.dusk ', 'ALICE.DUSK', 'pay.alice.dusk', 'a.dusk', '0.dusk'].map(toDuskName)).toEqual([
      'alice.dusk', 'alice.dusk', 'pay.alice.dusk', 'a.dusk', '0.dusk',
    ])
    for (const typed of ['alice', 'bad_name.dusk', '-alice.dusk', 'a.b.c.d.e.dusk', 'dusk:alice.dusk', '21n5nc', '', ' Klice.dusk'])
      expect(toDuskName(typed), typed).toBeNull()
  })

  it('say what is wrong with a name, the first that applies', () => {
    expect(
      Object.fromEntries(
        ['alice.dusk', '', 'alice', 'alice.dus', 'bad_name.dusk', 'Bad_Name.dusk', 'café.dusk', 'a b.dusk', '-alice.dusk', 'alice-.dusk',
          'sub.-x.dusk', '-a_b.dusk', `${'a'.repeat(64)}.dusk`, '.dusk', 'a..dusk', 'a.b.c.d.e.dusk', 'a.b.c.d.dusk'].map((n) => [n, nameProblem(n)]),
      ),
    ).toEqual({
      'alice.dusk': null, '': 'empty', alice: 'suffix', 'alice.dus': 'suffix', 'bad_name.dusk': 'characters', 'Bad_Name.dusk': 'characters',
      'café.dusk': 'characters', 'a b.dusk': 'characters', '-alice.dusk': 'hyphen', 'alice-.dusk': 'hyphen', 'sub.-x.dusk': 'hyphen',
      '-a_b.dusk': 'characters', [`${'a'.repeat(64)}.dusk`]: 'length', '.dusk': 'length', 'a..dusk': 'length', 'a.b.c.d.e.dusk': 'depth',
      'a.b.c.d.dusk': null,
    })
  })

  it("agree with validateName on every name typed with .dusk, the bridge's cases included", () => {
    const agrees = (name: string) =>
      (nameProblem(name) === null) === (/\.dusk$/u.test(name.trim().replace(/[A-Z]/gu, (c) => c.toLowerCase())) && validateName(name).ok)
    for (const name of ['alice.dusk', 'a.dusk', '0.dusk', 'wallet-both.dusk', 'al--ice.dusk', 'sub.alice.dusk', 'a.b.c.d.dusk', 'a.b.c.d.e.dusk',
      `${'x'.repeat(63)}.dusk`, `${'x'.repeat(64)}.dusk`, 'bad_name.dusk', '-alice.dusk', 'alice-.dusk', 'café.dusk', 'alice.dusk.dusk',
      'dusk.dusk', 'a_b.c.dusk', 'sub.-x.dusk', '1-2-3.dusk', 'alice.dus', 'alice', 'K.dusk'])
      expect(agrees(name), name).toBe(true)
    fc.assert(
      fc.property(fc.array(fc.constantFrom('a', 'Z', '0', '-', '.', '_', ' ', 'é', '.dusk', 'dusk'), { maxLength: 24 }), (parts) =>
        agrees(parts.join('')),
      ),
      { seed: 20261029, numRuns: 2000 },
    )
  })
})

describe('asDuskName', () => {
  it('offers the .dusk name a name typed without its ending, or with dots after it, likely means', () => {
    expect(
      ['alice', 'alice.', ' Alice \n', 'alice.dusk.', 'alice.dusk', 'pay.alice', 'shop.alice', 'wallet-both', 'a-1', 'a.b.c.d'].map(asDuskName),
    ).toEqual([
      'alice.dusk', 'alice.dusk', 'alice.dusk', 'alice.dusk', 'alice.dusk', 'pay.alice.dusk', 'shop.alice.dusk', 'wallet-both.dusk', 'a-1.dusk',
      'a.b.c.d.dusk',
    ])
  })

  it('offers nothing for what cannot be a name, or reads as an address', () => {
    for (const typed of ['', '.', 'dusk', '-alice', 'alice-', 'bad_name', 'al_ice', 'a..b', 'a.b.c.d.e', 'x'.repeat(64), 'aLice', 'ALICE.DUSK.',
      '0x', '0xab84', '0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a', '0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A', ACCOUNT, ADDRESS,
      '47jNTgAhzn9KCKF3ms', '21n5ncyuJkRr9', 'not an account', 'Klice'])
      expect(asDuskName(typed), typed).toBeNull()
  })
})

describe('closeDuskName', () => {
  it('suggests the closest known name one or two edits away, a swap of neighbours counting as one', () => {
    const known = ['wallet-both.dusk', 'Alice.dusk', 'alice-shop.dusk', 'bram.dusk']
    expect(['alcie.dusk', 'alise.dusk', 'ALCIE.dusk', 'alic.dusk', 'alicee.dusk', 'elise.dusk'].map((t) => closeDuskName(t, known))).toEqual([
      'alice.dusk', 'alice.dusk', 'alice.dusk', 'alice.dusk', 'alice.dusk', 'alice.dusk',
    ])
    expect(closeDuskName('ALICE-SHOPP.dusk', known)).toBe('alice-shop.dusk')
    expect(closeDuskName('alice-shpo.dusk', known)).toBe('alice-shop.dusk')
    expect(closeDuskName('walet-bth.dusk', known)).toBe('wallet-both.dusk')
  })

  it('allows one edit for short names, and suggests nothing far off, the same name or what is no name', () => {
    expect(closeDuskName('bran.dusk', ['bram.dusk'])).toBe('bram.dusk')
    expect(closeDuskName('bbo.dusk', ['bob.dusk'])).toBe('bob.dusk')
    for (const typed of ['brxx.dusk', 'bxx.dusk', 'charlie.dusk', 'carol.dusk', 'bob.dusk', '.dusk', ''])
      expect(closeDuskName(typed, ['bram.dusk', 'bob.dusk']), typed).toBeNull()
    expect(closeDuskName('alcie.dusk', ['alic_e.dusk', '-alice.dusk', 'Alice .dusk', ' '])).toBeNull()
    // The first of the closest, in the order given.
    expect(closeDuskName('bob.dusk', ['bab.dusk', 'bub.dusk'])).toBe('bab.dusk')
  })
})

describe('nameToShow', () => {
  it('shows a canonical name of at most 24 characters with no label like key material', () => {
    for (const name of ['alice.dusk', 'domains.dusk', 'pay.alice.dusk', `${'a'.repeat(19)}.dusk`, 'abcdefghijklmnop.dusk', '0123456789012345.dusk'])
      expect(nameToShow(name), name).toBe(name)
    for (const name of [`${'a'.repeat(20)}.dusk`, 'Alice.dusk', ' alice.dusk', 'alice', 'bad_name.dusk', '0x12ab.dusk', '0x.dusk',
      'abc123def456ghi7.dusk', 'pay.26fch745yg5etfl1.dusk', null, 42, undefined])
      expect(nameToShow(name), String(name)).toBeNull()
    expect(nameToShow(`${'a'.repeat(30)}.dusk`, 40)).toBe(`${'a'.repeat(30)}.dusk`)
  })
})
