'use client'

import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { MOUTH_REST, type MouthShape } from '@/lib/lipSync'

export type TutorMode = 'idle' | 'listening' | 'thinking' | 'speaking'

interface TutorAvatarProps {
  mode: TutorMode
  /** The mouth shape being spoken right now. Drives the lips, jaw, brows and head. */
  getMouth?: () => MouthShape
  height?: number
}

const IMAGE_URL = '/tutor-avatar.png'
// Where the face is in the picture, in pixels of its 360 x 360 original (scales with a larger copy)
const REF = 360
const FACE = {
  eyeL: [150.8, 86.9], eyeR: [183.8, 85.0], eyeSize: [8.4, 4.9],
  browL: [148, 70], browR: [182, 67.5],
  // Lip line under the top teeth: y = mouth.y + a*dx^2 + b*dx, and the mouth's half width
  mouth: [168, 121.9, 17.5], mouthCurve: [-0.0296, 0.0111],
  chinY: 141,
  neck: [167, 150],
  head: [168, 82, 64],
  skin: [0.91, 0.61, 0.41],
  view: [6, 192], // rows shown in the panel: head and shoulders, cut above the book
  centerX: 168,
}
const MAX_JAW = 6.5 // px the lips part on a wide-open "ah"

const MODE_GLOW: Record<TutorMode, [number, number, number]> = {
  idle: [0.55, 0.75, 1.0],
  listening: [1.0, 0.75, 0.4],
  thinking: [0.72, 0.6, 1.0],
  speaking: [0.45, 0.88, 0.95],
}
const MODE_LABEL: Record<TutorMode, string> = {
  idle: 'Tutor ready', listening: 'Tutor listening', thinking: 'Tutor thinking', speaking: 'Tutor speaking',
}

const smoothstep = (e0: number, e1: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return k * k * (3 - 2 * k)
}

const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

