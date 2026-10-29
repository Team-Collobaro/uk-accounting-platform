// Mouth shapes for the tutor avatar, kept in step with whatever is speaking.
//  - Neural voice (an audio clip): the whole clip is analysed before it plays, then looked up by its
//    playback position, so the lips follow the sound exactly.
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

const mix = (a: MouthShape, b: MouthShape, k: number): MouthShape => ({
  open: a.open + (b.open - a.open) * k,
  wide: a.wide + (b.wide - a.wide) * k,
  round: a.round + (b.round - a.round) * k,
  press: a.press + (b.press - a.press) * k,
})

// ── From the sound ──

const RATE = 24000 // the clip is resampled to this before analysis
const HOP = 240 // one mouth shape every 10 ms
const WIN = 512
const FPS = RATE / HOP
// Lips move slightly before the sound they make
const LEAD = 0.04

/** In-place radix-2 FFT. */
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]] }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const c = Math.cos(a * k)
        const s = Math.sin(a * k)
        const p = i + k
        const q = p + len / 2
        const tr = re[q] * c - im[q] * s
        const ti = re[q] * s + im[q] * c
        re[q] = re[p] - tr; im[q] = im[p] - ti
        re[p] += tr; im[p] += ti
      }
    }
  }
}

/** Zero-phase smoothing: no lag, unlike smoothing while playing. */
function blur(x: Float32Array, sigma: number): Float32Array {
  const r = Math.ceil(sigma * 2.5)
  const w = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-(((i - r) / sigma) ** 2) / 2))
  const out = new Float32Array(x.length)
  for (let i = 0; i < x.length; i++) {
    let sum = 0
    let norm = 0
    for (let k = -r; k <= r; k++) {
      const j = i + k
      if (j < 0 || j >= x.length) continue
      sum += x[j] * w[k + r]
      norm += w[k + r]
    }
    out[i] = sum / norm
  }
  return out
}

/** A neural-voice clip analysed before it plays: a mouth shape every 10 ms, looked up by playback time. */
export class AudioLipTrack {
  private constructor(private open: Float32Array, private wide: Float32Array, private round: Float32Array, private press: Float32Array) {}

  static async load(url: string): Promise<AudioLipTrack | null> {
    try {
      const data = await (await fetch(url)).arrayBuffer()
      const audio = await new OfflineAudioContext(1, 1, RATE).decodeAudioData(data)
      return AudioLipTrack.analyse(audio.getChannelData(0))
    } catch {
      return null
    }
  }

