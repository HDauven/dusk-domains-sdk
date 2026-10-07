/** Chain address validation helpers, shared by npm and JSR exports. @module */
import * as addresses from './core/chainAddresses.mjs'
export const checksumEthereumAddress: (value: string) => string = addresses.checksumEthereumAddress
export const validateEthereumAddress: (value: string) => string[] = addresses.validateEthereumAddress
export const validateSolanaAddress: (value: string) => string[] = addresses.validateSolanaAddress
export const normalizeBitcoinAddress: (value: string) => string = addresses.normalizeBitcoinAddress
export const validateBitcoinAddress: (value: string) => string[] = addresses.validateBitcoinAddress
