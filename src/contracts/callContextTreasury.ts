import {
  isTreasuryClaimAllReferralRewardsRuntimeArgs,
  isTreasuryClaimReferralRewardRuntimeArgs,
  isTreasuryClaimRuntimeArgs,
  isTreasuryInitArgs,
  isTreasuryUpdateOperatorRuntimeArgs,
} from './callArgGuards'
import { formatLux, principalSummary } from './callContextFormat'
import type { DuskDomainCallMetadata, DuskDomainDecodedContext } from './callTypes'

export function decodedTreasuryDuskDomainContext(call: DuskDomainCallMetadata): DuskDomainDecodedContext | null {
  if (call.contract !== 'treasury') return null

  if (call.functionName === 'init' && isTreasuryInitArgs(call.args)) {
    return {
      title: 'Set treasury operator',
      description: 'Configure who can claim fees and where claims are paid.',
      fields: [
        { label: 'Operator', value: treasuryOperatorSummary(call.args.operator, call.args.operatorRecipient) },
        { label: 'Claim recipient', value: call.args.operatorRecipient },
        { label: 'Allowed fee sources', value: String(call.args.allowedFeeSources.length) },
      ],
    }
  }

  if (call.functionName === 'update_operator_runtime' && isTreasuryUpdateOperatorRuntimeArgs(call.args)) {
    return {
      title: 'Update treasury operator',
      description: 'Rotate who can claim fees and where claims are paid.',
      fields: [
        { label: 'Operator', value: treasuryOperatorSummary(call.args.operator, call.args.operatorRecipient) },
        { label: 'Claim recipient', value: call.args.operatorRecipient },
      ],
    }
  }

  if (call.functionName === 'claim_runtime' && isTreasuryClaimRuntimeArgs(call.args)) {
    return {
      title: 'Claim collected fees',
      description: 'Withdraw available Dusk Domains fees to the configured recipient.',
      fields: [
        { label: 'Amount', value: `${formatLux(call.args.amountLux)} DUSK` },
      ],
    }
  }

  if (call.functionName === 'claim_all_runtime') {
    return {
      title: 'Claim all collected fees',
      description: 'Withdraw all available Dusk Domains fees to the configured recipient.',
      fields: [
        { label: 'Recipient', value: 'Configured claim recipient' },
      ],
    }
  }

  if (call.functionName === 'claim_referral_reward_runtime' && isTreasuryClaimReferralRewardRuntimeArgs(call.args)) {
    return {
      title: 'Claim referral rewards',
      description: 'Withdraw earned referral rewards to your connected wallet.',
      fields: [
        { label: 'Amount', value: `${formatLux(call.args.amountLux)} DUSK` },
        { label: 'Recipient', value: call.args.recipient },
      ],
    }
  }

  if (call.functionName === 'claim_all_referral_rewards_runtime' && isTreasuryClaimAllReferralRewardsRuntimeArgs(call.args)) {
    return {
      title: 'Claim all referral rewards',
      description: 'Withdraw all earned referral rewards to your connected wallet.',
      fields: [
        { label: 'Recipient', value: call.args.recipient },
      ],
    }
  }

  return null
}

function treasuryOperatorSummary(operator: Parameters<typeof principalSummary>[0], recipient: string) {
  return operator.kind === 'Moonlight' ? recipient : principalSummary(operator)
}
