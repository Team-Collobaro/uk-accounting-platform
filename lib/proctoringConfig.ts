export interface ProctoringConfig {
  devMode: boolean
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
