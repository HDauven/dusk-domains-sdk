import {
  bytesToBase58,
  bytesToHex,
  bytesToUtf8,
  endpointKindToRecordKey,
  enumValue,
  feeConfigFromEvent,
  lifecycleValueToIso as blockHeightToIso,
  numberOrNull,
  numericBlockHeight,
  principalFromEvent,
  treasuryReasonName,
  withHexPrefix,
} from './event-value-codecs.mjs'

const defaultTargetBlockSeconds = 10

/**
 * @param {{ contract: { key: string, contractId: string }, eventName: string,
 *   event: Record<string, unknown>, observedAt: string, observedBlockHeight?: number | null,
 *   targetBlockSeconds?: number }} input
 */
export function normalizeObservedEvent({
  contract,
  eventName,
  event,
  observedAt,
  observedBlockHeight = null,
  targetBlockSeconds = defaultTargetBlockSeconds,
}) {
  assertSafeEventNumbers(event)
  const eventHeight = numericBlockHeight([
    'created_at', 'updated_at', 'opened_at', 'closed_at', 'filled_at',
    'placed_at', 'cancelled_at', 'settled_at', 'accepted_at', 'claimed_at',
    'observed_at', 'released_at', 'pruned_at', 'issued_at',
  ].map(key => event[key]).find(value => value != null) ?? event.record?.updated_at ?? event.config?.updated_at)
  const anchor = eventHeight ?? numericBlockHeight(observedBlockHeight)
  const lifecycleValueToIso = (value, time, seconds) => blockHeightToIso(value, time, seconds, anchor)
  const meta = {
    txId: null,
    blockHeight: eventHeight,
    observedBlockHeight: numericBlockHeight(observedBlockHeight),
    timeSource: 'observation',
    source: 'w3sper-live-subscription',
    observedAt,
    contractKey: contract.key,
    contractId: withHexPrefix(contract.contractId),
  }

  if (eventName === 'registration_committed') {
    const committedBlockHeight = numericBlockHeight(event.created_at)
    return {
      event: {
        type: 'registration_committed',
        commitment: bytesToHex(event.commitment),
        controller: bytesToHex(event.controller),
        createdAt: observedAt,
      },
      meta: {
        ...meta,
        blockHeight: committedBlockHeight,
      },
    }
  }

  if (eventName === 'registration_revealed') {
    return {
      event: {
        type: 'registration_revealed',
        commitment: bytesToHex(event.commitment),
        node: bytesToHex(event.node),
        controller: bytesToHex(event.controller),
      },
      meta,
    }
  }

  if (eventName === 'reserved_name_issued') {
    const operator = principalFromEvent(event.operator)
    return {
      event: {
        type: 'reserved_name_issued',
        node: bytesToHex(event.node),
        label: event.label,
        actor: operator?.kind === 'Moonlight' ? bytesToBase58(operator.bytes) : bytesToHex(operator?.bytes),
        owner: bytesToHex(event.owner),
        manager: bytesToHex(event.manager),
        registry: bytesToHex(event.registry),
        operator,
        issuedAt: observedAt,
        issuedAtBlockHeight: numericBlockHeight(event.issued_at),
      },
      meta,
    }
  }

  if (eventName === 'name_registered') {
    return {
      event: {
        type: 'name_registered',
        node: bytesToHex(event.node),
        label: event.label,
        actor: bytesToHex(event.actor),
        owner: bytesToHex(event.owner),
        expiresAt: lifecycleValueToIso(event.expires_at, observedAt, targetBlockSeconds),
        graceEndsAt: lifecycleValueToIso(event.grace_ends_at, observedAt, targetBlockSeconds),
        expiresAtBlockHeight: numberOrNull(event.expires_at),
        graceEndsAtBlockHeight: numberOrNull(event.grace_ends_at),
        feeLux: Number(event.fee_lux ?? 0),
      },
      meta,
    }
  }

  if (eventName === 'name_renewed') {
    return {
      event: {
        type: 'name_renewed',
        node: bytesToHex(event.node),
        actor: bytesToHex(event.actor),
        expiresAt: lifecycleValueToIso(event.expires_at, observedAt, targetBlockSeconds),
        graceEndsAt: lifecycleValueToIso(event.grace_ends_at, observedAt, targetBlockSeconds),
        expiresAtBlockHeight: numberOrNull(event.expires_at),
        graceEndsAtBlockHeight: numberOrNull(event.grace_ends_at),
        feeLux: Number(event.fee_lux ?? 0),
      },
      meta,
    }
  }

  if (eventName === 'name_expired') {
    return {
      event: {
        type: 'name_expired',
        node: bytesToHex(event.node),
        label: event.label,
        actor: bytesToHex(event.actor),
        owner: bytesToHex(event.owner),
        expiresAt: lifecycleValueToIso(event.expires_at, observedAt, targetBlockSeconds),
        graceEndsAt: lifecycleValueToIso(event.grace_ends_at, observedAt, targetBlockSeconds),
        expiresAtBlockHeight: numberOrNull(event.expires_at),
        graceEndsAtBlockHeight: numberOrNull(event.grace_ends_at),
        observedAt: lifecycleValueToIso(event.observed_at, observedAt, targetBlockSeconds),
      },
      meta,
    }
  }

  if (eventName === 'name_released') {
    return {
      event: {
        type: 'name_released',
        node: bytesToHex(event.node),
        label: event.label,
        actor: bytesToHex(event.actor),
        previousOwner: bytesToHex(event.previous_owner),
        releasedAt: lifecycleValueToIso(event.released_at, observedAt, targetBlockSeconds),
      },
      meta,
    }
  }

  if (eventName === 'name_owner_changed') {
    return {
      event: {
        type: 'name_owner_changed',
        node: bytesToHex(event.node),
        actor: bytesToHex(event.actor),
        previousOwner: bytesToHex(event.previous_owner),
        owner: bytesToHex(event.owner),
        manager: bytesToHex(event.manager),
        resolver: bytesToHex(event.resolver),
        expiresAt: lifecycleValueToIso(event.expires_at, observedAt, targetBlockSeconds),
        expiresAtBlockHeight: numberOrNull(event.expires_at),
      },
      meta,
    }
  }

  if (eventName === 'resolver_changed') {
    return {
      event: {
        type: 'resolver_changed',
        node: bytesToHex(event.node),
        actor: bytesToHex(event.actor),
        resolver: bytesToHex(event.resolver),
      },
      meta,
    }
  }

  if (eventName === 'subname_created') {
    return {
      event: {
        type: 'subname_created',
        parentNode: bytesToHex(event.parent_node),
        node: bytesToHex(event.node),
        parentName: event.parent_name,
        name: event.name,
        label: event.label,
        actor: bytesToHex(event.actor),
        owner: bytesToHex(event.owner),
        manager: bytesToHex(event.manager),
        resolver: bytesToHex(event.resolver),
        expiresAt: lifecycleValueToIso(event.expires_at, observedAt, targetBlockSeconds),
        parentExpiresAt: lifecycleValueToIso(event.parent_expires_at, observedAt, targetBlockSeconds),
        expiresAtBlockHeight: numberOrNull(event.expires_at),
        parentExpiresAtBlockHeight: numberOrNull(event.parent_expires_at),
        expiryPolicy: enumValue(event.expiry_policy) === 'FixedBeforeParent' ? 'fixed_before_parent' : 'inherits_parent',
        createdAt: lifecycleValueToIso(event.created_at, observedAt, targetBlockSeconds),
      },
      meta,
    }
  }

  if (eventName === 'subname_pruned') {
    return {
      event: {
        type: 'subname_pruned',
        parentNode: bytesToHex(event.parent_node),
        node: bytesToHex(event.node),
        name: event.name,
        actor: bytesToHex(event.actor),
        prunedAt: lifecycleValueToIso(event.pruned_at, observedAt, targetBlockSeconds),
      },
      meta,
    }
  }

  if (eventName === 'record_changed') {
    return {
      event: {
        type: 'record_changed',
        node: bytesToHex(event.node),
        controller: bytesToHex(event.controller),
        record: {
          key: event.record?.key,
          value: recordValueFromEvent(event.record?.key, event.record?.value),
          visibility: event.record?.key === 'phoenix_payment_endpoint' ? 'sensitive_public' : 'public',
          updatedAt: lifecycleValueToIso(event.record?.updated_at, observedAt, targetBlockSeconds),
          updatedAtBlockHeight: numberOrNull(event.record?.updated_at),
          ttlSeconds: Number(event.record?.ttl_seconds ?? 300),
        },
      },
      meta,
    }
  }

  if (eventName === 'record_cleared') {
    return {
      event: {
        type: 'record_cleared',
        node: bytesToHex(event.node),
        controller: bytesToHex(event.controller),
        key: event.key,
      },
      meta,
    }
  }

  if (eventName === 'primary_name_changed') {
    return {
      event: {
        type: 'primary_name_changed',
        endpoint: {
          type: endpointKindToRecordKey(event.endpoint?.kind),
          value: endpointValueFromEvent(event.endpoint?.kind, event.endpoint?.value),
        },
        controller: bytesToHex(event.controller),
        node: bytesToHex(event.node),
        name: event.name,
        previousName: event.previous_name ?? null,
        updatedAt: lifecycleValueToIso(event.updated_at, observedAt, targetBlockSeconds),
        updatedAtBlockHeight: numberOrNull(event.updated_at),
      },
      meta,
    }
  }

  if (eventName === 'core_referral_config_changed') {
    return {
      event: {
        type: 'core_referral_config_changed',
        operator: principalFromEvent(event.operator, event.operator_authority),
        previousReferralRewardBps: Number(event.previous_referral_reward_bps ?? 0),
        referralRewardBps: Number(event.referral_reward_bps ?? 0),
      },
      meta,
    }
  }

  if (eventName === 'registrations_paused_changed' || eventName === 'trading_paused_changed') {
    if (typeof event.paused !== 'boolean') throw new Error('Pause event requires a boolean paused value')
    return {
      event: {
        type: eventName,
        paused: event.paused,
        operator: eventName === 'registrations_paused_changed'
          ? principalFromEvent(event.operator) : bytesToHex(event.operator),
        updatedAtBlockHeight: numberOrNull(event.updated_at),
      },
      meta,
    }
  }
  if (eventName === 'fee_config_updated') {
    return {
      event: {
        type: 'fee_config_updated',
        operator: principalFromEvent(event.operator, event.operator_authority),
        previousConfig: feeConfigFromEvent(event.previous_config),
        config: feeConfigFromEvent(event.config),
      },
      meta,
    }
  }

  if (eventName === 'records_moved') {
    return {
      event: {
        type: 'records_moved',
        node: bytesToHex(event.node),
        controller: bytesToHex(event.controller),
        fromResolver: bytesToHex(event.from_resolver),
        toResolver: bytesToHex(event.to_resolver),
        recordCount: Number(event.record_count ?? 0),
      },
      meta,
    }
  }

  if (eventName === 'router_initialized') {
    return {
      event: {
        type: 'router_initialized',
        operator: principalFromEvent(event.operator),
        treasury: bytesToHex(event.treasury),
        marketplace: bytesToHex(event.marketplace),
        feeConfig: feeConfigFromEvent(event.fee_config),
      },
      meta,
    }
  }

  if (eventName === 'pool_member_added') {
    return {
      event: {
        type: 'pool_member_added',
        kind: String(event.kind).toLowerCase(),
        member: bytesToHex(event.member),
        index: Number(event.index ?? 0),
        operator: principalFromEvent(event.operator),
      },
      meta,
    }
  }

  if (['router_operator_proposed', 'treasury_operator_proposed', 'marketplace_operator_proposed'].includes(eventName)) {
    const decodeOperator = eventName.startsWith('marketplace_') ? bytesToHex : principalFromEvent
    return {
      event: {
        type: eventName,
        operator: decodeOperator(event.operator),
        pendingOperator: decodeOperator(event.pending_operator),
        ...(eventName === 'treasury_operator_proposed'
          ? { pendingOperatorRecipient: bytesToBase58(event.pending_operator_recipient) }
          : {}),
      },
      meta,
    }
  }

  if (['router_operator_cancelled', 'treasury_operator_cancelled', 'marketplace_operator_cancelled'].includes(eventName)) {
    return {
      event: {
        type: eventName,
        operator: eventName.startsWith('marketplace_') ? bytesToHex(event.operator) : principalFromEvent(event.operator),
      },
      meta,
    }
  }

  if (eventName === 'marketplace_operator_changed') {
    return {
      event: {
        type: eventName,
        operator: bytesToHex(event.operator),
        previousOperator: bytesToHex(event.previous_operator),
      },
      meta,
    }
  }

  if (eventName === 'router_operator_changed') {
    return {
      event: {
        type: 'router_operator_changed',
        previousOperator: principalFromEvent(event.previous_operator),
        operator: principalFromEvent(event.operator),
      },
      meta,
    }
  }

  if (eventName === 'treasury_initialized') {
    return {
      event: {
        type: 'treasury_initialized',
        operator: principalFromEvent(event.operator, event.operator_authority),
        operatorRecipient: bytesToBase58(event.operator_recipient),
        allowedFeeSources: (event.allowed_fee_sources ?? []).map(bytesToHex),
        router: bytesToHex(event.router),
      },
      meta,
    }
  }

  if (eventName === 'treasury_operator_changed') {
    return {
      event: {
        type: 'treasury_operator_changed',
        previousOperator: principalFromEvent(event.previous_operator, event.previous_operator_authority),
        operator: principalFromEvent(event.operator, event.operator_authority),
        operatorRecipient: bytesToBase58(event.operator_recipient),
      },
      meta,
    }
  }

  if (eventName === 'treasury_fee_received') {
    return {
      event: {
        type: 'treasury_fee_received',
        sourceContract: bytesToHex(event.source_contract),
        reason: treasuryReasonName(event.reason),
        node: bytesToHex(event.node),
        amountLux: Number(event.amount_lux ?? 0),
        totalReceivedLux: Number(event.total_received_lux ?? 0),
        availableLux: Number(event.available_lux ?? 0),
        registrationReceivedLux: Number(event.registration_received_lux ?? 0),
        renewalReceivedLux: Number(event.renewal_received_lux ?? 0),
        otherReceivedLux: Number(event.other_received_lux ?? 0),
      },
      meta,
    }
  }

  if (eventName === 'treasury_claimed') {
    return {
      event: {
        type: 'treasury_claimed',
        operator: principalFromEvent(event.operator, event.operator_authority),
        operatorRecipient: bytesToBase58(event.operator_recipient),
        amountLux: Number(event.amount_lux ?? 0),
        remainingLux: Number(event.remaining_lux ?? 0),
      },
      meta,
    }
  }

  if (eventName === 'referral_reward_accrued') {
    return {
      event: {
        type: 'referral_reward_accrued',
        referrer: principalFromEvent(event.referrer, event.referrer_authority),
        buyer: principalFromEvent(event.buyer, event.buyer_authority),
        node: bytesToHex(event.node),
        amountLux: Number(event.amount_lux ?? 0),
        claimableLux: Number(event.claimable_lux ?? 0),
        claimedLux: Number(event.claimed_lux ?? 0),
        referralCount: Number(event.referral_count ?? 0),
      },
      meta,
    }
  }

  if (eventName === 'referral_reward_claimed') {
    return {
      event: {
        type: 'referral_reward_claimed',
        referrer: principalFromEvent(event.referrer, event.referrer_authority),
        recipient: bytesToBase58(event.referrer_recipient),
        amountLux: Number(event.amount_lux ?? 0),
        remainingLux: Number(event.remaining_lux ?? 0),
        claimedLux: Number(event.claimed_lux ?? 0),
        referralCount: Number(event.referral_count ?? 0),
      },
      meta,
    }
  }

  if (eventName === 'marketplace_initialized') {
    return {
      event: {
        type: 'marketplace_initialized',
        router: bytesToHex(event.router),
        treasuryContract: bytesToHex(event.treasury_contract),
        marketplaceAuthority: bytesToHex(event.marketplace_authority),
        operator: bytesToHex(event.operator),
        feeBps: Number(event.fee_bps ?? 0),
      },
      meta,
    }
  }

  if (eventName === 'marketplace_config_updated') {
    return {
      event: {
        type: 'marketplace_config_updated',
        operator: bytesToHex(event.operator),
        previousOperator: bytesToHex(event.previous_operator),
        previousFeeBps: Number(event.previous_fee_bps ?? 0),
        feeBps: Number(event.fee_bps ?? 0),
        updatedAtBlockHeight: Number(event.updated_at ?? 0),
      },
      meta,
    }
  }

  if (eventName === 'domain_fixed_sale_opened') {
    return {
      event: {
        type: 'domain_fixed_sale_opened',
        node: bytesToHex(event.node),
        name: event.name,
        sellerAuthority: bytesToHex(event.seller_authority),
        priceLux: Number(event.price_lux ?? 0),
        privateBuyer: event.private_buyer == null ? null : bytesToHex(event.private_buyer),
        feeBps: Number(event.fee_bps ?? 0),
        expiresAtBlockHeight: Number(event.expires_at ?? 0),
        openedAtBlockHeight: Number(event.opened_at ?? 0),
      },
      meta,
    }
  }

  if (eventName === 'domain_fixed_sale_closed') {
    return {
      event: {
        type: 'domain_fixed_sale_closed',
        node: bytesToHex(event.node),
        sellerAuthority: bytesToHex(event.seller_authority),
        expired: Boolean(event.expired),
        domainExpired: Boolean(event.domain_expired),
        closedAtBlockHeight: Number(event.closed_at ?? 0),
      },
      meta,
    }
  }

  if (eventName === 'domain_fixed_sale_filled') {
    return {
      event: {
        type: 'domain_fixed_sale_filled',
        node: bytesToHex(event.node),
        name: event.name,
        sellerAuthority: bytesToHex(event.seller_authority),
        buyerAuthority: bytesToHex(event.buyer_authority),
        grossAmountLux: Number(event.gross_amount_lux ?? 0),
        protocolFeeLux: Number(event.protocol_fee_lux ?? 0),
        sellerProceedsLux: Number(event.seller_proceeds_lux ?? 0),
        filledAtBlockHeight: Number(event.filled_at ?? 0),
      },
      meta,
    }
  }

  if (eventName === 'domain_auction_created') {
    return {
      event: {
        type: 'domain_auction_created',
        node: bytesToHex(event.node),
        name: event.name,
        sellerAuthority: bytesToHex(event.seller_authority),
        reservePriceLux: Number(event.reserve_price_lux ?? 0),
        durationBlocks: Number(event.duration_blocks ?? 0),
        startDeadlineBlockHeight: Number(event.start_deadline ?? 0),
        feeBps: Number(event.fee_bps ?? 0),
        createdAtBlockHeight: Number(event.created_at ?? 0),
      },
      meta,
    }
  }

  if (eventName === 'domain_bid_placed') {
    return {
      event: {
        type: 'domain_bid_placed',
        node: bytesToHex(event.node),
        bidderAuthority: bytesToHex(event.bidder_authority),
        amountLux: Number(event.amount_lux ?? 0),
        previousBidderAuthority: event.previous_bidder_authority == null ? null : bytesToHex(event.previous_bidder_authority),
        previousBidLux: Number(event.previous_bid_lux ?? 0),
        startBlock: Number(event.start_block ?? 0),
        endBlock: Number(event.end_block ?? 0),
        started: Boolean(event.started),
        extended: Boolean(event.extended),
        bidCount: Number(event.bid_count ?? 0),
        placedAtBlockHeight: Number(event.placed_at ?? 0),
      },
      meta,
    }
  }

  if (eventName === 'domain_auction_cancelled') {
    return {
      event: {
        type: 'domain_auction_cancelled',
        node: bytesToHex(event.node),
        sellerAuthority: bytesToHex(event.seller_authority),
        expired: Boolean(event.expired),
        domainExpired: Boolean(event.domain_expired),
        cancelledAtBlockHeight: Number(event.cancelled_at ?? 0),
      },
      meta,
    }
  }

  if (eventName === 'domain_auction_settled') {
    return {
      event: {
        type: 'domain_auction_settled',
        node: bytesToHex(event.node),
        name: event.name,
        sellerAuthority: bytesToHex(event.seller_authority),
        winnerAuthority: event.winner_authority == null ? null : bytesToHex(event.winner_authority),
        grossAmountLux: Number(event.gross_amount_lux ?? 0),
        protocolFeeLux: Number(event.protocol_fee_lux ?? 0),
        sellerProceedsLux: Number(event.seller_proceeds_lux ?? 0),
        domainExpired: Boolean(event.domain_expired),
        settledAtBlockHeight: Number(event.settled_at ?? 0),
      },
      meta,
    }
  }

  if (eventName === 'domain_offer_placed') {
    return {
      event: {
        type: 'domain_offer_placed',
        node: bytesToHex(event.node),
        buyerAuthority: bytesToHex(event.buyer_authority),
        amountLux: Number(event.amount_lux ?? 0),
        feeBps: Number(event.fee_bps ?? 0),
        expiresAtBlockHeight: Number(event.expires_at ?? 0),
        placedAtBlockHeight: Number(event.placed_at ?? 0),
      },
      meta,
    }
  }

  if (eventName === 'domain_offer_closed') {
    return {
      event: {
        type: 'domain_offer_closed',
        node: bytesToHex(event.node),
        buyerAuthority: bytesToHex(event.buyer_authority),
        amountLux: Number(event.amount_lux ?? 0),
        expired: Boolean(event.expired),
        closedAtBlockHeight: Number(event.closed_at ?? 0),
      },
      meta,
    }
  }

  if (eventName === 'domain_offer_accepted') {
    return {
      event: {
        type: 'domain_offer_accepted',
        node: bytesToHex(event.node),
        sellerAuthority: bytesToHex(event.seller_authority),
        buyerAuthority: bytesToHex(event.buyer_authority),
        grossAmountLux: Number(event.gross_amount_lux ?? 0),
        protocolFeeLux: Number(event.protocol_fee_lux ?? 0),
        sellerProceedsLux: Number(event.seller_proceeds_lux ?? 0),
        acceptedAtBlockHeight: Number(event.accepted_at ?? 0),
      },
      meta,
    }
  }

  if (eventName === 'marketplace_refund_claimed') {
    return {
      event: {
        type: 'marketplace_refund_claimed',
        authority: bytesToHex(event.authority),
        recipient: bytesToBase58(event.recipient),
        amountLux: Number(event.amount_lux ?? 0),
        claimedAtBlockHeight: Number(event.claimed_at ?? 0),
      },
      meta,
    }
  }

  return null
}

function assertSafeEventNumbers(value, path = 'event') {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`${path} contains an unsafe numeric value`)
    }
    return
  }
  if (typeof value === 'bigint') {
    if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(`${path} contains an unsafe numeric value`)
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeEventNumbers(item, `${path}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' && isNumericEventField(key) && /^\d+$/u.test(item)) {
      const parsed = BigInt(item)
      if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error(`${path}.${key} contains an unsafe numeric value`)
      }
      continue
    }
    assertSafeEventNumbers(item, `${path}.${key}`)
  }
}

function isNumericEventField(key) {
  return /(?:^|_)(?:lux|bps|at|height|block|blocks|count|seconds|years)$/u.test(key)
}

function recordValueFromEvent(key, value) {
  return key === 'moonlight_address' ? bytesToBase58(value) : bytesToUtf8(value)
}

function endpointValueFromEvent(kind, value) {
  return endpointKindToRecordKey(kind) === 'moonlight_address' ? bytesToBase58(value) : bytesToUtf8(value)
}
