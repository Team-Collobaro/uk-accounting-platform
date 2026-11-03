// Mouth shapes for the tutor avatar, and how far through its words a voice is, kept in step with
// whatever is speaking.
//  - Neural voice (an audio clip): the whole clip is analysed before it plays, then looked up by its
//    playback position, so the lips and the words follow the sound exactly.
//  - Browser speech (its audio cannot be analysed): shaped by the words, re-synced every time the
//    voice reports reaching the next word.
// "How far through" is counted in words as subtitles show them (split on spaces), so a subtitle word
// is spoken once progress × words passes its index.

import { normaliseForSpeech } from './localTts'

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

// ── Timing ──

// Sound reaches the ear a moment after the browser hands it to the speakers (longer over Bluetooth).
// The lips and the picture should wait for that moment, or they run ahead of what is heard.
let clock: AudioContext | null = null

/** Call from a tap: starts a clock that reports the output delay. */
export function startOutputClock(): void {
  if (clock) return
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    clock = new AC()
    clock.resume().catch(() => {})
  } catch { clock = null }
}

/** Seconds between playing a sound and hearing it. 0 where the browser does not report it. */
export function outputDelay(): number {
  return clock ? (clock.outputLatency || 0) + (clock.baseLatency || 0) : 0
}

/** The point in a clip that is being heard now, from its playback position. */
export function heardTime(el: HTMLMediaElement): number {
  return Math.max(0, el.currentTime - outputDelay())
}

// ── From the sound ──

const RATE = 24000 // the clip is resampled to this before analysis
const HOP = 240 // one mouth shape every 10 ms
const WIN = 512
const FPS = RATE / HOP
// Lips move slightly before the sound they make
const LEAD = 0.04
// Speech starts and ends where the clip gets this loud; quieter than SILENT_DB is a pause (dB below its loud parts)
const SPEECH_DB = -25
const SILENT_DB = -32
// The sound kept for drawing: averaged down to this rate, which keeps the voice's pitch and lower harmonics
const WAVE_RATE = 2400
// The pitch ranges kept for drawing bars: BANDS ranges, evenly spaced on a musical (log) scale, in Hz
export const BANDS = 16
const BAND_EDGES = Array.from({ length: BANDS + 1 }, (_, i) => 90 * Math.pow(7000 / 90, i / BANDS))
// How far below its loud moments a range goes quiet on the bars, in dB
const BAND_RANGE_DB = 32

