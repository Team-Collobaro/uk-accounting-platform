// Generates the narrated "video explainer" storyboards and stores them, so the app never has to
// generate them at runtime:
//   module intros   -> lib/explainers.json          (key: m23)
//   lesson sections -> lib/section-explainers.json  (key: m23/s02), with --sections
//
// Usage:
//   node --env-file=.env.local scripts/build-explainers.mjs                         # all module intros not yet generated
//   node --env-file=.env.local scripts/build-explainers.mjs m23 m24                 # only these modules
//   node --env-file=.env.local scripts/build-explainers.mjs --force m23             # regenerate even if stored
//   node --env-file=.env.local scripts/build-explainers.mjs --sections              # every lesson section
//   node --env-file=.env.local scripts/build-explainers.mjs --sections m23 m01/s02  # sections of m23, and m01 section s02
//
// An item is skipped when its stored storyboard was made from the same source text (hash match).

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'

// Sonnet is accurate enough with the strict prompt below at half Opus's price; set EXPLAINER_MODEL to override
const MODEL = process.env.EXPLAINER_MODEL ?? 'claude-sonnet-5-5'
const CONCURRENCY = 4

const KINDS = ['title', 'stats', 'steps', 'compare', 'timeline', 'cards', 'example', 'warning', 'checklist']
// Must match the icon map in components/ModuleExplainer.tsx
const ICONS = [
  'Building2', 'Building', 'Store', 'Factory', 'Briefcase', 'Users', 'User', 'UserCheck', 'UserX', 'UserPlus', 'UserMinus',
  'PiggyBank', 'Wallet', 'Banknote', 'Coins', 'HandCoins', 'PoundSterling', 'Percent', 'Calculator', 'Receipt', 'CreditCard',
  'Calendar', 'CalendarClock', 'CalendarCheck', 'Clock', 'Timer', 'Hourglass', 'FileText', 'FileCheck', 'FileWarning',
  'ClipboardCheck', 'ClipboardList', 'Scale', 'Gavel', 'Landmark', 'ShieldCheck', 'ShieldAlert', 'AlertTriangle', 'Ban',
  'TrendingUp', 'TrendingDown', 'BarChart3', 'PieChart', 'LineChart', 'ArrowRightLeft', 'RefreshCw', 'RotateCcw',
  'CheckCircle2', 'XCircle', 'HelpCircle', 'Lightbulb', 'BookOpen', 'GraduationCap', 'Target', 'Search', 'Lock', 'Key',
  'Database', 'Laptop', 'Globe', 'Mail', 'Send', 'Handshake', 'Truck', 'Package', 'ShoppingCart', 'Home', 'Car', 'Layers',
  'Split', 'Stamp', 'Flag', 'Network', 'Workflow', 'Sparkles',
]

const item = {
  type: 'object',
  additionalProperties: false,
  required: ['label', 'value', 'detail', 'icon'],
  properties: {
    label: { type: 'string' },
    value: { type: 'string' },
    detail: { type: 'string' },
    icon: { type: 'string', enum: ICONS },
  },
}
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['scenes'],
  properties: {
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'heading', 'subheading', 'icon', 'narration', 'items'],
        properties: {
          kind: { type: 'string', enum: KINDS },
          heading: { type: 'string' },
          subheading: { type: 'string' },
          icon: { type: 'string', enum: ICONS },
          narration: { type: 'string' },
          items: { type: 'array', items: item },
        },
      },
    },
  },
}

const BRIEF = {
  module: `You turn the introduction of a UK accounting course module into the storyboard for a short narrated explainer video (about 60-90 seconds).`,
  section: `You turn one lesson section of a UK accounting course into the storyboard for a short narrated explainer video. The AI tutor plays it to the learner at the start of the section, then teaches the section in conversation, so the video must cover every key point of the section, in the order the section gives them.`,
}
const SHAPE = {
  module: `- 5 to 7 scenes. Scene 1 is kind "title": what this topic is and why it matters. The last scene is kind "checklist": what the module covers.`,
  section: `- 3 to 6 scenes, depending on how much the section contains (a short section needs only 3). Scene 1 is kind "title": what this section is about and why it matters. The last scene is kind "checklist": the key takeaways of this section.
- Tables in the source are the facts to teach: keep their exact figures, ages, thresholds and wording.`,
}

const systemFor = (type) => `${BRIEF[type]} Each scene is an animated slide with on-screen text, icons and a spoken narration that is also shown as subtitles.

Accuracy comes first. Learners are training to be accountants.
- Use only facts, figures, names and dates that appear in the source text. Never add a rate, threshold, amount, deadline or rule that is not in it.
- Do not invent calculations. An "example" scene describes a realistic situation in words and may only use figures from the source.
- If the source text is awkwardly worded, say the same thing clearly; do not change its meaning.

Storyboard:
${SHAPE[type]}
- In between, pick the kind that best shows each idea:
  stats - key figures (1-4 items: value = the figure, e.g. "3%", "£400"; label = what it is; detail = context)
  steps - a process in order (2-5 items: label = step, detail = short explanation)
  compare - two sides or options (exactly 2 items)
  timeline - deadlines or periods in time order (2-5 items: value = when, e.g. "3 months")
  cards - categories or options (2-4 items)
  example - a short real-world scenario (2-4 items, each a line of the story)
  warning - penalties or risks, mildest first (1-3 items: value = the figure)
  checklist - 3-6 items, label only
- Don't use the same kind twice in a row.

Text limits (on-screen text must be short; it is read at a glance):
- heading: max 44 characters. subheading: max 80 characters (title scene only; "" elsewhere).
- item label: max 28 characters. item value: max 12 characters ("" if none). item detail: max 60 characters ("" if none).
- title and checklist scenes: items as described; title scene has no items.
- Pick the closest icon for each scene and item.

Narration:
- Spoken by a friendly British tutor to a trainee: plain, warm, direct. 1-2 sentences, max 230 characters per scene.
- It talks about what is on screen in that scene, adding the "why" where the source gives it.
- Write it to be read aloud: no brackets, no slashes, no bullet symbols, no abbreviations a listener would not know without first saying them in full.`

