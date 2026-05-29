'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { OrbAudioRef } from './Orb'

interface AvatarOrbProps {
  speaking: boolean
  audioRef: React.RefObject<OrbAudioRef>
}

const VERT = /* glsl */`
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;

  varying vec3  vWorldNormal;
  varying vec3  vViewDir;
  varying float vAngle;   // angle around the torus tube (0..2PI)
  varying float vRing;    // angle around the torus ring  (0..2PI)

  void main(){
    // tube angle: atan of the local xz offset from the ring centre
    // For a torus in XZ plane, the tube centre projects onto the ring
    // We encode it via uv or position — simpler: use normal.y as approx tube angle
    vAngle = atan(normal.y, length(normal.xz));   // elevation on tube
    vRing  = atan(position.z, position.x);         // azimuth around ring

    // subtle audio-driven tube ripple
    float ripple = uBass  * 0.045 * sin(vRing * 6.0  + uTime * 3.5)
                 + uMid   * 0.028 * sin(vRing * 12.0 + uTime * 5.0)
                 + uHigh  * 0.015 * sin(vRing * 22.0 + uTime * 8.0);
    vec3 displaced = position + normal * ripple;

    vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
    vWorldNormal  = normalize(mat3(modelMatrix) * normal);
    vViewDir      = normalize(cameraPosition - worldPos.xyz);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

const FRAG = /* glsl */`
  precision highp float;

  uniform float uTime;
  uniform float uEnergy;
  uniform float uBass;
  uniform float uMid;

  varying vec3  vWorldNormal;
  varying vec3  vViewDir;
  varying float vAngle;
  varying float vRing;

  void main(){
    vec3 N = normalize(vWorldNormal);
    vec3 V = normalize(vViewDir);
    float NdotV = max(dot(N, V), 0.0);

    // ── Rim / atmosphere ──────────────────────────────────────────────────────
    // The glow is brightest where we look along the surface tangent (rim = 0)
    float rim = 1.0 - NdotV;
    float atmosphere = pow(rim, 2.2);   // tight rim band

    // ── Colour sweep around the ring ─────────────────────────────────────────
    // vRing goes -PI..PI → normalise to 0..1
    float ring01 = (vRing + 3.14159) / 6.28318;

    // scroll the colour slowly + audio nudge
    float scroll = uTime * 0.06 + uEnergy * 0.15;
    float t = fract(ring01 + scroll);

    // aurora stops: cyan (bottom) → violet (side) → pink (top) → blue (other side)
    vec3 col0 = vec3(0.18, 0.88, 0.82);   // cyan
    vec3 col1 = vec3(0.55, 0.32, 0.92);   // violet
    vec3 col2 = vec3(0.90, 0.42, 0.72);   // pink
    vec3 col3 = vec3(0.22, 0.45, 0.95);   // blue

    vec3 bandCol;
    if(t < 0.25)      bandCol = mix(col0, col1, t * 4.0);
    else if(t < 0.5)  bandCol = mix(col1, col2, (t - 0.25) * 4.0);
    else if(t < 0.75) bandCol = mix(col2, col3, (t - 0.50) * 4.0);
    else               bandCol = mix(col3, col0, (t - 0.75) * 4.0);

    // brighten top of tube (outer face) vs inner — vAngle > 0 is outer face
    float outerFace = smoothstep(-0.3, 0.5, vAngle);
    bandCol = mix(bandCol * 0.55, bandCol * 1.25, outerFace);

    // audio energy pulses brightness
    float pulse = 1.0 + uBass * 0.45 + uMid * 0.25;

    // ── Assemble ──────────────────────────────────────────────────────────────
    // core colour on the surface, glow on the rim
    vec3 core = bandCol * (0.15 + outerFace * 0.25);          // dark interior
    vec3 glow = bandCol * atmosphere * 2.8 * pulse;            // bright rim halo

    vec3 final = core + glow;

    // soft inner shadow so center of ring looks hollow/dark
    float innerDark = pow(NdotV, 0.6) * 0.6;
    final -= innerDark * 0.18;

    gl_FragColor = vec4(clamp(final, 0.0, 1.0), atmosphere * 0.92 + 0.08);
  }
`

export default function AvatarOrb({ speaking, audioRef }: AvatarOrbProps) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const SIZE = 220
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(SIZE, SIZE)
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.set(0, 0.6, 3.4)   // slight top-down tilt so ring reads as 3D
    camera.lookAt(0, 0, 0)

    const uniforms = {
      uTime:   { value: 0 },
      uBass:   { value: 0 },
      uMid:    { value: 0 },
      uHigh:   { value: 0 },
      uEnergy: { value: 0 },
    }

    // Torus: radius 1.0, tube 0.32, high segment counts for smooth shading
    const geo = new THREE.TorusGeometry(1.0, 0.30, 128, 256)
    const mat = new THREE.ShaderMaterial({
      vertexShader:   VERT,
      fragmentShader: FRAG,
      uniforms,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const ring = new THREE.Mesh(geo, mat)
    // tilt so it matches the reference image (ring plane slightly tilted toward viewer)
    ring.rotation.x = Math.PI * 0.18
    scene.add(ring)

    let sBass = 0, sMid = 0, sHigh = 0
    let rafId: number
    const clock = new THREE.Clock()

    const animate = () => {
      rafId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()

      const a = audioRef.current
      if (a) {
        const RISE = 0.28, FALL = 0.05
        const lrp = (c: number, g: number) => c + (g - c) * (g > c ? RISE : FALL)
        sBass = lrp(sBass, a.bass ?? 0)
        sMid  = lrp(sMid,  a.mid  ?? 0)
        sHigh = lrp(sHigh, a.high ?? 0)
      } else {
        sBass *= 0.94; sMid *= 0.94; sHigh *= 0.94
      }

      const energy = Math.min(1, sBass * 1.2 + sMid * 0.7 + sHigh * 0.2)

      uniforms.uTime.value   = t
      uniforms.uBass.value   = sBass
      uniforms.uMid.value    = sMid
      uniforms.uHigh.value   = sHigh
      uniforms.uEnergy.value = energy

      // slow lazy spin around Y, gentle wobble on X driven by bass
      ring.rotation.y = t * 0.18
      ring.rotation.x = Math.PI * 0.18 + Math.sin(t * 0.4) * 0.04 + sBass * 0.06

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(rafId)
      renderer.dispose()
      mat.dispose()
      geo.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [audioRef])

  return <div ref={mountRef} style={{ width: 220, height: 220 }} />
}