/** The sound being heard right now: which clip, and how far into it. */
export interface HeardSound {
  track: AudioLipTrack
  seconds: number
}

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
  private constructor(
    private open: Float32Array, private wide: Float32Array, private round: Float32Array, private press: Float32Array,
    /** Loudness every 10 ms, in dB below the clip's loud parts */
    private db: Float32Array,
    /** The sound itself at WAVE_RATE, scaled so the clip's loud parts reach about ±1 */
    private wave: Float32Array,
    /** How strong each pitch range is every 10 ms (BANDS values per frame, 0 to 1) */
    private bands: Float32Array,
  ) {}

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
    const bandDb = new Float32Array(n * BANDS)
    const bands = new Float32Array(n * BANDS)
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
      // The voice split into pitch ranges, for drawing as bars
      for (let b = 0; b < BANDS; b++) {
        let s = 0
        for (let k = bin(BAND_EDGES[b]); k < Math.max(bin(BAND_EDGES[b]) + 1, bin(BAND_EDGES[b + 1])); k++) s += power(k)
        bandDb[f * BANDS + b] = 10 * Math.log10(s + 1e-12)
      }
    }
    // Each range against its own loud moments, so every bar uses its full height
    for (let b = 0; b < BANDS; b++) {
      const values = Array.from({ length: n }, (_, f) => bandDb[f * BANDS + b]).sort((x, y) => x - y)
      const top = values[Math.floor(values.length * 0.97)] ?? 0
      for (let f = 0; f < n; f++) bands[f * BANDS + b] = Math.min(1, Math.max(0, 1 + (bandDb[f * BANDS + b] - top) / BAND_RANGE_DB))
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
    const step = RATE / WAVE_RATE
    const wave = new Float32Array(Math.floor(pcm.length / step))
    for (let i = 0; i < wave.length; i++) {
      let sum = 0
      for (let k = 0; k < step; k++) sum += pcm[i * step + k]
      wave[i] = sum / step
    }
    const sizes = Array.from(wave, Math.abs).sort((a, b) => a - b)
    const peak = sizes[Math.floor(sizes.length * 0.995)] || 1
    for (let i = 0; i < wave.length; i++) wave[i] /= peak

    return new AudioLipTrack(blur(open, 1.5), blur(wide, 3), blur(round, 3), blur(press, 1.5), Float32Array.from(db), wave, bands)
  }

  /**
   * How strong each pitch range is at a playback time (0 to 1 each, lowest first), for drawing the
   * voice as bars: fills `out`, which holds BANDS values.
   */
  bandsAt(seconds: number, out: Float32Array): void {
    const frames = this.bands.length / BANDS
    const x = seconds * FPS
    const f = Math.floor(x)
    for (let b = 0; b < Math.min(BANDS, out.length); b++) {
      if (f < 0 || f >= frames) { out[b] = 0; continue }
      const a = this.bands[f * BANDS + b]
      const c = f + 1 < frames ? this.bands[(f + 1) * BANDS + b] : a
      out[b] = a + (c - a) * (x - f)
    }
  }

  /**
   * The sound itself around a playback time, for drawing: fills `out` with the waveform over `span`
   * seconds centred on that time (the clip's loud parts near ±1, silence at 0). Lined up on the
   * nearest upward zero crossing, as an oscilloscope does, so a steady sound holds still on screen.
   */
  waveAt(seconds: number, out: Float32Array, span = 0.25): void {
    const w = this.wave
    let centre = seconds * WAVE_RATE
    const at = Math.floor(centre)
    const reach = Math.round(0.012 * WAVE_RATE)
    for (let d = 0; d <= reach; d++) {
      const up = (i: number) => i > 0 && i < w.length && w[i - 1] < 0 && w[i] >= 0
      if (up(at + d)) { centre = at + d; break }
      if (up(at - d)) { centre = at - d; break }
    }
    const n = out.length
    for (let k = 0; k < n; k++) {
      const x = centre + (k / Math.max(1, n - 1) - 0.5) * span * WAVE_RATE
      const i = Math.floor(x)
      out[k] = i < 0 || i + 1 >= w.length ? 0 : w[i] + (w[i + 1] - w[i]) * (x - i)
    }
  }

  /**
   * How far through `text` (0 to 1, in subtitle words) the voice is at a playback time in this clip.
   * The text's timing model is fitted to the clip itself: where the speech really starts and ends,
   * and the pauses the voice really made at full stops and commas.
   */
  timeline(text: string): (seconds: number) => number {
    const model = tokenModel(text, BASE_UNIT)
    const n = model.length
    const db = this.db
    let first = 0
    while (first < db.length && db[first] < SPEECH_DB) first++
    let last = db.length - 1
    while (last > first && db[last] < SPEECH_DB) last--
    if (!n || last <= first) {
      const length = Math.max(0.1, db.length / FPS)
      return (seconds) => Math.min(1, Math.max(0, seconds / length))
    }
    const t0 = first / FPS
    const t1 = (last + 1) / FPS

    // The pauses the voice made: at least 100 ms of near silence
    const pauses: Array<{ from: number; to: number }> = []
    for (let f = first; f <= last;) {
      if (db[f] >= SILENT_DB) { f++; continue }
      let end = f
      while (end <= last && db[end] < SILENT_DB) end++
      if (end - f >= 10) pauses.push({ from: f / FPS, to: end / FPS })
      f = end
    }

    // The text's own timeline, in units: word k is said from s[k] for model[k].speak
    const s: number[] = []
    let u = 0
    for (const w of model) { s.push(u); u += w.speak + w.rest }
    const spoken = s[n - 1] + model[n - 1].speak
    // Where the text expects a pause: after each word with punctuation, but not the last
    const slots = model.flatMap((w, k) => (w.stop && k < n - 1 ? [k] : []))
    const expected = (k: number) => t0 + ((s[k] + model[k].speak + model[k].rest / 2) / spoken) * (t1 - t0)

    // Pair the pauses with those places, in order, at the least cost: a pause far from where the text
    // expects it costs more, and so does leaving out a full stop or a long pause
    const P = pauses.length
    const m = slots.length
    const cost = Array.from({ length: P + 1 }, () => new Array<number>(m + 1).fill(Infinity))
    const how = Array.from({ length: P + 1 }, () => new Array<number>(m + 1).fill(0))
    const skipPause = (i: number) => 0.8 * Math.min(1.5, (pauses[i].to - pauses[i].from) / 0.25)
    const skipSlot = (j: number) => model[slots[j]].stop / PAUSE_MS['.']
    const pair = (i: number, j: number) => {
      const off = ((pauses[i].from + pauses[i].to) / 2 - expected(slots[j])) / (t1 - t0)
      return 12 * off * off
    }
    cost[0][0] = 0
    for (let i = 0; i <= P; i++) {
      for (let j = 0; j <= m; j++) {
        const c = cost[i][j]
        if (!Number.isFinite(c)) continue
        if (i < P && c + skipPause(i) < cost[i + 1][j]) { cost[i + 1][j] = c + skipPause(i); how[i + 1][j] = 1 }
        if (j < m && c + skipSlot(j) < cost[i][j + 1]) { cost[i][j + 1] = c + skipSlot(j); how[i][j + 1] = 2 }
        if (i < P && j < m && c + pair(i, j) < cost[i + 1][j + 1]) { cost[i + 1][j + 1] = c + pair(i, j); how[i + 1][j + 1] = 3 }
      }
    }
    // Each paired pause pins the end of the word before it and the start of the word after it
    const pins: Array<[number, number]> = [[0, t0], [spoken, t1]]
    for (let i = P, j = m; i > 0 || j > 0;) {
      if (how[i][j] === 3) {
        const k = slots[j - 1]
        pins.push([s[k] + model[k].speak, pauses[i - 1].from], [s[k + 1], pauses[i - 1].to])
        i--
        j--
      } else if (how[i][j] === 1) i--
      else j--
    }
    pins.sort((a, b) => a[0] - b[0])
    const timeOf = (x: number) => {
      let k = 0
      while (k + 2 < pins.length && pins[k + 1][0] <= x) k++
      const [ua, ta] = pins[k]
      const [ub, tb] = pins[k + 1]
      return ub > ua ? ta + ((x - ua) / (ub - ua)) * (tb - ta) : ta
    }
    const starts = s.map(timeOf)

    return (seconds) => {
      if (seconds <= starts[0]) return 0
      if (seconds >= t1) return 1
      let k = 0
      while (k + 1 < n && starts[k + 1] <= seconds) k++
      const next = k + 1 < n ? starts[k + 1] : t1
      return (k + Math.min(1, (seconds - starts[k]) / Math.max(1e-3, next - starts[k]))) / n
    }
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
// One consonant at rate 1 (vowels last longer)
const BASE_UNIT = 55
// ...a starting guess for the browser voice, then learnt from its word events
let unitMs = BASE_UNIT
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

/** The words of a text as subtitles show them: split on spaces, punctuation attached. */
export function textTokens(text: string): string[] {
  return text.match(/\S+/g) ?? []
}

/**
 * Each subtitle word's speaking time, and the rest after it (the gap to the next word, plus a pause
 * at punctuation), in consonant units of `unit` ms. Words are timed as they are said ("£10,000" as
 * "10000 pounds"), since that is what the voice reads.
 */
function tokenModel(text: string, unit: number): Array<{ speak: number; rest: number; stop: number }> {
  return textTokens(text).map((token) => {
    const said = normaliseForSpeech(token).split(/\s+/).filter(Boolean)
    const speak = said.reduce((n, w) => n + wordVisemes(w).reduce((m, [, x]) => m + x, 0), 0) + GAP * Math.max(0, said.length - 1)
    const punctuation = Array.from(token).find((c) => c in PAUSE_MS)
    const stop = punctuation ? PAUSE_MS[punctuation] : 0
    return { speak, rest: GAP + stop / unit, stop }
  })
}

/** Within a word, glide into the next sound over the second half of each one, as lips do. */
function glide(visemes: Array<[Viseme, number]>, j: number, into: number, then: MouthShape): MouthShape {
  const next = j + 1 < visemes.length ? SHAPES[visemes[j + 1][0]] : then
  return mix(SHAPES[visemes[j][0]], next, smoothstep(0.5, 1, into) * 0.7)
}

export class TextLipSync {
  /** Each word, with the subtitle word it belongs to ("anti-money" is one subtitle word, two here) */
  private words: Array<{ end: number; visemes: Array<[Viseme, number]>; weight: number; pause: number; token: number; part: number; parts: number }>
  private tokens: number
  private unit: number
  private index = -1
  private since = 0
  private startedAt = 0
  private pausedAt = 0
  private high = 0
  private boundaries = false

  constructor(text: string, private rate = 1) {
    this.unit = unitMs / rate
    const tokenEnds = Array.from(text.matchAll(/\S+/g), (m) => (m.index ?? 0) + m[0].length)
    this.tokens = tokenEnds.length
    this.words = Array.from(text.matchAll(/([A-Za-z0-9']+)([^A-Za-z0-9']*)/g), (m) => {
      const visemes = wordVisemes(m[1])
      const punctuation = Array.from(m[2]).find((c) => c in PAUSE_MS)
      const at = m.index ?? 0
      return {
        end: at + m[1].length,
        visemes,
        weight: visemes.reduce((n, [, w]) => n + w, 0),
        pause: punctuation ? PAUSE_MS[punctuation] : 0,
        token: Math.max(0, tokenEnds.findIndex((end) => end > at)),
        part: 0,
        parts: 1,
      }
    })
    for (let i = 0; i < this.words.length; i++) {
      const prev = this.words[i - 1]
      if (prev && prev.token === this.words[i].token) this.words[i].part = prev.part + 1
    }
    for (let i = this.words.length - 1; i >= 0; i--) {
      const next = this.words[i + 1]
      this.words[i].parts = next && next.token === this.words[i].token ? next.parts : this.words[i].part + 1
    }
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
    const now = this.clock()
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

  /** The voice was paused: its clock stops too. */
  hold(): void {
    this.pausedAt = performance.now()
  }

  /** The voice carries on: the clock moves past the pause, so the words do not run ahead. */
  resume(): void {
    if (!this.pausedAt) return
    this.since += performance.now() - this.pausedAt
    this.pausedAt = 0
  }

  /** How far through the text the voice is (0 to 1, in subtitle words): smooth within a word, re-synced at each word the voice reports. */
  progress(): number {
    if (this.index < 0) return 0
    const { into } = this.locate(this.clock()) // may move the index on, so read it after
    const word = this.words[this.index]
    const value = word && this.tokens ? (word.token + (word.part + into) / word.parts) / this.tokens : 1
    // Never back up: a word reported earlier than estimated must not hide what is already on screen
    this.high = Math.max(this.high, value)
    return this.high
  }

  /** The time the voice has been speaking for; stands still while paused. */
  private clock(): number {
    return this.pausedAt || performance.now()
  }

  /** The word being spoken at this time, and how far through it (0 to 1). Moves on for voices that report no words. */
  private locate(now: number): { into: number } {
    const unit = this.boundaries ? this.unit : this.unit * pace
    for (;;) {
      const word = this.words[this.index]
      if (!word) return { into: 1 }
      const length = (word.weight + GAP) * unit + word.pause * (this.boundaries ? 1 : pace)
      const elapsed = now - this.since
      if (elapsed < length) return { into: elapsed / length }
      if (this.boundaries) return { into: 1 } // wait for the voice to reach the next word
      this.since += length
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