  static analyse(pcm: Float32Array): AudioLipTrack {
    const n = Math.max(1, Math.ceil(pcm.length / HOP))
    const rms = new Float32Array(n)
    const low = new Float32Array(n)
    const spread = new Float32Array(n)
    const hiss = new Float32Array(n)
    const f1 = new Float32Array(n)
    const re = new Float32Array(WIN)
    const im = new Float32Array(WIN)
    const hz = RATE / WIN
    const bin = (f: number) => Math.round(f / hz)
    for (let f = 0; f < n; f++) {
      const start = f * HOP - WIN / 2
      let sum = 0
      for (let i = 0; i < WIN; i++) {
        const x = pcm[start + i] ?? 0
        sum += x * x
        re[i] = x * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (WIN - 1)))
        im[i] = 0
      }
      rms[f] = Math.sqrt(sum / WIN)
      fft(re, im)
      const power = (k: number) => re[k] * re[k] + im[k] * im[k]
      const band = (lo: number, hi: number) => { let s = 0; for (let k = bin(lo); k <= bin(hi); k++) s += power(k); return s }
      low[f] = band(200, 900) // first formant: how far the jaw drops
      spread[f] = band(1400, 2800) // second formant of "ee"/"ay": lips spread
      hiss[f] = band(3500, 8000) // "s", "sh", "f", "t"
      // Where the first formant sits: high for "ah", low for "ee"/"oo" (above most of the voice's pitch)
      let moment = 0
      let weight = 0
      for (let k = bin(250); k <= bin(1000); k++) { const p = power(k); moment += p * k * hz; weight += p }
      f1[f] = weight ? moment / weight : 400
    }

    // Loudness relative to this clip's own loud parts. Vowels sit within a few dB of the peak and
    // consonants 10-20 dB below, so the scale is steep at the top to make syllables visible.
    const sorted = Array.from(rms).filter((x) => x > 1e-4).sort((a, b) => a - b)
    const ref = sorted.length ? sorted[Math.floor(sorted.length * 0.95)] : 1
    const db = Array.from(rms, (x) => 20 * Math.log10(Math.max(x, 1e-6) / ref))
    const level = db.map((d) => Math.min(1, Math.max(0, (d + 24) / 22)))

    // Spread versus rounded, against this voice's typical vowel
    const tilt = Array.from(spread, (s, f) => Math.log10((s + 1e-12) / (low[f] + 1e-12)))
    const vowels = tilt.filter((_, f) => db[f] > -10).sort((a, b) => a - b)
    const typical = vowels.length ? vowels[Math.floor(vowels.length / 2)] : 0

    const open = new Float32Array(n)
    const wide = new Float32Array(n)
    const round = new Float32Array(n)
    const press = new Float32Array(n)
    for (let f = 0; f < n; f++) {
      const fricative = smoothstep(0.3, 0.6, hiss[f] / (hiss[f] + low[f] + spread[f] + 1e-12))
      const d = tilt[f] - typical
      const voiced = level[f] > 0.3 ? 1 - fricative : 0
      open[f] = level[f] * level[f] * (0.5 + 0.5 * smoothstep(260, 520, f1[f])) * (1 - 0.6 * fricative)
      wide[f] = Math.max(smoothstep(0.25, 0.9, d) * voiced, 0.5 * fricative * Math.min(1, level[f] * 3))
      round[f] = smoothstep(-0.25, -0.9, d) * voiced
    }
    // A short silence between sounds is the lips closing for "p", "b" or a stop
    const quiet = (f: number) => level[f] < 0.15
    for (let f = 0; f < n;) {
      if (!quiet(f)) { f++; continue }
      let end = f
      while (end < n && quiet(end)) end++
      if (f > 0 && end < n && end - f <= 12) for (let k = f; k < end; k++) press[k] = 0.6
      f = end
    }
    return new AudioLipTrack(blur(open, 1.5), blur(wide, 3), blur(round, 3), blur(press, 1.5))
  }

  /** The shape at this point of the clip's playback, in seconds. */
  shapeAt(seconds: number): MouthShape {
    const x = (seconds + LEAD) * FPS
    const i = Math.floor(x)
    if (i < 0 || i >= this.open.length) return MOUTH_REST
    const j = Math.min(i + 1, this.open.length - 1)
    const k = x - i
    const at = (a: Float32Array) => a[i] + (a[j] - a[i]) * k
    return { open: at(this.open), wide: at(this.wide), round: at(this.round), press: at(this.press) }
  }
}

// ── From the words ──

const SHAPES = {
  A: { open: 0.85, wide: 0.25, round: 0, press: 0 },
  E: { open: 0.45, wide: 0.8, round: 0, press: 0 },
  I: { open: 0.3, wide: 0.7, round: 0, press: 0 },
  O: { open: 0.6, wide: 0, round: 0.7, press: 0 },
  U: { open: 0.25, wide: 0, round: 0.95, press: 0 },
  M: { open: 0, wide: 0.1, round: 0, press: 1 }, // m b p
  F: { open: 0.1, wide: 0.35, round: 0, press: 0.35 }, // f v
  T: { open: 0.2, wide: 0.4, round: 0, press: 0 }, // t d n s z th k g h
  L: { open: 0.3, wide: 0.3, round: 0, press: 0 },
  R: { open: 0.2, wide: 0, round: 0.45, press: 0 },
  S: { open: 0.2, wide: 0.1, round: 0.5, press: 0 }, // sh ch j
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

/** Within a word, glide into the next sound over the second half of each one, as lips do. */
function glide(visemes: Array<[Viseme, number]>, j: number, into: number, then: MouthShape): MouthShape {
  const next = j + 1 < visemes.length ? SHAPES[visemes[j + 1][0]] : then
  return mix(SHAPES[visemes[j][0]], next, smoothstep(0.5, 1, into) * 0.7)
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
      for (let j = 0; j < word.visemes.length; j++) {
        const length = word.visemes[j][1] * unit
        if (left < length) return glide(word.visemes, j, left / length, MOUTH_REST)
        left -= length
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
      for (let j = 0; j < word.visemes.length; j++) {
        const w = word.visemes[j][1]
        if (left < w) return glide(word.visemes, j, left / w, MOUTH_REST)
        left -= w
      }
      left -= length(word) - word.weight
      if (left < 0) return MOUTH_REST
    }
    return MOUTH_REST
  }
}
