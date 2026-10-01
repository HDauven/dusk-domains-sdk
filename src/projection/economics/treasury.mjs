import {
  arrayOfStrings,
  legacyPhoenixPrincipal,
  normalizePrincipal,
  principalKey,
} from './principals.mjs'

export function emptyTreasuryState() {
  return {
    initialized: false,
    operator: null,
    pendingOperator: null,
    pendingOperatorRecipient: null,
    operatorAuthority: null,
    operatorRecipient: null,
    allowedFeeSources: [],
    totalReceivedLux: 0,
    availableLux: 0,
    registrationReceivedLux: 0,
    renewalReceivedLux: 0,
    otherReceivedLux: 0,
    referralClaimableLux: 0,
    referralClaimedLux: 0,
    referralCount: 0,
    lastFeeSourceContract: null,
    lastFeeReason: null,
    lastFeeNode: null,
    lastEventType: null,
    txId: null,
    blockHeight: null,
    claims: [],
  }
}

export function normalizeTreasuryState(value) {
  if (!value || typeof value !== 'object') return emptyTreasuryState()
  const operator = normalizePrincipal(value.operator ?? value.operator_principal ?? null)
    ?? legacyPhoenixPrincipal(value.operatorAuthority ?? value.operator_authority ?? null)
  return {
    initialized: Boolean(value.initialized),
    operator,
    operatorAuthority: value.operatorAuthority ?? value.operator_authority ?? principalKey(operator) ?? null,
    operatorRecipient: value.operatorRecipient ?? value.operator_recipient ?? null,
    pendingOperator: normalizePrincipal(value.pendingOperator ?? value.pending_operator ?? null),
    pendingOperatorRecipient: value.pendingOperatorRecipient ?? value.pending_operator_recipient ?? null,
    allowedFeeSources: arrayOfStrings(value.allowedFeeSources ?? value.allowed_fee_sources),
    totalReceivedLux: Number(value.totalReceivedLux ?? value.total_received_lux ?? 0),
    availableLux: Number(value.availableLux ?? value.available_lux ?? 0),
    registrationReceivedLux: Number(value.registrationReceivedLux ?? value.registration_received_lux ?? 0),
    renewalReceivedLux: Number(value.renewalReceivedLux ?? value.renewal_received_lux ?? 0),
    otherReceivedLux: Number(value.otherReceivedLux ?? value.other_received_lux ?? 0),
    referralClaimableLux: Number(value.referralClaimableLux ?? value.referral_claimable_lux ?? 0),
    referralClaimedLux: Number(value.referralClaimedLux ?? value.referral_claimed_lux ?? 0),
    referralCount: Number(value.referralCount ?? value.referral_count ?? 0),
    lastFeeSourceContract: value.lastFeeSourceContract ?? value.last_fee_source_contract ?? null,
    lastFeeReason: value.lastFeeReason ?? value.last_fee_reason ?? null,
    lastFeeNode: value.lastFeeNode ?? value.last_fee_node ?? null,
    lastEventType: value.lastEventType ?? value.last_event_type ?? null,
    txId: value.txId ?? value.tx_id ?? null,
    blockHeight: value.blockHeight ?? value.block_height ?? null,
    claims: normalizeTreasuryClaims(value.claims),
  }
}

