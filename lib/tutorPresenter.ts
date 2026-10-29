// Lets the AI tutor present the explainer videos (module intro and each lesson section): a video
// publishes its narration state and loudness, the tutor's hologram speaks along with it, and the
// tutor carries on teaching afterwards. Each video has an id: the module id ("m23") for the intro,
// "m23/s02" for a section.

export const EXPLAINER_EVENTS = {
  /** A video started narrating (detail: ExplainerIdDetail); the tutor and other videos go quiet. */
  play: 'explainer:play',
  /** Video narration state changed (detail: ExplainerStateDetail). */
  state: 'explainer:state',
  /** The tutor asks a video to start presenting (detail: ExplainerIdDetail). */
  present: 'explainer:present',
  /** The tutor's play/pause buttons (detail: ExplainerControlDetail). */
  control: 'explainer:control',
  /** The tutor started talking; the video pauses. */
  tutorSpeaking: 'tutor:speaking',
} as const

export interface ExplainerIdDetail {
  id: string
}

export interface ExplainerStateDetail {
  id: string
  state: 'playing' | 'paused' | 'ended' | 'stopped'
  /** The narration is audible right now (false while a clip is still loading) */
  voiced?: boolean
  scene: number
  total: number
  heading: string
}

export interface ExplainerControlDetail {
  /** Only this video; every video when omitted */
  id?: string
  action: 'play' | 'pause'
}

/** The tutor finished teaching the section; the page marks it done and opens the next one. */
export const SECTION_COMPLETE_EVENT = 'lesson:section-complete'

/** Key of a lesson section's explainer video */
export const sectionVideoId = (moduleId: string, sectionId: string) => `${moduleId}/${sectionId}`

// Loudness (0 to 1) of the narration currently playing, for the hologram's jaw
const levelSources = new Map<string, () => number>()

export function setPresenterLevelSource(id: string, fn: (() => number) | null) {
  if (fn) levelSources.set(id, fn)
  else levelSources.delete(id)
}

export function presenterLevel(): number {
  let level = 0
  levelSources.forEach((fn) => {
    try { level = Math.max(level, fn()) } catch { /* ignore a broken source */ }
  })
  return level
}
