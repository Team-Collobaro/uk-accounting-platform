// Mouth shapes for the tutor avatar, kept in step with whatever is speaking.
//  - Neural voice (an <audio> routed through an AnalyserNode): shaped by the sound itself. Loudness
//    opens the jaw, the spectrum tells "ee" (spread) from "oo"/"oh" (rounded) and hiss ("s", "f").
//  - Browser speech (its audio cannot be analysed): shaped by the words, re-synced every time the
//    voice reports reaching the next word.

export interface MouthShape {
  /** Jaw opening, 0 closed to 1 wide open */
  open: number
  /** Lips spread ("ee") */
  wide: number
  /** Lips rounded ("oo") */
  round: number
  /** Lips pressed together over the teeth ("m", "b", "p") */
  press: number
}

export const MOUTH_REST: MouthShape = { open: 0, wide: 0, round: 0, press: 0 }

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

// ── From the sound ──

export class VoiceShaper {
  private wave: Uint8Array<ArrayBuffer>
  private freq: Uint8Array<ArrayBuffer>
  private peak = 0.05
  private tilt = -1
  private history: Array<{ t: number; shape: MouthShape }> = []

  constructor(private analyser: AnalyserNode) {
    analyser.smoothingTimeConstant = 0.3
    this.wave = new Uint8Array(analyser.fftSize)
    this.freq = new Uint8Array(analyser.frequencyBinCount)
  }

  shape(): MouthShape {
    const now = performance.now()
    this.history.push({ t: now, shape: this.measure() })
    // The analyser hears the audio before the speakers play it: show the shape that is audible now
    const ctx = this.analyser.context as AudioContext
    const lag = ((ctx.outputLatency || 0) + (ctx.baseLatency || 0)) * 1000
    while (this.history.length > 1 && this.history[1].t <= now - lag) this.history.shift()
    return this.history[0].shape
  }

  private band(lo: number, hi: number): number {
    const a = this.analyser
    const hz = a.context.sampleRate / a.fftSize
    let sum = 0
    for (let i = Math.max(1, Math.floor(lo / hz)); i <= Math.min(this.freq.length - 1, Math.ceil(hi / hz)); i++) {
      sum += Math.pow(10, (a.minDecibels + (this.freq[i] / 255) * (a.maxDecibels - a.minDecibels)) / 10)
    }
    return sum
  }

  private measure(): MouthShape {
    const a = this.analyser
    a.getByteTimeDomainData(this.wave)
    let sum = 0
    for (let i = 0; i < this.wave.length; i++) { const x = (this.wave[i] - 128) / 128; sum += x * x }
    const rms = Math.sqrt(sum / this.wave.length)
    // Follow the voice's own loudness so quiet and loud voices both use the full range
    this.peak = Math.max(rms, this.peak * 0.998, 0.02)
    const loud = smoothstep(0.08, 0.75, rms / this.peak)
    if (loud < 0.02) return { ...MOUTH_REST, press: 0.6 } // a pause or the closure before "b"/"p"

    a.getByteFrequencyData(this.freq)
    const low = this.band(200, 900) // first formant: how far the jaw drops
    const spread = this.band(1400, 2800) // second formant of "ee"/"ay": lips spread
    const hiss = this.band(3500, 8000) // "s", "sh", "f", "t"
    const voiced = low + spread + 1e-12
    const fricative = smoothstep(0.3, 0.6, hiss / (hiss + voiced))

    // Spread versus rounded, relative to this voice's average vowel
    const tilt = Math.log10((spread + 1e-12) / (low + 1e-12))
    this.tilt += (tilt - this.tilt) * 0.02
    const d = tilt - this.tilt
    const wide = smoothstep(0.15, 0.6, d)
    const round = smoothstep(-0.15, -0.6, d)

    // Where the first formant sits: high for "ah", low for "ee"/"oo"
    let moment = 0
    let weight = 0
    const hz = a.context.sampleRate / a.fftSize
    for (let i = Math.floor(200 / hz); i <= Math.ceil(1000 / hz); i++) {
      const p = this.freq[i] / 255
      moment += p * p * i * hz
      weight += p * p
    }
    const f1 = weight ? moment / weight : 500
    const jaw = loud * (0.55 + 0.45 * smoothstep(380, 680, f1))

    return {
      open: jaw * (1 - 0.65 * fricative),
      wide: Math.max(wide * (1 - fricative), 0.5 * fricative),
      round: round * (1 - fricative),
      press: 0,
    }
  }
}

