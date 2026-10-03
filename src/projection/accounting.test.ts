import { expect, it } from 'vitest'
import { applyProjectionEvent, createProjectionState, normalizeObservedEvent, normalizeTreasuryState } from '../projection.mjs'
import { isIndexedReferralState, isIndexedTreasuryState } from '../indexer/indexerClientGuards'

const node = `0x${'01'.repeat(32)}`
const registration = { type: 'name_registered' as const, node, label: 'aurora', actor: node, owner: node,
  expiresAt: '2027-10-03T00:00:00.000Z', graceEndsAt: '2027-11-03T00:00:00.000Z', expiresAtBlockHeight: 200_000, graceEndsAtBlockHeight: 300_000,
  feeLux: 999_999_523_162_842 + 10_000_000_000, premiumLux: 999_999_523_162_842 }
const total = '9999995231628420'

it('projects ten day-zero premiums with exact cumulative income', () => {
  const state = createProjectionState()
  for (let i = 0; i < 10; i++) applyProjectionEvent(state, registration)
  expect(state.namesByNode.get(node)).toMatchObject({ owner: node, graceEndsAtBlockHeight: 300_000 })
  expect(state.treasuryState.premiumReceivedLux).toBe(total)
  const restored = normalizeTreasuryState(JSON.parse(JSON.stringify(state.treasuryState)))
  expect(restored).toEqual(state.treasuryState)
  expect(isIndexedTreasuryState(restored)).toBe(true)
})

it('retains lifecycle and activity updates when premium statistics are corrupt', () => {
  const state = createProjectionState()
  state.treasuryState.premiumReceivedLux = 'invalid'
  expect(() => applyProjectionEvent(state, registration)).not.toThrow()
  expect(state.namesByNode.get(node)).toMatchObject({ owner: node, graceEndsAtBlockHeight: 300_000 })
  expect(state.activityByNode.get(node)).toHaveLength(1)
  expect(state.treasuryState.premiumAccountingError).toContain('integer Lux')
})

it('decodes, projects and restores large treasury totals without rounding', () => {
  const normalized = normalizeObservedEvent({ contract: { key: 'treasury', contractId: node }, observedAt: '2026-10-03T00:00:00.000Z',
    eventName: 'treasury_fee_received', event: { source_contract: Array(32).fill(1), node: Array(32).fill(1), reason: 'Registration',
      amount_lux: 1, total_received_lux: '10000000000000001', available_lux: '10000000000000001',
      registration_received_lux: total, renewal_received_lux: '9007199254740993', other_received_lux: 0 } })
  const state = createProjectionState()
  applyProjectionEvent(state, normalized.event)
  expect(state.treasuryState).toMatchObject({ totalReceivedLux: '10000000000000001', availableLux: '10000000000000001',
    registrationReceivedLux: total, renewalReceivedLux: '9007199254740993' })
  expect(normalizeTreasuryState(JSON.parse(JSON.stringify(state.treasuryState)))).toEqual(state.treasuryState)
  expect(isIndexedTreasuryState(state.treasuryState)).toBe(true)
})

it('adds and subtracts referral and claimed treasury balances exactly', () => {
  const state = createProjectionState()
  state.treasuryState.availableLux = '10000000000000001'
  state.treasuryState.referralClaimableLux = Number.MAX_SAFE_INTEGER
  state.treasuryState.referralClaimedLux = Number.MAX_SAFE_INTEGER
  applyProjectionEvent(state, { type: 'referral_reward_accrued', referrer: node, buyer: node, amountLux: 2, claimableLux: '9007199254740993', claimedLux: 0, referralCount: 1 })
  expect(state.treasuryState).toMatchObject({ availableLux: '9999999999999999', referralClaimableLux: '9007199254740993' })
  applyProjectionEvent(state, { type: 'referral_reward_claimed', referrer: node, amountLux: 2, remainingLux: Number.MAX_SAFE_INTEGER, claimedLux: '9007199254740993', referralCount: 1 })
  expect(state.treasuryState).toMatchObject({ referralClaimableLux: Number.MAX_SAFE_INTEGER, referralClaimedLux: '9007199254740993' })
  expect(isIndexedReferralState(state.referralsByReferrer.get(node))).toBe(true)
  applyProjectionEvent(state, { type: 'treasury_claimed', operatorRecipient: 'wallet', amountLux: '9999999999999999', remainingLux: 0 })
  expect(state.treasuryState.claims[0].amountLux).toBe('9999999999999999')
  expect(normalizeTreasuryState(JSON.parse(JSON.stringify(state.treasuryState)))).toEqual(state.treasuryState)
})
