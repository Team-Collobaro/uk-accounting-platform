import React from 'react'

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-1 py-2 animate-msg-in">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-typing"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">thinking…</span>
    </div>
  )
}
