import {
  isRouterAddPoolMemberArgs,
  isRouterInitArgs,
  isRouterSetFeeConfigRuntimeArgs,
  isRouterProposeOperatorRuntimeArgs,
  isRouterSetReferralConfigRuntimeArgs,
} from './callArgGuards'
import { formatLux, principalSummary } from './callContextFormat'
import type { DuskDomainCallMetadata, DuskDomainDecodedContext } from './callTypes'

export function decodedRouterDuskDomainContext(call: DuskDomainCallMetadata): DuskDomainDecodedContext | null {
  if (call.contract !== 'router') return null

  if (call.functionName === 'init' && isRouterInitArgs(call.args)) {
    return {
      title: 'Initialize the Dusk Domains router',
      description: 'Set the operator, treasury, marketplace and starting referral share for a new contract pool.',
      fields: [
        { label: 'Operator', value: principalSummary(call.args.operator) },
        { label: 'Treasury', value: call.args.treasury },
        { label: 'Marketplace', value: call.args.marketplace ?? 'None' },
        { label: 'Referral share', value: `${call.args.referralRewardBps / 100}%` },
      ],
    }
  }

  if (call.functionName === 'add_registry_runtime' && isRouterAddPoolMemberArgs(call.args)) {
    return {
      title: 'Add a registry to the pool',
      description: 'New names will be created in this registry. Existing names stay where they are.',
      fields: [{ label: 'Registry', value: call.args.member }],
    }
  }

  if (call.functionName === 'add_resolver_runtime' && isRouterAddPoolMemberArgs(call.args)) {
    return {
      title: 'Add a resolver to the pool',
      description: 'New records will be stored in this resolver. Existing records stay where they are.',
      fields: [{ label: 'Resolver', value: call.args.member }],
    }
  }

  if (call.functionName === 'accept_operator_runtime') {
    return {
      title: 'Accept router operator role',
      description: 'Accept the pending proposal using the proposed operator account.',
      fields: [],
    }
  }
  if (call.functionName === 'cancel_operator_runtime') {
    return {
      title: 'Cancel router operator proposal',
      description: 'Keep the current operator and discard the pending proposal.',
      fields: [],
    }
  }

  if (call.functionName === 'propose_operator_runtime' && isRouterProposeOperatorRuntimeArgs(call.args)) {
    return {
      title: 'Propose router operator',
      description: 'The proposed operator must accept before gaining control of fees and pool members.',
      fields: [{ label: 'New operator', value: principalSummary(call.args.operator) }],
    }
  }

  if (call.functionName === 'set_referral_config_runtime' && isRouterSetReferralConfigRuntimeArgs(call.args)) {
    return {
      title: 'Update referral share',
      description: 'Change the share of future registration fees credited to referrers.',
      fields: [
        { label: 'Referral share', value: `${call.args.referralRewardBps / 100}%` },
      ],
    }
  }

  if (call.functionName === 'set_fee_config_runtime' && isRouterSetFeeConfigRuntimeArgs(call.args)) {
    return {
      title: 'Update domain pricing',
      description: 'Change future registration pricing and referral economics.',
      fields: [
        { label: '3 characters', value: `${formatLux(call.args.threeCharYearLux)} DUSK / year` },
        { label: '4 characters', value: `${formatLux(call.args.fourCharYearLux)} DUSK / year` },
        { label: '5+ characters', value: `${formatLux(call.args.fivePlusYearLux)} DUSK / year` },
        { label: 'Referral share', value: `${call.args.referralRewardBps / 100}%` },
      ],
    }
  }

  return null
}
