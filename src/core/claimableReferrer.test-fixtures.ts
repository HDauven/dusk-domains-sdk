import { decodeBase58, type DuskPrincipal } from './principal'

export const claimableAccount = '24bfNr8MDUo5xJBecmeGzXDEraax4Cmbnhjyyt5GaL1Vbe6H48ZSYTpmjRDcFRDFzgzuePAPUNcdGMnBzBQBk4zAMgBCtPsY27tBJtKmB1st6qcmpzRR4Er5imxrzvMRnfWc'

// Mirror the flag, coordinate-boundary and off-curve vectors in the protocol's
// dusk-domains-types/src/principals.rs tests. Keep these independent of SDK constants.
const modulus = Array.from(Buffer.from('1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab', 'hex'))

export const referrerShapeVectors: { name: string; principal: DuskPrincipal | null | undefined; shape: boolean }[] = [
  { name: 'missing', principal: undefined, shape: false },
  { name: 'empty', principal: null, shape: false },
  { name: 'runtime Moonlight', principal: { kind: 'Moonlight', bytes: Array.from(decodeBase58(claimableAccount)!) }, shape: true },
  { name: 'contract', principal: { kind: 'Contract', bytes: Array(32).fill(9) }, shape: true },
  { name: 'contract with zero bytes', principal: { kind: 'Contract', bytes: [1, ...Array(31).fill(0)] }, shape: true },
  { name: 'zero contract', principal: { kind: 'Contract', bytes: Array(32).fill(0) }, shape: false },
  { name: 'short contract', principal: { kind: 'Contract', bytes: Array(31).fill(9) }, shape: false },
  { name: 'long contract', principal: { kind: 'Contract', bytes: Array(33).fill(9) }, shape: false },
  { name: 'sparse contract', principal: { kind: 'Contract', bytes: [9, ...Array(30).fill(0)].concat(Array(1)) }, shape: false },
  { name: 'Phoenix', principal: { kind: 'Phoenix', bytes: Array(32).fill(7) }, shape: false },
  { name: 'raw Moonlight', principal: { kind: 'Moonlight', bytes: Array(193).fill(7) }, shape: false },
  { name: 'short Moonlight', principal: { kind: 'Moonlight', bytes: Array(95).fill(0) }, shape: false },
  { name: 'long Moonlight', principal: { kind: 'Moonlight', bytes: [0x80, ...Array(96).fill(0)] }, shape: false },
  { name: 'uncompressed Moonlight', principal: { kind: 'Moonlight', bytes: Array(96).fill(7) }, shape: false },
  { name: 'out-of-subgroup Moonlight', principal: { kind: 'Moonlight', bytes: [0x80, ...Array(94).fill(0), 2] }, shape: true },
]

for (const flags of [0x00, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xe0]) {
  referrerShapeVectors.push({
    name: `Moonlight flags ${flags.toString(16)}`,
    principal: { kind: 'Moonlight', bytes: [flags, ...Array(95).fill(0)] },
    shape: flags === 0x80 || flags === 0xa0,
  })
}

for (const offset of [0, 48]) {
  for (const lastByte of [0xaa, 0xab, 0xac]) {
    const bytes = Array(96).fill(0)
    bytes.splice(offset, 48, ...modulus)
    bytes[offset + 47] = lastByte
    bytes[0] |= 0xa0
    referrerShapeVectors.push({
      name: `coordinate ${offset / 48} modulus ${lastByte - 0xab}`,
      principal: { kind: 'Moonlight', bytes },
      shape: lastByte === 0xaa,
    })
  }
}
