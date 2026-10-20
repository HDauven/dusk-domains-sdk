/**
 * Ethereum, Bitcoin and Solana address validators, the ones the `address.eth`,
 * `address.evm`, `address.btc` and `address.sol` record conventions apply.
 *
 * Import it to check such an address on its own; record validation in the root
 * entrypoint already runs these.
 *
 * @module
 */
import * as addresses from './core/chainAddresses.mjs'
/** Spell a `0x` Ethereum address with its EIP-55 checksum; it does not validate the address. */
export const checksumEthereumAddress: (value: string) => string = addresses.checksumEthereumAddress
/**
 * Check for `0x` and 40 hex digits, all lowercase or EIP-55 checksummed: `[]`, else
 * `['invalid_ethereum_address']`.
 */
export const validateEthereumAddress: (value: string) => string[] = addresses.validateEthereumAddress
/** Check for 32 to 44 Base58 characters that decode to 32 bytes: `[]`, else `['invalid_solana_address']`. */
export const validateSolanaAddress: (value: string) => string[] = addresses.validateSolanaAddress
/** Lowercase a `bc1` (Bech32) address; other addresses come back unchanged. */
export const normalizeBitcoinAddress: (value: string) => string = addresses.normalizeBitcoinAddress
/**
 * Check a Bitcoin mainnet address, Base58Check P2PKH or P2SH, or `bc1` SegWit with a valid Bech32
 * or Bech32m checksum: `[]`, else `['invalid_bitcoin_address']`.
 */
export const validateBitcoinAddress: (value: string) => string[] = addresses.validateBitcoinAddress
