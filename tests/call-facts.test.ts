/**
 * Call facts (`./call-facts`) and the pinned releases (`./releases`): on real testnet calls
 * (fixtures/testnet-registrations.json), on registrations the store's own driver encodes, and on the
 * apps' cases they replace (web wallet knownContracts and reservedNames, extension knownCalls,
 * explorer describeCall).
 */
import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { nameCall, revealsReservation, type ContractCall } from '../src/call-facts.ts'
import { PINNED_RELEASES, contractRole, releaseFor } from '../src/releases.ts'
import { authority, commitmentHash, fromHex, hex, namehashHex } from '../src/frozen/bytes.ts'
import { loadDataDriver } from '../src/frozen/driver.ts'
import { stringifyJson } from '../src/frozen/json.ts'
import { lensInitCommitment } from '../src/frozen/lens.ts'
import { validateReleaseManifest } from '../src/frozen/manifest.ts'
import { wireValue } from '../src/frozen/wire.ts'
import { decodeBase58 } from '../src/core/base58.ts'
import { driverBytes, sample } from './helpers.ts'

type Call = ContractCall & { name: string | null; hash: string; sender: string; data: string }
const fixture = JSON.parse(readFileSync(new URL('fixtures/testnet-registrations.json', import.meta.url), 'utf8')) as {
  registrations: Call[]
  reservations: Call[]
  issues: Call[]
}
const { registrations, reservations, issues } = fixture
const call = (c: Call, args: ContractCall['args'] = c.data): ContractCall => ({ contractId: c.contractId, fnName: c.fnName, args })
const registrationOf = (name: string) => registrations.find((c) => c.name === name)!
const bytesOf = (data: string) => Uint8Array.from(fromHex(data))
const STORE = registrations[0].contractId
const [operator, alice] = [registrations[0].sender, registrationOf('alice.dusk').sender]

describe('the pinned releases', () => {
  it("know each network's contracts by role, the lens included, on that network only", () => {
    for (const [network, other] of [['mainnet', 'testnet'], ['testnet', 'mainnet']] as const) {
      const release = PINNED_RELEASES[network]
      expect(release.contracts.map((c) => c.role).sort()).toEqual(['directory', 'marketplace', 'policy', 'resolver', 'store', 'vault'])
      for (const c of [...release.contracts, release.lens]) {
        expect(contractRole(c.contractId, network)).toBe(c.role)
        expect(contractRole(` 0x${c.contractId.toUpperCase()} `, release.chainId)).toBe(c.role)
        expect(contractRole(c.contractId, other)).toBeUndefined()
      }
    }
    expect(contractRole(STORE, 'testnet')).toBe('store')
    // Another contract, a devnet, a local node, or before the node said which network it is on.
    expect(contractRole('ab'.repeat(32), 'testnet')).toBeUndefined()
    for (const network of [3, 0, 'devnet', 'dusk:3', 'Testnet', '', Number.NaN, undefined as unknown as string])
      expect(contractRole(STORE, network)).toBeUndefined()
    for (const id of ['', 'toString', '__proto__']) expect(contractRole(id, 'testnet')).toBeUndefined()
  })

  it('find a network by its name, CAIP-2 chain ID or chain ID, and cannot be changed', () => {
    for (const [network, chain] of [['mainnet', 1], ['testnet', 2]] as const) {
      expect(releaseFor(network)).toBe(PINNED_RELEASES[network])
      expect(releaseFor(`dusk:${chain}`)).toBe(PINNED_RELEASES[network])
      expect(releaseFor(chain)).toBe(PINNED_RELEASES[network])
    }
    const release = PINNED_RELEASES.testnet
    expect(() => {
      ;(release.contracts as { contractId: string }[])[0].contractId = 'ab'.repeat(32)
    }).toThrow()
    expect(() => (release.contracts as unknown[]).push({})).toThrow()
    expect(Object.isFrozen(release.lens.dataDriver)).toBe(true)
  })

  it('are releases the light reader takes, bound to their own directory by the lens driver they pin', async () => {
    const lens = new Uint8Array(gunzipSync(readFileSync(new URL('fixtures/lens.wasm.gz', import.meta.url))))
    const driver = await loadDataDriver(lens)
    for (const [network, byte] of [['mainnet', 1], ['testnet', 2]] as const) {
      const release = PINNED_RELEASES[network]
      const manifest = validateReleaseManifest(release, { nodeUrl: 'https://node.invalid', indexerUrl: 'https://node.invalid' })
      expect(manifest).toMatchObject({ network: byte, chainId: release.chainId })
      expect(release.artifactBaseUrl).toBe(`${release.site}/`)
      expect(release.lens.dataDriver.sha256).toBe(createHash('sha256').update(lens).digest('hex'))
      const directory = release.contracts.find((c) => c.role === 'directory')!.contractId
      expect(lensInitCommitment(driver, directory)).toBe(release.lens.initHash)
    }
  })
})

