/** Human-facing aliases for frozen authority, registration and custody actions. @module */
import { buildCall, type FrozenCall } from './calls.ts'
import {
  contractId,
  fromHex,
  equalBytes,
  namehash,
  commitmentHash,
} from './bytes.ts'
import { stringifyJson, u64, U64_MAX } from './json.ts'
import {
  REGISTRATION_MIN_REVEAL_WAIT_BLOCKS,
  REGISTRATION_MAX_COMMITMENT_AGE_BLOCKS,
} from '../core/commitment.ts'
import { wireValue } from './wire.ts'
import type { DataDriver } from './driver.ts'
import type {
  Authority,
  NameRef,
  Register,
  RegistrationQuote,
  TypedPrincipal,
  RecordInput,
  Digest,
  CustodyIntent,
  Order,
  Terms,
} from './types.ts'
export interface TransferInput {
  name: NameRef
  owner: Authority
  manager: Authority
  clear_records: boolean
}
/** clear_records maps to the frozen identity-clearing flag (also clears primary identity). */
export function transferCall(
  store: string,
  input: TransferInput,
): FrozenCall<'store', 'update_authorities'> {
  return buildCall('store', store, 'update_authorities', {
    name: input.name,
    owner: input.owner,
    manager: input.manager,
    clear_identity: input.clear_records,
  })
}
export function reassignSubnameCall(
  store: string,
  input: TransferInput,
): FrozenCall<'store', 'update_authorities'> {
  return transferCall(store, input)
}
export interface RegistrationInput {
  actor: Authority
  label: string
  years: number
  secret: Digest
  commitmentStore: string
  /** Observed inclusion height of the original commitment. */
  commitHeight: bigint
  /** Inclusive transaction deadline; defaults to the last valid commitment block. */
  validUntil?: bigint
  quote: RegistrationQuote
  referrer?: TypedPrincipal | null
  records?: RecordInput[]
  primary?: number[] | null
}
export interface RegistrationCalls {
  commit: FrozenCall<'store', 'commit'>
  reveal: FrozenCall<'store', 'register'>
  commitment: Digest
}
/** Preserve the original commitment shard independently of the destination registration shard. */
export function registrationCalls(
  store: string,
  input: RegistrationInput,
): RegistrationCalls {
  const commitment = commitmentHash(input.actor, input.label, input.secret),
    quote = wireValue('RegistrationQuote', input.quote),
    commitHeight = u64(input.commitHeight),
    firstReveal = u64(commitHeight + REGISTRATION_MIN_REVEAL_WAIT_BLOCKS),
    windowEnd = commitHeight + REGISTRATION_MAX_COMMITMENT_AGE_BLOCKS,
    lastReveal = windowEnd > U64_MAX ? U64_MAX : windowEnd,
    validUntil = u64(input.validUntil === undefined ? lastReveal : input.validUntil)
  if (validUntil < firstReveal || validUntil > lastReveal)
    throw new Error(
      'Registration deadline is outside the commitment reveal window',
    )
  if (
    BigInt(quote.total_lux) !==
    BigInt(quote.quote.base_lux) + BigInt(quote.quote.premium_lux)
  )
    throw new Error('Registration quote total mismatch')
  if (!quote.quote.registration_open || quote.quote.label_status !== 'Public')
    throw new Error('Quote is not open for public registration')
  const args: Register = {
    node: namehash(`${input.label}.dusk`),
    label: input.label,
    years: input.years,
    commitment,
    secret: input.secret,
    commitment_store: fromHex(contractId(input.commitmentStore), 32),
    expected_fee_lux: quote.total_lux,
    expected_policy_version: quote.policy_version,
    expected_policy_config_version: quote.quote.config_version,
    valid_until: validUntil,
    referrer: input.referrer ?? null,
    records: input.records ?? [],
    primary: input.primary ?? null,
  }
  return {
    commit: buildCall('store', input.commitmentStore, 'commit', {
      hash: commitment,
    }),
    reveal: buildCall('store', store, 'register', args),
    commitment,
  }
}
export interface MarketplaceCalls {
  listFixed(intent: CustodyIntent): FrozenCall<'store', 'transfer_and_call'>
  auction(intent: CustodyIntent): FrozenCall<'store', 'transfer_and_call'>
  acceptOffer(
    order: Order,
    custodyNonce: bigint,
    validUntil: bigint,
  ): FrozenCall<'store', 'transfer_and_call'>
  buy(
    order: Order,
    manager: Authority,
    validUntil: bigint,
  ): FrozenCall<'marketplace', 'buy_fixed'>
  bid(
    order: Order,
    amountLux: string,
    manager: Authority,
    validUntil: bigint,
  ): FrozenCall<'marketplace', 'place_bid'>
  offer(
    terms: Terms,
    validUntil: bigint,
  ): FrozenCall<'marketplace', 'place_offer'>
  cancel(order: Order): FrozenCall<'marketplace', 'cancel_order'>
  settle(order: Order): FrozenCall<'marketplace', 'settle_auction'>
  expire(order: Order): FrozenCall<'marketplace', 'expire_order'>
  retryReturn(order: Order): FrozenCall<'marketplace', 'retry_return'>
}
/** Use the verified marketplace driver from client.release.drivers. Orders are copied and frozen. */
export function createMarketplaceCalls(
  market: string,
  directory: string,
  driver: DataDriver,
): MarketplaceCalls {
  market = contractId(market)
  directory = contractId(directory)
  function checkTerms(terms: Terms, kind?: Terms['kind']): void {
    wireValue('Terms', terms)
    if (
      contractId(terms.directory) !== directory ||
      terms.version !== 1 ||
      !equalBytes(terms.name.key.root, terms.name.key.node) ||
      (kind && terms.kind !== kind)
    )
      throw new Error(
        'Marketplace terms do not match reviewed deployment/root/order kind',
      )
  }
  function reviewed(order: Order, kind?: Terms['kind']): Order {
    checkTerms(order.terms, kind)
    return wireValue('Order', order)
  }
  function custody(
    intent: CustodyIntent,
    kind: Terms['kind'],
  ): FrozenCall<'store', 'transfer_and_call'> {
    checkTerms(intent.terms, kind)
    const data = driver.encodeInput(
      'custody_intent',
      stringifyJson(wireValue('CustodyIntent', intent)),
    )
    if (data.length > 4096) throw new Error('Custody intent exceeds 4096 bytes')
    return buildCall(
      'store',
      contractId(intent.terms.store),
      'transfer_and_call',
      {
        name: intent.terms.name,
        target: fromHex(market, 32),
        callback_gas: 500_000_000n,
        data: Array.from(data),
      },
    )
  }
  return {
    listFixed: (intent) => custody(intent, 'Fixed'),
    auction: (intent) => custody(intent, 'Auction'),
    acceptOffer(order, custodyNonce, validUntil) {
      const o = reviewed(order, 'Offer')
      if (o.status !== 'Open') throw new Error('Offer is not open')
      return custody(
        { terms: o.terms, nonce: custodyNonce, valid_until: validUntil },
        'Offer',
      )
    },
    buy: (order, manager, valid_until) =>
      buildCall('marketplace', market, 'buy_fixed', {
        order: reviewed(order, 'Fixed'),
        manager,
        valid_until,
      }),
    bid: (order, amount_lux, manager, valid_until) =>
      buildCall('marketplace', market, 'place_bid', {
        order: reviewed(order, 'Auction'),
        amount_lux,
        manager,
        valid_until,
      }),
    offer(terms, valid_until) {
      checkTerms(terms, 'Offer')
      return buildCall('marketplace', market, 'place_offer', {
        terms,
        valid_until,
      })
    },
    cancel: (order) =>
      buildCall('marketplace', market, 'cancel_order', reviewed(order)),
    settle: (order) =>
      buildCall(
        'marketplace',
        market,
        'settle_auction',
        reviewed(order, 'Auction'),
      ),
    expire: (order) =>
      buildCall('marketplace', market, 'expire_order', reviewed(order)),
    retryReturn: (order) =>
      buildCall('marketplace', market, 'retry_return', reviewed(order)),
  }
}
