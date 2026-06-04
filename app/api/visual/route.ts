import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL ?? "claude-haiku-4-5-20251001";

// svg background, gradients, filters — height changes per template
function defs(h: number) {
  return `<defs>
  <linearGradient id="gC" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4ECDC4"/><stop offset="100%" stop-color="#2BA8A0"/></linearGradient>
  <linearGradient id="gV" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#9B6FD0"/><stop offset="100%" stop-color="#7040B0"/></linearGradient>
  <linearGradient id="gM" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#52D98B"/><stop offset="100%" stop-color="#2BA85A"/></linearGradient>
  <linearGradient id="gG" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#E8B84B"/><stop offset="100%" stop-color="#B88820"/></linearGradient>
  <filter id="glow"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="blob"><feGaussianBlur stdDeviation="28"/></filter>
  <pattern id="dots" patternUnits="userSpaceOnUse" width="18" height="18"><circle cx="9" cy="9" r="0.55" fill="#8EA8CC" opacity="0.08"/></pattern>
</defs>
<rect width="520" height="${h}" rx="12" fill="#07091280"/>
<ellipse cx="90" cy="${h * 0.3}" rx="140" ry="80" fill="#4ECDC4" opacity="0.03" filter="url(#blob)"/>
<ellipse cx="440" cy="${h * 0.7}" rx="140" ry="70" fill="#9B6FD0" opacity="0.03" filter="url(#blob)"/>
<rect width="520" height="${h}" fill="url(#dots)" rx="12"/>
<rect width="520" height="${h}" rx="12" fill="none" stroke="rgba(78,205,196,0.1)" stroke-width="1"/>`;
}

function svg(title: string, body: string, h: number): string {
  return `<svg viewBox="0 0 520 ${h}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg">
${defs(h)}
<text x="16" y="19" font-family="Inter,system-ui,sans-serif" font-size="8.5" fill="rgba(78,205,196,0.55)" letter-spacing="0.16em" font-weight="700">${title.toUpperCase().slice(0, 42)}</text>
${body}
</svg>`;
}

// break text at word boundary into two lines
function wrap(s: string, n: number): [string, string] {
  const t = (s ?? "").trim();
  if (t.length <= n) return [t, ""];
  const idx = t.lastIndexOf(" ", n);
  const cut = idx > n * 0.5 ? idx : n;
  return [
    t.slice(0, cut).trim(),
    t
      .slice(cut)
      .trim()
      .slice(0, n + 4),
  ];
}

// 3 stacked authority rows
const HIERARCHY = (_t: string, tiers: [string, string][]) => {
  const pal = [
    {
      g: "gC",
      c: "#4ECDC4",
      border: "rgba(78,205,196,0.22)",
      bg: "rgba(78,205,196,0.05)",
    },
    {
      g: "gV",
      c: "#9B6FD0",
      border: "rgba(155,111,208,0.22)",
      bg: "rgba(155,111,208,0.05)",
    },
    {
      g: "gM",
      c: "#52D98B",
      border: "rgba(82,217,139,0.18)",
      bg: "rgba(82,217,139,0.05)",
    },
  ];
  const rowH = 52,
    gap = 8,
    startY = 30;
  const totalH = startY + 3 * rowH + 2 * gap + 14;
  let body = "";
  for (let i = 0; i < 3; i++) {
    const y = startY + i * (rowH + gap);
    const p = pal[i];
    const [head, note] = tiers[i] ?? ["", ""];
    const [n1, n2] = wrap(note, 58);
    const hasTwo = n2.length > 0;
    const titleY = hasTwo ? y + 18 : y + rowH / 2 - 2;
    const d1Y = titleY + 15;
    const d2Y = d1Y + 13;
    body += `<rect x="14" y="${y}" width="492" height="${rowH}" rx="8" fill="${p.bg}" stroke="${p.border}" stroke-width="1"/>
<rect x="14" y="${y}" width="3" height="${rowH}" rx="1.5" fill="url(#${p.g})"/>
<circle cx="487" cy="${y + rowH / 2}" r="11" fill="rgba(0,0,0,0.35)" stroke="${p.border}" stroke-width="1"/>
<text x="487" y="${y + rowH / 2 + 3.5}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="9.5" fill="${p.c}" font-weight="800">${i + 1}</text>
<text x="26" y="${titleY + 4}" font-family="Inter,system-ui,sans-serif" font-size="12" fill="#E8F0FC" font-weight="700">${head.slice(0, 38)}</text>
<text x="26" y="${d1Y + 4}" font-family="Inter,system-ui,sans-serif" font-size="9.5" fill="#6A88AA">${n1}</text>
${hasTwo ? `<text x="26" y="${d2Y + 4}" font-family="Inter,system-ui,sans-serif" font-size="9.5" fill="#6A88AA">${n2}</text>` : ""}`;
    if (i < 2) {
      const arY = y + rowH + 1;
      body += `<line x1="260" y1="${arY}" x2="260" y2="${arY + gap - 1}" stroke="rgba(78,205,196,0.2)" stroke-width="1"/>`;
    }
  }
  return { body, h: totalH };
};

