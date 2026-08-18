import { useState, useEffect, useCallback } from 'react'
import defaultConfigJson from '@/config/proctoring.config.json'

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

export const DEFAULT_PROCTORING_CONFIG: ProctoringConfig = defaultConfigJson as ProctoringConfig

const EVENT_NAME = 'dev_proctoring_config_updated'

// Clear any legacy localStorage to ensure proctoring.config.json is the single source of truth
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('dev_proctoring_config')
  } catch (_) {}
}

export function saveProctoringConfigFile(config: ProctoringConfig) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: config }))
  
  // Real-time disk sync
  fetch('/api/dev-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  }).catch((err) => {
    console.warn('Failed to sync proctoring config to disk file:', err)
  })
}

export function useProctoringConfig(): {
  config: ProctoringConfig
  updateConfig: (updater: (prev: ProctoringConfig) => ProctoringConfig) => void
  setConfig: (newConfig: ProctoringConfig) => void
  resetConfig: () => void
} {
  const [config, setLocalConfig] = useState<ProctoringConfig>(defaultConfigJson as ProctoringConfig)

  // Keep state updated if defaultConfigJson updates via HMR (file edited on disk)
  useEffect(() => {
    setLocalConfig(defaultConfigJson as ProctoringConfig)
  }, [defaultConfigJson])

  useEffect(() => {
    const handleUpdate = (e: CustomEvent<ProctoringConfig>) => {
      if (e.detail) {
        setLocalConfig(e.detail)
      }
    }

    window.addEventListener(EVENT_NAME as any, handleUpdate)
    return () => {
      window.removeEventListener(EVENT_NAME as any, handleUpdate)
    }
  }, [])

  const setConfig = useCallback((newConfig: ProctoringConfig) => {
    setLocalConfig(newConfig)
    saveProctoringConfigFile(newConfig)
  }, [])

  const updateConfig = useCallback((updater: (prev: ProctoringConfig) => ProctoringConfig) => {
    setLocalConfig((prev) => {
      const next = updater(prev)
      saveProctoringConfigFile(next)
      return next
    })
  }, [])

  return {
    config,
    updateConfig,
    setConfig,
    resetConfig: useCallback(() => {
      fetch('/api/dev-config')
        .then((r) => r.json())
        .then((data) => {
          setLocalConfig(data)
          window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: data }))
        })
        .catch(() => setLocalConfig(defaultConfigJson as ProctoringConfig))
    }, []),
  }
}
