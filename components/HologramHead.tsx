'use client'

import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'

export type HoloMode = 'idle' | 'listening' | 'thinking' | 'speaking'

interface HologramHeadProps {
  mode: HoloMode
  /** Returns the current voice loudness, 0 to 1. Drives the jaw and glow. */
  getLevel?: () => number
  height?: number
}

// Baked by scripts/build-tutor-head.mjs (MediaPipe canonical face + smooth skull/neck)
const MODEL_URL = '/tutor-head.bin'
const RING_EVERY = 8 // draw every Nth row as a horizontal ring
const LINE_EVERY = 6 // draw every Nth column as a vertical line

const MODE_COLOR: Record<HoloMode, [number, number, number]> = {
  idle: [0.25, 0.6, 1.0],
  listening: [1.0, 0.7, 0.2],
  thinking: [0.62, 0.45, 1.0],
  speaking: [0.2, 0.85, 1.0],
}
const MODE_LABEL: Record<HoloMode, string> = {
  idle: 'Tutor ready', listening: 'Tutor listening', thinking: 'Tutor thinking', speaking: 'Tutor speaking',
}

// Jaw drop and blink, shared by every layer so they stay glued together
const DISPLACE = `
uniform float uLevel;
uniform float uBlink;
uniform float uMouthY;
uniform float uChinY;
uniform vec3 uEyeL;
uniform vec3 uEyeR;
uniform vec2 uEyeSize;
varying float vY;

vec3 blink(vec3 p, vec3 c) {
  float dx = (p.x - c.x) / uEyeSize.x;
  float dy = (p.y - c.y) / (uEyeSize.y * 3.0);
  float w = (1.0 - smoothstep(0.55, 1.0, length(vec2(dx, dy)))) * step(c.y, p.y) * smoothstep(c.z - 0.06, c.z, p.z);
  p.y = mix(p.y, c.y - uEyeSize.y * 0.4, uBlink * w);
  return p;
}

vec3 displace(vec3 p) {
  float jaw = (1.0 - smoothstep(uMouthY - 0.006, uMouthY + 0.006, p.y))
    * smoothstep(uChinY - 0.08, uChinY + 0.02, p.y)
    * smoothstep(0.2, 0.45, p.z)
    * (1.0 - smoothstep(0.26, 0.42, abs(p.x)));
  p.y -= uLevel * 0.055 * jaw;
  p.z -= uLevel * 0.012 * jaw;
  p = blink(p, uEyeL);
  p = blink(p, uEyeR);
  return p;
}
`

const FILL_VERT = `${DISPLACE}
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec3 p = displace(position);
  vY = p.y;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`

const FILL_FRAG = `
uniform vec3 uColor;
uniform float uLevel;
varying float vY;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec3 n = normalize(vNormal);
  float rim = pow(1.0 - abs(dot(n, normalize(vView))), 2.2);
  // Soft key light from the upper left so the nose, brows and eye sockets read from the front
  float key = pow(max(dot(n, normalize(vec3(-0.55, 0.45, 0.7))), 0.0), 3.0);
  float fade = smoothstep(-1.0, -0.62, vY);
  vec3 base = vec3(0.012, 0.035, 0.09);
  vec3 col = base + uColor * (0.04 + key * 0.22 + rim * (0.42 + uLevel * 0.25));
  gl_FragColor = vec4(col, 0.92 * fade);
}`

const LINE_VERT = `${DISPLACE}
void main() {
  vec3 p = displace(position);
  vY = p.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_Position.z -= 0.0015 * gl_Position.w;
}`

const LINE_FRAG = `
uniform float uTime;
uniform float uLevel;
uniform float uSpeed;
uniform float uAlpha;
uniform float uScan;
uniform vec3 uColor;
varying float vY;
void main() {
  // A light band sweeps down the head only while the tutor is talking
  float pos = 1.25 - fract(uTime * 0.18 * uSpeed) * 2.6;
  float band = exp(-pow((pos - vY) * 6.0, 2.0)) * uScan;
  float fade = smoothstep(-1.0, -0.62, vY);
  float a = uAlpha * (0.75 + band * 0.9 + uLevel * 0.45) * fade;
  gl_FragColor = vec4(mix(uColor, vec3(1.0), band * 0.35), a);
}`

