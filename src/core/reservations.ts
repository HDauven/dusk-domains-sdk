/** Reload recovery for commitments, bound to the original deployment and shard. @module */
import { contractId, fromHex, hex, namehashHex } from '../frozen/bytes.ts'
import { u64, parseJson, stringifyJson } from '../frozen/json.ts'
import { registrationCommitmentHex } from './commitment.ts'
import { registrationYears } from './lifecycle.ts'
import { validateName } from './names.ts'
/** Storage key the pending reservations are saved under, as one JSON array. */
export const PENDING_NAME_RESERVATIONS_STORAGE_KEY =
  'dusk-domains:pending-reservations:frozen:v1'
/** Synchronous key-value storage for reservations, such as `localStorage`. */
export interface ReservationStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
/**
 * A saved commit-reveal registration, enough to finish it after a reload. It holds the secret: keep it
 * out of logs and telemetry.
 */
export interface PendingNameReservation {
  name: string
  node: string
  commitment: string
  secret: string
  controller: string
  chainId: string
  directory: string
  commitmentStore: string
  durationYears: number
  committedBlockHeight: bigint | null
  committedTxId: string | null
  createdAt: string
  updatedAt: string
}
/** Fields `listPendingNameReservations` filters on; an omitted field matches every reservation. */
export interface PendingNameReservationFilter {
  chainId?: string
  directory?: string
  controller?: string
  commitmentStore?: string
}
/** Identifies one saved reservation: chain, directory, controller, original commitment store and commitment. */
export interface PendingNameReservationKey {
  chainId: string
  directory: string
  controller: string
  commitmentStore: string
  commitment: string
}
/** Thrown when a reservation save fails: storage `unavailable`, `corrupt` data, or `write_failed`. */
export class ReservationStorageError extends Error {
  constructor(
    readonly code: 'unavailable' | 'corrupt' | 'write_failed',
    options?: ErrorOptions,
  ) {
    super(`Reservation storage: ${code}`, options)
  }
}
function storageOrNull(
  storage?: ReservationStorage | null,
): ReservationStorage | null {
  if (storage !== undefined) return storage
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}
const bytes32 = (value: string): string =>
  `0x${hex(fromHex(value.replace(/^0X/u, '0x'), 32))}`