const hashOf = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16)
const clip = (s, n) => {
  s = String(s ?? '').replace(/\s+/g, ' ').trim()
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s
}

function sanitize(raw) {
  const scenes = (raw?.scenes ?? [])
    .filter((s) => KINDS.includes(s?.kind) && String(s?.narration ?? '').trim())
    .slice(0, 8)
    .map((s) => ({
      kind: s.kind,
      heading: clip(s.heading, 60),
      subheading: clip(s.subheading, 110),
      icon: ICONS.includes(s.icon) ? s.icon : 'Sparkles',
      narration: clip(s.narration, 320),
      items: (s.items ?? []).slice(0, 6).map((i) => ({
        label: clip(i.label, 40),
        value: clip(i.value, 16),
        detail: clip(i.detail, 80),
        icon: ICONS.includes(i.icon) ? i.icon : 'CheckCircle2',
      })),
    }))
  if (scenes.length < 3) throw new Error(`only ${scenes.length} usable scenes`)
  return scenes
}

const client = new Anthropic()

async function generate(job) {
  const response = await client.messages.create(
    {
      model: MODEL,
      max_tokens: 16000,
      system: systemFor(job.type),
      messages: [{ role: 'user', content: job.prompt }],
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      fallbacks: 'default',
    },
    { headers: { 'anthropic-beta': 'server-side-fallback-2026-07-01' } },
  )
  if (response.stop_reason === 'refusal') throw new Error('model declined')
  if (response.stop_reason === 'max_tokens') throw new Error('output truncated')
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  return { scenes: sanitize(JSON.parse(text)), usage: response.usage, model: response.model }
}

// Section HTML as readable text: keeps table rows and list items on their own lines
const htmlToText = (html) => html
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<\/(td|th)>/gi, ' | ')
  .replace(/<li[^>]*>/gi, '• ')
  .replace(/<\/(tr|p|li|h\d|div|ul|ol|table)>|<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  .replace(/[^\S\n]+/g, ' ').replace(/ *\n[\s]*/g, '\n').replace(/ \|\n/g, '\n').trim()

// ── Main ──
const args = process.argv.slice(2)
const force = args.includes('--force')
const sectionsMode = args.includes('--sections')
const only = args.filter((a) => /^(m\d{2}|app[A-Z])(\/s\d{2})?$/.test(a))
const wanted = (key) => !only.length || only.some((o) => key === o || key.startsWith(`${o}/`))

const OUT = sectionsMode ? 'lib/section-explainers.json' : 'lib/explainers.json'
const course = JSON.parse(readFileSync('lib/courseDataRaw.json', 'utf8'))
const jobs = sectionsMode
  ? course.flatMap((m) => (m.sections ?? []).map((s) => {
      const text = htmlToText(s.contentHtml ?? '')
      return {
        type: 'section', key: `${m.id}/${s.id}`, label: `${m.id}/${s.id} ${s.title}`, source: text,
        skip: s.title.trim().toLowerCase() === 'knowledge check' || text.length < 60,
        prompt: `Module ${m.id.replace(/^m0?/, '')}: ${m.title}\nSection ${s.title}\n\nSection content:\n${text.slice(0, 12000)}`,
      }
    }))
  : course.map((m) => {
      const intro = (m.hookText ?? '').replace(/\s+/g, ' ').trim()
      return {
        type: 'module', key: m.id, label: `${m.id} ${m.title}`, source: m.hookText ?? '', skip: !intro,
        prompt: `Module ${m.id.slice(1)}: ${m.title}\n\nIntroduction:\n${intro}`,
      }
    })
const candidates = jobs.filter((j) => !j.skip && wanted(j.key))
const store = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}

const todo = candidates.filter((j) => force || store[j.key]?.sourceHash !== hashOf(j.source))
console.log(`${candidates.length} ${sectionsMode ? 'sections' : 'module intros'}, ${todo.length} to generate with ${MODEL}`)

let done = 0, failed = 0, inTok = 0, outTok = 0
const save = () => {
  const sorted = Object.fromEntries(Object.keys(store).sort().map((k) => [k, store[k]]))
  writeFileSync(OUT, JSON.stringify(sorted, null, 1) + '\n')
}

const queue = [...todo]
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const job = queue.shift()
    try {
      const { scenes, usage, model } = await generate(job)
      store[job.key] = { sourceHash: hashOf(job.source), model, scenes }
      inTok += usage.input_tokens; outTok += usage.output_tokens
      done++
      save() // save after each item so an interrupted run keeps its progress
      console.log(`✓ ${job.label} (${scenes.length} scenes)`)
    } catch (err) {
      failed++
      console.error(`✗ ${job.label}: ${err.message}`)
    }
  }
}))

console.log(`Done: ${done} generated, ${failed} failed. Tokens: ${inTok} in, ${outTok} out.`)
if (failed) process.exitCode = 1