// Works in the picture's own pixels (y down). Every effect is an inverse warp: for each
// screen pixel, find where in the picture to sample.
const FRAG = `
uniform sampler2D uTex;
uniform float uHasTex;
uniform float uAspect;
uniform vec2 uView;
uniform float uCenterX;
uniform vec3 uGlow;
uniform float uJaw;
uniform float uWide;
uniform float uRound;
uniform float uPress;
uniform float uBlink;
uniform float uBrow;
uniform float uTilt;
uniform float uNod;
uniform vec2 uEyeL;
uniform vec2 uEyeR;
uniform vec2 uEyeSize;
uniform vec2 uBrowL;
uniform vec2 uBrowR;
uniform vec3 uMouth;
uniform vec2 uMouthCurve;
uniform float uChinY;
uniform vec2 uNeck;
uniform vec3 uHead;
uniform vec3 uSkin;
varying vec2 vUv;

vec2 rotate(vec2 v, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

vec4 picture(vec2 s) {
  if (uHasTex < 0.5 || s.x < 0.0 || s.y < 0.0 || s.x > ${REF}.0 || s.y > ${REF}.0) return vec4(0.0);
  return texture2D(uTex, vec2(s.x / ${REF}.0, 1.0 - s.y / ${REF}.0));
}

// An eyelid sliding from the upper lid line down to the lower one; leaves the glasses rim alone
vec4 eyelid(vec2 s, vec2 c, float rimShade) {
  vec2 e = (s - c) / uEyeSize;
  float span = sqrt(max(0.0, 1.0 - e.x * e.x));
  float edge = mix(-span * 1.1, span * 0.95, uBlink);
  float inside = 1.0 - smoothstep(0.92, 1.08, length(e));
  float rim = (1.0 - smoothstep(0.12, 0.22, rimShade)) * smoothstep(-0.5, -0.75, e.y);
  float cover = inside * (1.0 - smoothstep(edge - 0.12, edge + 0.12, e.y)) * step(0.02, uBlink) * (1.0 - rim);
  vec3 col = uSkin * mix(1.0, 0.8, smoothstep(edge - 0.6, edge - 0.1, e.y));
  col = mix(col, vec3(0.16, 0.09, 0.07), smoothstep(edge - 0.32, edge - 0.04, e.y));
  return vec4(col, cover);
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  float viewH = uView.y - uView.x;
  vec2 p = vec2(uCenterX + (uv.x - 0.5) * viewH * uAspect, uView.x + uv.y * viewH);

  // Backdrop: a soft studio gradient with the tutor's mood glowing behind the head
  vec3 bg = mix(vec3(0.93, 0.95, 0.99), vec3(0.78, 0.85, 0.95), uv.y);
  float halo = exp(-pow(distance(p, uHead.xy) / (uHead.z * 1.3), 2.0));
  bg = mix(bg, uGlow, halo * 0.4);

  // Head: tilt and nod around the neck, fading out towards the collar
  float headW = (1.0 - smoothstep(uHead.z * 0.9, uHead.z * 1.25, distance(p, uHead.xy)))
    * (1.0 - smoothstep(uNeck.y - 8.0, uNeck.y + 6.0, p.y));
  vec2 s = uNeck + rotate(p - uNeck, -uTilt * headW);
  s.y -= uNod * headW;

  // Eyebrows lift on emphasis
  vec2 b1 = (s - uBrowL) / vec2(14.0, 6.0);
  vec2 b2 = (s - uBrowR) / vec2(14.0, 6.0);
  s.y += uBrow * 2.5 * (exp(-dot(b1, b1)) + exp(-dot(b2, b2)));

  vec2 lidAt = s;

  // Lip corners spread for "ee" and draw in for "oo"
  float dx = s.x - uMouth.x;
  float lineY = uMouth.y + uMouthCurve.x * dx * dx + uMouthCurve.y * dx;
  vec2 mq = vec2(dx / (uMouth.z * 1.7), (s.y - lineY) / 9.0);
  s.x = uMouth.x + dx / (1.0 + (0.14 * uWide - 0.3 * uRound) * exp(-dot(mq, mq)));

  // Lips part: the lower lip drops most, the upper lip lifts a little, and the skin below follows
  // less and less down to the chin, fading into the cheeks, so the jaw never moves as one block
  dx = s.x - uMouth.x;
  lineY = uMouth.y + uMouthCurve.x * dx * dx + uMouthCurve.y * dx;
  float t = dx / (uMouth.z * (1.0 + 0.1 * uWide - 0.35 * uRound));
  float gap = uJaw * pow(max(0.0, 1.0 - t * t), 0.6 - 0.3 * uWide - 0.15 * uRound);
  float lower = gap * 0.78;
  float upper = gap - lower;
  float rel = s.y - lineY;
  float mouth = 0.0;
  if (rel > -upper && rel < lower && gap > 0.05) {
    mouth = smoothstep(0.0, 0.6, rel + upper) * smoothstep(0.0, 0.6, lower - rel);
  }
  if (rel >= 0.0) {
    float chinRel = uChinY - lineY;
    float chin = 0.38 * uJaw * exp(-pow(dx / (uMouth.z * 1.9), 2.0));
    float drop = mix(lower, chin, smoothstep(lower, chinRel, rel));
    s.y -= drop * (1.0 - smoothstep(chinRel, chinRel + 12.0, rel));
  } else {
    s.y += upper * exp(-pow(max(0.0, -rel - upper) / 4.0, 2.0));
  }

  vec4 tex = picture(s); // premultiplied
  vec3 col = tex.rgb;

  if (mouth > 0.0) {
    float g = clamp((rel + upper) / max(gap, 0.001), 0.0, 1.0);
    vec3 m = mix(vec3(0.2, 0.05, 0.06), vec3(0.38, 0.11, 0.12), g);
    m = mix(m, vec3(0.78, 0.4, 0.4), smoothstep(0.55, 1.0, g) * (1.0 - smoothstep(0.4, 0.85, abs(t))) * 0.85);
    m *= mix(0.6, 1.0, smoothstep(0.0, 0.4, g));
    // Lower teeth show when the lips spread
    m = mix(m, vec3(0.93, 0.9, 0.86), uWide * 0.9 * smoothstep(0.68, 0.8, g) * (1.0 - smoothstep(0.55, 0.9, abs(t))));
    col = mix(col, m, mouth);
  }

  // Lips pressed together over the teeth for "m", "b", "p"
  if (uPress > 0.01) {
    float tp = dx / uMouth.z;
    float band = 5.2 * sqrt(max(0.0, 1.0 - tp * tp));
    float up = lineY - s.y;
    float k = clamp(up / max(band, 0.001), 0.0, 1.0);
    vec3 lip = mix(vec3(0.86, 0.55, 0.45), vec3(0.74, 0.42, 0.35), k);
    lip = mix(lip, vec3(0.45, 0.2, 0.18), exp(-pow((k - 0.45) / 0.12, 2.0)));
    float inBand = smoothstep(-0.6, 0.4, up) * smoothstep(-0.6, 0.4, band - up) * step(0.001, band);
    col = mix(col, lip, inBand * uPress);
  }

  float shade = dot(tex.rgb, vec3(0.3, 0.59, 0.11));
  vec4 lidL = eyelid(lidAt, uEyeL, shade);
  vec4 lidR = eyelid(lidAt, uEyeR, shade);
  col = mix(col, lidL.rgb, lidL.a);
  col = mix(col, lidR.rgb, lidR.a);

  gl_FragColor = vec4(bg * (1.0 - tex.a) + col, 1.0);
}`

