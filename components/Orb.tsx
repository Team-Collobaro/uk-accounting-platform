'use client'

import { Mesh, Program, Renderer, Triangle, Vec3 } from 'ogl'
import { useEffect, useRef } from 'react'
import './Orb.css'

export interface OrbAudioRef {
  hover: number       // 0..1 warp intensity
  intensity: number   // hoverIntensity override
  bass: number        // 0..1 bass energy
  mid: number         // 0..1 mid energy
  high: number        // 0..1 high energy
}

interface OrbProps {
  hue?: number
  hoverIntensity?: number
  rotateOnHover?: boolean
  forceHoverState?: boolean
  backgroundColor?: string
  audioRef?: React.RefObject<OrbAudioRef>
}

export default function Orb({
  hue = 0,
  hoverIntensity = 0.2,
  rotateOnHover = true,
  forceHoverState = false,
  backgroundColor = '#000000',
  audioRef,
}: OrbProps) {
  const ctnDom = useRef<HTMLDivElement>(null)

  const vert = /* glsl */ `
    precision highp float;
    attribute vec2 position;
    attribute vec2 uv;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `

  const frag = /* glsl */ `
    precision highp float;

    uniform float iTime;
    uniform vec3 iResolution;
    uniform float hue;
    uniform float hover;
    uniform float rot;
    uniform float hoverIntensity;
    uniform vec3 backgroundColor;

    // Audio frequency bands (0..1 each)
    uniform float uBass;
    uniform float uMid;
    uniform float uHigh;
    uniform float uEnergy;  // combined energy 0..1

    varying vec2 vUv;

    vec3 rgb2yiq(vec3 c) {
      float y = dot(c, vec3(0.299, 0.587, 0.114));
      float i = dot(c, vec3(0.596, -0.274, -0.322));
      float q = dot(c, vec3(0.211, -0.523, 0.312));
      return vec3(y, i, q);
    }

    vec3 yiq2rgb(vec3 c) {
      float r = c.x + 0.956 * c.y + 0.621 * c.z;
      float g = c.x - 0.272 * c.y - 0.647 * c.z;
      float b = c.x - 1.106 * c.y + 1.703 * c.z;
      return vec3(r, g, b);
    }

    vec3 adjustHue(vec3 color, float hueDeg) {
      float hueRad = hueDeg * 3.14159265 / 180.0;
      vec3 yiq = rgb2yiq(color);
      float cosA = cos(hueRad);
      float sinA = sin(hueRad);
      float i2 = yiq.y * cosA - yiq.z * sinA;
      float q2 = yiq.y * sinA + yiq.z * cosA;
      yiq.y = i2;
      yiq.z = q2;
      return yiq2rgb(yiq);
    }

    vec3 hash33(vec3 p3) {
      p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
      p3 += dot(p3, p3.yxz + 19.19);
      return -1.0 + 2.0 * fract(vec3(
        p3.x + p3.y,
        p3.x + p3.z,
        p3.y + p3.z
      ) * p3.zyx);
    }

    float snoise3(vec3 p) {
      const float K1 = 0.333333333;
      const float K2 = 0.166666667;
      vec3 i = floor(p + (p.x + p.y + p.z) * K1);
      vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
      vec3 e = step(vec3(0.0), d0 - d0.yzx);
      vec3 i1 = e * (1.0 - e.zxy);
      vec3 i2 = 1.0 - e.zxy * (1.0 - e);
      vec3 d1 = d0 - (i1 - K2);
      vec3 d2 = d0 - (i2 - K1);
      vec3 d3 = d0 - 0.5;
      vec4 h = max(0.6 - vec4(
        dot(d0, d0), dot(d1, d1), dot(d2, d2), dot(d3, d3)
      ), 0.0);
      vec4 n = h * h * h * h * vec4(
        dot(d0, hash33(i)),
        dot(d1, hash33(i + i1)),
        dot(d2, hash33(i + i2)),
        dot(d3, hash33(i + 1.0))
      );
      return dot(vec4(31.316), n);
    }

    vec4 extractAlpha(vec3 colorIn) {
      float a = max(max(colorIn.r, colorIn.g), colorIn.b);
      return vec4(colorIn.rgb / (a + 1e-5), a);
    }

    const float PI = 3.14159265;

    // Base palette — cyan/violet/indigo (matches aurora theme)
    const vec3 baseColor1 = vec3(0.611765, 0.262745, 0.996078); // violet
    const vec3 baseColor2 = vec3(0.298039, 0.760784, 0.913725); // cyan
    const vec3 baseColor3 = vec3(0.062745, 0.078431, 0.600000); // deep indigo

    // Audio-reactive accent colours
    const vec3 bassColor  = vec3(1.0, 0.3, 0.6);   // pink/magenta on bass
    const vec3 midColor   = vec3(0.1, 1.0, 0.8);   // mint on mids
    const vec3 highColor  = vec3(0.8, 0.9, 1.0);   // white-blue on highs

    const float innerRadius = 0.6;
    const float noiseScale  = 0.65;

    float light1(float intensity, float attenuation, float dist) {
      return intensity / (1.0 + dist * attenuation);
    }
    float light2(float intensity, float attenuation, float dist) {
      return intensity / (1.0 + dist * dist * attenuation);
    }

    // Per-angle waveform displacement from frequency bands
    float waveDisplace(float ang) {
      // bass → low-freq ripples, mid → medium, high → fast shimmer
      float b = uBass  * 0.10 * sin(ang * 2.0  + iTime * 4.0);
      float m = uMid   * 0.06 * sin(ang * 5.0  + iTime * 7.0);
      float h = uHigh  * 0.03 * sin(ang * 11.0 + iTime * 14.0);
      return b + m + h;
    }

    vec4 draw(vec2 uv) {
      // Dynamic hue shift: energy drives +40deg toward pink/magenta
      float audioHueShift = hue + uEnergy * 40.0;
      vec3 color1 = adjustHue(baseColor1, audioHueShift);
      vec3 color2 = adjustHue(baseColor2, audioHueShift);
      vec3 color3 = adjustHue(baseColor3, audioHueShift);

      // Blend in frequency-band accent colours
      color1 = mix(color1, bassColor,  uBass  * 0.55);
      color2 = mix(color2, midColor,   uMid   * 0.40);
      color2 = mix(color2, highColor,  uHigh  * 0.25);

      float ang    = atan(uv.y, uv.x);
      float len    = length(uv);
      float invLen = len > 0.0 ? 1.0 / len : 0.0;

      float bgLuminance = dot(backgroundColor, vec3(0.299, 0.587, 0.114));

      // Noise-based radius — fattens with bass
      float n0 = snoise3(vec3(uv * noiseScale, iTime * 0.5)) * 0.5 + 0.5;
      float bassThick = uBass * 0.08; // ring thickens on bass hit
      float r0 = mix(
        mix(innerRadius, 1.0, 0.4 - bassThick),
        mix(innerRadius, 1.0, 0.6 + bassThick),
        n0
      );

      // Per-angle waveform displacement
      float disp = waveDisplace(ang);
      r0 += disp;
      r0 = clamp(r0, innerRadius * 0.85, 1.1);

      float d0 = distance(uv, (r0 * invLen) * uv);
      float v0 = light1(1.0, 10.0, d0);

      v0 *= smoothstep(r0 * 1.05, r0, len);
      float innerFade = smoothstep(r0 * 0.8, r0 * 0.95, len);
      v0 *= mix(innerFade, 1.0, bgLuminance * 0.7);

      float cl = cos(ang + iTime * 2.0) * 0.5 + 0.5;

      float a   = iTime * -1.0;
      vec2  pos = vec2(cos(a), sin(a)) * r0;
      float d   = distance(uv, pos);

      // Bright hot-spot intensity scales with energy
      float spotBoost = 1.5 + uEnergy * 2.0;
      float v1 = light2(spotBoost, 5.0, d);
      v1 *= light1(1.0, 50.0, d0);

      float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);
      float v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);

      vec3 colBase    = mix(color1, color2, cl);
      float fadeAmount = mix(1.0, 0.1, bgLuminance);

      // Outer bloom glow expands with energy
      float bloomRadius = 1.05 + uEnergy * 0.12;
      float bloom = smoothstep(bloomRadius, innerRadius, len) * uEnergy * 0.35;

      vec3 darkCol  = mix(color3, colBase, v0);
      darkCol = (darkCol + v1) * v2 * v3;
      darkCol += bloom * color2;
      darkCol = clamp(darkCol, 0.0, 1.0);

      vec3 lightCol = (colBase + v1) * mix(1.0, v2 * v3, fadeAmount);
      lightCol = mix(backgroundColor, lightCol, v0);
      lightCol += bloom * color1;
      lightCol = clamp(lightCol, 0.0, 1.0);

      vec3 finalCol = mix(darkCol, lightCol, bgLuminance);

      return extractAlpha(finalCol);
    }

    vec4 mainImage(vec2 fragCoord) {
      vec2 center = iResolution.xy * 0.5;
      float size  = min(iResolution.x, iResolution.y);
      vec2 uv     = (fragCoord - center) / size * 2.0;

      float angle = rot;
      float s = sin(angle);
      float c = cos(angle);
      uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);

      // Warp from hover/audio
      uv.x += hover * hoverIntensity * 0.1 * sin(uv.y * 10.0 + iTime);
      uv.y += hover * hoverIntensity * 0.1 * sin(uv.x * 10.0 + iTime);

      return draw(uv);
    }

    void main() {
      vec2 fragCoord = vUv * iResolution.xy;
      vec4 col = mainImage(fragCoord);
      gl_FragColor = vec4(col.rgb * col.a, col.a);
    }
  `

  useEffect(() => {
    const container = ctnDom.current
    if (!container) return

    const renderer = new Renderer({ alpha: true, premultipliedAlpha: false })
    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 0)
    container.appendChild(gl.canvas)

    const geometry = new Triangle(gl)
    const program = new Program(gl, {
      vertex: vert,
      fragment: frag,
      uniforms: {
        iTime:           { value: 0 },
        iResolution:     { value: new Vec3(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height) },
        hue:             { value: hue },
        hover:           { value: 0 },
        rot:             { value: 0 },
        hoverIntensity:  { value: hoverIntensity },
        backgroundColor: { value: hexToVec3(backgroundColor) },
        uBass:           { value: 0 },
        uMid:            { value: 0 },
        uHigh:           { value: 0 },
        uEnergy:         { value: 0 },
      },
    })

    const mesh = new Mesh(gl, { geometry, program })

    function resize() {
      if (!container) return
      const dpr = window.devicePixelRatio || 1
      const width = container.clientWidth
      const height = container.clientHeight
      renderer.setSize(width * dpr, height * dpr)
      gl.canvas.style.width  = width + 'px'
      gl.canvas.style.height = height + 'px'
      program.uniforms.iResolution.value.set(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height)
    }
    window.addEventListener('resize', resize)
    resize()

    let targetHover = 0
    let lastTime    = 0
    let currentRot  = 0
    const rotationSpeed = 0.3

    const handleMouseMove = (e: MouseEvent) => {
      const rect    = container.getBoundingClientRect()
      const x       = e.clientX - rect.left
      const y       = e.clientY - rect.top
      const size    = Math.min(rect.width, rect.height)
      const uvX     = ((x - rect.width  / 2) / size) * 2.0
      const uvY     = ((y - rect.height / 2) / size) * 2.0
      targetHover   = Math.sqrt(uvX * uvX + uvY * uvY) < 0.8 ? 1 : 0
    }
    const handleMouseLeave = () => { targetHover = 0 }

    container.addEventListener('mousemove',  handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)

    // Smoothed audio values to avoid jitter
    let sBass = 0, sMid = 0, sHigh = 0

    let rafId: number
    const update = (t: number) => {
      rafId = requestAnimationFrame(update)
      const dt = (t - lastTime) * 0.001
      lastTime = t
      program.uniforms.iTime.value = t * 0.001
      program.uniforms.hue.value   = hue
      program.uniforms.backgroundColor.value = hexToVec3(backgroundColor)

      let effectiveHover: number
      if (audioRef?.current) {
        effectiveHover = audioRef.current.hover
        program.uniforms.hoverIntensity.value = audioRef.current.intensity

        // Smooth audio bands
        const RISE = 0.35, FALL = 0.08
        const lerpBand = (cur: number, tgt: number) =>
          cur + (tgt - cur) * (tgt > cur ? RISE : FALL)

        sBass = lerpBand(sBass, audioRef.current.bass  ?? 0)
        sMid  = lerpBand(sMid,  audioRef.current.mid   ?? 0)
        sHigh = lerpBand(sHigh, audioRef.current.high  ?? 0)
      } else {
        effectiveHover = forceHoverState ? 1 : targetHover
        program.uniforms.hoverIntensity.value = hoverIntensity
        sBass = sBass * 0.9
        sMid  = sMid  * 0.9
        sHigh = sHigh * 0.9
      }

      program.uniforms.uBass.value   = sBass
      program.uniforms.uMid.value    = sMid
      program.uniforms.uHigh.value   = sHigh
      program.uniforms.uEnergy.value = Math.min(1, sBass * 1.2 + sMid * 0.6 + sHigh * 0.2)

      program.uniforms.hover.value += (effectiveHover - program.uniforms.hover.value) * 0.12

      if (rotateOnHover && effectiveHover > 0.1) {
        currentRot += dt * rotationSpeed * effectiveHover
      }
      // Continuous slow rotation while audio is active
      if (audioRef?.current && (sBass + sMid + sHigh) > 0.05) {
        currentRot += dt * 0.15 * (1 + sBass * 2)
      }
      program.uniforms.rot.value = currentRot

      renderer.render({ scene: mesh })
    }
    rafId = requestAnimationFrame(update)

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      container.removeEventListener('mousemove',  handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)
      if (container.contains(gl.canvas)) container.removeChild(gl.canvas)
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hue, hoverIntensity, rotateOnHover, forceHoverState, backgroundColor, audioRef])

  return <div ref={ctnDom} className="orb-container" />
}

function hslToRgb(h: number, s: number, l: number): Vec3 {
  let r: number, g: number, b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return new Vec3(r, g, b)
}

function hexToVec3(color: string): Vec3 {
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16) / 255
    const g = parseInt(color.slice(3, 5), 16) / 255
    const b = parseInt(color.slice(5, 7), 16) / 255
    return new Vec3(r, g, b)
  }
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (rgbMatch) {
    return new Vec3(parseInt(rgbMatch[1]) / 255, parseInt(rgbMatch[2]) / 255, parseInt(rgbMatch[3]) / 255)
  }
  const hslMatch = color.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%/)
  if (hslMatch) {
    return hslToRgb(parseInt(hslMatch[1]) / 360, parseInt(hslMatch[2]) / 100, parseInt(hslMatch[3]) / 100)
  }
  return new Vec3(0, 0, 0)
}
