import { sha256 } from '@noble/hashes/sha2.js'
import { keccak_256 } from '@noble/hashes/sha3.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'

const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const bech32Alphabet = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
const bech32Generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]

function decodeBase58(value) {
  let number = 0n
  for (const character of value) {
    const digit = base58Alphabet.indexOf(character)
    if (digit < 0) return null
    number = number * 58n + BigInt(digit)
  }
  const bytes = []
  while (number > 0n) {
    bytes.push(Number(number & 255n))
    number >>= 8n
  }
  for (const character of value) {
    if (character !== '1') break
    bytes.push(0)
  }
  return Uint8Array.from(bytes.reverse())
}

export function checksumEthereumAddress(value) {
  const hex = value.slice(2).toLowerCase()
  const hash = bytesToHex(keccak_256(utf8ToBytes(hex)))
  return `0x${[...hex].map((character, index) => Number.parseInt(hash[index], 16) >= 8 ? character.toUpperCase() : character).join('')}`
}

export function validateEthereumAddress(value) {
  if (/^0x[0-9a-fA-F]{40}$/.test(value)
    && (value === value.toLowerCase() || value === checksumEthereumAddress(value))) return []
  return ['Use a 20-byte 0x hex address in lowercase or with a valid EIP-55 checksum.']
}

export function validateSolanaAddress(value) {
  if (value.length >= 32 && value.length <= 44 && decodeBase58(value)?.length === 32) return []
  return ['Solana addresses must encode exactly 32 bytes in Base58.']
}

export function normalizeBitcoinAddress(value) {
  return /^bc1/i.test(value) ? value.toLowerCase() : value
}

export function validateBitcoinAddress(value) {
  if (/^bc1/i.test(value)) {
    if (validSegwitAddress(value)) return []
  } else if (value.length >= 26 && value.length <= 35) {
    const bytes = decodeBase58(value)
    if (bytes?.length === 25 && (bytes[0] === 0 || bytes[0] === 5)) {
      const checksum = sha256(sha256(bytes.subarray(0, 21)))
      if (bytes.subarray(21).every((byte, index) => byte === checksum[index])) return []
    }
  }
  return ['Bitcoin addresses must use mainnet Base58Check, Bech32, or Bech32m with a valid checksum.']
}

function validSegwitAddress(value) {
  if (value.length > 90 || (value !== value.toLowerCase() && value !== value.toUpperCase())) return false
  const data = [...value.toLowerCase().slice(3)].map(character => bech32Alphabet.indexOf(character))
  if (data.length < 7 || data.some(digit => digit < 0) || data[0] > 16) return false

  // BIP-173 HRP expansion for "bc", followed by data and its six checksum words.
  let polymod = 1
  for (const digit of [3, 3, 0, 2, 3, ...data]) {
    const top = polymod >>> 25
    polymod = ((polymod & 0x1ffffff) << 5) ^ digit
    for (let index = 0; index < 5; index += 1) {
      if ((top >>> index) & 1) polymod ^= bech32Generators[index]
    }
  }
  const version = data[0]
  if (polymod !== (version === 0 ? 1 : 0x2bc830a3)) return false

  let accumulator = 0
  let bits = 0
  let length = 0
  for (const digit of data.slice(1, -6)) {
    accumulator = ((accumulator << 5) | digit) & 0xfff
    bits += 5
    if (bits >= 8) {
      bits -= 8
      length += 1
    }
  }
  if (bits >= 5 || ((accumulator << (8 - bits)) & 0xff) !== 0) return false
  return length >= 2 && length <= 40 && (version !== 0 || length === 20 || length === 32)
}
