'use client'
import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'

interface DecryptedTextProps {
  text: string
  speed?: number
  maxIterations?: number
  sequential?: boolean
  revealDirection?: 'start' | 'end' | 'center'
  useOriginalCharsOnly?: boolean
  characters?: string
  className?: string
  parentClassName?: string
  encryptedClassName?: string
  animateOn?: 'hover' | 'view' | 'click'
  clickMode?: 'once' | 'toggle'
}

export default function DecryptedText({
  text,
  speed = 50,
  maxIterations = 10,
  sequential = false,
  revealDirection = 'start',
  useOriginalCharsOnly = false,
  characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+',
  className = '',
  parentClassName = '',
  encryptedClassName = '',
  animateOn = 'hover',
  clickMode = 'once',
}: DecryptedTextProps) {
  const [displayText, setDisplayText] = useState(text)
  const [isAnimating, setIsAnimating] = useState(false)
  const [revealedIndices, setRevealedIndices] = useState(new Set<number>())
  const [hasAnimated, setHasAnimated] = useState(false)
  const [isDecrypted, setIsDecrypted] = useState(animateOn !== 'click')
  const [direction, setDirection] = useState<'forward' | 'reverse'>('forward')

  const containerRef = useRef<HTMLSpanElement>(null)
  const orderRef = useRef<number[]>([])
  const pointerRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const availableChars = useMemo(() => {
    return useOriginalCharsOnly
      ? Array.from(new Set(text.split(''))).filter(c => c !== ' ')
      : characters.split('')
  }, [useOriginalCharsOnly, text, characters])

  const shuffleText = useCallback(
    (original: string, revealed: Set<number>) =>
      original.split('').map((char, i) => {
        if (char === ' ') return ' '
        if (revealed.has(i)) return original[i]
        return availableChars[Math.floor(Math.random() * availableChars.length)]
      }).join(''),
    [availableChars]
  )

  const fillAllIndices = useCallback(() => {
    const s = new Set<number>()
    for (let i = 0; i < text.length; i++) s.add(i)
    return s
  }, [text])

  const computeOrder = useCallback((len: number) => {
    const order: number[] = []
    if (len <= 0) return order
    if (revealDirection === 'start') { for (let i = 0; i < len; i++) order.push(i); return order }
    if (revealDirection === 'end') { for (let i = len - 1; i >= 0; i--) order.push(i); return order }
    const middle = Math.floor(len / 2); let offset = 0
    while (order.length < len) {
      if (offset % 2 === 0) { const idx = middle + offset / 2; if (idx >= 0 && idx < len) order.push(idx) }
      else { const idx = middle - Math.ceil(offset / 2); if (idx >= 0 && idx < len) order.push(idx) }
      offset++
    }
    return order.slice(0, len)
  }, [revealDirection])

  const triggerDecrypt = useCallback(() => {
    if (sequential) { orderRef.current = computeOrder(text.length); pointerRef.current = 0; setRevealedIndices(new Set()) }
    else setRevealedIndices(new Set())
    setDirection('forward'); setIsAnimating(true)
  }, [sequential, computeOrder, text.length])

  const encryptInstantly = useCallback(() => {
    const s = new Set<number>()
    setRevealedIndices(s); setDisplayText(shuffleText(text, s)); setIsDecrypted(false)
  }, [text, shuffleText])

  useEffect(() => {
    if (!isAnimating) return
    let iter = 0
    const getNext = (revealed: Set<number>) => {
      if (revealDirection === 'start') return revealed.size
      if (revealDirection === 'end') return text.length - 1 - revealed.size
      const mid = Math.floor(text.length / 2)
      const off = Math.floor(revealed.size / 2)
      const idx = revealed.size % 2 === 0 ? mid + off : mid - off - 1
      if (idx >= 0 && idx < text.length && !revealed.has(idx)) return idx
      for (let i = 0; i < text.length; i++) if (!revealed.has(i)) return i
      return 0
    }
    intervalRef.current = setInterval(() => {
      setRevealedIndices(prev => {
        if (sequential) {
          if (direction === 'forward') {
            if (prev.size < text.length) {
              const next = new Set(prev); next.add(getNext(prev))
              setDisplayText(shuffleText(text, next)); return next
            } else { clearInterval(intervalRef.current!); setIsAnimating(false); setIsDecrypted(true); return prev }
          }
        } else {
          setDisplayText(shuffleText(text, prev)); iter++
          if (iter >= maxIterations) { clearInterval(intervalRef.current!); setIsAnimating(false); setDisplayText(text); setIsDecrypted(true) }
          return prev
        }
        return prev
      })
    }, speed)
    return () => clearInterval(intervalRef.current!)
  }, [isAnimating, text, speed, maxIterations, sequential, revealDirection, shuffleText, direction, fillAllIndices])

  const resetToPlain = useCallback(() => {
    clearInterval(intervalRef.current!); setIsAnimating(false)
    setRevealedIndices(new Set()); setDisplayText(text); setIsDecrypted(true); setDirection('forward')
  }, [text])

  useEffect(() => {
    if (animateOn !== 'view') return
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting && !hasAnimated) { triggerDecrypt(); setHasAnimated(true) } })
    }, { threshold: 0.1 })
    const el = containerRef.current; if (el) obs.observe(el)
    return () => { if (el) obs.unobserve(el) }
  }, [animateOn, hasAnimated, triggerDecrypt])

  useEffect(() => {
    if (animateOn === 'click') encryptInstantly()
    else { setDisplayText(text); setIsDecrypted(true) }
    setRevealedIndices(new Set()); setDirection('forward')
  }, [animateOn, text, encryptInstantly])

  const animateProps = animateOn === 'hover'
    ? { onMouseEnter: triggerDecrypt, onMouseLeave: resetToPlain }
    : animateOn === 'click'
      ? { onClick: () => { if (!isDecrypted && clickMode === 'once') return; triggerDecrypt() } }
      : {}

  return (
    <motion.span className={parentClassName} ref={containerRef} style={{ display: 'inline-block', whiteSpace: 'pre-wrap' }} {...animateProps}>
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>{displayText}</span>
      <span aria-hidden="true">
        {displayText.split('').map((char, i) => {
          const revealed = revealedIndices.has(i) || (!isAnimating && isDecrypted)
          return <span key={i} className={revealed ? className : encryptedClassName}>{char}</span>
        })}
      </span>
    </motion.span>
  )
}
