import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL  = process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5-20251001'

// ─── Shared SVG defs + background (injected into every template) ─────────────
const DEFS = `<defs>
  <linearGradient id="gC" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4ECDC4"/><stop offset="100%" stop-color="#2BA8A0"/></linearGradient>
  <linearGradient id="gV" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#9B6FD0"/><stop offset="100%" stop-color="#6B3FA0"/></linearGradient>
  <linearGradient id="gM" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#52D98B"/><stop offset="100%" stop-color="#2BA85A"/></linearGradient>
  <linearGradient id="gG" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#E8B84B"/><stop offset="100%" stop-color="#B88820"/></linearGradient>
  <linearGradient id="gBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0A0F1E"/><stop offset="100%" stop-color="#050810"/></linearGradient>
  <linearGradient id="gCard" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#0E1525" stop-opacity="0.95"/><stop offset="100%" stop-color="#090D1A" stop-opacity="0.98"/></linearGradient>
  <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="blob"><feGaussianBlur stdDeviation="20"/></filter>
  <pattern id="dots" patternUnits="userSpaceOnUse" width="20" height="20"><circle cx="10" cy="10" r="0.7" fill="#8EA8CC" opacity="0.08"/></pattern>
</defs>
<rect width="520" height="200" rx="12" fill="url(#gBg)"/>
<ellipse cx="100" cy="60" rx="130" ry="70" fill="#4ECDC4" opacity="0.04" filter="url(#blob)"/>
<ellipse cx="420" cy="150" rx="140" ry="65" fill="#9B6FD0" opacity="0.05" filter="url(#blob)"/>
<rect width="520" height="200" fill="url(#dots)" rx="12"/>
<rect width="520" height="200" rx="12" fill="none" stroke="rgba(78,205,196,0.13)" stroke-width="1"/>`

// ─── Pre-built templates — Haiku only fills {{SLOT}} values ──────────────────

// FLOW: up to 4 steps
const FLOW = (title: string, steps: string[]) => {
  const n = Math.min(steps.length, 4)
  const w = 108, gap = 18, startX = (520 - (n * w + (n - 1) * gap)) / 2
  const colors = ['gC','gV','gM','gG']
  const strokes = ['rgba(78,205,196,0.3)','rgba(155,111,208,0.3)','rgba(82,217,139,0.3)','rgba(232,184,75,0.3)']
  let out = ''
  for (let i = 0; i < n; i++) {
    const x = startX + i * (w + gap)
    const label = steps[i].slice(0, 28)
    const line1 = label.slice(0, 14), line2 = label.slice(14)
    out += `<rect x="${x}" y="70" width="${w}" height="64" rx="10" fill="url(#gCard)" stroke="${strokes[i]}" stroke-width="1"/>
<line x1="${x+1}" y1="71" x2="${x+w-1}" y2="71" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
<circle cx="${x+14}" cy="82" r="8" fill="url(#${colors[i]})" filter="url(#glow)"/>
<text x="${x+14}" y="86" text-anchor="middle" font-family="Inter,sans-serif" font-size="9" fill="#050810" font-weight="700">${i+1}</text>
<text x="${x+w/2}" y="${line2 ? '108' : '113'}" text-anchor="middle" font-family="Inter,sans-serif" font-size="10.5" fill="#E8F0FC" font-weight="600">${line1}</text>
${line2 ? `<text x="${x+w/2}" y="122" text-anchor="middle" font-family="Inter,sans-serif" font-size="10.5" fill="#E8F0FC">${line2}</text>` : ''}`
    if (i < n - 1) {
      const ax = x + w + 2
      out += `<line x1="${ax}" y1="102" x2="${ax+gap-4}" y2="102" stroke="rgba(78,205,196,0.45)" stroke-width="1.5" filter="url(#glow)"/>
<polygon points="${ax+gap-4},98 ${ax+gap+2},102 ${ax+gap-4},106" fill="#4ECDC4"/>`
    }
  }
  return out
}

// PILLARS: exactly 3 items
const PILLARS = (title: string, items: [string, string][]) => {
  const cols = [['gC','rgba(78,205,196,0.22)'],['gV','rgba(155,111,208,0.22)'],['gM','rgba(82,217,139,0.22)']]
  const xs = [38, 193, 348]
  let out = ''
  for (let i = 0; i < 3; i++) {
    const x = xs[i], [gId, bg] = cols[i]
    const [head, sub] = items[i] ?? ['','']
    out += `<rect x="${x}" y="50" width="139" height="120" rx="10" fill="${bg}" stroke="url(#${gId})" stroke-width="1" opacity="0.9"/>
<rect x="${x}" y="50" width="139" height="5" rx="10" fill="url(#${gId})"/>
<line x1="${x+1}" y1="56" x2="${x+138}" y2="56" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
<text x="${x+69}" y="100" text-anchor="middle" font-family="Inter,sans-serif" font-size="11" fill="#E8F0FC" font-weight="700">${head.slice(0,16)}</text>
<text x="${x+69}" y="118" text-anchor="middle" font-family="Inter,sans-serif" font-size="9" fill="#8EA8CC">${sub.slice(0,20)}</text>
<text x="${x+69}" y="145" text-anchor="middle" font-family="Inter,sans-serif" font-size="9" fill="#8EA8CC">${sub.slice(20,40)}</text>`
  }
  return out
}

