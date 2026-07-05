import { blake2b } from '@noble/hashes/blake2.js'
import { bytesToHex, concatBytes, utf8ToBytes } from '@noble/hashes/utils.js'

export type RegistrationCommitmentInput = {
  node: string
  controller: string
  label: string
  secret: string
}

export const REGISTRATION_MIN_REVEAL_WAIT_BLOCKS = 5
export const REGISTRATION_MAX_COMMITMENT_AGE_BLOCKS = 8_640

export type RegistrationCommitWindow =
  | {
      status: 'missing'
      waitBlocks: 0
      staleInBlocks: 0
    }
  | {
      status: 'waiting'
      waitBlocks: number
      staleInBlocks: number
    }
  | {
      status: 'ready'
      waitBlocks: 0
      staleInBlocks: number
    }
  | {
      status: 'stale'
      waitBlocks: 0
      staleInBlocks: 0
    }

export function createRegistrationSecret(): string {
  const bytes = new Uint8Array(32)

  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure randomness is required to prepare a registration commitment.')
  }

  globalThis.crypto.getRandomValues(bytes)
  return `0x${bytesToHex(bytes)}`
}

export function registrationCommitmentHex(input: RegistrationCommitmentInput): string {
  const material = concatBytes(
    utf8ToBytes('dusk-domains:registration:v1'),
    bytes32(input.controller, 'controller'),
    bytes32(input.node, 'node'),
    utf8ToBytes(input.label.trim().toLowerCase()),
    bytes32(input.secret, 'secret'),
  )

  return `0x${bytesToHex(blake2b(material, { dkLen: 32 }))}`
}

function bytes32(value: string, label: string): Uint8Array {
  const hex = value.trim().toLowerCase().replace(/^0x/u, '')
  if (!/^[a-f0-9]{64}$/u.test(hex)) {
    throw new Error(`${label} must be a 32-byte hex string.`)
  }
  return Uint8Array.from({ length: 32 }, (_, index) => Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16))
}

export function registrationCommitWindow(
  committedBlockHeight: number | null | undefined,
  currentBlockHeight: number | null | undefined,
): RegistrationCommitWindow {
  if (!isBlockHeight(committedBlockHeight) || !isBlockHeight(currentBlockHeight)) {
    return {
      status: 'missing',
      waitBlocks: 0,
      staleInBlocks: 0,
    }
  }

  const age = Math.max(0, currentBlockHeight - committedBlockHeight)

  if (age > REGISTRATION_MAX_COMMITMENT_AGE_BLOCKS) {
    return {
      status: 'stale',
      waitBlocks: 0,
      staleInBlocks: 0,
    }
  }

  if (age < REGISTRATION_MIN_REVEAL_WAIT_BLOCKS) {
    return {
      status: 'waiting',
      waitBlocks: REGISTRATION_MIN_REVEAL_WAIT_BLOCKS - age,
      staleInBlocks: REGISTRATION_MAX_COMMITMENT_AGE_BLOCKS - age,
    }
  }

  return {
    status: 'ready',
    waitBlocks: 0,
    staleInBlocks: REGISTRATION_MAX_COMMITMENT_AGE_BLOCKS - age,
  }
}

function isBlockHeight(value: number | null | undefined): value is number {
  return Number.isInteger(value) && Number(value) >= 0
}
