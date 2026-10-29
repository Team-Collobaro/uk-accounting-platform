// Free on-device tutor voice (Kokoro, Apache-2.0) running in a Web Worker in the student's browser.
// Until the model has downloaded, or if the device is too slow, callers get null and use the browser voice.

type Status = 'idle' | 'loading' | 'ready' | 'failed'

export const LOCAL_VOICE = 'bm_george' // British English, male. Others: bm_lewis, bf_emma, bf_isabella

let worker: Worker | null = null
let status: Status = 'idle'
let percent = 0
let nextId = 1
let slowStreak = 0
const pending = new Map<number, (url: string | null) => void>()
const listeners = new Set<() => void>()

function notify() { listeners.forEach((l) => l()) }

export function subscribeLocalTts(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function localTtsState(): { status: Status; percent: number } {
  return { status, percent }
}

/** Skip very weak devices and slow connections: they are better served by the browser voice. */
export function deviceCanTryLocalTts(): boolean {
  if (typeof window === 'undefined' || !window.Worker) return false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const n = navigator as any
  if (n.connection?.saveData) return false
  if (['slow-2g', '2g', '3g'].includes(n.connection?.effectiveType)) return false
  const cores = n.hardwareConcurrency ?? 4
  const memory = n.deviceMemory ?? 8
  return !!n.gpu || (cores >= 4 && memory >= 4)
}

function fail() {
  status = 'failed'
  worker?.terminate()
  worker = null
  pending.forEach((resolve) => resolve(null))
  pending.clear()
  notify()
}

export function startLocalTts(): void {
  if (worker || status === 'failed' || !deviceCanTryLocalTts()) return
  try {
    worker = new Worker('/kokoro-worker.js', { type: 'module' })
  } catch { status = 'failed'; notify(); return }
  status = 'loading'
  notify()
  worker.onmessage = (e: MessageEvent) => {
    const m = e.data
    if (m.type === 'progress') {
      const p = m.progress
      if (p && typeof p.progress === 'number') { percent = Math.max(percent, Math.round(p.progress)); notify() }
    } else if (m.type === 'ready') {
      status = 'ready'; percent = 100; notify()
    } else if (m.type === 'error') {
      console.warn('Local voice unavailable:', m.message)
      fail()
    } else if (m.type === 'audio') {
      const resolve = pending.get(m.id)
      pending.delete(m.id)
      if (!resolve) return
      if (m.error || !m.blob) { resolve(null); return }
      // Too slow to keep up with speech? Give up after a few in a row.
      slowStreak = m.ms / 1000 > m.seconds * 1.5 ? slowStreak + 1 : 0
      if (slowStreak >= 3) { fail(); resolve(URL.createObjectURL(m.blob)); return }
      resolve(URL.createObjectURL(m.blob))
    }
  }
  worker.onerror = () => fail()
  worker.postMessage({ type: 'init' })
}

/** Returns an object URL for a WAV of `text`, or null when the local voice is not ready. */
export function localSpeak(text: string): Promise<string | null> {
  if (status !== 'ready' || !worker) return Promise.resolve(null)
  const id = nextId++
  return new Promise((resolve) => {
    pending.set(id, resolve)
    worker!.postMessage({ type: 'speak', id, text, voice: LOCAL_VOICE })
  })
}

/** Make money, percentages and acronyms read the way a UK teacher would say them. */
export function normaliseForSpeech(text: string): string {
  return text
    .replace(/£\s?([\d,]+(?:\.\d+)?)/g, (_m, n: string) => `${n.replace(/,/g, '')} pounds`)
    .replace(/(\d)\s?%/g, '$1 percent')
    .replace(/\bHMRC\b/g, 'H M R C')
    .replace(/\bCT600\b/g, 'C T six hundred')
    .replace(/\bVAT\b/g, 'vat')
}
