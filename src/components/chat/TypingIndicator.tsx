interface Props {
  text: string
}

export function TypingIndicator({ text }: Props) {
  if (!text) return null
  return (
    <div className="px-4 py-1">
      <span className="text-xs text-muted-foreground animate-pulse">{text}</span>
    </div>
  )
}
