/** Frozen commit/reveal helpers. @module */
import {
  commitmentHash,
  equalBytes,
  fromHex,
  hex,
  namehash,
} from '../frozen/bytes.ts'
import { u64 } from '../frozen/json.ts'
/** Age in blocks at which a commitment's reveal window opens. */
export const REGISTRATION_MIN_REVEAL_WAIT_BLOCKS = 5n
/** Last age in blocks at which a commitment can be revealed: one day. The window includes both ends. */
export const REGISTRATION_MAX_COMMITMENT_AGE_BLOCKS = 8_640n
/** Most pending commitments one actor can hold in a store. */
export const MAX_PENDING_COMMITMENTS_PER_CONTROLLER = 16
/**
 * What a root registration commits to, as hex: the root's node, the controller's authority and the
 * secret (32 bytes each), and the root label.
 */
export interface RegistrationCommitmentInput {
  node: string
  controller: string
  label: string
  secret: string
}
/** Persist the result before submitting commit; never substitute non-cryptographic randomness. */
export function createRegistrationSecret(): string {
  if (!globalThis.crypto?.getRandomValues)
    throw new Error('Secure randomness unavailable')
  return `0x${hex(globalThis.crypto.getRandomValues(new Uint8Array(32)))}`
}
/**
 * Commitment hash the store's `commit` takes for `input`, as `0x` hex. Throws when `node` is not the
 * namehash of `<label>.dusk`, the label is not canonical, or a value is not 32-byte hex.
 */
export function registrationCommitmentHex(
  input: RegistrationCommitmentInput,
): string {
  const node = fromHex(input.node, 32)
  if (!equalBytes(node, namehash(`${input.label}.dusk`)))
    throw new Error('Root node mismatch')
  return `0x${hex(commitmentHash(fromHex(input.controller, 32), input.label, fromHex(input.secret, 32)))}`
}
/** Where a commitment stands in its reveal window, with the blocks left until it opens and closes. */
export interface RegistrationCommitWindow {
  status: 'missing' | 'future' | 'waiting' | 'ready' | 'stale'
  waitBlocks: bigint
  /** Distance to the last valid reveal block; zero is still ready on that block. */
  staleInBlocks: bigint
}
/**
 * Reveal window of a commitment included at height `committed`, seen at height `current`. Either
 * height missing gives `missing`; a `current` below `committed` gives `future`.
 */
export function registrationCommitWindow(
  committed: bigint | null | undefined,
  current: bigint | null | undefined,
): RegistrationCommitWindow {
  if (committed == null || current == null)
    return { status: 'missing', waitBlocks: 0n, staleInBlocks: 0n }
  const age = u64(current) - u64(committed)
  if (age < 0n)
    return {
      status: 'future',
      waitBlocks: 5n - age,
      staleInBlocks: 8640n - age,
    }
  if (age > 8640n) return { status: 'stale', waitBlocks: 0n, staleInBlocks: 0n }
  return {
    status: age < 5n ? 'waiting' : 'ready',
    waitBlocks: age < 5n ? 5n - age : 0n,
    staleInBlocks: 8640n - age,
  }
}
