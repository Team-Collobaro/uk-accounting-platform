'use client'

import React, { useEffect, useRef, useState } from 'react'
import { FaceLandmarker, FilesetResolver, ObjectDetector } from '@mediapipe/tasks-vision'
import QRCode from 'react-qr-code'
import { DEFAULT_PROCTORING_CONFIG, useProctoringConfig } from '@/lib/proctoringConfig'
import { mobileAppDownload } from '@/lib/mobileAppDownload'
import { TimedDetectionEngine } from '@/lib/proctoring/detectionPolicy'
import { useProctorIncidentReporter } from '@/lib/proctoring/useProctorIncidentReporter'
import { DetectionIncident, IncidentType } from '@/lib/proctoring/types'

interface ProctoringCameraProps {
  onViolation: (isViolating: boolean, message: string) => void
  onIncidentsChange?: (incidents: DetectionIncident[]) => void
  sessionId?: string
  qrValue?: string
  expiresAt?: string
  onRegenerateQr?: () => void | Promise<void>
}

export default function ProctoringCamera({
  onViolation,
  onIncidentsChange,
  sessionId,
  qrValue,
  expiresAt,
  onRegenerateQr,
}: ProctoringCameraProps) {
  const { config } = useProctoringConfig()
  const configRef = useRef(config)
  useEffect(() => {
    configRef.current = config
  }, [config])

  const { reportIncident, resolveIncident } = useProctorIncidentReporter({ sessionId })

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioBarRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'disabled'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isRegeneratingQr, setIsRegeneratingQr] = useState(false)

  // Track active local incidents
  const activeIncidentsRef = useRef<Map<string, DetectionIncident>>(new Map())

  const syncIncidents = () => {
    const incidents = Array.from(activeIncidentsRef.current.values())
    onIncidentsChange?.(incidents)

    const hardIncidents = incidents.filter(
      (i) => i.severity === 'hard' || i.severity === 'technical',
    )
    const softIncidents = incidents.filter(
      (i) => i.severity === 'warning' || i.severity === 'soft',
    )

    if (hardIncidents.length > 0) {
      onViolation(true, hardIncidents[0].description)
    } else if (softIncidents.length > 0) {
      onViolation(false, softIncidents[0].description)
    } else {
      onViolation(false, '')
    }
  }

  const setIncident = (incident: DetectionIncident) => {
    const prev = activeIncidentsRef.current.get(incident.incidentKey)
    if (prev && prev.severity === incident.severity && prev.description === incident.description) {
      return
    }
    activeIncidentsRef.current.set(incident.incidentKey, incident)
    syncIncidents()
    if (incident.severity === 'hard' || incident.severity === 'technical') {
      void reportIncident(incident)
    }
  }

  const removeIncident = (incidentKey: string, type: IncidentType, source = 'laptop_local') => {
    if (activeIncidentsRef.current.has(incidentKey)) {
      activeIncidentsRef.current.delete(incidentKey)
      syncIncidents()
      void resolveIncident(type, source)
    }
  }

  const regenerateQr = async () => {
    if (!onRegenerateQr || isRegeneratingQr) return
    setIsRegeneratingQr(true)
    try {
      await onRegenerateQr()
    } finally {
      setIsRegeneratingQr(false)
    }
  }

  useEffect(() => {
    if (!expiresAt) {
      setTimeRemaining(null)
      return
    }

    const updateCountdown = () => {
      const now = new Date().getTime()
      const end = new Date(expiresAt).getTime()
      const diff = end - now

      if (diff <= 0) {
        setTimeRemaining(0)
      } else {
        setTimeRemaining(Math.floor(diff / 1000))
      }
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [expiresAt])

  useEffect(() => {
    if (!config.laptop.cameraFeed) {
      setStatus('disabled')
      activeIncidentsRef.current.clear()
      syncIncidents()
      return
    }

    let faceLandmarker: FaceLandmarker | null = null
    let objectDetector: ObjectDetector | null = null
    let audioContext: AudioContext | null = null
    let analyser: AnalyserNode | null = null
    let dataArray: Float32Array | null = null
    let stream: MediaStream | null = null
    let animationFrameId: number
    let checkIntervalId: NodeJS.Timeout | null = null

    // Stale video tracking
    let lastVideoTime = -1
    let lastTimeAdvancedMs = performance.now()
    let isStalled = false

    // Scheduling timestamps & overlap locks
    let lastFaceDetectMs = 0
    let lastObjectDetectMs = 0
    let lastBrightnessCheckMs = 0
    let isRunningFace = false
    let isRunningObject = false

    // Audio & liveness
    let noiseFrames = 0
    let lastBlinkTime = performance.now()
    let nosePositions: { x: number; y: number }[] = []

    // Offscreen canvas for brightness / obstruction check
    const sampleCanvas = document.createElement('canvas')
    sampleCanvas.width = 16
    sampleCanvas.height = 16
    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true })
    let darkFrameCount = 0

    // Policy Engines
    const policyConfig = configRef.current.policy || DEFAULT_PROCTORING_CONFIG.policy!
    const recoveryMs = policyConfig.recoveryMs ?? 2500

    const secondPersonEngine = TimedDetectionEngine.secondPerson(recoveryMs)
    const presenceEngine = TimedDetectionEngine.presence(recoveryMs)
    const gazeEngine = TimedDetectionEngine.presence(2000)
    const objectEngine = TimedDetectionEngine.object(recoveryMs)

    const init = async () => {
      try {
        const shouldGetAudio = configRef.current.laptop.microphoneFeed
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: shouldGetAudio,
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        // Web Audio API
        if (shouldGetAudio) {
          try {
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
            analyser = audioContext.createAnalyser()
            analyser.fftSize = 512
            const source = audioContext.createMediaStreamSource(stream)
            source.connect(analyser)
            const bufferLength = analyser.frequencyBinCount
            dataArray = new Float32Array(bufferLength)
          } catch (audioErr) {
            console.warn('Failed to initialize audio monitoring', audioErr)
          }
        }

        // Load MediaPipe resolver
        const filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
        )

        // Try GPU delegate first, fallback to CPU delegate on failure
        const createVisionModels = async (delegate: 'GPU' | 'CPU') => {
          return await Promise.all([
            FaceLandmarker.createFromOptions(filesetResolver, {
              baseOptions: {
                modelAssetPath:
                  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                delegate,
              },
              outputFaceBlendshapes: true,
              outputFacialTransformationMatrixes: true,
              runningMode: 'VIDEO',
              numFaces: 4,
            }),
            ObjectDetector.createFromOptions(filesetResolver, {
              baseOptions: {
                modelAssetPath:
                  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite',
                delegate,
              },
              scoreThreshold: policyConfig.minConfidence ?? 0.35,
              runningMode: 'VIDEO',
            }),
          ])
        }

        try {
          const [landmarker, detector] = await createVisionModels('GPU')
          faceLandmarker = landmarker
          objectDetector = detector
        } catch (gpuErr) {
          console.warn('MediaPipe GPU initialization failed, falling back to CPU:', gpuErr)
          try {
            const [landmarker, detector] = await createVisionModels('CPU')
            faceLandmarker = landmarker
            objectDetector = detector
          } catch (cpuErr) {
            throw new Error('Both GPU and CPU vision initialization failed: ' + (cpuErr as any)?.message)
          }
        }

        setStatus('ready')
        lastTimeAdvancedMs = performance.now()
        startDetectionLoop()
      } catch (err: any) {
        setStatus('error')
        setErrorMessage(err.message || 'Webcam access denied. Required for Knowledge Check.')

        const incident: DetectionIncident = {
          incidentKey: 'laptop:detector_unavailable',
          type: 'detector_unavailable',
          severity: 'technical',
          description: 'Laptop camera or detector is unavailable. Camera access is required.',
          source: 'laptop_local',
          occurredAt: new Date().toISOString(),
        }
        setIncident(incident)
      }
    }

    const startDetectionLoop = () => {
      const personIntervalMs = policyConfig.personAnalysisIntervalMs ?? 250
      const objectIntervalMs = policyConfig.secondaryAnalysisIntervalMs ?? 600
      const staleTimeoutMs = policyConfig.staleFrameTimeoutMs ?? 6000

      const checkWatchdogs = () => {
        const video = videoRef.current
        if (!video) return
        const now = performance.now()

        // 1. Camera Stalled Watchdog
        if (video.readyState >= 2 && !video.paused) {
          if (video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime
            lastTimeAdvancedMs = now
            if (isStalled) {
              isStalled = false
              removeIncident('laptop:camera_stalled', 'camera_stalled')
            }
          } else if (now - lastTimeAdvancedMs > staleTimeoutMs && !isStalled) {
            isStalled = true
            setIncident({
              incidentKey: 'laptop:camera_stalled',
              type: 'camera_stalled',
              severity: 'technical',
              description: 'Laptop camera feed is stalled or frozen.',
              source: 'laptop_local',
              occurredAt: new Date().toISOString(),
            })
          }
        }

        // 2. Camera Obstructed / Covered Check (~1s)
        if (now - lastBrightnessCheckMs >= 1000 && video.readyState >= 2 && sampleCtx) {
          lastBrightnessCheckMs = now
          try {
            sampleCtx.drawImage(video, 0, 0, 16, 16)
            const imgData = sampleCtx.getImageData(0, 0, 16, 16).data
            let totalBrightness = 0
            for (let i = 0; i < imgData.length; i += 4) {
              totalBrightness += (imgData[i] + imgData[i + 1] + imgData[i + 2]) / 3
            }
            const avgBrightness = totalBrightness / (16 * 16)
            if (avgBrightness < 6) {
              darkFrameCount++
              if (darkFrameCount >= 3) {
                setIncident({
                  incidentKey: 'laptop:camera_obstructed',
                  type: 'camera_obstructed',
                  severity: 'hard',
                  description: 'Laptop camera view is obstructed or pitch black.',
                  source: 'laptop_local',
                  occurredAt: new Date().toISOString(),
                })
              }
            } else {
              if (darkFrameCount >= 3) {
                removeIncident('laptop:camera_obstructed', 'camera_obstructed')
              }
              darkFrameCount = 0
            }
          } catch (e) {
            // ignore canvas security/rendering errors
          }
        }
      }

      const loop = () => {
        const video = videoRef.current
        if (!video || !faceLandmarker || !objectDetector) {
          animationFrameId = requestAnimationFrame(loop)
          return
        }

        const now = performance.now()
        const currentCfg = configRef.current
        checkWatchdogs()

        // 1. Person & Face Analysis (every ~250ms)
        if (now - lastFaceDetectMs >= personIntervalMs && !isRunningFace && video.readyState >= 2) {
          lastFaceDetectMs = now
          isRunningFace = true

          try {
            const results = faceLandmarker.detectForVideo(video, now)
            const faceCount = results.faceLandmarks.length

            // Multiple People check
            if (currentCfg.laptop.multiplePeopleDetection) {
              const transition = secondPersonEngine.record({
                at: now,
                detected: faceCount > 1,
                confidence: 0.85,
              })

              if (transition === 'confirmed') {
                setIncident({
                  incidentKey: 'laptop:second_person',
                  type: 'second_person',
                  severity: 'hard',
                  description: 'Multiple people detected by laptop camera.',
                  source: 'laptop_local',
                  occurredAt: new Date().toISOString(),
                })
              } else if (transition === 'warning') {
                setIncident({
                  incidentKey: 'laptop:second_person',
                  type: 'second_person',
                  severity: 'warning',
                  description: 'Another person suspected in camera view.',
                  source: 'laptop_local',
                  occurredAt: new Date().toISOString(),
                })
              } else if (transition === 'resolved' || transition === 'warningCleared') {
                removeIncident('laptop:second_person', 'second_person')
              }
            }

            // Face Presence check
            if (currentCfg.laptop.facePresenceDetection) {
              const transition = presenceEngine.record({
                at: now,
                detected: faceCount === 0,
                confidence: 0.9,
              })

              if (transition === 'confirmed') {
                setIncident({
                  incidentKey: 'laptop:student_missing',
                  type: 'student_missing',
                  severity: 'hard',
                  description: 'No face detected in laptop camera. Please face the screen.',
                  source: 'laptop_local',
                  occurredAt: new Date().toISOString(),
                })
              } else if (transition === 'warning') {
                setIncident({
                  incidentKey: 'laptop:student_missing',
                  type: 'student_missing',
                  severity: 'warning',
                  description: 'Face not clearly visible. Please re-center.',
                  source: 'laptop_local',
                  occurredAt: new Date().toISOString(),
                })
              } else if (transition === 'resolved' || transition === 'warningCleared') {
                removeIncident('laptop:student_missing', 'student_missing')
              }
            }

            // Gaze & Liveness Tracking (when 1 face is present)
            if (faceCount === 1) {
              const landmarks = results.faceLandmarks[0]

              // Gaze tracking
              if (currentCfg.laptop.gazeTracking) {
                const nose = landmarks[1]
                const leftEdge = landmarks[234]
                const rightEdge = landmarks[454]
                const topForehead = landmarks[10]
                const chin = landmarks[152]

                const horizontalRatio = (nose.x - leftEdge.x) / (rightEdge.x - leftEdge.x)
                const verticalRatio = (nose.y - topForehead.y) / (chin.y - topForehead.y)
                const isLookingAway =
                  horizontalRatio < 0.22 || horizontalRatio > 0.78 || verticalRatio > 0.78

                const gazeTransition = gazeEngine.record({
                  at: now,
                  detected: isLookingAway,
                  confidence: 0.7,
                })

                if (gazeTransition === 'confirmed') {
                  setIncident({
                    incidentKey: 'laptop:gaze_away',
                    type: 'gaze_away',
                    severity: 'hard',
                    description: 'Looking away from screen detected.',
                    source: 'laptop_local',
                    occurredAt: new Date().toISOString(),
                  })
                } else if (gazeTransition === 'warning') {
                  setIncident({
                    incidentKey: 'laptop:gaze_away',
                    type: 'gaze_away',
                    severity: 'warning',
                    description: 'Please look towards your exam screen.',
                    source: 'laptop_local',
                    occurredAt: new Date().toISOString(),
                  })
                } else if (gazeTransition === 'resolved' || gazeTransition === 'warningCleared') {
                  removeIncident('laptop:gaze_away', 'gaze_away')
                }
              }

              // Liveness check (Blink & Micro-movements)
              if (currentCfg.laptop.livenessCheck) {
                const blendshapes = results.faceBlendshapes?.[0]?.categories
                if (blendshapes) {
                  const leftBlink =
                    blendshapes.find((b) => b.categoryName === 'eyeBlinkLeft')?.score || 0
                  const rightBlink =
                    blendshapes.find((b) => b.categoryName === 'eyeBlinkRight')?.score || 0
                  if (leftBlink > 0.4 || rightBlink > 0.4) {
                    lastBlinkTime = now
                    nosePositions = []
                  }
                }

                nosePositions.push({ x: landmarks[1].x, y: landmarks[1].y })
                if (nosePositions.length > 30) nosePositions.shift()

                if (now - lastBlinkTime > 15000 && nosePositions.length >= 30) {
                  const avgX = nosePositions.reduce((s, p) => s + p.x, 0) / nosePositions.length
                  const avgY = nosePositions.reduce((s, p) => s + p.y, 0) / nosePositions.length
                  const stdDevX = Math.sqrt(
                    nosePositions.reduce((s, p) => s + Math.pow(p.x - avgX, 2), 0) /
                      nosePositions.length,
                  )
                  const stdDevY = Math.sqrt(
                    nosePositions.reduce((s, p) => s + Math.pow(p.y - avgY, 2), 0) /
                      nosePositions.length,
                  )

                  if (stdDevX < 0.0001 && stdDevY < 0.0001) {
                    setIncident({
                      incidentKey: 'laptop:static_image_spoof',
                      type: 'static_image_spoof',
                      severity: 'hard',
                      description: 'Static image detected. Liveness check failed.',
                      source: 'laptop_local',
                      occurredAt: new Date().toISOString(),
                    })
                  } else {
                    lastBlinkTime = now
                    removeIncident('laptop:static_image_spoof', 'static_image_spoof')
                  }
                }
              }
            }
          } catch (e) {
            console.warn('Face landmark error:', e)
          } finally {
            isRunningFace = false
          }
        }

        // 2. Object Detection (every ~600ms)
        if (
          now - lastObjectDetectMs >= objectIntervalMs &&
          !isRunningObject &&
          video.readyState >= 2 &&
          currentCfg.laptop.forbiddenObjectDetection
        ) {
          lastObjectDetectMs = now
          isRunningObject = true

          try {
            const objectResults = objectDetector.detectForVideo(video, now)
            const forbiddenLabels = ['cell phone', 'phone', 'book']
            let detectedForbiddenObject: string | null = null

            for (const detection of objectResults.detections) {
              for (const category of detection.categories) {
                const name = category.categoryName.toLowerCase()
                if (forbiddenLabels.includes(name) && category.score > 0.4) {
                  detectedForbiddenObject = category.categoryName
                  break
                }
              }
              if (detectedForbiddenObject) break
            }

            const objectTransition = objectEngine.record({
              at: now,
              detected: Boolean(detectedForbiddenObject),
              confidence: 0.8,
            })

            if (objectTransition === 'confirmed') {
              setIncident({
                incidentKey: 'laptop:suspicious_object',
                type: 'suspicious_object',
                severity: 'hard',
                description: `Forbidden object (${detectedForbiddenObject}) detected. Please remove it.`,
                source: 'laptop_local',
                occurredAt: new Date().toISOString(),
              })
            } else if (objectTransition === 'warning') {
              setIncident({
                incidentKey: 'laptop:suspicious_object',
                type: 'suspicious_object',
                severity: 'warning',
                description: `Possible forbidden item detected in view.`,
                source: 'laptop_local',
                occurredAt: new Date().toISOString(),
              })
            } else if (objectTransition === 'resolved' || objectTransition === 'warningCleared') {
              removeIncident('laptop:suspicious_object', 'suspicious_object')
            }
          } catch (e) {
            console.warn('Object detector error:', e)
          } finally {
            isRunningObject = false
          }
        }

        // 3. Audio Noise Monitor
        if (currentCfg.laptop.audioNoiseDetection && analyser && dataArray) {
          analyser.getFloatTimeDomainData(dataArray as any)
          let sumSquares = 0.0
          for (let i = 0; i < dataArray.length; i++) {
            sumSquares += dataArray[i] * dataArray[i]
          }
          const rms = Math.sqrt(sumSquares / dataArray.length)

          if (audioBarRef.current) {
            const percentage = Math.min(100, Math.round((rms / 0.1) * 100))
            audioBarRef.current.style.transform = `scaleX(${percentage / 100})`
            if (rms > 0.06) {
              audioBarRef.current.style.backgroundColor = '#ef4444'
            } else if (rms > 0.03) {
              audioBarRef.current.style.backgroundColor = '#eab308'
            } else {
              audioBarRef.current.style.backgroundColor = '#22c55e'
            }
          }

          if (rms > 0.06) {
            noiseFrames++
            if (noiseFrames > 60 && currentCfg.laptop.audioCountdownBlur) {
              setIncident({
                incidentKey: 'laptop:audio_noise',
                type: 'suspicious_object',
                severity: 'hard',
                description: 'High background noise or speech detected.',
                source: 'laptop_local',
                occurredAt: new Date().toISOString(),
              })
            }
          } else {
            if (noiseFrames > 0) noiseFrames--
            if (noiseFrames === 0) {
              removeIncident('laptop:audio_noise', 'suspicious_object')
            }
          }
        }

        animationFrameId = requestAnimationFrame(loop)
      }

      animationFrameId = requestAnimationFrame(loop)
    }

    init()

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
      if (checkIntervalId) clearInterval(checkIntervalId)
      if (stream) stream.getTracks().forEach((track) => track.stop())
      if (faceLandmarker) faceLandmarker.close()
      if (objectDetector) objectDetector.close()
      if (audioContext) audioContext.close()
    }
  }, [config.laptop.cameraFeed, config.laptop.microphoneFeed])

  if (status === 'disabled' || !config.laptop.cameraFeed) {
    return (
      <div className="flex flex-col gap-3 bg-slate-900/90 p-4 rounded-xl border border-slate-700/80 mt-2 w-full text-center">
        <div className="py-6 px-4 bg-slate-950/60 rounded-lg border border-dashed border-slate-700 flex flex-col items-center justify-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center text-sm font-bold">
            💻
          </div>
          <span className="text-xs font-semibold text-slate-300">Laptop Camera Feed Disabled</span>
          <span className="text-[11px] text-slate-500">Camera monitoring is disabled</span>
        </div>
        {sessionId && qrValue && config.mobile.cameraFeed && (
          <div className="border-t border-white/5 pt-3">
            <div className="text-[11px] font-semibold text-cyan-400 mb-2">📱 Mobile Camera QR</div>
            <div className="bg-white p-2 rounded inline-block mx-auto">
              <QRCode value={qrValue} size={90} />
            </div>
          </div>
        )}
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="bg-red-900/50 border border-red-500 rounded p-4 text-center my-4">
        <p className="text-red-200 font-bold">{errorMessage}</p>
        <p className="text-sm text-red-300 mt-2">Please refresh and allow webcam permissions.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 bg-slate-900 p-4 rounded-xl border border-slate-700 mt-2 w-full">
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden flex-shrink-0 shadow-inner">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover origin-center scale-x-[-1]"
        />
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 text-xs text-slate-300 font-medium tracking-wide">
            <div className="w-5 h-5 border-2 border-slate-500 border-t-white rounded-full animate-spin mb-2"></div>
            Connecting...
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="font-semibold text-slate-200 text-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            AI Proctoring Active
          </div>
          <div className="text-slate-400 text-xs mt-1">Processed locally for privacy</div>
        </div>
        {config.laptop.microphoneFeed && (
          <div className="flex flex-col items-end gap-1 w-24">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
              Audio Level
            </span>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                ref={audioBarRef}
                className="h-full bg-green-500 origin-left transition-transform duration-75"
                style={{ transform: 'scaleX(0)' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Mobile Camera QR Link Panel */}
      {sessionId && qrValue && config.mobile.cameraFeed && (
        <div
          style={{
            borderTop: '1px solid rgba(255,255,255,0.07)',
            paddingTop: 14,
            marginTop: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.6)',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>📱 Link Mobile Camera</span>
            {config.gates.bypassMobileCameraRequired && (
              <span
                style={{
                  fontSize: 9,
                  background: 'rgba(34,197,94,0.15)',
                  color: '#4ade80',
                  padding: '1px 5px',
                  borderRadius: 4,
                  textTransform: 'none',
                }}
              >
                Optional (Dev Mode)
              </span>
            )}
          </div>
          <div
            style={{
              background: 'rgba(78,205,196,0.06)',
              border: '1px solid rgba(78,205,196,0.2)',
              borderRadius: 10,
              padding: 10,
              position: 'relative',
            }}
          >
            <div
              style={{
                background: 'white',
                borderRadius: 6,
                padding: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: timeRemaining === 0 ? 0.2 : 1,
                transition: 'opacity 0.3s',
              }}
            >
              <QRCode
                value={qrValue}
                size={100}
                style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                viewBox={`0 0 100 100`}
              />
            </div>

            {timeRemaining === 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(15, 23, 42, 0.8)',
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    color: '#f87171',
                    fontSize: 12,
                    fontWeight: 'bold',
                    marginBottom: 8,
                  }}
                >
                  QR Expired
                </div>
                <button
                  onClick={regenerateQr}
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: 4,
                    fontSize: 10,
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  {isRegeneratingQr ? 'Generating…' : 'Generate New QR'}
                </button>
              </div>
            )}
          </div>

          {timeRemaining !== 0 && onRegenerateQr && (
            <button
              type="button"
              onClick={regenerateQr}
              disabled={isRegeneratingQr}
              style={{
                border: '1px solid rgba(78,205,196,0.45)',
                background: 'rgba(78,205,196,0.10)',
                color: '#4ecdc4',
                borderRadius: 6,
                padding: '7px 12px',
                fontSize: 10,
                fontWeight: 700,
                cursor: isRegeneratingQr ? 'wait' : 'pointer',
                opacity: isRegeneratingQr ? 0.65 : 1,
              }}
            >
              {isRegeneratingQr ? 'Generating New QR…' : 'Generate New QR'}
            </button>
          )}

          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.4)',
              textAlign: 'center',
              lineHeight: 1.5,
              padding: '0 8px',
            }}
          >
            {timeRemaining !== null && timeRemaining > 0 && (
              <div
                style={{
                  color: timeRemaining < 60 ? '#f87171' : '#4ECDC4',
                  marginBottom: 4,
                  fontWeight: 'bold',
                }}
              >
                Expires in {Math.floor(timeRemaining / 60)}:
                {(timeRemaining % 60).toString().padStart(2, '0')}
              </div>
            )}
            Scan with LMS Mobile or your iPhone Camera to activate rear-camera monitoring.
            <br />
            <span style={{ color: '#4ECDC4', fontWeight: 500 }}>
              Prop your phone ~1 meter behind you so it can see your back, desk, and screen.
            </span>
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <a
              href={mobileAppDownload.url}
              download={mobileAppDownload.fileName}
              style={{
                width: '100%',
                border: '1px solid rgba(78,205,196,0.45)',
                background: 'rgba(78,205,196,0.10)',
                color: '#4ECDC4',
                borderRadius: 7,
                padding: '8px 10px',
                fontSize: 10,
                fontWeight: 800,
                textAlign: 'center',
                textDecoration: 'none',
              }}
              aria-label={`Download LMS Mobile for Android`}
            >
              🤖 Download LMS Mobile (Android APK)
            </a>
            <div
              style={{
                width: '100%',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.85)',
                borderRadius: 7,
                padding: '7px 10px',
                fontSize: 9.5,
                fontWeight: 600,
                textAlign: 'center',
              }}
            >
              🍏 iOS: Point iPhone Camera at QR or use in-app scanner
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.05)',
              fontSize: 9,
              color: 'rgba(255,255,255,0.3)',
              fontFamily: 'monospace',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <div
              style={{
                fontWeight: 'bold',
                marginBottom: 4,
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              Diagnostic Info
            </div>
            <div>
              Session ID: {sessionId?.substring(0, 8)}...
              {sessionId?.substring(sessionId.length - 4)}
            </div>
            <div>Token Suffix: {qrValue ? qrValue.substring(qrValue.length - 6) : 'none'}</div>
          </div>
        </div>
      )}
    </div>
  )
}