// 3 concept columns
const PILLARS = (_t: string, items: [string, string][]) => {
  const pal = [
    {
      g: "gC",
      c: "#4ECDC4",
      border: "rgba(78,205,196,0.25)",
      bg: "rgba(78,205,196,0.05)",
    },
    {
      g: "gV",
      c: "#9B6FD0",
      border: "rgba(155,111,208,0.25)",
      bg: "rgba(155,111,208,0.05)",
    },
    {
      g: "gM",
      c: "#52D98B",
      border: "rgba(82,217,139,0.22)",
      bg: "rgba(82,217,139,0.05)",
    },
  ];
  const xs = [14, 185, 356],
    cw = 150,
    startY = 28,
    cardH = 168,
    totalH = startY + cardH + 18;
  let body = "";
  for (let i = 0; i < 3; i++) {
    const x = xs[i],
      p = pal[i];
    const [head, sub] = items[i] ?? ["", ""];
    const [s1, s2] = wrap(sub, 20);
    const [s3] = s2.length > 0 ? wrap(s2, 20) : ["", ""];
    body += `<rect x="${x}" y="${startY}" width="${cw}" height="${cardH}" rx="9" fill="${p.bg}" stroke="${p.border}" stroke-width="1"/>
<rect x="${x}" y="${startY}" width="${cw}" height="3" rx="1.5" fill="url(#${p.g})"/>
<circle cx="${x + cw / 2}" cy="${startY + 44}" r="18" fill="rgba(0,0,0,0.4)" stroke="${p.border}" stroke-width="1.5"/>
<circle cx="${x + cw / 2}" cy="${startY + 44}" r="8" fill="url(#${p.g})" opacity="0.85" filter="url(#glow)"/>
<text x="${x + cw / 2}" y="${startY + 44 + 3.5}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="9" fill="#050810" font-weight="800">${i + 1}</text>
<text x="${x + cw / 2}" y="${startY + 83}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="11" fill="${p.c}" font-weight="700">${head.slice(0, 15)}</text>
<line x1="${x + 18}" y1="${startY + 93}" x2="${x + cw - 18}" y2="${startY + 93}" stroke="${p.border}" stroke-width="0.8"/>
<text x="${x + cw / 2}" y="${startY + 110}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="9.5" fill="#6A88AA">${s1}</text>
${s3 ? `<text x="${x + cw / 2}" y="${startY + 124}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="9.5" fill="#6A88AA">${s3}</text>` : ""}`;
  }
  return { body, h: totalH };
};

