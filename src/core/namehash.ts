import { blake2b } from '@noble/hashes/blake2.js'
import { bytesToHex, concatBytes, utf8ToBytes } from '@noble/hashes/utils.js'
import { validateName } from './namePolicy'

export const NAMEHASH_BYTES = 32
export const EMPTY_NAMEHASH: Uint8Array = new Uint8Array(NAMEHASH_BYTES)

export type NamehashResult = {
  canonicalName: string
  node: Uint8Array
  hex: string
}

export function labelhash(label: string): Uint8Array {
  return blake2b(utf8ToBytes(label), { dkLen: NAMEHASH_BYTES })
}

export function namehash(name: string): NamehashResult {
  const validation = validateName(name)

  if (!validation.ok) {
    const reasons = validation.issues.map((issue) => issue.text).join(' ')
    throw new Error(`Cannot namehash invalid .dusk name. ${reasons}`)
  }

  let node = EMPTY_NAMEHASH

  for (const label of validation.name.labels.toReversed()) {
    node = blake2b(concatBytes(node, labelhash(label)), { dkLen: NAMEHASH_BYTES })
  }

  return {
    canonicalName: validation.name.canonical,
    node,
    hex: `0x${bytesToHex(node)}`,
  }
}

export function namehashHex(name: string): string {
  return namehash(name).hex
}
