import { RunningPulseIcon } from './RunningPulseIcon.js'
import { RunStatusRow } from './RunStatusRow.js'

interface Props {
  text: string
}

/**
 * The in-flight status row for an agent run. It renders through RunStatusRow —
 * the same component the finished-run transcript uses — so the two states share
 * one element tree and one type scale instead of two copies that drift.
 *
 * It is not expandable: a pending run has no process detail yet, so the row
 * carries the chevron as a placeholder and no aria-expanded.
 */
export function TypingIndicator({ text }: Props) {
  if (!text) return null
  return <RunStatusRow icon={<RunningPulseIcon />} label={text} labelClassName="text-[#181d26]" />
}