function normalize(value: PendingNameReservation): PendingNameReservation {
  const v = validateName(value.name)
  if (!v.ok || v.name.depth || v.name.canonical !== value.name)
    throw new Error('Invalid reservation name')
  registrationYears(value.durationYears)
  if (!/^dusk:[\w-]+$/u.test(value.chainId)) throw new Error('Invalid chain')
  if (
    ![value.createdAt, value.updatedAt].every(
      (s) => typeof s === 'string' && Number.isFinite(Date.parse(s)),
    )
  )
    throw new Error('Invalid reservation date')
  if (
    value.committedTxId !== null &&
    (typeof value.committedTxId !== 'string' || !value.committedTxId)
  )
    throw new Error('Invalid transaction ID')
  const result: PendingNameReservation = {
    name: value.name,
    node: bytes32(value.node),
    commitment: bytes32(value.commitment),
    secret: bytes32(value.secret),
    controller: `0x${contractId(value.controller.replace(/^0X/u, '0x'))}`,
    chainId: value.chainId,
    directory: contractId(value.directory),
    commitmentStore: contractId(value.commitmentStore),
    durationYears: value.durationYears,
    committedBlockHeight:
      value.committedBlockHeight === null
        ? null
        : u64(value.committedBlockHeight),
    committedTxId: value.committedTxId,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
  if (
    result.node !== `0x${namehashHex(result.name)}` ||
    registrationCommitmentHex({
      node: result.node,
      controller: result.controller,
      label: v.name.registrableLabel,
      secret: result.secret,
    }) !== result.commitment
  )
    throw new Error('Reservation commitment mismatch')
  return result
}
function read(
  storage: ReservationStorage | null,
  strict: boolean,
): PendingNameReservation[] {
  if (!storage) {
    if (strict) throw new ReservationStorageError('unavailable')
    return []
  }
  let raw: string | null
  try {
    raw = storage.getItem(PENDING_NAME_RESERVATIONS_STORAGE_KEY)
  } catch (cause) {
    if (strict) throw new ReservationStorageError('unavailable', { cause })
    return []
  }
  if (raw === null) return []
  try {
    const rows = parseJson(raw)
    if (!Array.isArray(rows)) throw new Error('Invalid storage envelope')
    const result: PendingNameReservation[] = []
    for (const row of rows) {
      try {
        result.push(normalize(row as unknown as PendingNameReservation))
      } catch (cause) {
        if (strict) throw cause
      }
    }
    return result
  } catch (cause) {
    if (strict) throw new ReservationStorageError('corrupt', { cause })
    return []
  }
}
function matching(
  row: PendingNameReservation,
  f: PendingNameReservationFilter,
): boolean {
  return (
    (!f.chainId || row.chainId === f.chainId) &&
    (!f.directory || row.directory === contractId(f.directory)) &&
    (!f.commitmentStore ||
      row.commitmentStore === contractId(f.commitmentStore)) &&
    (!f.controller || row.controller === bytes32(f.controller))
  )
}
function keyMatches(
  row: PendingNameReservation,
  key: PendingNameReservationKey,
): boolean {
  if (
    !key.chainId ||
    !key.directory ||
    !key.controller ||
    !key.commitmentStore ||
    !key.commitment
  )
    throw new Error('Incomplete reservation key')
  return matching(row, key) && row.commitment === bytes32(key.commitment)
}
function sorted(rows: PendingNameReservation[]): PendingNameReservation[] {
  return rows.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}
/** Unavailable/malformed storage yields no recovered rows. Mutations report failure explicitly. */
export function listPendingNameReservations(
  filter: PendingNameReservationFilter = {},
  storage?: ReservationStorage | null,
): PendingNameReservation[] {
  return sorted(
    read(storageOrNull(storage), false).filter((r) => matching(r, filter)),
  )
}
function mutate(
  storage: ReservationStorage | null | undefined,
  operation: (rows: PendingNameReservation[]) => PendingNameReservation[],
): PendingNameReservation[] {
  const adapter = storageOrNull(storage),
    next = sorted(operation(read(adapter, true)))
  try {
    adapter!.setItem(PENDING_NAME_RESERVATIONS_STORAGE_KEY, stringifyJson(next))
  } catch (cause) {
    throw new ReservationStorageError('write_failed', { cause })
  }
  return next
}
/** Same digest on different shards is a different recovery entry; a new secret never erases an old one. */
export function upsertPendingNameReservation(
  reservation: PendingNameReservation,
  storage?: ReservationStorage | null,
): PendingNameReservation[] {
  const next = normalize(reservation)
  return mutate(storage, (rows) => [
    next,
    ...rows.filter((r) => !keyMatches(r, next)),
  ])
}
/**
 * Remove the reservation under `key` and return the rest, newest first. Throws a
 * `ReservationStorageError` when storage fails.
 */
export function removePendingNameReservation(
  key: PendingNameReservationKey,
  storage?: ReservationStorage | null,
): PendingNameReservation[] {
  return mutate(storage, (rows) => rows.filter((r) => !keyMatches(r, key)))
}
/**
 * Set the commit's inclusion height and transaction ID on the reservation under `key`, or clear them
 * with `null` after a reorg, and return every reservation, newest first. Throws a
 * `ReservationStorageError` when storage fails.
 */
export function updatePendingNameReservationBlock(
  key: PendingNameReservationKey,
  update: {
    committedBlockHeight: bigint | null
    committedTxId?: string | null
    updatedAt?: string
  },
  storage?: ReservationStorage | null,
): PendingNameReservation[] {
  return mutate(storage, (rows) =>
    rows.map((r) =>
      keyMatches(r, key)
        ? normalize({
            ...r,
            committedBlockHeight: update.committedBlockHeight,
            committedTxId:
              update.committedTxId === undefined
                ? r.committedTxId
                : update.committedTxId,
            updatedAt: update.updatedAt ?? new Date().toISOString(),
          })
        : r,
    ),
  )
}
