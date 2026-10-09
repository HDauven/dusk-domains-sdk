import { expect, it } from 'vitest'
import { indexerEventCatalog } from '../src/indexer/events/indexerEventCatalog.ts'
import { committedEvents, type Receipt } from '../src/frozen/journal.ts'
import {
  createProjectionState,
  projectReceipt,
  snapshotProjection,
} from '../src/frozen/projection.ts'
import { fixtures, id, bytes } from './helpers.ts'
import { wireValue } from '../src/frozen/wire.ts'
const rows = [
  ...Object.values(fixtures()),
  ...Object.values(fixtures('market-v1')),
]
for (const [topic, spec] of Object.entries(indexerEventCatalog)) {
  if (spec.role === '*') continue
  const scope = { [id(1)]: 'directory', [id(2)]: spec.role } as const
  const data = wireValue(
    spec.type,
    rows.find((r) => r.type === spec.type)!.json,
  ) as { version: number; op_seq: bigint; body: unknown }
  const receipt = (): Receipt => ({
    id: topic,
    height: 9n,
    success: true,
    events: [
      {
        emitter: id(2),
        topic: 'operation_begin',
        ordinal: 0,
        data: { op_seq: data.op_seq, height: 9n, call_path: [bytes(2)] },
      },
      { emitter: id(2), topic, ordinal: 1, data },
      {
        emitter: id(2),
        topic: 'operation_end',
        ordinal: 2,
        data: { op_seq: data.op_seq, call_path: [bytes(2)] },
      },
    ],
  })
  it(`${topic}: committed golden event retains its occurrence and payload`, () =>
    expect(committedEvents(receipt(), scope)).toEqual([
      { ...receipt().events[1], topic, height: 9n, operationOrdinal: 0 },
    ]))
  it(`${topic}: reverted effects never mutate the projection`, () => {
    const tx = receipt()
    tx.events[1].reverted = true
    // A directory effect uses the canonical directory ID as emitter.
    const options =
      spec.role === 'directory'
        ? { directoryId: id(2), contracts: { [id(2)]: spec.role } }
        : { directoryId: id(1), contracts: scope }
    const before = createProjectionState(options),
      checkpoint = snapshotProjection(before),
      after = projectReceipt(before, tx)
    expect(committedEvents(tx, scope)).toEqual([])
    expect(after).toBe(before)
    expect(after).toEqual({ ...checkpoint, height: 9n, receipts: { [topic]: true } })
  })
  it(`${topic}: unsuccessful or unfinished receipts cannot publish effects`, () => {
    expect(committedEvents({ ...receipt(), success: false }, scope)).toEqual([])
    const tx = receipt()
    tx.events.pop()
    expect(committedEvents(tx, scope)).toEqual([])
  })
}
