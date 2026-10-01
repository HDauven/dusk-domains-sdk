import type { CoreFeeConfig } from '../core/namePolicy'
import type { TreasuryFeeReason } from '../indexer/indexerTypes'

export function endpointKindToRecordKey(kind: unknown): string
export function treasuryReasonName(reason: unknown): TreasuryFeeReason
export function enumValue(value: unknown): unknown
export function bytesToHex(value: unknown): string | null
export function principalFromEvent(value: unknown, legacyBytes?: unknown): { kind: string, bytes: number[] } | null
export function feeConfigFromEvent(value: unknown): CoreFeeConfig
export function bytesToUtf8(value: unknown): string | null
export function bytesToBase58(value: unknown): string | null
export function lifecycleValueToIso(value: unknown, observedAt: string, targetBlockSeconds: number, observedBlockHeight?: number | null): string | null
export function numberOrNull(value: unknown): number | null
export function numericBlockHeight(value: unknown): number | null
export function withHexPrefix(value: unknown): string | null
