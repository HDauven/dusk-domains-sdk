export const REFERRAL_ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export type ReferralAttributionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

type StoredReferralAttribution = {
  input: string
  expiresAt: number
  version: 1
}

export function readReferralAttribution(
  storage: ReferralAttributionStorage | null | undefined,
  key: string,
  now = Date.now(),
) {
  if (!storage) return ''
  try {
    const raw = storage.getItem(key)
    if (!raw) return ''
    const parsed = JSON.parse(raw) as Partial<StoredReferralAttribution>
    if (
      parsed.version !== 1 ||
      typeof parsed.input !== 'string' ||
      !parsed.input.trim() ||
      typeof parsed.expiresAt !== 'number' ||
      parsed.expiresAt <= now
    ) {
      storage.removeItem(key)
      return ''
    }
    return parsed.input.trim()
  } catch {
    storage.removeItem(key)
    return ''
  }
}

export function writeReferralAttribution(
  storage: ReferralAttributionStorage | null | undefined,
  key: string,
  input: string,
  now = Date.now(),
) {
  if (!storage) return
  const trimmed = input.trim()
  try {
    if (!trimmed) {
      storage.removeItem(key)
      return
    }
    const record: StoredReferralAttribution = {
      version: 1,
      input: trimmed,
      expiresAt: now + REFERRAL_ATTRIBUTION_TTL_MS,
    }
    storage.setItem(key, JSON.stringify(record))
  } catch {
    // Browser storage may be unavailable in hardened or private contexts.
  }
}
