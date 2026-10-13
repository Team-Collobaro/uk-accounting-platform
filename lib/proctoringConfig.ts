export interface ProctoringConfig {
  devMode: boolean
  policy?: {
    version: number
    personAnalysisIntervalMs: number
    secondaryAnalysisIntervalMs: number
    warningWindowMs: number
    strongConfirmPositives: number
    strongConfirmWindowMs: number
    weakConfirmPositives: number
    weakConfirmWindowMs: number
    recoveryMs: number
    staleFrameTimeoutMs: number
    minConfidence: number
  }
  laptop: {
    cameraFeed: boolean
    microphoneFeed: boolean
    facePresenceDetection: boolean
    multiplePeopleDetection: boolean
    gazeTracking: boolean
    livenessCheck: boolean
    forbiddenObjectDetection: boolean
    audioNoiseDetection: boolean
    audioCountdownBlur: boolean
  }
  browserGuards: {
    tabSwitchBlur: boolean
    multiMonitorDetection: boolean
    screenshotProtection: boolean
    clipboardCopyProtection: boolean
  }
  gates: {
    bypassIntegrityAgreement: boolean
    bypassMobileCameraRequired: boolean
  }
  mobile: {
    cameraFeed: boolean
    mlKitObjectDetection: boolean
    studentMissingWatchdog: boolean
    livenessDetection: boolean
    claudeTier2Verification: boolean
    supabaseBroadcast: boolean
    heartbeatWatchdog: boolean
    wakelock: boolean
  }
}

// Fixed proctoring defaults; developer overrides and disk persistence have been removed.
export const DEFAULT_PROCTORING_CONFIG: ProctoringConfig = {
  "devMode": false,
  "policy": {
    "version": 1,
    "personAnalysisIntervalMs": 500,
    "secondaryAnalysisIntervalMs": 1500,
    "warningWindowMs": 1500,
    "strongConfirmPositives": 2,
    "strongConfirmWindowMs": 1000,
    "weakConfirmPositives": 3,
    "weakConfirmWindowMs": 1500,
    "recoveryMs": 3500,
    "staleFrameTimeoutMs": 8000,
    "minConfidence": 0.35
  },
  "laptop": {
    "cameraFeed": true,
    "microphoneFeed": true,
    "facePresenceDetection": true,
    "multiplePeopleDetection": true,
    "gazeTracking": true,
    "livenessCheck": true,
    "forbiddenObjectDetection": true,
    "audioNoiseDetection": true,
    "audioCountdownBlur": false
  },
  "browserGuards": {
    "tabSwitchBlur": true,
    "multiMonitorDetection": false,
    "screenshotProtection": true,
    "clipboardCopyProtection": true
  },
  "gates": {
    "bypassIntegrityAgreement": false,
    "bypassMobileCameraRequired": false
  },
  "mobile": {
    "cameraFeed": true,
    "mlKitObjectDetection": true,
    "studentMissingWatchdog": true,
    "livenessDetection": true,
    "claudeTier2Verification": true,
    "supabaseBroadcast": true,
    "heartbeatWatchdog": true,
    "wakelock": true
  }
}

export function useProctoringConfig(): { config: ProctoringConfig } {
  return { config: DEFAULT_PROCTORING_CONFIG }
}
