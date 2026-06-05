import React from 'react'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MCQData } from '@/types/course'

export function MCQBlock({ data, onAnswer, answered }: {
  data: MCQData
  onAnswer: (letter: string, text: string) => void
  answered: string | null
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border bg-card animate-msg-in">
      <div className="flex items-center gap-2 border-b px-3.5 py-2.5">
        <div className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border text-[10px] font-bold text-foreground">
          ?
        </div>
        <p className="m-0 text-sm font-medium leading-snug text-foreground">{data.question}</p>
      </div>

      <div className="flex flex-col gap-1.5 px-3 pb-3 pt-2.5">
        {data.options.map((opt) => {
          const isCorrect = answered !== null && opt.letter === data.correct
          const isWrong = answered === opt.letter && opt.letter !== data.correct

          return (
            <button
              key={opt.letter}
              disabled={answered !== null}
              onClick={() => onAnswer(opt.letter, `${opt.letter}. ${opt.text}`)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-colors',
                answered === null && 'hover:bg-accent',
                isCorrect && 'border-foreground bg-accent',
                isWrong && 'opacity-60',
              )}
            >
              <div className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold',
                isCorrect ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground',
              )}>
                {opt.letter}
              </div>
              <span className={cn(
                'flex-1 text-sm leading-snug',
                isCorrect ? 'text-foreground' : isWrong ? 'text-muted-foreground line-through' : 'text-muted-foreground',
              )}>
                {opt.text}
              </span>
              {isCorrect && <Check size={15} className="shrink-0 text-foreground" />}
              {isWrong && <X size={15} className="shrink-0 text-muted-foreground" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