// ── From the words ──

const SHAPES = {
  A: { open: 0.95, wide: 0.25, round: 0, press: 0 },
  E: { open: 0.5, wide: 0.85, round: 0, press: 0 },
  I: { open: 0.35, wide: 0.75, round: 0, press: 0 },
  O: { open: 0.7, wide: 0, round: 0.75, press: 0 },
  U: { open: 0.3, wide: 0, round: 1, press: 0 },
  M: { open: 0, wide: 0.1, round: 0, press: 1 }, // m b p
  F: { open: 0.12, wide: 0.35, round: 0, press: 0.35 }, // f v
  T: { open: 0.22, wide: 0.45, round: 0, press: 0 }, // t d n s z th k g h
  L: { open: 0.38, wide: 0.3, round: 0, press: 0 },
  R: { open: 0.28, wide: 0, round: 0.5, press: 0 },
  S: { open: 0.3, wide: 0.1, round: 0.55, press: 0 }, // sh ch j
} satisfies Record<string, MouthShape>
type Viseme = keyof typeof SHAPES

// Spelling to mouth shapes, longest match first. Rough, but English spelling is mostly enough for lips.
const RULES: Array<[string, Viseme[]]> = [
  ['tch', ['S']], ['igh', ['A', 'I']], ['ough', ['O']],
  ['th', ['T']], ['sh', ['S']], ['ch', ['S']], ['ph', ['F']], ['wh', ['U']], ['qu', ['T', 'U']], ['ck', ['T']], ['ng', ['T']],
  ['oo', ['U']], ['ee', ['E']], ['ea', ['E']], ['ie', ['I']], ['ey', ['E']],
  ['ou', ['O', 'U']], ['ow', ['O', 'U']], ['oi', ['O', 'I']], ['oy', ['O', 'I']],
  ['ai', ['E']], ['ay', ['E', 'I']], ['ei', ['E']], ['au', ['O']], ['aw', ['O']], ['ew', ['U']], ['ue', ['U']],
  ['a', ['A']], ['e', ['E']], ['i', ['I']], ['o', ['O']], ['u', ['A']], ['y', ['I']],
  ['m', ['M']], ['b', ['M']], ['p', ['M']], ['f', ['F']], ['v', ['F']], ['w', ['U']], ['l', ['L']], ['r', ['R']], ['j', ['S']],
]
const VOWELS = new Set<Viseme>(['A', 'E', 'I', 'O', 'U'])
const GAP = 1 // between words, in consonant units
const PAUSE_MS: Record<string, number> = { ',': 180, ';': 220, ':': 220, '.': 380, '!': 380, '?': 380 }
// One consonant at rate 1 (vowels last longer): a starting guess, then learnt from the voice's word events
let unitMs = 55
// For voices that never report words: how their pace compares with the estimate, learnt per sentence
let pace = 1

function wordVisemes(word: string): Array<[Viseme, number]> {
  let s = word.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (s.length > 3 && /[^aeiou]e$/.test(s)) s = s.slice(0, -1) // silent final e
  const out: Viseme[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/[0-9]/.test(c)) { out.push('T', 'A'); i++; continue }
    if (i > 0 && c === s[i - 1] && !'aeiou'.includes(c)) { i++; continue } // "ll", "ss", "tt"
    if (i === 0 && c === 'y') { out.push('T'); i++; continue }
    const rule = RULES.find(([g]) => s.startsWith(g, i))
    if (rule) { out.push(...rule[1]); i += rule[0].length } else { out.push('T'); i++ }
  }
  return out.map((v) => [v, VOWELS.has(v) ? 1.6 : v === 'M' ? 1 : 0.9])
}