describe('a call to Dusk Domains', () => {
  it.each(registrations.map((c) => [c.name, c]))('reads %s from its testnet registration, as the store checks it', async (name, c) => {
    const read = (args: ContractCall['args']) => nameCall(call(c, args), 'testnet')
    // As the archive gives them, and as a site sends them.
    for (const args of [c.data, `0x${c.data.toUpperCase()}`, bytesOf(c.data), Array.from(bytesOf(c.data))])
      expect(read(args)).toEqual({ role: 'store', kind: 'registration', name, reservation: null })
    // The store's own driver reads the same label and node from them.
    const store = await loadDataDriver(driverBytes('store'))
    expect(store.decodeInput('register', bytesOf(c.data))).toMatchObject({ label: name!.slice(0, -5), node: fromHex(namehashHex(name!)) })
  })

  it('reads labels of up to 7 bytes in place and longer ones before the arguments, from real calls', () => {
    const lengthByte = (name: string) => bytesOf(registrationOf(name).data).at(-304 + 32 + 7)!
    expect(['21x.dusk', 'bitvavo.dusk', 'domains.dusk'].map(lengthByte)).toEqual([3, 7, 7])
    for (const name of ['shpongle.dusk', 'lumenpay.dusk', 'devtest-20261005-003555.dusk']) expect(lengthByte(name)).toBeGreaterThanOrEqual(0x80)
  })

  it("reads the name of every registration the store's driver encodes, at any label length", async () => {
    const store = await loadDataDriver(driverBytes('store'))
    const base = sample('Register'),
      key = Array.from(decodeBase58(operator)!),
      secret = Array(32).fill(9)
    for (const label of ['a', '0', 'ab', 'abcdefg', 'abcdefgh', 'a-b', 'x'.repeat(63), `${'9'.repeat(30)}-${'z'.repeat(32)}`])
      for (const extras of [{}, { referrer: null, records: [], primary: null }]) {
        const commitment = commitmentHash(authority({ kind: 'Moonlight', bytes: key }), label, secret)
        const json = { ...base, ...extras, label, node: fromHex(namehashHex(`${label}.dusk`)), commitment, secret }
        const args = store.encodeInput('register', stringifyJson(wireValue('Register', json)))
        expect(nameCall({ contractId: STORE, fnName: 'register', args }, 'testnet', operator), label).toEqual({
          role: 'store', kind: 'registration', name: `${label}.dusk`, reservation: hex(commitment),
        })
      }
  })

  it("reads no name from arguments that don't read exactly, or that name another node", () => {
    const longer = registrationOf('alice-shop.dusk'),
      shorter = registrationOf('alice.dusk')
    const changed = (c: Call, change: (args: Uint8Array, root: number) => void) => {
      const args = bytesOf(c.data)
      change(args, args.length - 304)
      return nameCall(call(c, args), 'testnet')?.name
    }
    for (const args of ['', 'zz', 'xyz', longer.data.slice(0, -2), longer.data.slice(2), `00${longer.data}`, [256], [-1]])
      expect(nameCall(call(longer, args as string), 'testnet')?.name).toBeNull()
    expect(nameCall({ contractId: STORE, fnName: 'register' }, 'testnet')?.name).toBeNull()
    // "alice" spelled "Alice" or "alicf", which is not the name its node was made from.
    expect(changed(shorter, (a, root) => (a[root + 32] = 0x41))).toBeNull()
    expect(changed(shorter, (a, root) => (a[root + 36] = 0x66))).toBeNull()
    // Kept in place, but longer than the place holds; kept out of place, but pointing past the root or
    // before the arguments.
    expect(changed(shorter, (a, root) => (a[root + 39] = 8))).toBeNull()
    const view = (a: Uint8Array) => new DataView(a.buffer, a.byteOffset)
    expect(changed(longer, (a, root) => view(a).setInt32(root + 36, 4, true))).toBeNull()
    expect(changed(longer, (a, root) => view(a).setInt32(root + 36, -root - 64, true))).toBeNull()
    // A label with a space, or a capital, read out of place.
    expect(changed(longer, (a) => (a[3] = 0x20))).toBeNull()
    expect(changed(longer, (a) => (a[0] = 0x41))).toBeNull()
  })

  it('reads no label from where the encoding never puts one, even a label whose node the call names', () => {
    const forged = (c: Call, change: (args: Uint8Array, root: number) => string) => {
      const args = bytesOf(c.data),
        root = args.length - 304,
        label = change(args, root)
      args.set(fromHex(namehashHex(`${label}.dusk`)), root)
      return nameCall(call(c, args), 'testnet')?.name
    }
    // Kept in place but longer than its place, its length byte a digit: it would run on into the arguments.
    expect(forged(registrationOf('alice.dusk'), (a, root) => {
      const label = `abcdefg0${'x'.repeat(40)}`
      a.set(Array.from(label, (ch) => ch.charCodeAt(0)), root + 32)
      return label
    })).toBeNull()
    // Kept out of place, but running into the arguments' own fields: its last character the first byte
    // of the node it hashes to.
    const digits = 'abcdefghijklmnopqrstuvwxyz0123456789'
    const label = Array.from({ length: 64 }, (_, i) => [...digits].map((c) => `overlap${i}${c}`)).flat()
      .find((l) => fromHex(namehashHex(`${l}.dusk`))[0] === l.charCodeAt(l.length - 1))!
    expect(forged(registrationOf('alice-shop.dusk'), (a, root) => {
      const view = new DataView(a.buffer, a.byteOffset)
      a.set(Array.from(label.slice(0, -1), (ch) => ch.charCodeAt(0)), root - label.length + 1)
      view.setUint32(root + 32, label.length, true)
      view.setInt32(root + 36, -label.length + 1 - 32, true)
      return label
    })).toBeNull()
  })

  it('is only a Dusk Domains contract on its own network', () => {
    const [c] = registrations
    expect(nameCall(call(c), 'mainnet')).toBeNull()
    expect(nameCall(call(c), 'devnet')).toBeNull()
    expect(nameCall({ ...call(c), contractId: 'ab'.repeat(32) }, 'testnet')).toBeNull()
    expect(nameCall({ ...call(c), contractId: `0x${STORE.toUpperCase()}` }, 2)).toMatchObject({ kind: 'registration', name: c.name })
  })

  it("says what a store call does, and nothing for other contracts' functions or inherited keys", () => {
    const kind = (fnName: string, contractId = STORE) => nameCall({ contractId, fnName }, 'testnet')?.kind
    expect(
      ['commit', 'register', 'renew', 'issue_reserved', 'create_subname', 'mutate_records', 'replace_records', 'set_primary', 'clear_primary'].map((fn) => kind(fn)),
    ).toEqual(['reservation', 'registration', 'renewal', 'issue', 'subname', 'records', 'records', 'primary-set', 'primary-cleared'])
    for (const fn of ['transfer_and_call', 'update_authorities', 'toString', '__proto__', ' register', '']) expect(kind(fn)).toBe('other')
    const vault = PINNED_RELEASES.testnet.contracts.find((c) => c.role === 'vault')!.contractId
    expect(nameCall({ contractId: vault, fnName: 'register' }, 'testnet')).toEqual({ role: 'vault', kind: 'other' })
    expect(nameCall({ contractId: PINNED_RELEASES.testnet.lens.contractId, fnName: 'resolve' }, 'testnet')).toEqual({ role: 'lens', kind: 'other' })
    for (const c of issues) expect(nameCall(call(c), 'testnet', c.sender)).toEqual({ role: 'store', kind: 'issue' })
  })
})