// horizontal steps with arrows
const FLOW = (_t: string, steps: string[]) => {
  const n = Math.min(steps.length, 4);
  const w = 104,
    gap = 20,
    startX = (520 - (n * w + (n - 1) * gap)) / 2;
  const pal = ["gC", "gV", "gM", "gG"];
  const cs = ["#4ECDC4", "#9B6FD0", "#52D98B", "#E8B84B"];
  const startY = 28,
    cardH = 110,
    totalH = startY + cardH + 24;
  let body = "";
  for (let i = 0; i < n; i++) {
    const x = startX + i * (w + gap),
      c = cs[i],
      g = pal[i];
    const [l1, l2] = wrap(steps[i], 13);
    body += `<rect x="${x}" y="${startY}" width="${w}" height="${cardH}" rx="9" fill="rgba(0,0,0,0.3)" stroke="rgba(${c === "#4ECDC4" ? "78,205,196" : c === "#9B6FD0" ? "155,111,208" : c === "#52D98B" ? "82,217,139" : "232,184,75"},0.25)" stroke-width="1"/>
<rect x="${x}" y="${startY}" width="${w}" height="3" rx="1.5" fill="url(#${g})"/>
<circle cx="${x + w / 2}" cy="${startY + 36}" r="15" fill="rgba(0,0,0,0.4)" stroke="rgba(${c === "#4ECDC4" ? "78,205,196" : c === "#9B6FD0" ? "155,111,208" : c === "#52D98B" ? "82,217,139" : "232,184,75"},0.4)" stroke-width="1.5"/>
<text x="${x + w / 2}" y="${startY + 40}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="13" fill="${c}" font-weight="800" filter="url(#glow)">${i + 1}</text>
<text x="${x + w / 2}" y="${startY + (l2 ? 73 : 80)}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="10.5" fill="#E8F0FC" font-weight="600">${l1}</text>
${l2 ? `<text x="${x + w / 2}" y="${startY + 87}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="10.5" fill="#C0D4EC">${l2}</text>` : ""}`;
    if (i < n - 1) {
      const ax = x + w + 3;
      body += `<line x1="${ax}" y1="${startY + cardH / 2}" x2="${ax + gap - 5}" y2="${startY + cardH / 2}" stroke="rgba(78,205,196,0.3)" stroke-width="1.5"/>
<polygon points="${ax + gap - 5},${startY + cardH / 2 - 3} ${ax + gap + 1},${startY + cardH / 2} ${ax + gap - 5},${startY + cardH / 2 + 3}" fill="rgba(78,205,196,0.5)"/>`;
    }
  }
  return { body, h: totalH };
};

// stat cards for figures and rates
const STATS = (_t: string, stats: [string, string, string][]) => {
  const n = Math.min(stats.length, 4);
  const w = n === 2 ? 218 : n === 3 ? 142 : 108;
  const gap = n === 2 ? 44 : n === 3 ? 22 : 16;
  const startX = (520 - (n * w + (n - 1) * gap)) / 2;
  const pal = [
    { g: "gC", c: "#4ECDC4", b: "rgba(78,205,196,0.25)" },
    { g: "gV", c: "#9B6FD0", b: "rgba(155,111,208,0.25)" },
    { g: "gM", c: "#52D98B", b: "rgba(82,217,139,0.22)" },
    { g: "gG", c: "#E8B84B", b: "rgba(232,184,75,0.22)" },
  ];
  const startY = 28,
    cardH = 148,
    totalH = startY + cardH + 18;
  let body = "";
  for (let i = 0; i < n; i++) {
    const x = startX + i * (w + gap),
      p = pal[i];
    const [val, label, desc] = stats[i];
    body += `<rect x="${x}" y="${startY}" width="${w}" height="${cardH}" rx="9" fill="rgba(0,0,0,0.3)" stroke="${p.b}" stroke-width="1"/>
<rect x="${x}" y="${startY}" width="${w}" height="3" rx="1.5" fill="url(#${p.g})"/>
<text x="${x + w / 2}" y="${startY + 73}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="30" fill="${p.c}" font-weight="800" filter="url(#glow)">${val.slice(0, 10)}</text>
<text x="${x + w / 2}" y="${startY + 91}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="9" fill="#8EA8CC" letter-spacing="0.07em">${label.slice(0, 20).toUpperCase()}</text>
<line x1="${x + w * 0.18}" y1="${startY + 102}" x2="${x + w * 0.82}" y2="${startY + 102}" stroke="${p.b}" stroke-width="1"/>
<text x="${x + w / 2}" y="${startY + 118}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="9" fill="#4A6285">${desc.slice(0, 24)}</text>`;
  }
  return { body, h: totalH };
};

