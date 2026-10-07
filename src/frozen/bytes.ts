/** Byte and frozen identity helpers. @module */
import { blake2b } from '@noble/hashes/blake2.js'
import type {
  Authority,
  Digest,
  NameKey,
  Node,
  TypedPrincipal,
} from './types.ts'
export function hex(bytes: readonly number[] | Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
export function fromHex(value: string, length?: number): number[] {
  const s = value.replace(/^0x/u, '')
  if (
    !/^(?:[\da-fA-F]{2})*$/u.test(s) ||
    (length !== undefined && s.length !== length * 2)
  )
    throw new Error('Invalid hex bytes')
  return Array.from({ length: s.length / 2 }, (_, i) =>
    Number.parseInt(s.slice(i * 2, i * 2 + 2), 16),
  )
}
export function contractId(value: string | readonly number[]): string {
  const b = typeof value === 'string' ? fromHex(value, 32) : value
  if (
    b.length !== 32 ||
    b.some((x) => !Number.isInteger(x) || x < 0 || x > 255) ||
    b.every((x) => x === 0)
  )
    throw new Error('Invalid contract ID')
  return hex(b)
}
export function equalBytes(
  a: readonly number[],
  b: readonly number[],
): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}
export function hash(
  ...parts: (readonly number[] | Uint8Array | string)[]
): Digest {
  const enc = new TextEncoder()
  const arrays = parts.map((p) =>
    typeof p === 'string' ? enc.encode(p) : Uint8Array.from(p),
  )
  const bytes = new Uint8Array(arrays.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of arrays) {
    bytes.set(p, at)
    at += p.length
  }
  return Array.from(blake2b(bytes, { dkLen: 32 }))
}
export function validateLabel(label: string): void {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label))
    throw new Error('Expected a canonical 1–63 byte ASCII label')
}
export function childNode(parent: Node, label: string): Node {
  validateLabel(label)
  return hash(parent, hash(label))
}
export function nameKey(spelling: string): NameKey {
  const labels = spelling.split('.')
  if (labels.length < 2 || labels.length > 5 || labels.at(-1) !== 'dusk')
    throw new Error(
      'Expected a canonical .dusk name with at most three subname labels',
    )
  let node: Node = Array(32).fill(0),
    root: Node = node
  for (const [i, label] of labels.toReversed().entries()) {
    node = childNode(node, label)
    if (i === 1) root = node
  }
  return { root, node }
}
export function namehash(spelling: string): Node {
  return nameKey(spelling).node
}
export function namehashHex(spelling: string): string {
  return hex(namehash(spelling))
}
export function authority(principal: TypedPrincipal): Authority {
  if (principal.kind === 'Contract')
    return fromHex(contractId(principal.bytes), 32)
  if (principal.kind === 'Moonlight' && principal.bytes.length === 96)
    return hash('dusk-domains:runtime-authority:v1', principal.bytes)
  throw new Error('Principal has no frozen v1 authority')
}
export function commitmentHash(
  actor: Authority,
  label: string,
  secret: Digest,
): Digest {
  if (actor.length !== 32 || secret.length !== 32)
    throw new Error('Commitment requires 32-byte authority and secret')
  validateLabel(label)
  return hash(
    'dusk-domains:registration:v1',
    actor,
    namehash(`${label}.dusk`),
    label,
    secret,
  )
}
