/** Base58 (Bitcoin alphabet), as Dusk spells accounts and addresses. @module */
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
/** Decode Base58 (Bitcoin alphabet); `null` for empty text, over 512 characters, or a character outside it. */
export function decodeBase58(value: string): Uint8Array | null {
  if (!value || value.length > 512) return null
  let n = 0n
  for (const c of value) {
    const digit = alphabet.indexOf(c)
    if (digit < 0) return null
    n = n * 58n + BigInt(digit)
  }
  const bytes: number[] = []
  while (n) {
    bytes.unshift(Number(n & 255n))
    n >>= 8n
  }
  let zeroes = 0
  while (value[zeroes] === '1') zeroes++
  return Uint8Array.from([...Array<number>(zeroes).fill(0), ...bytes])
}
/** Encode bytes as Base58 (Bitcoin alphabet); throws a `RangeError` for a value that is not a byte. */
export function encodeBase58(value: Uint8Array | readonly number[]): string {
  if (value.some((b) => !Number.isInteger(b) || b < 0 || b > 255))
    throw new RangeError('Invalid bytes')
  let n = 0n,
    out = '',
    zeroes = 0
  for (const byte of value) n = (n << 8n) + BigInt(byte)
  while (n) {
    out = alphabet[Number(n % 58n)] + out
    n /= 58n
  }
  while (zeroes < value.length && value[zeroes] === 0) zeroes++
  return '1'.repeat(zeroes) + out
}
