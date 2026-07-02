import { describe, expect, it } from 'vitest'
import { createLifecycleEventProjector } from './indexer'

describe('Dusk Domains economics event projector', () => {
  it('projects treasury registration, renewal, and operator claim accounting', () => {
    const projector = createLifecycleEventProjector()
    const registrar = `0x${'40'.repeat(32)}`
    const controller = `0x${'41'.repeat(32)}`
    const node = `0x${'42'.repeat(32)}`
    const operator = `0x${'43'.repeat(32)}`
    const nextOperator = `0x${'44'.repeat(32)}`
    const recipient = 'dusk1operator'
    const nextRecipient = 'dusk1operatornext'

    projector.applyTreasury({
      type: 'treasury_initialized',
      operatorAuthority: operator,
      operatorRecipient: recipient,
      allowedFeeSources: [registrar, controller],
    }, { txId: 'tx-treasury-init', blockHeight: 80 })
    projector.applyTreasury({
      type: 'treasury_fee_received',
      sourceContract: registrar,
      reason: 'registration',
      node,
      amountLux: 50_000_000_000,
      totalReceivedLux: 50_000_000_000,
      availableLux: 50_000_000_000,
      registrationReceivedLux: 50_000_000_000,
      renewalReceivedLux: 0,
      otherReceivedLux: 0,
    }, { txId: 'tx-register-fee', blockHeight: 81 })
    projector.applyTreasury({
      type: 'treasury_fee_received',
      sourceContract: registrar,
      reason: 'renewal',
      node,
      amountLux: 50_000_000_000,
      totalReceivedLux: 100_000_000_000,
      availableLux: 100_000_000_000,
      registrationReceivedLux: 50_000_000_000,
      renewalReceivedLux: 50_000_000_000,
      otherReceivedLux: 0,
    }, { txId: 'tx-renew-fee', blockHeight: 82 })
    projector.applyTreasury({
      type: 'treasury_operator_changed',
      previousOperatorAuthority: operator,
      operatorAuthority: nextOperator,
      operatorRecipient: nextRecipient,
    }, { txId: 'tx-operator-rotate', blockHeight: 83 })
    projector.applyTreasury({
      type: 'treasury_claimed',
      operatorAuthority: nextOperator,
      operatorRecipient: nextRecipient,
      amountLux: 100_000_000_000,
      remainingLux: 0,
    }, { txId: 'tx-claim', blockHeight: 84 })

    expect(projector.getTreasuryState()).toMatchObject({
      initialized: true,
      operatorAuthority: nextOperator,
      operatorRecipient: nextRecipient,
      allowedFeeSources: [registrar, controller],
      totalReceivedLux: 100_000_000_000,
      availableLux: 0,
      registrationReceivedLux: 50_000_000_000,
      renewalReceivedLux: 50_000_000_000,
      otherReceivedLux: 0,
      lastFeeSourceContract: registrar,
      lastFeeReason: 'renewal',
      lastFeeNode: node,
      lastEventType: 'treasury_claimed',
      txId: 'tx-claim',
      blockHeight: 84,
    })
    expect(projector.getReferralState(operator)).toMatchObject({
      supported: true,
      referrer: operator,
      claimableLux: 0,
      referralCount: 0,
    })
  })

  it('projects operator fee config updates', () => {
    const projector = createLifecycleEventProjector()
    const operator = `0x${'43'.repeat(32)}`

    expect(projector.getFeeConfig()).toMatchObject({
      threeCharYearLux: 150_000_000_000,
      fourCharYearLux: 50_000_000_000,
      fivePlusYearLux: 10_000_000_000,
      referralRewardBps: 2_000,
      renewalReferralRewardBps: 1_000,
      premiumReferralRewardBps: 0,
      version: 1,
    })

    projector.applyFeeConfig({
      type: 'fee_config_updated',
      operator,
      config: {
        threeCharYearLux: 175_000_000_000,
        fourCharYearLux: 60_000_000_000,
        fivePlusYearLux: 12_000_000_000,
        referralRewardBps: 1_500,
        renewalReferralRewardBps: 1_000,
        premiumReferralRewardBps: 0,
        version: 2,
        updatedAt: 120,
      },
    }, { txId: 'tx-fee-config', blockHeight: 120 })

    expect(projector.getFeeConfig()).toMatchObject({
      operator,
      fourCharYearLux: 60_000_000_000,
      referralRewardBps: 1_500,
      txId: 'tx-fee-config',
      blockHeight: 120,
    })
  })

  it('projects referral accruals and user claims', () => {
    const projector = createLifecycleEventProjector()
    const referrer = `0x${'44'.repeat(32)}`
    const buyer = `0x${'45'.repeat(32)}`

    projector.applyReferral({
      type: 'referral_reward_accrued',
      referrer,
      buyer,
      amountLux: 5_000_000_000,
      claimableLux: 5_000_000_000,
      claimedLux: 0,
      referralCount: 1,
    }, { txId: 'tx-referral-accrual-1', blockHeight: 90 })
    projector.applyReferral({
      type: 'referral_reward_accrued',
      referrer,
      buyer,
      amountLux: 2_000_000_000,
      claimableLux: 7_000_000_000,
      claimedLux: 0,
      referralCount: 2,
    }, { txId: 'tx-referral-accrual-2', blockHeight: 91 })
    projector.applyReferral({
      type: 'referral_reward_claimed',
      referrer,
      amountLux: 3_000_000_000,
      remainingLux: 4_000_000_000,
      claimedLux: 3_000_000_000,
      referralCount: 2,
    }, { txId: 'tx-referral-claim', blockHeight: 92 })

    expect(projector.getReferralState(referrer)).toMatchObject({
      supported: true,
      referrer,
      claimableLux: 4_000_000_000,
      claimedLux: 3_000_000_000,
      referralCount: 2,
      recentActivity: [
        {
          kind: 'claim',
          amountLux: 3_000_000_000,
          txId: 'tx-referral-claim',
          blockHeight: 92,
          counterparty: null,
        },
        {
          kind: 'accrual',
          amountLux: 2_000_000_000,
          txId: 'tx-referral-accrual-2',
          blockHeight: 91,
          counterparty: buyer,
        },
        {
          kind: 'accrual',
          amountLux: 5_000_000_000,
          txId: 'tx-referral-accrual-1',
          blockHeight: 90,
          counterparty: buyer,
        },
      ],
    })
    expect(projector.getReferralState(`0x${'99'.repeat(32)}`)).toMatchObject({
      supported: true,
      referrer: `0x${'99'.repeat(32)}`,
      claimableLux: 0,
      referralCount: 0,
    })
  })

  it('moves accrued referral rewards out of operator-claimable treasury funds', () => {
    const projector = createLifecycleEventProjector()
    const registrar = `0x${'40'.repeat(32)}`
    const node = `0x${'42'.repeat(32)}`
    const referrer = `0x${'44'.repeat(32)}`
    const buyer = `0x${'45'.repeat(32)}`

    projector.applyTreasury({
      type: 'treasury_fee_received',
      sourceContract: registrar,
      reason: 'registration',
      node,
      amountLux: 500_000_000_000,
      totalReceivedLux: 500_000_000_000,
      availableLux: 500_000_000_000,
      registrationReceivedLux: 500_000_000_000,
      renewalReceivedLux: 0,
      otherReceivedLux: 0,
    }, { txId: 'tx-register-fee', blockHeight: 100 })

    projector.applyReferral({
      type: 'referral_reward_accrued',
      referrer,
      buyer,
      amountLux: 100_000_000_000,
      claimableLux: 100_000_000_000,
      claimedLux: 0,
      referralCount: 1,
    }, { txId: 'tx-referral-accrual', blockHeight: 100 })

    expect(projector.getTreasuryState()).toMatchObject({
      totalReceivedLux: 500_000_000_000,
      availableLux: 400_000_000_000,
      registrationReceivedLux: 500_000_000_000,
      referralClaimableLux: 100_000_000_000,
      referralClaimedLux: 0,
      referralCount: 1,
    })
    expect(projector.getReferralState(referrer)).toMatchObject({
      claimableLux: 100_000_000_000,
      claimedLux: 0,
      referralCount: 1,
    })

    projector.applyReferral({
      type: 'referral_reward_claimed',
      referrer,
      amountLux: 100_000_000_000,
      remainingLux: 0,
      claimedLux: 100_000_000_000,
      referralCount: 1,
    }, { txId: 'tx-referral-claim', blockHeight: 101 })

    expect(projector.getTreasuryState()).toMatchObject({
      availableLux: 400_000_000_000,
      referralClaimableLux: 0,
      referralClaimedLux: 100_000_000_000,
      referralCount: 1,
    })
    expect(projector.getReferralState(referrer)).toMatchObject({
      claimableLux: 0,
      claimedLux: 100_000_000_000,
    })
  })
})