export function reduceTreasuryEvent(event, current, meta) {
  if (event.type === 'treasury_initialized') {
    const operator = normalizePrincipal(event.operator) ?? legacyPhoenixPrincipal(event.operatorAuthority ?? event.operator_authority ?? null)
    return {
      ...current,
      initialized: true,
      operator,
      operatorAuthority: event.operatorAuthority ?? principalKey(operator),
      operatorRecipient: event.operatorRecipient,
      pendingOperator: null,
      pendingOperatorRecipient: null,
      allowedFeeSources: arrayOfStrings(event.allowedFeeSources),
      lastEventType: event.type,
      txId: meta.txId ?? current.txId,
      blockHeight: meta.blockHeight ?? current.blockHeight,
    }
  }

  if (event.type === 'treasury_operator_proposed' || event.type === 'treasury_operator_cancelled') {
    return {
      ...current,
      pendingOperator: event.type === 'treasury_operator_proposed' ? normalizePrincipal(event.pendingOperator) : null,
      pendingOperatorRecipient: event.type === 'treasury_operator_proposed' ? event.pendingOperatorRecipient : null,
      lastEventType: event.type,
      txId: meta.txId ?? current.txId,
      blockHeight: meta.blockHeight ?? current.blockHeight,
    }
  }

  if (event.type === 'treasury_operator_changed') {
    const operator = normalizePrincipal(event.operator) ?? legacyPhoenixPrincipal(event.operatorAuthority ?? event.operator_authority ?? null)
    return {
      ...current,
      operator: operator ?? current.operator,
      operatorAuthority: event.operatorAuthority ?? principalKey(operator) ?? current.operatorAuthority,
      operatorRecipient: event.operatorRecipient ?? current.operatorRecipient,
      pendingOperator: null,
      pendingOperatorRecipient: null,
      lastEventType: event.type,
      txId: meta.txId ?? current.txId,
      blockHeight: meta.blockHeight ?? current.blockHeight,
    }
  }

  if (event.type === 'treasury_fee_received') {
    return {
      ...current,
      totalReceivedLux: Number(event.totalReceivedLux ?? 0),
      availableLux: Number(event.availableLux ?? 0),
      registrationReceivedLux: Number(event.registrationReceivedLux ?? 0),
      renewalReceivedLux: Number(event.renewalReceivedLux ?? 0),
      otherReceivedLux: Number(event.otherReceivedLux ?? 0),
      lastFeeSourceContract: event.sourceContract ?? null,
      lastFeeReason: event.reason ?? null,
      lastFeeNode: event.node ?? null,
      lastEventType: event.type,
      txId: meta.txId ?? current.txId,
      blockHeight: meta.blockHeight ?? current.blockHeight,
    }
  }

  const operator = normalizePrincipal(event.operator) ?? legacyPhoenixPrincipal(event.operatorAuthority ?? event.operator_authority ?? null)
  return {
    ...current,
    operator: operator ?? current.operator,
    operatorAuthority: event.operatorAuthority ?? principalKey(operator) ?? current.operatorAuthority,
    operatorRecipient: event.operatorRecipient ?? current.operatorRecipient,
    availableLux: Number(event.remainingLux ?? current.availableLux),
    lastEventType: event.type,
    txId: meta.txId ?? current.txId,
    blockHeight: meta.blockHeight ?? current.blockHeight,
    claims: [
      {
        operator: operator ?? current.operator,
        operatorAuthority: event.operatorAuthority ?? principalKey(operator) ?? current.operatorAuthority ?? '',
        operatorRecipient: event.operatorRecipient ?? current.operatorRecipient ?? '',
        amountLux: Number(event.amountLux ?? 0),
        remainingLux: Number(event.remainingLux ?? current.availableLux),
        txId: meta.txId ?? null,
        blockHeight: meta.blockHeight ?? null,
      },
      ...(current.claims ?? []),
    ].slice(0, 12),
  }
}

export function reduceTreasuryReferralReserve(event, current) {
  if (event.type !== 'referral_reward_accrued') return current
  const amountLux = Number(event.amountLux ?? event.amount_lux ?? 0)
  return {
    ...current,
    availableLux: Math.max(0, Number(current.availableLux ?? 0) - amountLux),
    referralClaimableLux: Number(current.referralClaimableLux ?? 0) + amountLux,
    referralCount: Number(current.referralCount ?? 0) + 1,
  }
}

export function reduceTreasuryReferralClaim(event, current) {
  if (event.type !== 'referral_reward_claimed') return current
  const amountLux = Number(event.amountLux ?? event.amount_lux ?? 0)
  return {
    ...current,
    referralClaimableLux: Math.max(0, Number(current.referralClaimableLux ?? 0) - amountLux),
    referralClaimedLux: Number(current.referralClaimedLux ?? 0) + amountLux,
  }
}

function normalizeTreasuryClaims(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((claim) => normalizeTreasuryClaim(claim))
    .filter(Boolean)
    .slice(0, 12)
}

function normalizeTreasuryClaim(value) {
  if (!value || typeof value !== 'object') return null
  const operator = normalizePrincipal(value.operator ?? value.operator_principal ?? null)
    ?? legacyPhoenixPrincipal(value.operatorAuthority ?? value.operator_authority ?? null)
  return {
    operator,
    operatorAuthority: value.operatorAuthority ?? value.operator_authority ?? principalKey(operator) ?? '',
    operatorRecipient: value.operatorRecipient ?? value.operator_recipient ?? '',
    amountLux: Number(value.amountLux ?? value.amount_lux ?? 0),
    remainingLux: Number(value.remainingLux ?? value.remaining_lux ?? 0),
    txId: value.txId ?? value.tx_id ?? null,
    blockHeight: value.blockHeight ?? value.block_height ?? null,
  }
}
