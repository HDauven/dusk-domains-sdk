import type { CoreFeeConfig, ReservedNamePolicy } from './namePolicy'

export const LUX_PER_DUSK: 1000000000
export const DEFAULT_FEE_CONFIG: CoreFeeConfig
export const RESERVED_NAME_POLICIES: readonly ReservedNamePolicy[]
export const RESERVED_LABELS: Set<string>
export const RESERVED_REASONS: Record<string, string>
export function getReservedNamePolicy(label: string): ReservedNamePolicy | undefined