interface HeadModel {
  positions: Float32Array
  fillIndex: number[]
  gridIndex: number[]
  landmarks: Float32Array
  contourIndex: Uint16Array
}

function parseModel(buf: ArrayBuffer): HeadModel {
  const [cols, rows, nLandmarks, nSegs] = new Uint32Array(buf, 0, 4)
  let off = 16
  const rowY = new Float32Array(buf, off, rows); off += rows * 4
  const landmarks = new Float32Array(buf.slice(off, off + nLandmarks * 12)); off += nLandmarks * 12
  const radius = new Uint16Array(buf, off, rows * cols); off += rows * cols * 2
  const contourIndex = new Uint16Array(buf.slice(off, off + nSegs * 4))

  const positions = new Float32Array(rows * cols * 3)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      const th = (c / cols) * Math.PI * 2
      const rad = radius[i] / 65535
      positions.set([rad * Math.sin(th), rowY[r], rad * Math.cos(th)], i * 3)
    }
  }

  const at = (r: number, c: number) => r * cols + (c % cols)
  const fillIndex: number[] = []
  const gridIndex: number[] = []
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      fillIndex.push(at(r, c), at(r + 1, c), at(r, c + 1), at(r, c + 1), at(r + 1, c), at(r + 1, c + 1))
      if (c % LINE_EVERY === 0) gridIndex.push(at(r, c), at(r + 1, c))
    }
  }
  for (let r = 0; r < rows; r += RING_EVERY) {
    for (let c = 0; c < cols; c++) gridIndex.push(at(r, c), at(r, c + 1))
  }
  return { positions, fillIndex, gridIndex, landmarks, contourIndex }
}

