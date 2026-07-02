import type { DuskNameContractMap } from './callTypes'

export const DUSK_NAME_PLACEHOLDER_CONTRACT_ID = '0x0000000000000000000000000000000000000000000000000000000000000000'

export const DUSK_NAME_CONTRACTS: DuskNameContractMap = {
  core: {
    contractId: DUSK_NAME_PLACEHOLDER_CONTRACT_ID,
    driverUrl: '/contracts/dusk-names-core.data-driver.wasm',
    name: 'Dusk Domains Core',
    methodSigs: {
      init: 'init(InitCoreRuntime)',
      set_referral_config_runtime: 'set_referral_config_runtime(SetReferralConfigRuntime)',
      set_fee_config_runtime: 'set_fee_config_runtime(SetFeeConfigRuntime)',
      commit_runtime: 'commit_runtime(CommitRegistrationRuntime)',
      complete_registration_runtime: 'complete_registration_runtime(CompleteRegistrationRuntime)',
      renew_runtime: 'renew_runtime(RenewNameRuntime)',
      update_authorities_runtime: 'update_authorities_runtime(UpdateAuthoritiesRuntime)',
      set_record_sender_runtime: 'set_record_sender_runtime(SetRecordSenderRuntime)',
      clear_record_sender_runtime: 'clear_record_sender_runtime(ClearRecordSenderRuntime)',
      mutate_records_sender_runtime: 'mutate_records_sender_runtime(MutateRecordsSenderRuntime)',
      set_primary_name_runtime: 'set_primary_name_runtime(SetPrimaryNameRuntime)',
      clear_primary_name_runtime: 'clear_primary_name_runtime(ClearPrimaryNameRuntime)',
      create_subname_runtime: 'create_subname_runtime(CreateSubnameRuntime)',
      get_name: 'get_name(GetName)',
      read_record: 'read_record(ReadRecord)',
      read_primary_name: 'read_primary_name(ReadPrimaryName)',
      pending_commitment: 'pending_commitment(PendingCommitmentQuery)',
      fee_config: 'fee_config',
    },
  },
  treasury: {
    contractId: DUSK_NAME_PLACEHOLDER_CONTRACT_ID,
    driverUrl: '/contracts/dusk-name-treasury.data-driver.wasm',
    name: 'Dusk Domain Treasury',
    methodSigs: {
      init: 'init(InitTreasury)',
      update_operator_runtime: 'update_operator_runtime(UpdateTreasuryOperatorRuntime)',
      claim_runtime: 'claim_runtime(ClaimTreasuryRuntime)',
      claim_all_runtime: 'claim_all_runtime',
      claim_referral_reward_runtime: 'claim_referral_reward_runtime(ClaimReferralRewardRuntime)',
      claim_all_referral_rewards_runtime: 'claim_all_referral_rewards_runtime(ClaimAllReferralRewardsRuntime)',
      read_state: 'read_state',
    },
  },
}
