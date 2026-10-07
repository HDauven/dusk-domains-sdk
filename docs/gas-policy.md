# Provisional frozen gas policy

Every public write has an explicit entry in `GAS_LIMITS`; there is no generic
wallet fallback. Calls cannot override the limit. The direct public wallet path
is supported; arbitrary additional contract-wallet nesting needs its own budget.

| Action family | Wallet limit |
| --- | ---: |
| Commit, simple pause/delay controls | 100M |
| Authority/primary clear/cancel, several governance/maintenance actions | 150M |
| Subname create and vault/refund claims | 200M |
| Records, primary set, custody return, directory execute | 300M |
| Register, renew, reserved issuance, preserving record move, bids/offers | 500M |
| Subtree removal/take-back, custody callbacks, marketplace delivery/settlement/return/renewal | 1,000M |
| Move prepare, stage, finalize, source/target cleanup | 3,000M |

The exact table in `src/frozen/gas.ts` is authoritative. These are provisional
wallet envelopes, not measured consumption. §12.1 specifies finalization's 200M
wrapper, 150M preflight, 1,500M activation, 150M completion and 2,000M total
implementation budgets. The SDK submits with the full 3,000M production ceiling
to preserve nested-call and strictly-greater reserve headroom. Spec maximum
callback gas is 500M; marketplace custody builders use that explicit allowance.
The policy quote allowance is 50M plus a 10M failure reserve.

The spec gives no measured per-action limits for ordinary frozen writes or move
preparation/staging/cleanup. Their explicit provisional limits must be replaced
with production-host maximum-case measurements before treating them as cost
estimates. The large move envelopes follow the spec's requirement that each
bounded step fit the production block ceiling. No deployment conformance is
claimed by these defaults.

Automatic gas price is capped at 10 Lux/gas, retaining the 0.2 price policy; a
one-second estimation timeout or malformed estimate falls back to 1. Set an
explicit positive u64 `gasPrice` when desired. The wallet display separates the
exact principal deposit from maximum gas cost. Included application failure can
consume the full limit, including when the principal deposit is refunded.
