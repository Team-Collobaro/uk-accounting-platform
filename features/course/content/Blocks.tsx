import React from 'react'
import type { LabeledItem } from '@/types/course'

function KeyCardsBlock({
  title, items, numbered, connector,
}: {
  title: string
  items: LabeledItem[]
  numbered: boolean
  connector?: boolean
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border bg-muted/30 animate-msg-in">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-3.5 py-2">
        <div className="h-3.5 w-0.5 rounded-full bg-foreground" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      </div>

      <div className={`flex flex-col px-3 pb-3 pt-2.5 ${connector ? 'gap-0' : 'gap-2'}`}>
        {items.map((item, i) => (
          <div key={i} className="relative flex items-stretch">
            {connector && i < items.length - 1 && (
              <div className="absolute left-[15px] top-[30px] bottom-[-10px] z-0 w-px bg-border" />
            )}
            <div className={`relative z-[1] flex w-full items-start gap-2.5 ${connector ? 'pb-3.5' : ''}`}>
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center border bg-muted text-xs font-semibold text-foreground ${numbered ? 'rounded-md' : 'rounded-full'}`}>
                {numbered ? i + 1 : '▸'}
              </div>
              <div className="min-w-0 flex-1 rounded-md border border-l-2 border-l-foreground bg-muted/40 px-3 py-2">
                <p className="mb-0.5 text-sm font-semibold leading-snug text-foreground">{item.label}</p>
                {item.desc && <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PillarsBlock({ title, items }: { title: string; items: LabeledItem[] }) {
  return <KeyCardsBlock title={title} items={items} numbered={true} />
}

export function StepsBlock({ title, items }: { title: string; items: LabeledItem[] }) {
  return <KeyCardsBlock title={title} items={items} numbered={true} connector={true} />
}

export function TermsBlock({ title, items }: { title: string; items: LabeledItem[] }) {
  return <KeyCardsBlock title={title} items={items} numbered={false} />
}
