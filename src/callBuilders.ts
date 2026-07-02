import type {
  CoreClearPrimaryNameRuntimeArgs,
  CoreClearRecordSenderRuntimeArgs,
  CoreCommitRuntimeArgs,
  CoreCompleteRegistrationRuntimeArgs,
  CoreCreateSubnameRuntimeArgs,
  CoreGetNameArgs,
  CoreInitArgs,
  CoreMutateRecordsSenderRuntimeArgs,
  CorePendingCommitmentArgs,
  CoreReadPrimaryNameArgs,
  CoreReadRecordArgs,
  CoreRenewRuntimeArgs,
  CoreSetFeeConfigRuntimeArgs,
  CoreSetPrimaryNameRuntimeArgs,
  CoreSetRecordSenderRuntimeArgs,
  CoreSetReferralConfigRuntimeArgs,
  CoreUpdateAuthoritiesRuntimeArgs,
  DuskNameCallMetadata,
  TreasuryClaimAllReferralRewardsRuntimeArgs,
  TreasuryClaimReferralRewardRuntimeArgs,
  TreasuryClaimRuntimeArgs,
  TreasuryInitArgs,
  TreasuryUpdateOperatorRuntimeArgs,
} from './callTypes'

export function coreInitCall(args: CoreInitArgs): DuskNameCallMetadata<CoreInitArgs> {
  return {
    contract: 'core',
    functionName: 'init',
    kind: 'write',
    args,
  }
}

export function coreSetReferralConfigRuntimeCall(
  args: CoreSetReferralConfigRuntimeArgs,
): DuskNameCallMetadata<CoreSetReferralConfigRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'set_referral_config_runtime',
    kind: 'write',
    args,
  }
}

export function coreSetFeeConfigRuntimeCall(
  args: CoreSetFeeConfigRuntimeArgs,
): DuskNameCallMetadata<CoreSetFeeConfigRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'set_fee_config_runtime',
    kind: 'write',
    args,
  }
}

export function coreCommitRuntimeCall(
  args: CoreCommitRuntimeArgs,
): DuskNameCallMetadata<CoreCommitRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'commit_runtime',
    kind: 'write',
    args,
  }
}

export function coreCompleteRegistrationRuntimeCall(
  args: CoreCompleteRegistrationRuntimeArgs,
): DuskNameCallMetadata<CoreCompleteRegistrationRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'complete_registration_runtime',
    kind: 'write',
    args,
  }
}

export function coreRenewRuntimeCall(
  args: CoreRenewRuntimeArgs,
): DuskNameCallMetadata<CoreRenewRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'renew_runtime',
    kind: 'write',
    args,
  }
}

export function coreUpdateAuthoritiesRuntimeCall(
  args: CoreUpdateAuthoritiesRuntimeArgs,
): DuskNameCallMetadata<CoreUpdateAuthoritiesRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'update_authorities_runtime',
    kind: 'write',
    args,
  }
}

export function coreSetRecordSenderRuntimeCall(
  args: CoreSetRecordSenderRuntimeArgs,
): DuskNameCallMetadata<CoreSetRecordSenderRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'set_record_sender_runtime',
    kind: 'write',
    args,
  }
}

export function coreClearRecordSenderRuntimeCall(
  args: CoreClearRecordSenderRuntimeArgs,
): DuskNameCallMetadata<CoreClearRecordSenderRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'clear_record_sender_runtime',
    kind: 'write',
    args,
  }
}

export function coreMutateRecordsSenderRuntimeCall(
  args: CoreMutateRecordsSenderRuntimeArgs,
): DuskNameCallMetadata<CoreMutateRecordsSenderRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'mutate_records_sender_runtime',
    kind: 'write',
    args,
  }
}

export function coreSetPrimaryNameRuntimeCall(
  args: CoreSetPrimaryNameRuntimeArgs,
): DuskNameCallMetadata<CoreSetPrimaryNameRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'set_primary_name_runtime',
    kind: 'write',
    args,
  }
}

