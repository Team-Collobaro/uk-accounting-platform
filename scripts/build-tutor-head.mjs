// Bakes public/tutor-head.bin: a full wireframe head for the AI tutor hologram.
//
// The face comes from MediaPipe's canonical face model (Apache-2.0):
//   https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj
// The skull, ears and neck are smooth SDF shapes blended around it. Every grid vertex is
// found by a horizontal ray from the head's vertical axis, so the output is a clean
// rows x cols quad grid that follows the real face (like a 3D scan wireframe).
//
// Usage: node scripts/build-tutor-head.mjs <canonical_face_model.obj> [out.bin]

import { readFileSync, writeFileSync } from 'node:fs'
import { FaceLandmarker } from '@mediapipe/tasks-vision'

const [objPath, outPath = 'public/tutor-head.bin'] = process.argv.slice(2)
if (!objPath) {
  console.error('Usage: node scripts/build-tutor-head.mjs <canonical_face_model.obj> [out.bin]')
  process.exit(1)
}

// ── Face mesh (units: cm, +y up, +z towards the viewer) ──
const verts = []
const tris = []
for (const line of readFileSync(objPath, 'utf8').split('\n')) {
  const parts = line.trim().split(/\s+/)
  if (parts[0] === 'v') verts.push(parts.slice(1, 4).map(Number))
  if (parts[0] === 'f') tris.push(parts.slice(1, 4).map((p) => parseInt(p, 10) - 1))
}
if (verts.length !== 468) throw new Error(`Expected 468 face landmarks, got ${verts.length}`)

// ── Head layout (cm) ──
const AXIS_Z = -3.5 // vertical axis the rays start from
const Y_TOP = 12.6
const Y_BOTTOM = -17
const COLS = 144
const ROW_STEP = 0.24

const SKULL = { c: [0, 1.6, -3.6], r: [7.7, 11.0, 9.6] }
const JAW = { c: [0, -5.0, -1.0], r: [5.6, 5.0, 5.5] }
const EARS = [-1, 1].map((s) => ({ c: [s * 7.55, 1.0, -4.1], r: [1.1, 3.0, 1.9] }))
const NECK = { x: 0, z: -3.0, y0: -25, y1: -4, radius: 5.0 }

const sdEllipsoid = (p, { c, r }) => {
  const q = [(p[0] - c[0]) / r[0], (p[1] - c[1]) / r[1], (p[2] - c[2]) / r[2]]
  const k0 = Math.hypot(...q)
  const k1 = Math.hypot(q[0] / r[0], q[1] / r[1], q[2] / r[2])
  return k1 === 0 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1
}
const sdNeck = (p) => {
  const y = Math.min(Math.max(p[1], NECK.y0), NECK.y1)
  return Math.hypot(p[0] - NECK.x, p[1] - y, p[2] - NECK.z) - NECK.radius
}
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - (h * h * k) / 4
}
const sdHead = (p) => {
  let d = smin(sdEllipsoid(p, SKULL), sdEllipsoid(p, JAW), 3)
  d = smin(d, sdNeck(p), 3)
  for (const ear of EARS) d = smin(d, sdEllipsoid(p, ear), 0.8)
  return d
}

// Outermost crossing of the base head along a ray, marching inwards from outside.
function baseHit(o, dir) {
  const at = (t) => sdHead([o[0] + dir[0] * t, o[1] + dir[1] * t, o[2] + dir[2] * t])
  for (let t = 25; t > 0; t -= 0.05) {
    if (at(t) < 0) {
      let lo = t, hi = t + 0.05
      for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2
        if (at(mid) < 0) lo = mid
        else hi = mid
      }
      return lo
    }
  }
  return 0
}

// Outermost hit on the face mesh (Möller–Trumbore), or NaN.
function faceHit(o, dir) {
  let best = NaN
  for (const [ia, ib, ic] of tris) {
    const a = verts[ia], b = verts[ib], c = verts[ic]
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const pv = [dir[1] * e2[2] - dir[2] * e2[1], dir[2] * e2[0] - dir[0] * e2[2], dir[0] * e2[1] - dir[1] * e2[0]]
    const det = e1[0] * pv[0] + e1[1] * pv[1] + e1[2] * pv[2]
    if (Math.abs(det) < 1e-9) continue
    const inv = 1 / det
    const tv = [o[0] - a[0], o[1] - a[1], o[2] - a[2]]
    const u = (tv[0] * pv[0] + tv[1] * pv[1] + tv[2] * pv[2]) * inv
    if (u < 0 || u > 1) continue
    const qv = [tv[1] * e1[2] - tv[2] * e1[1], tv[2] * e1[0] - tv[0] * e1[2], tv[0] * e1[1] - tv[1] * e1[0]]
    const v = (dir[0] * qv[0] + dir[1] * qv[1] + dir[2] * qv[2]) * inv
    if (v < 0 || u + v > 1) continue
    const t = (e2[0] * qv[0] + e2[1] * qv[1] + e2[2] * qv[2]) * inv
    if (t > 0 && !(t <= best)) best = t
  }
  return best
}