// STATS: 2-4 stat cards
const STATS = (title: string, stats: [string, string, string][]) => {
  const n = Math.min(stats.length, 4)
  const w = n === 2 ? 220 : n === 3 ? 145 : 108
  const gap = n === 2 ? 30 : n === 3 ? 22 : 18
  const startX = (520 - (n * w + (n - 1) * gap)) / 2
  const gIds = ['gC','gV','gM','gG']
  const strokes = ['rgba(78,205,196,0.28)','rgba(155,111,208,0.28)','rgba(82,217,139,0.28)','rgba(232,184,75,0.28)']
  let out = ''
  for (let i = 0; i < n; i++) {
    const x = startX + i * (w + gap)
    const [val, label, desc] = stats[i]
    out += `<rect x="${x}" y="45" width="${w}" height="120" rx="10" fill="url(#gCard)" stroke="${strokes[i]}" stroke-width="1"/>
<line x1="${x+1}" y1="46" x2="${x+w-1}" y2="46" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
<text x="${x+w/2}" y="100" text-anchor="middle" font-family="Inter,sans-serif" font-size="28" fill="url(#${gIds[i]})" font-weight="800" filter="url(#glow)">${val.slice(0,10)}</text>
<text x="${x+w/2}" y="118" text-anchor="middle" font-family="Inter,sans-serif" font-size="9.5" fill="#8EA8CC" letter-spacing="0.06em">${label.slice(0,18).toUpperCase()}</text>
<line x1="${x+w*0.2}" y1="128" x2="${x+w*0.8}" y2="128" stroke="url(#${gIds[i]})" stroke-width="1.5" opacity="0.6"/>
<text x="${x+w/2}" y="148" text-anchor="middle" font-family="Inter,sans-serif" font-size="8.5" fill="#4A6285">${desc.slice(0,20)}</text>`
  }
  return out
}

// HIERARCHY: 3 tiers
const HIERARCHY = (title: string, tiers: [string, string][]) => {
  const widths = [280, 360, 440]
  const gIds = ['gC','gV','gM']
  const strokes = ['rgba(78,205,196,0.35)','rgba(155,111,208,0.3)','rgba(82,217,139,0.25)']
  let out = `<line x1="40" y1="55" x2="40" y2="175" stroke="rgba(78,205,196,0.2)" stroke-width="1.5"/>`
  const ys = [42, 92, 140]
  for (let i = 0; i < 3; i++) {
    const tw = widths[i], x = (520 - tw) / 2
    const [head, note] = tiers[i] ?? ['','']
    out += `<rect x="${x}" y="${ys[i]}" width="${tw}" height="42" rx="8" fill="url(#gCard)" stroke="${strokes[i]}" stroke-width="1"/>
<rect x="${x}" y="${ys[i]}" width="4" height="42" rx="2" fill="url(#${gIds[i]})"/>
<line x1="${x+1}" y1="${ys[i]+1}" x2="${x+tw-1}" y2="${ys[i]+1}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
<text x="${x+18}" y="${ys[i]+17}" font-family="Inter,sans-serif" font-size="11" fill="#E8F0FC" font-weight="700">${head.slice(0,22)}</text>
<text x="${x+18}" y="${ys[i]+32}" font-family="Inter,sans-serif" font-size="9" fill="#8EA8CC">${note.slice(0,40)}</text>`
  }
  return out
}