export function coreClearPrimaryNameRuntimeCall(
  args: CoreClearPrimaryNameRuntimeArgs,
): DuskNameCallMetadata<CoreClearPrimaryNameRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'clear_primary_name_runtime',
    kind: 'write',
    args,
  }
}

export function coreCreateSubnameRuntimeCall(
  args: CoreCreateSubnameRuntimeArgs,
): DuskNameCallMetadata<CoreCreateSubnameRuntimeArgs> {
  return {
    contract: 'core',
    functionName: 'create_subname_runtime',
    kind: 'write',
    args,
  }
}

export function coreGetNameCall(args: CoreGetNameArgs): DuskNameCallMetadata<CoreGetNameArgs> {
  return {
    contract: 'core',
    functionName: 'get_name',
    kind: 'read',
    args,
  }
}

export function coreReadRecordCall(args: CoreReadRecordArgs): DuskNameCallMetadata<CoreReadRecordArgs> {
  return {
    contract: 'core',
    functionName: 'read_record',
    kind: 'read',
    args,
  }
}

export function coreReadPrimaryNameCall(args: CoreReadPrimaryNameArgs): DuskNameCallMetadata<CoreReadPrimaryNameArgs> {
  return {
    contract: 'core',
    functionName: 'read_primary_name',
    kind: 'read',
    args,
  }
}

export function corePendingCommitmentCall(
  args: CorePendingCommitmentArgs,
): DuskNameCallMetadata<CorePendingCommitmentArgs> {
  return {
    contract: 'core',
    functionName: 'pending_commitment',
    kind: 'read',
    args,
  }
}

export function coreFeeConfigCall(): DuskNameCallMetadata<undefined> {
  return {
    contract: 'core',
    functionName: 'fee_config',
    kind: 'read',
    args: undefined,
  }
}

export function treasuryInitCall(args: TreasuryInitArgs): DuskNameCallMetadata<TreasuryInitArgs> {
  return {
    contract: 'treasury',
    functionName: 'init',
    kind: 'write',
    args,
  }
}

export function treasuryUpdateOperatorRuntimeCall(
  args: TreasuryUpdateOperatorRuntimeArgs,
): DuskNameCallMetadata<TreasuryUpdateOperatorRuntimeArgs> {
  return {
    contract: 'treasury',
    functionName: 'update_operator_runtime',
    kind: 'write',
    args,
  }
}

export function treasuryClaimRuntimeCall(
  args: TreasuryClaimRuntimeArgs,
): DuskNameCallMetadata<TreasuryClaimRuntimeArgs> {
  return {
    contract: 'treasury',
    functionName: 'claim_runtime',
    kind: 'write',
    args,
  }
}

export function treasuryClaimAllRuntimeCall(): DuskNameCallMetadata<undefined> {
  return {
    contract: 'treasury',
    functionName: 'claim_all_runtime',
    kind: 'write',
    args: undefined,
  }
}

export function treasuryClaimReferralRewardRuntimeCall(
  args: TreasuryClaimReferralRewardRuntimeArgs,
): DuskNameCallMetadata<TreasuryClaimReferralRewardRuntimeArgs> {
  return {
    contract: 'treasury',
    functionName: 'claim_referral_reward_runtime',
    kind: 'write',
    args,
  }
}

export function treasuryClaimAllReferralRewardsRuntimeCall(
  args: TreasuryClaimAllReferralRewardsRuntimeArgs,
): DuskNameCallMetadata<TreasuryClaimAllReferralRewardsRuntimeArgs> {
  return {
    contract: 'treasury',
    functionName: 'claim_all_referral_rewards_runtime',
    kind: 'write',
    args,
  }
}

export function treasuryReadStateCall(): DuskNameCallMetadata<undefined> {
  return {
    contract: 'treasury',
    functionName: 'read_state',
    kind: 'read',
    args: undefined,
  }
}