// central idea with surrounding concepts
const CONCEPT = (_t: string, centre: string, satellites: string[]) => {
  const n = Math.min(satellites.length, 4);
  const pos: [number, number][] = [
    [110, 72],
    [410, 72],
    [110, 188],
    [410, 188],
  ];
  const pal = [
    { g: "gC", b: "rgba(78,205,196,0.28)" },
    { g: "gV", b: "rgba(155,111,208,0.28)" },
    { g: "gM", b: "rgba(82,217,139,0.25)" },
    { g: "gG", b: "rgba(232,184,75,0.25)" },
  ];
  const [c1, c2] = wrap(centre, 14);
  const totalH = 262;
  let body = `<ellipse cx="260" cy="130" rx="72" ry="44" fill="rgba(78,205,196,0.06)" stroke="rgba(78,205,196,0.35)" stroke-width="1.5" filter="url(#glow)"/>
<text x="260" y="${c2 ? "125" : "134"}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="12" fill="#4ECDC4" font-weight="700">${c1}</text>
${c2 ? `<text x="260" y="141" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="11" fill="#4ECDC4">${c2}</text>` : ""}`;
  for (let i = 0; i < n; i++) {
    const [sx, sy] = pos[i],
      p = pal[i];
    const [l1, l2] = wrap(satellites[i], 15);
    const cardH = l2 ? 46 : 34;
    const lx = sx < 260 ? sx + 56 : sx - 56;
    const ly = sy < 130 ? 106 : 154;
    body += `<line x1="${lx}" y1="${ly}" x2="${sx < 260 ? 188 : 332}" y2="130" stroke="${p.b}" stroke-width="1" stroke-dasharray="3 3"/>
<rect x="${sx - 58}" y="${sy - cardH / 2}" width="116" height="${cardH}" rx="8" fill="rgba(8,12,24,0.85)" stroke="${p.b}" stroke-width="1"/>
<rect x="${sx - 58}" y="${sy - cardH / 2}" width="116" height="3" rx="1.5" fill="url(#${p.g})"/>
<text x="${sx}" y="${sy + (l2 ? -4 : 4)}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="10.5" fill="#E8F0FC" font-weight="600">${l1}</text>
${l2 ? `<text x="${sx}" y="${sy + 11}" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="9.5" fill="#7A98BE">${l2}</text>` : ""}`;
  }
  return { body, h: totalH };
};

// haiku reads the tutor message and returns JSON — no SVG generation cost
const PROMPT = `You are a data-extraction assistant for an accounting education app.
Read the tutor message and return ONLY a valid JSON object — no explanation, no markdown.

Pick the best visual type and extract real content from the message:

STEPS or PROCESS → "flow"
{ "type":"flow", "title":"3-word title", "steps":["Exact step name","Exact step name","Exact step name"] }
3-4 steps, each max 26 chars, use actual names from the message

3 PILLARS / PRINCIPLES / CORE CONCEPTS → "pillars"
{ "type":"pillars", "title":"3-word title", "items":[["Exact name","what it means"],["Exact name","what it means"],["Exact name","what it means"]] }
name max 15 chars, meaning max 42 chars, use exact terms from the message

FIGURES / RATES / AMOUNTS (£ or %) → "stats"
{ "type":"stats", "title":"3-word title", "stats":[["£value or %","label","tax year or context"]] }
2-4 items, value max 10 chars

AUTHORITY LAYERS / HIERARCHY / WHO OVERSEES WHO → "hierarchy"
{ "type":"hierarchy", "title":"3-word title", "tiers":[["Exact authority name","what they actually do"],["Exact name","what they do"],["Exact name","what they do"]] }
name max 34 chars using EXACT names from message, description max 60 chars

CENTRAL IDEA with 3-4 connected concepts → "concept"
{ "type":"concept", "title":"3-word title", "centre":"Core concept", "satellites":["related idea","related idea","related idea"] }
centre max 24 chars, each satellite max 26 chars

IMPORTANT: Use the actual names and terms from the tutor message. Do not invent generic names like "Layer 1" or "Concept A".
Return ONLY the JSON.`;

export async function POST(req: NextRequest) {
  try {
    const { content } = (await req.json()) as { content: string };
    if (!content?.trim()) return NextResponse.json({ svg: null });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 380,
      temperature: 0,
      system: PROMPT,
      messages: [{ role: "user", content: content.slice(0, 1000) }],
    });

    const raw =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : "";
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    type VisualData =
      | { type: "flow"; title: string; steps: string[] }
      | { type: "pillars"; title: string; items: [string, string][] }
      | { type: "stats"; title: string; stats: [string, string, string][] }
      | { type: "hierarchy"; title: string; tiers: [string, string][] }
      | {
          type: "concept";
          title: string;
          centre: string;
          satellites: string[];
        };

    const data = JSON.parse(cleaned) as VisualData;

    let result: { body: string; h: number };
    switch (data.type) {
      case "flow":
        result = FLOW(data.title, data.steps);
        break;
      case "pillars":
        result = PILLARS(data.title, data.items);
        break;
      case "stats":
        result = STATS(data.title, data.stats);
        break;
      case "hierarchy":
        result = HIERARCHY(data.title, data.tiers);
        break;
      case "concept":
        result = CONCEPT(data.title, data.centre, data.satellites);
        break;
      default:
        return NextResponse.json({ svg: null });
    }

    return NextResponse.json({ svg: svg(data.title, result.body, result.h) });
  } catch {
    return NextResponse.json({ svg: null });
  }
}
