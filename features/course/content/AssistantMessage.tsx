import React from 'react'
import { parseContent } from './parseContent'
import { FormattedText } from './FormattedText'
import { PillarsBlock, StepsBlock, TermsBlock } from './Blocks'
import { MCQBlock } from './MCQBlock'
import { VisualCard } from './VisualCard'

export function AssistantMessage({ content, svg, onAnswer, answeredMcq, isStreaming }: {
  content: string
  svg?: string
  onAnswer?: (letter: string, text: string) => void
  answeredMcq?: string | null
  isStreaming?: boolean
}) {
  // Hide incomplete :::MCQ block while streaming so raw text never flashes
  const displayContent = isStreaming ? content.replace(/[ \t]*:::MCQ[\s\S]*$/, '') : content
  const segments = parseContent(displayContent)

  return (
    <div className="flex flex-col gap-2.5">
      {segments.map((seg, i) => {
        if (seg.kind === 'text')    return <FormattedText key={i} text={seg.text} />
        if (seg.kind === 'pillars') return <PillarsBlock  key={i} title={seg.title} items={seg.items} />
        if (seg.kind === 'steps')   return <StepsBlock    key={i} title={seg.title} items={seg.items} />
        if (seg.kind === 'terms')   return <TermsBlock    key={i} title={seg.title} items={seg.items} />
        if (seg.kind === 'mcq')     return <MCQBlock key={i} data={seg.data} onAnswer={onAnswer ?? (() => {})} answered={answeredMcq ?? null} />
        return null
      })}
      {svg && <VisualCard svg={svg} />}
    </div>
  )
}
