import { describe, expect, it } from 'vitest'
import {
  applyDuskDomainsIndexedEvent,
  createDuskDomainsProjector,
  isDuskDomainsIndexedEventType,
  type DuskDomainsIndexedEvent,
} from './indexerKit'
import { isIndexedMarketplaceConfig, isIndexedTreasuryState } from './indexerClientGuards'
import { DEFAULT_FEE_CONFIG } from '../core/namePolicy'

const principal = (byte: number) => ({ kind: 'Contract' as const, bytes: Array(32).fill(byte) })
const authority = (byte: number) => `0x${byte.toString(16).padStart(2, '0').repeat(32)}`

describe('operator handover projections', () => {
  for (const contract of ['router', 'treasury', 'marketplace'] as const) {
    it(`projects ${contract} proposals, replacement, cancellation and completion`, () => {
      const projector = createDuskDomainsProjector()
      const operator = contract === 'marketplace' ? authority(1) : principal(1)
      const next = contract === 'marketplace' ? authority(2) : principal(2)
      const replacement = contract === 'marketplace' ? authority(3) : principal(3)
      const apply = (event: object, blockHeight = 10) => applyDuskDomainsIndexedEvent(projector, {
        event: event as DuskDomainsIndexedEvent,
        meta: { txId: `tx-${blockHeight}`, blockHeight, contractId: authority(9) },
      })
      const read = () => contract === 'router' ? projector.getPoolState()
        : contract === 'treasury' ? projector.getTreasuryState() : projector.getMarketplaceConfig()
      apply({
        type: `${contract}_initialized`, operator,
        treasury: authority(8), marketplace: authority(7), feeConfig: DEFAULT_FEE_CONFIG,
        router: authority(9), treasuryContract: authority(8), marketplaceAuthority: authority(7),
        feeBps: 250, allowedFeeSources: [], operatorRecipient: 'old-recipient',
      })
      const proposal = (pendingOperator: typeof operator, recipient: string) => ({
        type: `${contract}_operator_proposed`, operator, pendingOperator, pendingOperatorRecipient: recipient,
      })
      expect(read().pendingOperator).toBeNull()
      expect(isDuskDomainsIndexedEventType(`${contract}_operator_proposed`)).toBe(true)
      apply(proposal(next, 'next-recipient'), 11)
      expect(read()).toMatchObject({ operator, pendingOperator: next, blockHeight: 11 })
      apply(proposal(replacement, 'replacement-recipient'), 12)
      expect(read()).toMatchObject({ operator, pendingOperator: replacement })
      if (contract === 'treasury') {
        expect(isIndexedTreasuryState(read())).toBe(true)
        expect(isIndexedTreasuryState({ ...read(), pendingOperator: 'invalid' })).toBe(false)
        expect(isIndexedTreasuryState({ ...read(), pendingOperatorRecipient: 123 })).toBe(false)
        expect(read()).toMatchObject({ operatorRecipient: 'old-recipient', pendingOperatorRecipient: 'replacement-recipient' })
        apply({ type: 'treasury_claimed', operator, operatorRecipient: 'old-recipient', amountLux: 1, remainingLux: 9 })
        expect(read().pendingOperator).toEqual(replacement)
      }
      if (contract === 'marketplace') {
        expect(isIndexedMarketplaceConfig(read())).toBe(true)
        expect(isIndexedMarketplaceConfig({ ...read(), pendingOperator: 123 })).toBe(false)
        apply({ type: 'marketplace_config_updated', operator, previousOperator: operator, feeBps: 300, previousFeeBps: 250, updatedAtBlockHeight: 12 })
        expect(read().pendingOperator).toEqual(replacement)
      }
      apply({ type: `${contract}_operator_cancelled`, operator }, 13)
      expect(read()).toMatchObject({ operator, pendingOperator: null, blockHeight: 13 })
      if (contract === 'treasury') expect(read()).toMatchObject({ pendingOperatorRecipient: null })
      apply(proposal(next, 'next-recipient'), 14)
      apply({ type: `${contract}_operator_changed`, operator: next, previousOperator: operator, operatorRecipient: 'next-recipient' }, 15)
      expect(read()).toMatchObject({ operator: next, pendingOperator: null, txId: 'tx-15', blockHeight: 15 })
      if (contract === 'treasury') expect(read()).toMatchObject({ operatorRecipient: 'next-recipient', pendingOperatorRecipient: null })
    })
  }
})
