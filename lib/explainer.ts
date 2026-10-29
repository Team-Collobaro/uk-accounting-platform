// Narrated explainer videos, generated once by scripts/build-explainers.mjs:
// module intros in lib/explainers.json (key "m23"), lesson sections in lib/section-explainers.json (key "m23/s02").
// Types only: keep the JSON imports in server code so the stores never ship to the browser.

export type ExplainerKind =
  | 'title' | 'stats' | 'steps' | 'compare' | 'timeline' | 'cards' | 'example' | 'warning' | 'checklist'

export interface ExplainerItem {
  label: string
  value: string
  detail: string
  icon: string
}

export interface ExplainerScene {
  kind: ExplainerKind
  heading: string
  subheading: string
  icon: string
  narration: string
  items: ExplainerItem[]
}

export interface StoredExplainer {
  sourceHash: string
  model: string
  scenes: ExplainerScene[]
}