describe("a name's reservation and its registration", () => {
  const named = reservations.filter((c) => c.name)
  it.each(named.map((c) => [c.name, c]))('match for %s, sent by the account that sent both', (name, reservation) => {
    const registration = registrationOf(name!)
    const made = nameCall(call(reservation), 'testnet'),
      revealed = nameCall(call(registration), 'testnet', reservation.sender)
    expect(made).toEqual({ role: 'store', kind: 'reservation', reservation: reservation.data })
    expect(revealed?.reservation).toBe(reservation.data)
    expect(revealsReservation(revealed, made)).toBe(true)
    expect(revealsReservation(made, revealed)).toBe(false)
    // As a site sends them.
    expect(nameCall(call(reservation, bytesOf(reservation.data)), 'testnet')).toEqual(made)
  })

  it("match nothing for another account, a changed byte, another name's reservation or arguments that don't read", () => {
    const reservation = reservations.find((c) => c.name === 'dawn.dusk')!,
      registration = registrationOf('dawn.dusk')
    const made = nameCall(call(reservation), 'testnet')
    for (const sender of [alice, '', undefined, 'not an account', registration.data])
      expect(nameCall(call(registration), 'testnet', sender)).toMatchObject({ name: 'dawn.dusk', reservation: null })
    const secret = bytesOf(registration.data)
    secret[secret.length - 304 + 73] ^= 1
    expect(nameCall(call(registration, secret), 'testnet', operator)).toMatchObject({ name: 'dawn.dusk', reservation: null })
    // Every other reservation, the one of a name these registrations don't hold included.
    const revealed = nameCall(call(registration), 'testnet', operator)
    for (const other of reservations.filter((c) => c !== reservation))
      expect(revealsReservation(revealed, nameCall(call(other), 'testnet'))).toBe(false)
    expect(reservations.some((c) => c.name === null)).toBe(true)
    for (const args of [`${reservation.data}00`, reservation.data.slice(2), 'zz', ''])
      expect(nameCall(call(reservation, args), 'testnet')).toEqual({ role: 'store', kind: 'reservation', reservation: null })
    expect(revealsReservation(nameCall(call(registration), 'testnet'), nameCall(call(reservation, ''), 'testnet'))).toBe(false)
    expect(revealsReservation(null, made)).toBe(false)
    expect(revealsReservation(revealed, undefined)).toBe(false)
  })
})
