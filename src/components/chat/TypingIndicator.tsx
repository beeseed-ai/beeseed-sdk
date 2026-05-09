interface Props {
  text: string
}

export function TypingIndicator({ text }: Props) {
  if (!text) return null
  return (
    <div className="flex items-center gap-1.5 px-4 py-1.5">
      <span className="flex gap-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
      </span>
      <span className="text-xs text-muted-foreground">{text}</span>
    </div>
  )
}
