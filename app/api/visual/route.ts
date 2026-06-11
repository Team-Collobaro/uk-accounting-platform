import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL ?? "claude-haiku-4-5-20251001";

/* ──────────────────────────────────────────────────────────────────────────
   Monochrome diagram system — matches the app's neutral black & white theme.
   No gradients or glows: hairline borders, translucent cards, and a single
   accent of inverted white chips (white fill / black digit). The SVG is
   transparent; the chat's <VisualCard> supplies the frame & background.
   ──────────────────────────────────────────────────────────────────────── */
const W = 520;
const FONT = "Inter,system-ui,sans-serif";
const INK = "#FAFAFA"; // primary text / accents (foreground)
const SUB = "#A1A1AA"; // secondary text (muted-foreground)
const FAINT = "#71717A"; // tertiary text
const LINE = "rgba(255,255,255,0.10)"; // hairline border
const LINE2 = "rgba(255,255,255,0.18)"; // stronger hairline / connectors
const CARD = "rgba(255,255,255,0.025)"; // card fill
const CARD2 = "rgba(255,255,255,0.05)"; // elevated fill
const CHIP_TXT = "#0A0A0A"; // digit colour inside white chips

const esc = (s: string) =>
  (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function svg(title: string, body: string, h: number): string {
  return `<svg viewBox="0 0 ${W} ${h}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block" xmlns="http://www.w3.org/2000/svg">
<line x1="20" y1="21" x2="27" y2="21" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
<text x="33" y="24.5" font-family="${FONT}" font-size="9" fill="${SUB}" letter-spacing="0.18em" font-weight="700">${esc(title.toUpperCase().slice(0, 42))}</text>
${body}
</svg>`;
}

// break text at word boundary into two lines
function wrap(s: string, n: number): [string, string] {
  const t = (s ?? "").trim();
  if (t.length <= n) return [t, ""];
  const idx = t.lastIndexOf(" ", n);
  const cut = idx > 0 ? idx : n;
  const l1 = t.slice(0, cut).trim();
  const rem = t.slice(cut).trim();
  const lim = n + 10;
  if (rem.length <= lim) return [l1, rem];
  const idx2 = rem.lastIndexOf(" ", lim);
  return [l1, idx2 > 0 ? rem.slice(0, idx2) : rem.slice(0, lim)];
}

// white chip with a black digit — the one recurring accent
const chip = (cx: number, cy: number, r: number, n: number | string, fs: number) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${INK}"/>
<text x="${cx}" y="${cy + fs * 0.35}" text-anchor="middle" font-family="${FONT}" font-size="${fs}" fill="${CHIP_TXT}" font-weight="800">${n}</text>`;

// up to 3 stacked authority rows — only render the tiers that have real content
const HIERARCHY = (_t: string, tiers: [string, string][]) => {
  const rows = (tiers ?? []).filter((t) => t && t[0] && t[0].trim());
  const n = Math.min(rows.length, 3);
  const rowH = 54,
    gap = 10,
    startY = 36;
  const totalH = startY + n * rowH + Math.max(0, n - 1) * gap + 16;
  let body = "";
  for (let i = 0; i < n; i++) {
    const y = startY + i * (rowH + gap);
    const [head, note] = rows[i];
    const [n1, n2] = wrap(note, 60);
    const hasTwo = n2.length > 0;
    const titleY = hasTwo ? y + 19 : y + rowH / 2 - 2;
    const d1Y = titleY + 15;
    const d2Y = d1Y + 13;
    body += `<rect x="14" y="${y}" width="492" height="${rowH}" rx="10" fill="${CARD}" stroke="${LINE}"/>
<rect x="14" y="${y}" width="2.5" height="${rowH}" rx="1.25" fill="${INK}"/>
${chip(486, y + rowH / 2, 11, i + 1, 10)}
<text x="28" y="${titleY + 4}" font-family="${FONT}" font-size="12.5" fill="${INK}" font-weight="700">${esc(head.slice(0, 38))}</text>
<text x="28" y="${d1Y + 4}" font-family="${FONT}" font-size="9.5" fill="${SUB}">${esc(n1)}</text>
${hasTwo ? `<text x="28" y="${d2Y + 4}" font-family="${FONT}" font-size="9.5" fill="${SUB}">${esc(n2)}</text>` : ""}`;
    if (i < n - 1) {
      const arY = y + rowH + 1;
      body += `<line x1="260" y1="${arY}" x2="260" y2="${arY + gap - 1}" stroke="${LINE2}" stroke-width="1"/>`;
    }
  }
  return { body, h: totalH };
};

// up to 3 concept columns — only render the items that have real content
const PILLARS = (_t: string, items: [string, string][]) => {
  const cols = (items ?? []).filter((it) => it && it[0] && it[0].trim());
  const n = Math.min(cols.length, 3);
  const cw = 150,
    gap = 21,
    startY = 36,
    cardH = 170,
    totalH = startY + cardH + 16;
  const startX = (W - (n * cw + Math.max(0, n - 1) * gap)) / 2;
  let body = "";
  for (let i = 0; i < n; i++) {
    const x = startX + i * (cw + gap);
    const [head, sub] = cols[i];
    const [s1, s2] = wrap(sub, 20);
    const [s3] = s2.length > 0 ? wrap(s2, 20) : ["", ""];
    body += `<rect x="${x}" y="${startY}" width="${cw}" height="${cardH}" rx="12" fill="${CARD}" stroke="${LINE}"/>
<rect x="${x}" y="${startY}" width="${cw}" height="2.5" rx="1.25" fill="${INK}"/>
<circle cx="${x + cw / 2}" cy="${startY + 47}" r="17" fill="none" stroke="${LINE2}"/>
${chip(x + cw / 2, startY + 47, 11, i + 1, 10)}
<text x="${x + cw / 2}" y="${startY + 87}" text-anchor="middle" font-family="${FONT}" font-size="11.5" fill="${INK}" font-weight="700">${esc(head.slice(0, 15))}</text>
<line x1="${x + 20}" y1="${startY + 98}" x2="${x + cw - 20}" y2="${startY + 98}" stroke="${LINE}"/>
<text x="${x + cw / 2}" y="${startY + 115}" text-anchor="middle" font-family="${FONT}" font-size="9.5" fill="${SUB}">${esc(s1)}</text>
${s3 ? `<text x="${x + cw / 2}" y="${startY + 129}" text-anchor="middle" font-family="${FONT}" font-size="9.5" fill="${SUB}">${esc(s3)}</text>` : ""}`;
  }
  return { body, h: totalH };
};

// horizontal steps with arrows
const FLOW = (_t: string, steps: string[]) => {
  const n = Math.min(steps.length, 4);
  const w = 104,
    gap = 22,
    startX = (W - (n * w + (n - 1) * gap)) / 2;
  const startY = 36,
    cardH = 108,
    totalH = startY + cardH + 22;
  let body = "";
  for (let i = 0; i < n; i++) {
    const x = startX + i * (w + gap);
    const [l1, l2] = wrap(steps[i], 13);
    body += `<rect x="${x}" y="${startY}" width="${w}" height="${cardH}" rx="11" fill="${CARD}" stroke="${LINE}"/>
<rect x="${x}" y="${startY}" width="${w}" height="2.5" rx="1.25" fill="${INK}"/>
${chip(x + w / 2, startY + 38, 14, i + 1, 12)}
<text x="${x + w / 2}" y="${startY + (l2 ? 75 : 81)}" text-anchor="middle" font-family="${FONT}" font-size="10.5" fill="${INK}" font-weight="600">${esc(l1)}</text>
${l2 ? `<text x="${x + w / 2}" y="${startY + 89}" text-anchor="middle" font-family="${FONT}" font-size="10.5" fill="${SUB}">${esc(l2)}</text>` : ""}`;
    if (i < n - 1) {
      const ax = x + w + 4;
      const my = startY + cardH / 2;
      body += `<line x1="${ax}" y1="${my}" x2="${ax + gap - 8}" y2="${my}" stroke="${LINE2}" stroke-width="1.5"/>
<polygon points="${ax + gap - 8},${my - 3.5} ${ax + gap - 2},${my} ${ax + gap - 8},${my + 3.5}" fill="${SUB}"/>`;
    }
  }
  return { body, h: totalH };
};

// stat cards for figures and rates
const STATS = (_t: string, stats: [string, string, string][]) => {
  const n = Math.min(stats.length, 4);
  const w = n === 2 ? 218 : n === 3 ? 142 : 108;
  const gap = n === 2 ? 44 : n === 3 ? 22 : 16;
  const startX = (W - (n * w + (n - 1) * gap)) / 2;
  const startY = 36,
    cardH = 150,
    totalH = startY + cardH + 16;
  let body = "";
  for (let i = 0; i < n; i++) {
    const x = startX + i * (w + gap);
    const [val, label, desc] = stats[i];
    body += `<rect x="${x}" y="${startY}" width="${w}" height="${cardH}" rx="12" fill="${CARD}" stroke="${LINE}"/>
<rect x="${x}" y="${startY}" width="${w}" height="2.5" rx="1.25" fill="${INK}"/>
<text x="${x + w / 2}" y="${startY + 76}" text-anchor="middle" font-family="${FONT}" font-size="30" fill="${INK}" font-weight="800" letter-spacing="-0.02em">${esc(val.slice(0, 10))}</text>
<text x="${x + w / 2}" y="${startY + 94}" text-anchor="middle" font-family="${FONT}" font-size="9" fill="${SUB}" letter-spacing="0.08em">${esc(label.slice(0, 20).toUpperCase())}</text>
<line x1="${x + w * 0.2}" y1="${startY + 105}" x2="${x + w * 0.8}" y2="${startY + 105}" stroke="${LINE}"/>
<text x="${x + w / 2}" y="${startY + 121}" text-anchor="middle" font-family="${FONT}" font-size="9" fill="${FAINT}">${esc(desc.slice(0, 24))}</text>`;
  }
  return { body, h: totalH };
};

// central idea with surrounding concepts
const CONCEPT = (_t: string, centre: string, satellites: string[]) => {
  const n = Math.min(satellites.length, 4);
  const pos: [number, number][] = [
    [110, 78],
    [410, 78],
    [110, 192],
    [410, 192],
  ];
  const [c1, c2] = wrap(centre, 14);
  const totalH = 268;
  let body = `<ellipse cx="260" cy="135" rx="72" ry="44" fill="${CARD2}" stroke="${LINE2}" stroke-width="1.5"/>
<text x="260" y="${c2 ? "130" : "139"}" text-anchor="middle" font-family="${FONT}" font-size="12.5" fill="${INK}" font-weight="700">${esc(c1)}</text>
${c2 ? `<text x="260" y="146" text-anchor="middle" font-family="${FONT}" font-size="11" fill="${INK}">${esc(c2)}</text>` : ""}`;
  for (let i = 0; i < n; i++) {
    const [sx, sy] = pos[i];
    const [l1, l2] = wrap(satellites[i], 18);
    const cardH = l2 ? 46 : 34;
    const lx = sx < 260 ? sx + 56 : sx - 56;
    const ly = sy < 135 ? 110 : 160;
    body += `<line x1="${lx}" y1="${ly}" x2="${sx < 260 ? 190 : 330}" y2="135" stroke="${LINE2}" stroke-width="1" stroke-dasharray="3 4"/>
<rect x="${sx - 58}" y="${sy - cardH / 2}" width="116" height="${cardH}" rx="10" fill="${CARD}" stroke="${LINE}"/>
<rect x="${sx - 58}" y="${sy - cardH / 2}" width="116" height="2.5" rx="1.25" fill="${INK}"/>
<text x="${sx}" y="${sy + (l2 ? -4 : 4)}" text-anchor="middle" font-family="${FONT}" font-size="10.5" fill="${INK}" font-weight="600">${esc(l1)}</text>
${l2 ? `<text x="${sx}" y="${sy + 11}" text-anchor="middle" font-family="${FONT}" font-size="9.5" fill="${SUB}">${esc(l2)}</text>` : ""}`;
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

    // No real content extracted → don't render an empty frame
    if (!result.body.trim()) return NextResponse.json({ svg: null });

    return NextResponse.json({ svg: svg(data.title, result.body, result.h) });
  } catch {
    return NextResponse.json({ svg: null });
  }
}
