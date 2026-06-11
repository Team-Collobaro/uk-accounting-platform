import React from 'react'
import type { LabeledItem } from '@/types/course'

// Shared card shell: one surface, a brand accent tick, an uppercase label.
function BlockShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border bg-card/60 animate-msg-in">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2.5">
        <span className="h-3.5 w-0.5 rounded-full bg-brand" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      </div>
      {children}
    </div>
  )
}

// PILLARS — clean numbered reference list, brand-tinted index badges.
export function PillarsBlock({ title, items }: { title: string; items: LabeledItem[] }) {
  return (
    <BlockShell title={title}>
      <div className="flex flex-col px-2 pb-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40"
          >
            <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand/15 text-xs font-semibold text-brand">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug text-foreground">{item.label}</p>
              {item.desc && (
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </BlockShell>
  )
}

// STEPS — vertical timeline with brand nodes and a connecting rail.
export function StepsBlock({ title, items }: { title: string; items: LabeledItem[] }) {
  return (
    <BlockShell title={title}>
      <div className="flex flex-col px-4 pb-3 pt-1">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <div key={i} className="relative flex gap-3 pb-4 last:pb-1">
              {/* connector rail behind the node, runs to the next node */}
              {!isLast && (
                <span className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />
              )}
              <span className="relative z-[1] mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug text-foreground">{item.label}</p>
                {item.desc && (
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </BlockShell>
  )
}

// TERMS — definition list: term chip, definition beside it (stacks on narrow screens).
export function TermsBlock({ title, items }: { title: string; items: LabeledItem[] }) {
  return (
    <BlockShell title={title}>
      <div className="flex flex-col gap-px px-2 pb-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex flex-col gap-1 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40 sm:flex-row sm:items-baseline sm:gap-3"
          >
            <span className="shrink-0 border-l-2 border-l-brand pl-2 text-sm font-semibold leading-snug text-foreground sm:w-40">
              {item.label}
            </span>
            {item.desc && (
              <p className="min-w-0 flex-1 pl-2 text-sm leading-relaxed text-muted-foreground sm:pl-0">
                {item.desc}
              </p>
            )}
          </div>
        ))}
      </div>
    </BlockShell>
  )
}