// CONCEPT MAP: central node + up to 4 satellites
const CONCEPT = (title: string, centre: string, satellites: string[]) => {
  const n = Math.min(satellites.length, 4)
  const positions = [[130,55],[390,55],[130,155],[390,155]]
  const gIds = ['gC','gV','gM','gG']
  const strokes = ['rgba(78,205,196,0.3)','rgba(155,111,208,0.3)','rgba(82,217,139,0.3)','rgba(232,184,75,0.3)']
  let out = `<ellipse cx="260" cy="105" rx="70" ry="40" fill="url(#gCard)" stroke="rgba(78,205,196,0.4)" stroke-width="1.5" filter="url(#glow)"/>
<text x="260" y="101" text-anchor="middle" font-family="Inter,sans-serif" font-size="11" fill="#4ECDC4" font-weight="700">${centre.slice(0,14)}</text>
<text x="260" y="116" text-anchor="middle" font-family="Inter,sans-serif" font-size="9" fill="#8EA8CC">${centre.slice(14,28)}</text>`
  for (let i = 0; i < n; i++) {
    const [sx, sy] = positions[i]
    const label = satellites[i].slice(0, 24)
    const line1 = label.slice(0, 12), line2 = label.slice(12)
    // line from satellite to centre
    out += `<line x1="${sx}" y1="${sy}" x2="220" y2="100" stroke="${strokes[i]}" stroke-width="1" stroke-dasharray="4 3"/>
<rect x="${sx-52}" y="${sy-20}" width="104" height="${line2 ? 44 : 32}" rx="8" fill="url(#gCard)" stroke="${strokes[i]}" stroke-width="1"/>
<line x1="${sx-51}" y1="${sy-19}" x2="${sx+51}" y2="${sy-19}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
<text x="${sx}" y="${sy-3}" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" fill="#E8F0FC" font-weight="600">${line1}</text>
${line2 ? `<text x="${sx}" y="${sy+11}" text-anchor="middle" font-family="Inter,sans-serif" font-size="10" fill="#8EA8CC">${line2}</text>` : ''}`
  }
  return out
}

// ─── Build final SVG from template + content ──────────────────────────────────
function buildSVG(title: string, body: string): string {
  return `<svg viewBox="0 0 520 200" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg">
${DEFS}
<text x="16" y="15" font-family="Inter,sans-serif" font-size="9" fill="#4A6285" letter-spacing="0.14em" font-weight="600">${title.toUpperCase().slice(0, 36)}</text>
${body}
</svg>`
}

// ─── Prompt: Haiku only returns JSON — no SVG generation cost ────────────────
const PROMPT = `You are a data-extraction assistant for an accounting education app.
Read the tutor message and return ONLY a valid JSON object — no explanation, no markdown.

Choose the best visual type and extract the data:

If the message describes STEPS or a PROCESS → type "flow"
  { "type":"flow", "title":"[3-word title]", "steps":["Step label","Step label","Step label"] }
  steps: 3-4 items, max 24 chars each

If the message describes 3 CORE CONCEPTS / PILLARS / PRINCIPLES → type "pillars"
  { "type":"pillars", "title":"[3-word title]", "items":[["Heading","short desc"],["Heading","short desc"],["Heading","short desc"]] }
  heading max 14 chars, desc max 38 chars

If the message mentions FIGURES / RATES / AMOUNTS (£ or %) → type "stats"
  { "type":"stats", "title":"[3-word title]", "stats":[["value","label","year or context"],["value","label","context"]] }
  2-4 items, value max 8 chars (e.g. "£12,570" or "20%")

If the message describes a HIERARCHY / LAYERS / AUTHORITY STRUCTURE → type "hierarchy"
  { "type":"hierarchy", "title":"[3-word title]", "tiers":[["Top tier name","brief note"],["Mid tier","brief note"],["Base tier","brief note"]] }
  name max 20 chars, note max 38 chars

If the message explains a CENTRAL IDEA with related concepts → type "concept"
  { "type":"concept", "title":"[3-word title]", "centre":"Central Term", "satellites":["concept 1","concept 2","concept 3","concept 4"] }
  centre max 26 chars, each satellite max 22 chars

Return ONLY the JSON object.`

export async function POST(req: NextRequest) {
  try {
    const { content } = await req.json() as { content: string }
    if (!content?.trim()) return NextResponse.json({ svg: null })

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      temperature: 0,
      system: PROMPT,
      messages: [{ role: 'user', content: content.slice(0, 700) }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    type VisualData =
      | { type: 'flow';      title: string; steps: string[] }
      | { type: 'pillars';   title: string; items: [string, string][] }
      | { type: 'stats';     title: string; stats: [string, string, string][] }
      | { type: 'hierarchy'; title: string; tiers: [string, string][] }
      | { type: 'concept';   title: string; centre: string; satellites: string[] }

    const data = JSON.parse(cleaned) as VisualData

    let body = ''
    switch (data.type) {
      case 'flow':      body = FLOW(data.title, data.steps); break
      case 'pillars':   body = PILLARS(data.title, data.items); break
      case 'stats':     body = STATS(data.title, data.stats); break
      case 'hierarchy': body = HIERARCHY(data.title, data.tiers); break
      case 'concept':   body = CONCEPT(data.title, data.centre, data.satellites); break
      default: return NextResponse.json({ svg: null })
    }

    return NextResponse.json({ svg: buildSVG(data.title, body) })
  } catch {
    return NextResponse.json({ svg: null })
  }
}
