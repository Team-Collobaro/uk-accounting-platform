import React from 'react'

export function VisualCard({ svg }: { svg: string }) {
  return (
    <div className="mt-2 w-full max-w-[520px] overflow-hidden rounded-lg border bg-muted/30 animate-msg-in">
      <div className="block leading-[0]" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  )
}
