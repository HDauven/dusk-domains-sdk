/** Receipt journal filtering with occurrence identity and caught-revert handling. @module */
import { contractId, equalBytes } from './bytes.ts'
import { wireValue } from './wire.ts'
import {
  indexerEventCatalog,
  type EventTopic,
} from '../indexer/events/indexerEventCatalog.ts'
import type { ContractRole } from './manifest.ts'
import type { OperationBegin, OperationEnd, Event } from './types.ts'
export interface ReceiptEvent {
  emitter: string
  topic: string
  data: unknown
  reverted?: boolean
  ordinal: number
}
export interface Receipt {
  id: string
  height: bigint
  success: boolean
  events: ReceiptEvent[]
}
export interface CommittedEvent extends ReceiptEvent {
  topic: EventTopic
  height: bigint
  data: unknown
}
interface Frame {
  begin: OperationBegin
  emitter: string
  ordinal: number
  parent: Frame | undefined
  closed: boolean
  abandoned: boolean
  events: CommittedEvent[]
}
function prefix(a: number[][], b: number[][]): boolean {
  return a.length <= b.length && a.every((x, i) => equalBytes(x, b[i]))
}
/** Returns effects only after their own and all enclosing frozen operations ended. */
export function committedEvents(
  receipt: Receipt,
  scope: Readonly<Record<string, ContractRole>>,
): CommittedEvent[] {
  if (!receipt.success) return []
  const frames: Frame[] = []
  let open: Frame[] = []
  let previous = -1
  for (const raw of receipt.events) {
    if (!Number.isSafeInteger(raw.ordinal) || raw.ordinal <= previous)
      throw new Error('Receipt events are not in strict ordinal order')
    previous = raw.ordinal
    if (raw.reverted) continue
    const emitter = raw.emitter.replace(/^0x/u, '').toLowerCase(),
      role = scope[emitter]
    if (!role) continue
    if (!Object.hasOwn(indexerEventCatalog, raw.topic)) continue
    const topic = raw.topic as EventTopic,
      spec = indexerEventCatalog[topic]
    if (spec.role !== '*' && spec.role !== role)
      throw new Error('Event emitter role mismatch')
    const data = wireValue(spec.type, raw.data)
    if (topic === 'operation_begin') {
      const begin = data as OperationBegin
      if (
        begin.height !== receipt.height ||
        !begin.call_path.length ||
        contractId(begin.call_path.at(-1)!) !== emitter
      )
        throw new Error('Journal begin height/path mismatch')
      for (const frame of open)
        if (
          !prefix(frame.begin.call_path, begin.call_path) ||
          frame.begin.call_path.length === begin.call_path.length
        )
          frame.abandoned = true
      open = open.filter((f) => !f.abandoned)
      const parent = open
        .filter(
          (f) =>
            prefix(f.begin.call_path, begin.call_path) &&
            f.begin.call_path.length < begin.call_path.length,
        )
        .at(-1)
      const frame: Frame = {
        begin,
        emitter,
        ordinal: raw.ordinal,
        parent,
        closed: false,
        abandoned: false,
        events: [],
      }
      frames.push(frame)
      open.push(frame)
    } else if (topic === 'operation_end') {
      const end = data as OperationEnd
      const frame = open.findLast(
        (f) =>
          f.emitter === emitter &&
          f.begin.op_seq === end.op_seq &&
          f.begin.call_path.length === end.call_path.length &&
          prefix(f.begin.call_path, end.call_path),
      )
      if (!frame) continue
      for (const f of open)
        if (f !== frame && prefix(frame.begin.call_path, f.begin.call_path))
          f.abandoned = true
      frame.closed = true
      open = open.filter((f) => f !== frame && !f.abandoned)
    } else {
      const event = data as Event<unknown>
      if (event.version !== 1) throw new Error('Unsupported event version')
      const frame = open.findLast(
        (f) => f.emitter === emitter && f.begin.op_seq === event.op_seq,
      )
      if (frame)
        frame.events.push({
          ...raw,
          emitter,
          topic,
          data: event,
          height: receipt.height,
        })
    }
  }
  function committed(f: Frame): boolean {
    return f.closed && !f.abandoned && (!f.parent || committed(f.parent))
  }
  return frames
    .filter(committed)
    .flatMap((f) => f.events)
    .sort((a, b) => a.ordinal - b.ordinal)
}
