import type { ActivityEntry } from './activity'

export const RECENT_CHANGE_WARNING_WINDOW_SECONDS = 3 * 24 * 60 * 60
export const HIGH_RISK_RECORD_KEYS = [
  'moonlight_address',
  'phoenix_payment_endpoint',
  'dusk_contract',
  'dusk_asset',
  'evm_address',
  'website',
  'compliance_ref',
] as const

export type RecentChangeWarningCode =
  | 'recent_high_risk_record_change'
  | 'recent_resolver_change'
  | 'recent_primary_name_change'

export type RecentChangeWarning = {
  code: RecentChangeWarningCode
  severity: 'warning' | 'danger'
  eventType: ActivityEntry['eventType']
  node: string
  name: string
  actor: string
  target: string | null
  timestamp: string
  txId?: string
  blockHeight: number | null
  ageSeconds: number
  windowSeconds: number
  message: string
}

export function createRecentChangeWarnings(
  activity: ActivityEntry[],
  options: {
    now?: Date
    windowSeconds?: number
  } = {},
): RecentChangeWarning[] {
  const now = options.now ?? new Date()
  const windowSeconds = options.windowSeconds ?? RECENT_CHANGE_WARNING_WINDOW_SECONDS

  return activity
    .map((entry) => warningFromActivityEntry(entry, now, windowSeconds))
    .filter((warning): warning is RecentChangeWarning => warning !== null)
    .sort((left, right) => left.ageSeconds - right.ageSeconds)
}

function warningFromActivityEntry(
  entry: ActivityEntry,
  now: Date,
  windowSeconds: number,
): RecentChangeWarning | null {
  const timestamp = new Date(entry.timestamp)
  const timestampMs = timestamp.getTime()

  if (!Number.isFinite(timestampMs)) return null

  const ageSeconds = Math.max(0, Math.floor((now.getTime() - timestampMs) / 1000))

  if (ageSeconds > windowSeconds) return null

  if (entry.eventType === 'resolver_change') {
    return createRecentWarning(entry, {
      code: 'recent_resolver_change',
      severity: 'warning',
      ageSeconds,
      windowSeconds,
      message: 'Record source changed recently. Check the current records if this update was unexpected.',
    })
  }

  if (entry.eventType === 'primary_name') {
    return createRecentWarning(entry, {
      code: 'recent_primary_name_change',
      severity: 'warning',
      ageSeconds,
      windowSeconds,
      message: 'Primary domain changed recently. Apps will verify the address match before display.',
    })
  }

  if (entry.eventType === 'record_update' && isHighRiskRecordTarget(entry.target)) {
    return createRecentWarning(entry, {
      code: 'recent_high_risk_record_change',
      severity: 'warning',
      ageSeconds,
      windowSeconds,
      message: `${entry.target} changed recently. Review the current value if this update was unexpected.`,
    })
  }

  return null
}

function createRecentWarning(
  entry: ActivityEntry,
  warning: Pick<RecentChangeWarning, 'code' | 'severity' | 'ageSeconds' | 'windowSeconds' | 'message'>,
): RecentChangeWarning {
  return {
    code: warning.code,
    severity: warning.severity,
    eventType: entry.eventType,
    node: entry.node,
    name: entry.name,
    actor: entry.actor,
    target: entry.target ?? null,
    timestamp: entry.timestamp,
    txId: entry.txId,
    blockHeight: entry.blockHeight,
    ageSeconds: warning.ageSeconds,
    windowSeconds: warning.windowSeconds,
    message: warning.message,
  }
}

function isHighRiskRecordTarget(target: string | undefined) {
  if (!target) return false
  if (target.startsWith('service_endpoint.')) return true
  return HIGH_RISK_RECORD_KEYS.includes(target as (typeof HIGH_RISK_RECORD_KEYS)[number])
}