/** The picture with its white backdrop removed (near-white pixels connected to the border). */
function cutOut(img: HTMLImageElement): HTMLCanvasElement {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  const image = ctx.getImageData(0, 0, w, h)
  const px = image.data
  const lightness = (i: number) => Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2])

  const bg = new Uint8Array(w * h)
  const stack: number[] = []
  const seed = (i: number) => {
    if (!bg[i] && lightness(i) > 242) { bg[i] = 1; stack.push(i) }
  }
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1) }
  while (stack.length) {
    const i = stack.pop()!
    const x = i % w
    if (x > 0) seed(i - 1)
    if (x < w - 1) seed(i + 1)
    if (i >= w) seed(i - w)
    if (i < w * (h - 1)) seed(i + w)
  }

  for (let i = 0; i < w * h; i++) {
    if (bg[i]) { px[i * 4 + 3] = 0; continue }
    const x = i % w
    const edge = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (i >= w && bg[i - w]) || (i < w * (h - 1) && bg[i + w])
    if (!edge) continue
    // Edge pixels are part white: take the white out so no light halo shows on the backdrop
    const a = Math.min(1, (255 - lightness(i)) / 60)
    for (let k = 0; k < 3; k++) px[i * 4 + k] = a > 0 ? Math.max(0, Math.min(255, (px[i * 4 + k] - (1 - a) * 255) / a)) : 0
    px[i * 4 + 3] = Math.round(a * 255)
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

export default function TutorAvatar({ mode, getMouth, height = 190 }: TutorAvatarProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const modeRef = useRef<TutorMode>(mode)
  const mouthRef = useRef<(() => MouthShape) | undefined>(getMouth)
  modeRef.current = mode
  mouthRef.current = getMouth

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false })
    } catch {
      return // No WebGL: the plain backdrop still shows
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    host.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'

    const v2 = (a: number[]) => new THREE.Vector2(a[0], a[1])
    const v3 = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2])
    const uniforms = {
      uTex: { value: null as THREE.Texture | null },
      uHasTex: { value: 0 },
      uAspect: { value: 1 },
      uView: { value: v2(FACE.view) },
      uCenterX: { value: FACE.centerX },
      uGlow: { value: new THREE.Color(...MODE_GLOW.idle) },
      uJaw: { value: 0 },
      uWide: { value: 0 },
      uRound: { value: 0 },
      uPress: { value: 0 },
      uBlink: { value: 0 },
      uBrow: { value: 0 },
      uTilt: { value: 0 },
      uNod: { value: 0 },
      uEyeL: { value: v2(FACE.eyeL) },
      uEyeR: { value: v2(FACE.eyeR) },
      uEyeSize: { value: v2(FACE.eyeSize) },
      uBrowL: { value: v2(FACE.browL) },
      uBrowR: { value: v2(FACE.browR) },
      uMouth: { value: v3(FACE.mouth) },
      uMouthCurve: { value: v2(FACE.mouthCurve) },
      uChinY: { value: FACE.chinY },
      uNeck: { value: v2(FACE.neck) },
      uHead: { value: v3(FACE.head) },
      uSkin: { value: v3(FACE.skin) },
    }
    // Colours stay in the picture's own sRGB values from texture to screen
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, toneMapped: false })
    const geometry = new THREE.PlaneGeometry(2, 2)
    const scene = new THREE.Scene()
    scene.add(new THREE.Mesh(geometry, material))
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    let disposed = false
    let texture: THREE.Texture | null = null
    const img = new Image()
    img.onload = () => {
      if (disposed) return
      texture = new THREE.CanvasTexture(cutOut(img))
      texture.colorSpace = THREE.NoColorSpace
      texture.premultiplyAlpha = true
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.anisotropy = 4
      uniforms.uTex.value = texture
      uniforms.uHasTex.value = 1
    }
    img.src = IMAGE_URL

    const resize = () => {
      const w = host.clientWidth || 300
      renderer.setSize(w, height, false)
      renderer.domElement.style.width = `${w}px`
      renderer.domElement.style.height = `${height}px`
      uniforms.uAspect.value = w / height
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const glow = new THREE.Color()
    const startedAt = performance.now()
    const mouth = { ...MOUTH_REST }
    let phrase = 0 // how much is being said over the last half second: drives brows and nods
    let nextBlink = 1.5 + Math.random() * 2
    let blinkStart = -1
    let last = startedAt
    let raf = 0

    let dt = 1 / 60
    // Moves `current` towards `target` with this time constant in seconds, at any frame rate
    const ease = (current: number, target: number, tau: number) => current + (target - current) * (1 - Math.exp(-dt / tau))

    const frame = () => {
      raf = requestAnimationFrame(frame)
      const now = performance.now()
      dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const t = (now - startedAt) / 1000
      const m = modeRef.current
      const talking = m === 'speaking'

      // Lips move only while the voice is audible
      let target = MOUTH_REST
      if (talking) {
        try { target = mouthRef.current?.() ?? MOUTH_REST } catch { target = MOUTH_REST }
      }
      // Lips have weight: they open quickly and settle a little slower between sounds
      mouth.open = ease(mouth.open, target.open, target.open > mouth.open ? 0.04 : 0.07)
      mouth.wide = ease(mouth.wide, target.wide, 0.08)
      mouth.round = ease(mouth.round, target.round, 0.08)
      mouth.press = ease(mouth.press, target.press, 0.05)
      phrase = ease(phrase, mouth.open, 0.5)
      uniforms.uJaw.value = MAX_JAW * mouth.open
      uniforms.uWide.value = mouth.wide
      uniforms.uRound.value = mouth.round
      uniforms.uPress.value = mouth.press

      glow.setRGB(...MODE_GLOW[m])
      uniforms.uGlow.value.lerp(glow, 0.06)

      uniforms.uBrow.value = ease(uniforms.uBrow.value, talking ? smoothstep(0.3, 0.6, phrase) * 0.7 : m === 'listening' ? 0.35 : 0, 0.25)

      // Natural blinks every few seconds, now and then a double blink
      if (blinkStart < 0 && t > nextBlink) blinkStart = t
      let blink = 0
      if (blinkStart >= 0) {
        const k = (t - blinkStart) / 0.16
        blink = k < 0.4 ? k / 0.4 : k < 1 ? 1 - (k - 0.4) / 0.6 : 0
        if (k >= 1) {
          blinkStart = -1
          nextBlink = t + (Math.random() < 0.15 ? 0.25 : 2.5 + Math.random() * 3.5)
        }
      }
      uniforms.uBlink.value = blink

      // The head moves with the phrase, not each syllable: a gentle sway while talking, a tilt to listen
      if (!reduceMotion) {
        const tilt = talking ? Math.sin(t * 1.1) * 0.03 + Math.sin(t * 0.47) * 0.02 : m === 'listening' ? 0.04 : 0
        const nod = talking ? phrase * 1.2 + Math.sin(t * 1.7) * 0.4 : 0
        uniforms.uTilt.value = ease(uniforms.uTilt.value, tilt, 0.3)
        uniforms.uNod.value = ease(uniforms.uNod.value, nod, 0.3)
      }

      renderer.render(scene, camera)
    }
    frame()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      texture?.dispose()
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [height])

  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: 14, overflow: 'hidden', background: 'linear-gradient(#eef2fb, #c8d6ec)' }}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
      <span role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
        {MODE_LABEL[mode]}
      </span>
    </div>
  )
}
