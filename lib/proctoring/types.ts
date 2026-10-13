export type DetectionSeverity = 'info' | 'soft' | 'warning' | 'hard' | 'technical'

export type DetectionSource =
  | 'laptop_local'
  | 'mobile_local'
  | 'browser_protection'
  | 'fused_mediapipe'
  | 'system'

export type IncidentType =
  | 'second_person'
  | 'student_missing'
  | 'gaze_away'
  | 'camera_obstructed'
  | 'camera_stalled'
  | 'detector_unavailable'
  | 'suspicious_object'
  | 'second_phone'
  | 'second_monitor'
  | 'notes_visible'
  | 'tab_switch'
  | 'static_image_spoof'
  | 'student_mismatch'
  | 'distance_invalid'
  | 'camera_moved'
  | 'mobile_session_ended'

export interface DetectionObservation {
  at: number // unix ms timestamp
  detected: boolean
  confidence?: number
  agreeingSources?: number
}

export type DetectionPhase = 'clear' | 'suspected' | 'confirmed'

export type DetectionTransition =
  | 'none'
  | 'warning'
  | 'warningCleared'
  | 'confirmed'
  | 'resolved'

export interface DetectionPolicyConfig {
  warningPositives?: number
  warningWindowMs?: number
  strongConfirmPositives?: number
  strongConfirmWindowMs?: number
  weakConfirmPositives?: number
  weakConfirmWindowMs?: number
  strongConfidence?: number
  recoveryMs?: number
  maxHistory?: number
}

export interface DetectionIncident {
  id?: string
  incidentKey: string
  type: IncidentType | string
  severity: DetectionSeverity
  confidence?: number
  description: string
  source: DetectionSource | string
  occurredAt: string
  personCount?: number
  metadata?: Record<string, any>
}

export interface DetectorHealth {
  isReady: boolean
  isGpuAccelerated: boolean
  lastInferenceMs?: number
  error?: string
}
