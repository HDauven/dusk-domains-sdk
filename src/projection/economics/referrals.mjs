import { accountingLux, sumAccountingLux, subtractAccountingLux } from '../accounting.mjs'
import { referralKey } from './principals.mjs'

export function emptyReferralState(referrer = null, supported = false) {
  return {
    supported,
    referrer,
    claimableLux: 0,
    claimedLux: 0,
    referralCount: 0,
    recentActivity: [],
  }
}

export function normalizeReferralStateMap(value) {
  const map = new Map()

  if (Array.isArray(value)) {
    for (const row of value) {
      const normalized = normalizeReferralState(row)
      if (!normalized.referrer) continue
      map.set(referralKey(normalized.referrer), normalized)
    }
    return map
  }

  if (!value || typeof value !== 'object') return map

  for (const [key, row] of Object.entries(value)) {
    const normalized = normalizeReferralState({
      ...(row && typeof row === 'object' ? row : {}),
      referrer: row?.referrer ?? row?.referrerAuthority ?? row?.referrer_authority ?? key,
    })
    if (!normalized.referrer) continue
    map.set(referralKey(normalized.referrer), normalized)
  }

  return map
}

export function referralStateFor(store, referrer) {
  const supported = Boolean(store.referralRewardsSupported)
  if (!referrer) return emptyReferralState(null, supported)
  return store.referralsByReferrer?.get(referralKey(referrer)) ?? emptyReferralState(referrer, supported)
}

export function applyReferralEvent(store, event, meta) {
  const referrer = referralKey(event.referrer ?? event.referrerAuthority ?? event.referrer_authority ?? null) || null
  if (!referrer) throw new Error('Referral event is missing referrer.')
  const current = store.referralsByReferrer.get(referrer) ?? {
    ...emptyReferralState(referrer),
    supported: true,
  }
  const next = reduceReferralEvent(event, current, meta)
  store.referralsByReferrer.set(referrer, next)
  return next
}

function normalizeReferralState(value) {
  if (!value || typeof value !== 'object') return emptyReferralState()
  const referrer = referralKey(value.referrer ?? value.referrerAuthority ?? value.referrer_authority ?? null) || null
  return {
    supported: Boolean(value.supported ?? referrer),
    referrer,
    claimableLux: accountingLux(value.claimableLux ?? value.claimable_lux ?? 0),
    claimedLux: accountingLux(value.claimedLux ?? value.claimed_lux ?? 0),
    referralCount: Number(value.referralCount ?? value.referral_count ?? 0),
    recentActivity: normalizeReferralActivity(value.recentActivity ?? value.recent_activity),
  }
}

function normalizeReferralActivity(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((activity) => {
      if (!activity || typeof activity !== 'object') return null
      const kind = activity.kind === 'claim' ? 'claim' : 'accrual'
      return {
        txId: activity.txId ?? activity.tx_id ?? null,
        blockHeight: activity.blockHeight ?? activity.block_height ?? null,
        amountLux: accountingLux(activity.amountLux ?? activity.amount_lux ?? 0),
        kind,
        counterparty: referralKey(activity.counterparty ?? activity.buyer ?? activity.buyerAuthority ?? activity.buyer_authority ?? null) || null,
      }
    })
    .filter(Boolean)
    .slice(0, 12)
}

function reduceReferralEvent(event, current, meta) {
  const referrer = referralKey(event.referrer ?? event.referrerAuthority ?? event.referrer_authority ?? current.referrer)
  if (event.type === 'referral_reward_accrued') {
    const amountLux = accountingLux(event.amountLux ?? event.amount_lux ?? 0)
    const claimableLux = accountingLux(event.claimableLux ?? event.claimable_lux ?? sumAccountingLux(current.claimableLux, amountLux))
    const claimedLux = accountingLux(event.claimedLux ?? event.claimed_lux ?? current.claimedLux)
    const referralCount = Number(event.referralCount ?? event.referral_count ?? current.referralCount + 1)
    return {
      supported: true,
      referrer,
      claimableLux,
      claimedLux,
      referralCount,
      recentActivity: [
        {
          txId: meta.txId ?? event.txId ?? event.tx_id ?? null,
          blockHeight: meta.blockHeight ?? event.blockHeight ?? event.block_height ?? null,
          amountLux,
          kind: 'accrual',
          counterparty: referralKey(event.buyer ?? event.buyerAuthority ?? event.buyer_authority ?? event.counterparty ?? null) || null,
        },
        ...(current.recentActivity ?? []),
      ].slice(0, 12),
    }
  }

  const amountLux = accountingLux(event.amountLux ?? event.amount_lux ?? 0)
  const remainingLux = accountingLux(event.remainingLux ?? event.remaining_lux ?? subtractAccountingLux(current.claimableLux, amountLux))
  return {
    supported: true,
    referrer,
    claimableLux: remainingLux,
    claimedLux: accountingLux(event.claimedLux ?? event.claimed_lux ?? sumAccountingLux(current.claimedLux, amountLux)),
    referralCount: Number(event.referralCount ?? event.referral_count ?? current.referralCount),
    recentActivity: [
      {
        txId: meta.txId ?? event.txId ?? event.tx_id ?? null,
        blockHeight: meta.blockHeight ?? event.blockHeight ?? event.block_height ?? null,
        amountLux,
        kind: 'claim',
        counterparty: event.counterparty ?? null,
      },
      ...(current.recentActivity ?? []),
    ].slice(0, 12),
  }
}
