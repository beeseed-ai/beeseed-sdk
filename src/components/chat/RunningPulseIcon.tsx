/**
 * The in-flight status glyph: a solid dot with a pinging halo. Shared by the
 * completed-run card and the typing indicator so both read as one component.
 */
export function RunningPulseIcon() {
  return (
    <span className="relative flex size-3.5 shrink-0 items-center justify-center">
      <span className="absolute inline-flex size-3 rounded-full bg-[#181d26]/15 animate-ping" />
      <span className="relative inline-flex size-2 rounded-full bg-[#181d26]" />
    </span>
  )
}
