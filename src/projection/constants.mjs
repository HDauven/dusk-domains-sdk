import { DEFAULT_FEE_CONFIG as coreFeeConfig } from '../core/namePolicyData.mjs'

export const DEFAULT_FEE_CONFIG = { ...coreFeeConfig, operator: null, txId: null, blockHeight: null }
export const PUBLIC_PRIMARY_ENDPOINT_TYPES = new Set(['moonlight_address'])