// ── Row heights: even arc spacing over the crown, then even steps down the face and neck ──
const rowY = []
{
  const [, yc] = SKULL.c
  const b = SKULL.r[1]
  const dPhi = ROW_STEP / b
  for (let phi = dPhi * 0.6; phi < Math.PI / 2; phi += dPhi) rowY.push(yc + b * Math.cos(phi))
  for (let y = yc; y >= Y_BOTTOM; y -= ROW_STEP) rowY.push(y)
}
const ROWS = rowY.length
const idx = (row, col) => row * COLS + ((col % COLS) + COLS) % COLS

// ── Cast rays ──
const rBase = new Float32Array(ROWS * COLS)
const rFace = new Float32Array(ROWS * COLS)
for (let row = 0; row < ROWS; row++) {
  const o = [0, rowY[row], AXIS_Z]
  for (let col = 0; col < COLS; col++) {
    const th = (col / COLS) * Math.PI * 2
    const dir = [Math.sin(th), 0, Math.cos(th)]
    rBase[idx(row, col)] = baseHit(o, dir)
    rFace[idx(row, col)] = faceHit(o, dir)
  }
}

// ── Separate "outside the face" from holes (eyes, mouth), reachable from the back of the head ──
const outside = new Uint8Array(ROWS * COLS)
{
  const queue = [idx(0, COLS / 2)]
  outside[queue[0]] = 1
  while (queue.length) {
    const i = queue.pop()
    const row = Math.floor(i / COLS), col = i % COLS
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const r2 = row + dr
      if (r2 < 0 || r2 >= ROWS) continue
      const j = idx(r2, col + dc)
      if (!outside[j] && Number.isNaN(rFace[j])) { outside[j] = 1; queue.push(j) }
    }
  }
}

// Fill eye and mouth holes smoothly from their rims, then recess them slightly (closed lids, lip line)
const hole = []
for (let i = 0; i < ROWS * COLS; i++) if (!outside[i] && Number.isNaN(rFace[i])) hole.push(i)
for (const i of hole) rFace[i] = rBase[i]
for (let iter = 0; iter < 400; iter++) {
  for (const i of hole) {
    const row = Math.floor(i / COLS), col = i % COLS
    rFace[i] = (rFace[idx(row - 1, col)] + rFace[idx(row + 1, col)] + rFace[idx(row, col - 1)] + rFace[idx(row, col + 1)]) / 4
  }
}
for (const i of hole) rFace[i] -= 0.18

// Blend weight: distance (in cells) from the face edge, so the face melts into the skull
const dist = new Float32Array(ROWS * COLS).fill(Infinity)
{
  let frontier = []
  for (let i = 0; i < ROWS * COLS; i++) if (outside[i]) { dist[i] = 0; frontier.push(i) }
  for (let d = 1; frontier.length; d++) {
    const next = []
    for (const i of frontier) {
      const row = Math.floor(i / COLS), col = i % COLS
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const r2 = row + dr
        if (r2 < 0 || r2 >= ROWS) continue
        const j = idx(r2, col + dc)
        if (dist[j] === Infinity) { dist[j] = d; next.push(j) }
      }
    }
    frontier = next
  }
}
const BLEND_CELLS = 6
const smooth = (x) => x * x * (3 - 2 * x)
const radius = new Float32Array(ROWS * COLS)
for (let i = 0; i < ROWS * COLS; i++) {
  const w = outside[i] ? 0 : smooth(Math.min(1, dist[i] / BLEND_CELLS))
  radius[i] = w ? rBase[i] + (rFace[i] - rBase[i]) * w : rBase[i]
}

// ── Normalise to roughly [-1, 1] and write ──
const SCALE = (Y_TOP - Y_BOTTOM) / 2
const Y_MID = (Y_TOP + Y_BOTTOM) / 2
const R_MAX = 1.0

const contourSets = ['FACE_LANDMARKS_LEFT_EYE', 'FACE_LANDMARKS_RIGHT_EYE', 'FACE_LANDMARKS_LEFT_EYEBROW', 'FACE_LANDMARKS_RIGHT_EYEBROW', 'FACE_LANDMARKS_LIPS']
const segs = contourSets.flatMap((k) => FaceLandmarker[k].map(({ start, end }) => [start, end]))

// Layout: u32 cols, rows, landmarks, segments | f32 rowY[rows] | f32 landmarks[n*3] | u16 radius[rows*cols] | u16 segs[n*2]
const bytes = 16 + ROWS * 4 + verts.length * 12 + ROWS * COLS * 2 + segs.length * 4
const buf = new ArrayBuffer(bytes)
new Uint32Array(buf, 0, 4).set([COLS, ROWS, verts.length, segs.length])
let off = 16
new Float32Array(buf, off, ROWS).set(rowY.map((y) => (y - Y_MID) / SCALE)); off += ROWS * 4
new Float32Array(buf, off, verts.length * 3).set(verts.flatMap(([x, y, z]) => [x / SCALE, (y - Y_MID) / SCALE, (z - AXIS_Z) / SCALE])); off += verts.length * 12
new Uint16Array(buf, off, ROWS * COLS).set(Array.from(radius, (r) => Math.round(Math.min(1, r / SCALE / R_MAX) * 65535))); off += ROWS * COLS * 2
new Uint16Array(buf, off, segs.length * 2).set(segs.flat())

writeFileSync(outPath, Buffer.from(buf))
console.log(`Wrote ${outPath}: ${COLS}x${ROWS} grid, ${hole.length} hole cells filled, ${segs.length} contour segments, ${bytes} bytes`)