export default function HologramHead({ mode, getLevel, height = 190 }: HologramHeadProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const modeRef = useRef<HoloMode>(mode)
  const levelRef = useRef<(() => number) | undefined>(getLevel)
  modeRef.current = mode
  levelRef.current = getLevel

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      return // No WebGL: the glow background and HUD still show
    }
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    renderer.setPixelRatio(dpr)
    renderer.setClearColor(0x000000, 0)
    host.appendChild(renderer.domElement)
    renderer.domElement.style.display = 'block'

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50)
    camera.position.set(0, 0.12, 4.3)
    camera.lookAt(0, 0.12, 0)

    const head = new THREE.Group()
    scene.add(head)

    const uniforms = {
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uSpeed: { value: 1 },
      uBlink: { value: 0 },
      uAlpha: { value: 0.55 },
      uScan: { value: 0 },
      uColor: { value: new THREE.Color(...MODE_COLOR.idle) },
      uMouthY: { value: -0.14 },
      uChinY: { value: -0.49 },
      uEyeL: { value: new THREE.Vector3() },
      uEyeR: { value: new THREE.Vector3() },
      uEyeSize: { value: new THREE.Vector2(0.1, 0.02) },
    }
    const fillMat = new THREE.ShaderMaterial({
      uniforms, vertexShader: FILL_VERT, fragmentShader: FILL_FRAG,
      transparent: true, depthWrite: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    })
    const gridMat = new THREE.ShaderMaterial({
      uniforms, vertexShader: LINE_VERT, fragmentShader: LINE_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })
    const contourMat = new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uAlpha: { value: 1 } }, vertexShader: LINE_VERT, fragmentShader: LINE_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })
    let disposed = false
    const disposables: Array<{ dispose: () => void }> = [renderer, fillMat, gridMat, contourMat]

    fetch(MODEL_URL)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('head model missing'))))
      .then((buf) => {
        if (disposed) return
        const m = parseModel(buf)
        const lm = (i: number) => new THREE.Vector3().fromArray(m.landmarks, i * 3)

        // Feature anchors from MediaPipe landmark indices
        uniforms.uMouthY.value = (lm(13).y + lm(14).y) / 2
        uniforms.uChinY.value = lm(152).y
        uniforms.uEyeL.value.copy(lm(159)).add(lm(145)).multiplyScalar(0.5)
        uniforms.uEyeR.value.copy(lm(386)).add(lm(374)).multiplyScalar(0.5)
        uniforms.uEyeSize.value.set(lm(33).distanceTo(lm(133)) / 2, (lm(159).y - lm(145).y) / 2)

        const surface = new THREE.BufferGeometry()
        surface.setAttribute('position', new THREE.BufferAttribute(m.positions, 3))
        surface.setIndex(m.fillIndex)
        surface.computeVertexNormals()
        const fill = new THREE.Mesh(surface, fillMat)
        fill.renderOrder = 0

        const grid = new THREE.BufferGeometry()
        grid.setAttribute('position', surface.getAttribute('position'))
        grid.setIndex(m.gridIndex)
        const gridLines = new THREE.LineSegments(grid, gridMat)
        gridLines.renderOrder = 1

        const features = new THREE.BufferGeometry()
        features.setAttribute('position', new THREE.BufferAttribute(m.landmarks, 3))
        features.setIndex(Array.from(m.contourIndex))
        const contours = new THREE.LineSegments(features, contourMat)
        contours.renderOrder = 2

        head.add(fill, gridLines, contours)
        disposables.push(surface, grid, features)
      })
      .catch(() => { /* leaves the glow background only */ })

    const resize = () => {
      const w = host.clientWidth || 300
      renderer.setSize(w, height, false)
      renderer.domElement.style.width = `${w}px`
      renderer.domElement.style.height = `${height}px`
      camera.aspect = w / height
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const target = new THREE.Color()
    const startedAt = performance.now()
    let level = 0
    let nextBlink = 2 + Math.random() * 3
    let raf = 0

    const frame = () => {
      raf = requestAnimationFrame(frame)
      const t = (performance.now() - startedAt) / 1000
      const m = modeRef.current

      let raw = 0
      try { raw = levelRef.current ? levelRef.current() : 0 } catch { raw = 0 }
      level += (Math.min(1, Math.max(0, raw)) - level) * 0.4

      target.setRGB(...MODE_COLOR[m])
      uniforms.uColor.value.lerp(target, 0.08)
      uniforms.uTime.value = t
      uniforms.uLevel.value = level
      const talking = m === 'speaking'
      uniforms.uSpeed.value = 1.3
      uniforms.uScan.value += ((talking ? 1 : 0) - uniforms.uScan.value) * 0.06

      // The head only moves while talking: a gentle sway plus small nods on louder syllables,
      // easing back to face forward when the tutor stops
      if (!reduceMotion) {
        const yaw = talking ? Math.sin(t * 1.1) * 0.13 + Math.sin(t * 0.47) * 0.07 : 0
        const nod = talking ? -level * 0.07 + Math.sin(t * 2.3) * 0.02 : 0
        const tilt = talking ? Math.sin(t * 0.8) * 0.03 : 0
        head.rotation.y += (yaw - head.rotation.y) * 0.08
        head.rotation.x += (nod - head.rotation.x) * 0.12
        head.rotation.z += (tilt - head.rotation.z) * 0.08
      }

      // Blink: quick close and open every few seconds
      let blink = 0
      if (t > nextBlink) {
        const k = (t - nextBlink) / 0.16
        blink = k < 1 ? 1 - Math.abs(1 - k * 2) : 0
        if (k >= 1) nextBlink = t + 2.5 + Math.random() * 4
      }
      uniforms.uBlink.value = blink

      renderer.render(scene, camera)
    }
    frame()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      disposables.forEach((d) => d.dispose())
      renderer.domElement.remove()
    }
  }, [height])

  return (
    <div style={{
      position: 'relative', width: '100%', height, borderRadius: 14, overflow: 'hidden',
      background: 'radial-gradient(ellipse at 50% 45%, rgba(18,52,120,0.6), rgba(3,8,24,0.97) 72%)',
    }}>
      <div ref={hostRef} style={{ position: 'absolute', inset: 0 }} />
      <span role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
        {MODE_LABEL[mode]}
      </span>
    </div>
  )
}
