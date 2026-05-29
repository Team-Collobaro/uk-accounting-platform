'use client'
import {
  forwardRef, useCallback, useEffect, useImperativeHandle,
  useMemo, useState,
} from 'react'
import { motion, AnimatePresence, type TargetAndTransition, type Transition } from 'framer-motion'
import './RotatingText.css'

interface RotatingTextProps {
  texts: string[]
  transition?: Transition
  initial?: TargetAndTransition
  animate?: TargetAndTransition
  exit?: TargetAndTransition
  animatePresenceMode?: 'wait' | 'sync' | 'popLayout'
  animatePresenceInitial?: boolean
  rotationInterval?: number
  staggerDuration?: number
  staggerFrom?: 'first' | 'last' | 'center' | 'random' | number
  loop?: boolean
  auto?: boolean
  splitBy?: 'characters' | 'words' | 'lines' | string
  onNext?: (index: number) => void
  mainClassName?: string
  splitLevelClassName?: string
  elementLevelClassName?: string
}

export interface RotatingTextHandle {
  next: () => void
  previous: () => void
  jumpTo: (index: number) => void
  reset: () => void
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ')
}

const RotatingText = forwardRef<RotatingTextHandle, RotatingTextProps>((props, ref) => {
  const {
    texts,
    transition = { type: 'spring', damping: 25, stiffness: 300 },
    initial = { y: '100%', opacity: 0 },
    animate = { y: 0, opacity: 1 },
    exit = { y: '-120%', opacity: 0 },
    animatePresenceMode = 'wait',
    animatePresenceInitial = false,
    rotationInterval = 2000,
    staggerDuration = 0,
    staggerFrom = 'first',
    loop = true,
    auto = true,
    splitBy = 'characters',
    onNext,
    mainClassName,
    splitLevelClassName,
    elementLevelClassName,
  } = props

  const [currentTextIndex, setCurrentTextIndex] = useState(0)

  const splitIntoChars = (text: string) => {
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const seg = new (Intl as any).Segmenter('en', { granularity: 'grapheme' })
      return Array.from(seg.segment(text), (s: { segment: string }) => s.segment)
    }
    return Array.from(text)
  }

  const elements = useMemo(() => {
    const cur = texts[currentTextIndex]
    if (splitBy === 'characters') {
      return cur.split(' ').map((word, i, arr) => ({
        characters: splitIntoChars(word),
        needsSpace: i !== arr.length - 1,
      }))
    }
    if (splitBy === 'words') {
      return cur.split(' ').map((word, i, arr) => ({
        characters: [word],
        needsSpace: i !== arr.length - 1,
      }))
    }
    return cur.split(splitBy).map((part, i, arr) => ({
      characters: [part],
      needsSpace: i !== arr.length - 1,
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texts, currentTextIndex, splitBy])

  const getStaggerDelay = useCallback(
    (index: number, total: number) => {
      if (staggerFrom === 'first') return index * staggerDuration
      if (staggerFrom === 'last') return (total - 1 - index) * staggerDuration
      if (staggerFrom === 'center') return Math.abs(Math.floor(total / 2) - index) * staggerDuration
      if (staggerFrom === 'random') return Math.abs(Math.floor(Math.random() * total) - index) * staggerDuration
      return Math.abs((staggerFrom as number) - index) * staggerDuration
    },
    [staggerFrom, staggerDuration]
  )

  const handleIndexChange = useCallback((newIndex: number) => {
    setCurrentTextIndex(newIndex); onNext?.(newIndex)
  }, [onNext])

  const next = useCallback(() => {
    const n = currentTextIndex === texts.length - 1 ? (loop ? 0 : currentTextIndex) : currentTextIndex + 1
    if (n !== currentTextIndex) handleIndexChange(n)
  }, [currentTextIndex, texts.length, loop, handleIndexChange])

  const previous = useCallback(() => {
    const p = currentTextIndex === 0 ? (loop ? texts.length - 1 : currentTextIndex) : currentTextIndex - 1
    if (p !== currentTextIndex) handleIndexChange(p)
  }, [currentTextIndex, texts.length, loop, handleIndexChange])

  const jumpTo = useCallback((index: number) => {
    const v = Math.max(0, Math.min(index, texts.length - 1))
    if (v !== currentTextIndex) handleIndexChange(v)
  }, [texts.length, currentTextIndex, handleIndexChange])

  const reset = useCallback(() => {
    if (currentTextIndex !== 0) handleIndexChange(0)
  }, [currentTextIndex, handleIndexChange])

  useImperativeHandle(ref, () => ({ next, previous, jumpTo, reset }), [next, previous, jumpTo, reset])

  useEffect(() => {
    if (!auto) return
    const id = setInterval(next, rotationInterval)
    return () => clearInterval(id)
  }, [next, rotationInterval, auto])

  return (
    <motion.span className={cn('text-rotate', mainClassName)} layout transition={transition as Transition}>
      <span className="text-rotate-sr-only">{texts[currentTextIndex]}</span>
      <AnimatePresence mode={animatePresenceMode} initial={animatePresenceInitial}>
        <motion.span key={currentTextIndex} className={cn('text-rotate')} layout aria-hidden="true">
          {elements.map((wordObj, wi, arr) => {
            const prevCount = arr.slice(0, wi).reduce((s, w) => s + w.characters.length, 0)
            const total = arr.reduce((s, w) => s + w.characters.length, 0)
            return (
              <span key={wi} className={cn('text-rotate-word', splitLevelClassName)}>
                {wordObj.characters.map((char, ci) => (
                  <motion.span
                    key={ci}
                    initial={initial}
                    animate={animate}
                    exit={exit}
                    transition={{ ...(transition as Transition), delay: getStaggerDelay(prevCount + ci, total) }}
                    className={cn('text-rotate-element', elementLevelClassName)}
                  >
                    {char}
                  </motion.span>
                ))}
                {wordObj.needsSpace && <span className="text-rotate-space"> </span>}
              </span>
            )
          })}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  )
})

RotatingText.displayName = 'RotatingText'
export default RotatingText
