// When each item in an explainer scene should appear: as the narrator starts talking about it.
//
// An item's words (label, value, detail) are looked for in the narration, allowing for different
// endings ("supervises" / "supervisors") and spelt-out acronyms ("FCA" / "Financial Conduct
// Authority"). The items are placed in order, each at the clause where it is first mentioned;
// an item never mentioned goes evenly between its neighbours.

import type { ExplainerItem } from './explainer'
import { textTokens } from './lipSync'

const STOP = new Set((
  'a an the and or but of to in on at by for from with as is are was were be been being it its this that these those ' +
  'they their them you your we our us he she his her can will may must not no so if than then there here which who ' +
  'what when how all any each more most such into out up per also only just do does did has have had about over under'
).split(' '))

const WINDOW = 8 // words after a mention that can still count towards it
const LABEL = 1
const VALUE = 1.5
const DETAIL = 0.4
const ENOUGH = 0.9 // an item needs about one label word (or a value) to count as mentioned

const NUMBERS: Record<string, string> = Object.fromEntries((
  'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen ' +
  'seventeen eighteen nineteen twenty'
).split(' ').map((w, i) => [w, String(i)]))
// "Four" and "4" are the same word
const clean = (w: string) => {
  const s = w.toLowerCase().replace(/[^a-z0-9]/g, '')
  return NUMBERS[s] ?? s
}
// Words sharing their first five letters count as the same word
const stem = (w: string) => (w.length > 5 ? w.slice(0, 5) : w.replace(/(es|s)$/, '') || w)
const acronymOf = (w: string) => {
  const letters = w.replace(/[^A-Za-z]/g, '')
  return /^[A-Z]{2,6}s?$/.test(letters) ? letters.replace(/s$/, '').toLowerCase() : ''
}

interface Key { stem?: string; acronym?: string; weight: number }

function keysOf(text: string, weight: number): Key[] {
  const keys: Key[] = []
  for (const raw of text.split(/[\s/–—-]+/)) {
    const acronym = acronymOf(raw)
    if (acronym) { keys.push({ acronym, weight }); continue }
    const w = clean(raw)
    if (!w || STOP.has(w) || (w.length < 3 && !/\d/.test(w))) continue
    keys.push({ stem: stem(w), weight })
  }
  return keys
}

/** For each item, the point in the narration (0 to 1, in subtitle words) at which it should appear. */
export function itemCues(narration: string, items: ExplainerItem[]): number[] {
  const tokens = textTokens(narration)
  const T = tokens.length
  const n = items.length
  if (!n) return []
  if (!T) return items.map(() => 0)

  // What each narration word offers: its stems, and the letters it adds to an acronym
  const stems = tokens.map((t) => new Set(t.split(/[/–—-]+/).map(clean).filter(Boolean).map(stem)))
  const letters: Array<{ ch: string; token: number }> = []
  tokens.forEach((t, token) => {
    for (const part of t.split(/[/–—-]+/)) {
      const acronym = acronymOf(part)
      const w = clean(part)
      if (acronym) for (const ch of acronym) letters.push({ ch, token })
      else if (w && !STOP.has(w)) letters.push({ ch: w[0], token })
    }
  })
  // An acronym spelt out from this word on ("Financial Conduct Authority" for FCA)
  const acronymAt = (acronym: string, token: number) => {
    const i = letters.findIndex((l) => l.token === token)
    return i >= 0 && acronym.split('').every((ch, k) => letters[i + k]?.ch === ch)
  }
  const matches = (key: Key, token: number) => key.stem ? stems[token].has(key.stem) : acronymAt(key.acronym!, token)

  // Each item's words, strongest first. A word several items share ("threshold" in three of them) says
  // little about which one is meant, so it counts for less; a figure says the most.
  const id = (k: Key) => k.stem ?? `#${k.acronym}`
  const keyLists = items.map((item) => {
    const all = [
      ...keysOf(item.label, LABEL),
      ...keysOf(item.value, VALUE).map((k) => (k.stem && /^\d/.test(k.stem) ? k : { ...k, weight: LABEL })),
      ...keysOf(item.detail, DETAIL),
    ]
    return all.filter((k, i) => all.findIndex((o) => id(o) === id(k)) === i)
  })
  const shared = new Map<string, number>()
  for (const keys of keyLists) for (const k of keys) if (k.weight >= LABEL) shared.set(id(k), (shared.get(id(k)) ?? 0) + 1)
  const weightOf = (k: Key) => (k.weight >= LABEL ? k.weight / (shared.get(id(k)) ?? 1) : k.weight)

  // How strongly each item is mentioned starting at each word
  const score = keyLists.map((keys) => {
    return tokens.map((_, p) => {
      // A mention starts on one of the item's own words, not one most items share; its detail only adds weight
      if (!keys.some((k) => k.weight >= LABEL && weightOf(k) >= 0.5 && matches(k, p))) return 0
      let total = 0
      for (const k of keys) {
        for (let q = p; q < Math.min(T, p + WINDOW); q++) if (matches(k, q)) { total += weightOf(k); break }
      }
      return total >= ENOUGH ? total : 0
    })
  })

  // Place the items in order, as strongly mentioned as possible, each at its earliest good mention
  const memo = new Map<string, { value: number; at: number[] }>()
  const place = (i: number, after: number): { value: number; at: number[] } => {
    if (i === n) return { value: 0, at: [] }
    const id = `${i}:${after}`
    const hit = memo.get(id)
    if (hit) return hit
    const skip = place(i + 1, after)
    let best = { value: skip.value, at: [-1, ...skip.at] }
    for (let p = Math.max(0, after); p < T; p++) {
      if (!score[i][p]) continue
      const rest = place(i + 1, p)
      const value = score[i][p] - 1e-4 * p + rest.value
      if (value > best.value) best = { value, at: [p, ...rest.at] }
    }
    memo.set(id, best)
    return best
  }
  const at = place(0, -1).at

  // Show an item as the clause that mentions it begins, when that is only a few words earlier
  const clauseStart = (p: number) => {
    let c = p
    while (c > 0 && !/[.!?,;:]["'’”)]*$/.test(tokens[c - 1])) c--
    return c
  }
  let previous = -1
  for (let i = 0; i < n; i++) {
    if (at[i] < 0) continue
    const c = clauseStart(at[i])
    if (at[i] - c <= 4 && c > previous) at[i] = c
    previous = at[i]
  }

  // Items never mentioned go evenly between their neighbours (or, with none mentioned, through the first three quarters)
  const known = at.flatMap((p, i) => (p >= 0 ? [i] : []))
  const end = 0.8 * T
  const placed = at.map((p, i) => {
    if (p >= 0) return p
    if (!known.length) return (i / n) * 0.75 * T
    const before = [...known].reverse().find((k) => k < i)
    const after = known.find((k) => k > i)
    const [i0, p0] = before === undefined ? [-1, 0] : [before, at[before]]
    const [i1, p1] = after === undefined ? [n, Math.max(end, p0)] : [after, at[after]]
    return p0 + ((i - i0) / (i1 - i0)) * (p1 - p0)
  })
  return placed.map((p) => Math.min(1, Math.max(0, p / T)))
}