export class TextLipSync {
  private words: Array<{ end: number; visemes: Array<[Viseme, number]>; weight: number; pause: number }>
  private unit: number
  private index = -1
  private since = 0
  private startedAt = 0
  private boundaries = false

  constructor(text: string, private rate = 1) {
    this.unit = unitMs / rate
    this.words = Array.from(text.matchAll(/([A-Za-z0-9']+)([^A-Za-z0-9']*)/g), (m) => {
      const visemes = wordVisemes(m[1])
      const punctuation = Array.from(m[2]).find((c) => c in PAUSE_MS)
      return {
        end: (m.index ?? 0) + m[1].length,
        visemes,
        weight: visemes.reduce((n, [, w]) => n + w, 0),
        pause: punctuation ? PAUSE_MS[punctuation] : 0,
      }
    })
  }

  /** The voice became audible. */
  start(): void {
    if (this.index >= 0) return
    this.index = 0
    this.since = this.startedAt = performance.now()
  }

  /** The voice reached the word at this character (SpeechSynthesisUtterance 'boundary'). */
  boundary(charIndex: number, name?: string): void {
    if (name === 'sentence') return // sent before the first word is audible
    const i = this.words.findIndex((w) => w.end > charIndex)
    if (i < 0) return
    const now = performance.now()
    // Learn this voice's pace from how long the previous word really took
    if (this.boundaries && i === this.index + 1) {
      const prev = this.words[this.index]
      const ms = (now - this.since - prev.pause) / (prev.weight + GAP)
      if (ms > 15 && ms < 200) {
        this.unit += (ms - this.unit) * 0.3
        unitMs = this.unit * this.rate
      }
    }
    if (this.index < 0) this.startedAt = now
    this.boundaries = true
    this.index = i
    this.since = now
  }

  /** The voice finished. One that never reported words teaches the next sentence its pace. */
  finish(): void {
    if (!this.boundaries && this.startedAt) {
      const estimate = this.words.reduce((n, w) => n + (w.weight + GAP) * this.unit + w.pause, 0) * pace
      const actual = performance.now() - this.startedAt
      if (actual > 500 && estimate > 0) pace = Math.min(2, Math.max(0.5, pace * Math.pow(actual / estimate, 0.6)))
    }
    this.index = this.words.length
  }

  /** The shape right now, following the voice's word events. */
  shape(): MouthShape {
    const now = performance.now()
    for (;;) {
      const word = this.words[this.index]
      if (!word) return MOUTH_REST
      const unit = this.boundaries ? this.unit : this.unit * pace
      let left = now - this.since
      for (const [v, w] of word.visemes) {
        left -= w * unit
        if (left < 0) return SHAPES[v]
      }
      if (this.boundaries) return MOUTH_REST // wait for the voice to reach the next word
      // Voices that never report words: move on at the learnt pace
      const rest = GAP * unit + word.pause * pace
      if (left < rest) return MOUTH_REST
      this.since += word.weight * unit + rest
      this.index++
    }
  }

  /** The shape at a point (0 to 1) through the text, for audio whose progress is known. */
  shapeAt(progress: number): MouthShape {
    const length = (w: (typeof this.words)[number]) => w.weight + GAP + w.pause / this.unit
    let left = Math.min(1, Math.max(0, progress)) * this.words.reduce((n, w) => n + length(w), 0)
    for (const word of this.words) {
      for (const [v, w] of word.visemes) {
        left -= w
        if (left < 0) return SHAPES[v]
      }
      left -= length(word) - word.weight
      if (left < 0) return MOUTH_REST
    }
    return MOUTH_REST
  }
}
