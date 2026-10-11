/** Internal input-aware wallet policy; the wire arguments remain unchanged. */
import { gasLimit } from './gas.ts'
const million = 1_000_000n
const utf8 = new TextEncoder()
function payload(rows: unknown): bigint {
  return (rows as { key: string; value: number[] }[]).reduce(
    (sum, row) => sum + BigInt(utf8.encode(row.key).length + row.value.length),
    0n,
  )
}
/** Arguments have already passed wireValue. Unknown stored populations use ceilings. */
export function walletGasLimit(
  role: string,
  method: string,
  args: Record<string, unknown>,
): bigint {
  const ceiling = gasLimit(role, method)
  let limit = ceiling
  switch (`${role}.${method}`) {
    case 'store.register':
      limit = 80n * million + 2500n * payload(args.records) +
        (args.referrer === null ? 0n : 60n * million)
      break
    case 'store.replace_records':
    case 'store.move_records':
      limit = 7n * million + 3500n * payload(args.records)
      break
    case 'store.mutate_records':
      limit = 30n * million + 2000n * payload(args.mutations)
      break
    case 'store.stage_move_row':
      limit = 12n * million + 3500n * payload(args.records)
      break
    case 'store.take_back_subnames':
      limit = 7n * million + 270_000n * BigInt((args.targets as unknown[]).length)
      break
    case 'store.transfer_and_call':
      limit = ((args.callback_gas as bigint) + 10n * million) * 10_000n
      limit = (limit + 8648n) / 8649n + 25n * million
      break
    case 'directory.prune_proposals':
      limit = 5n * million + 4n * million * BigInt((args.ids as unknown[]).length)
      break
    case 'store.prune_commitments':
      limit = 5n * million + 60_000n * BigInt((args.keys as unknown[]).length)
      break
    case 'store.prune_import':
    case 'store.prune_forwarded':
      limit = 5n * million + 125_000n * BigInt(args.limit as number)
      break
    case 'vault.prune_referrals':
      limit = 5n * million + 125_000n * BigInt(args.limit as number)
      break
    case 'marketplace.buy_fixed':
      limit = (args.order as { terms: { referral: unknown } }).terms.referral === null
        ? 10n * million : 130n * million
      break
    case 'marketplace.settle_auction':
      limit = (args.terms as { referral: unknown }).referral === null
        ? 10n * million : 130n * million
      break
  }
  // Wire-valid integers may exceed application bounds (for example callback_gas).
  // Keep the existing bounded wallet policy for such rejected contract inputs.
  const rounded = ((limit + million - 1n) / million) * million
  return rounded < ceiling ? rounded : ceiling
}
