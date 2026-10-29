// Runs the free, open-source Kokoro voice model inside the student's own browser.
// No server, no per-character cost. Falls back silently (the page uses the browser voice) if anything fails.
let tts = null
let ready = null
let chain = Promise.resolve()

async function load() {
  const { KokoroTTS } = await import('https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm')
  let gpu = false
  try { gpu = !!self.navigator.gpu && !!(await self.navigator.gpu.requestAdapter()) } catch { gpu = false }
  tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
    dtype: gpu ? 'fp32' : 'q8',
    device: gpu ? 'webgpu' : 'wasm',
    progress_callback: (p) => postMessage({ type: 'progress', progress: p }),
  })
  return gpu ? 'webgpu' : 'wasm'
}

async function handle(m) {
  if (m.type === 'init') {
    try {
      ready = ready || load()
      postMessage({ type: 'ready', device: await ready })
    } catch (err) {
      postMessage({ type: 'error', message: String(err) })
    }
    return
  }
  if (m.type === 'speak') {
    try {
      await ready
      const t0 = performance.now()
      const audio = await tts.generate(m.text, { voice: m.voice, speed: m.speed || 1 })
      const blob = typeof audio.toBlob === 'function' ? audio.toBlob() : new Blob([audio.toWav()], { type: 'audio/wav' })
      postMessage({ type: 'audio', id: m.id, blob, seconds: audio.audio.length / audio.sampling_rate, ms: performance.now() - t0 })
    } catch (err) {
      postMessage({ type: 'audio', id: m.id, error: String(err) })
    }
  }
}

// One job at a time: the model cannot run two generations at once.
onmessage = (e) => { chain = chain.then(() => handle(e.data)) }
