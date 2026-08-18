'use client'

import React, { useEffect, useRef, useState } from 'react'
import { FaceLandmarker, FilesetResolver, ObjectDetector } from '@mediapipe/tasks-vision'
import QRCode from 'react-qr-code'
import { useProctoringConfig } from '@/lib/proctoringConfig'

interface ProctoringCameraProps {
  onViolation: (isViolating: boolean, message: string) => void
  sessionId?: string
  qrValue?: string
}

export default function ProctoringCamera({ onViolation, sessionId, qrValue }: ProctoringCameraProps) {
  const { config } = useProctoringConfig()
  const configRef = useRef(config)
  useEffect(() => {
    configRef.current = config
  }, [config])

  const videoRef = useRef<HTMLVideoElement>(null)
  const audioBarRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'disabled'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    // If dev explicitly disabled laptop camera feed, skip media capture entirely
    if (!config.laptop.cameraFeed) {
      setStatus('disabled')
      onViolation(false, '')
      return
    }

    let faceLandmarker: FaceLandmarker | null = null
    let objectDetector: ObjectDetector | null = null
    let audioContext: AudioContext | null = null
    let analyser: AnalyserNode | null = null
    let dataArray: Float32Array | null = null
    let stream: MediaStream | null = null
    let animationFrameId: number
    let lastVideoTime = -1

    // Debounce state to avoid flickering
    let violatingFrames = 0
    let normalFrames = 0
    let noiseFrames = 0

    // Liveness state
    let lastBlinkTime = performance.now()
    let nosePositions: { x: number; y: number }[] = []

    const init = async () => {
      try {
        // 1. Get webcam and microphone
        const shouldGetAudio = configRef.current.laptop.microphoneFeed
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240 },
          audio: shouldGetAudio,
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        // Initialize Web Audio API if mic is enabled
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

        // 2. Load MediaPipe resolver
        const filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        )
        const [landmarker, detector] = await Promise.all([
          FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
              delegate: 'GPU',
            },
            outputFaceBlendshapes: true,
            outputFacialTransformationMatrixes: true,
            runningMode: 'VIDEO',
            numFaces: 2,
          }),
          ObjectDetector.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite',
              delegate: 'GPU',
            },
            scoreThreshold: 0.4,
            runningMode: 'VIDEO',
          }),
        ])

        faceLandmarker = landmarker
        objectDetector = detector

        setStatus('ready')
        predictWebcam()
      } catch (err: any) {
        setStatus('error')
        setErrorMessage(err.message || 'Webcam access denied. Required for Knowledge Check.')
        // Only trigger continuous violation if camera feed is not in dev bypass
        if (configRef.current.laptop.cameraFeed) {
          onViolation(true, 'Camera access required to view Knowledge Check.')
        }
      }
    }

    const predictWebcam = () => {
      if (!videoRef.current || !faceLandmarker || !objectDetector) return

      const currentCfg = configRef.current
      let startTimeMs = performance.now()

      if (videoRef.current.currentTime !== lastVideoTime) {
        lastVideoTime = videoRef.current.currentTime
        const results = faceLandmarker.detectForVideo(videoRef.current, startTimeMs)
        const objectResults = objectDetector.detectForVideo(videoRef.current, startTimeMs)

        let frameViolation = false
        let frameViolationMessage = ''

        // 1. Check for forbidden objects and count people
        const forbiddenLabels = ['cell phone', 'phone', 'book', 'laptop']
        let detectedForbiddenObject = null
        let personCount = 0

        for (const detection of objectResults.detections) {
          let isPerson = false
          for (const category of detection.categories) {
            const name = category.categoryName.toLowerCase()
            if (name === 'person' && category.score > 0.4) {
              isPerson = true
            }
            if (forbiddenLabels.includes(name) && category.score > 0.4) {
              detectedForbiddenObject = category.categoryName
            }
          }
          if (isPerson) personCount++
        }

        // Multiple People Detection Check
        if (currentCfg.laptop.multiplePeopleDetection && personCount > 1) {
          violatingFrames++
          normalFrames = 0
          if (violatingFrames > 10) {
            frameViolation = true
            frameViolationMessage = 'Multiple people detected in the room.'
          }
        } else if (currentCfg.laptop.forbiddenObjectDetection && detectedForbiddenObject) {
          // Forbidden Object Check
          violatingFrames++
          normalFrames = 0
          if (violatingFrames > 10) {
            frameViolation = true
            frameViolationMessage = `Forbidden object (${detectedForbiddenObject}) detected. Please remove it.`
          }
        }

        // 2. Check noise level (Audio)
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
              audioBarRef.current.style.backgroundColor = '#ef4444' // red-500
            } else if (rms > 0.03) {
              audioBarRef.current.style.backgroundColor = '#eab308' // yellow-500
            } else {
              audioBarRef.current.style.backgroundColor = '#22c55e' // green-500
            }
          }

          if (rms > 0.06) {
            noiseFrames++
            if (noiseFrames <= 90) {
              if (currentCfg.laptop.audioCountdownBlur) {
                const secondsRemaining = Math.max(1, Math.ceil((90 - noiseFrames) / 30))
                frameViolation = true
                frameViolationMessage = `Speaking or noise detected. Content will blur in ${secondsRemaining}s. Please keep quiet.`
              }
            } else {
              if (currentCfg.laptop.audioCountdownBlur) {
                frameViolation = true
                frameViolationMessage = 'Speaking or high background noise detected. Content locked.'
              }
            }
          } else {
            if (noiseFrames > 0) {
              noiseFrames--
              if (noiseFrames > 0 && currentCfg.laptop.audioCountdownBlur) {
                const secondsRemaining = Math.max(1, Math.ceil((90 - noiseFrames) / 30))
                frameViolation = true
                frameViolationMessage = `Speaking or noise detected. Content will blur in ${secondsRemaining}s. Please keep quiet.`
              }
            }
          }
        }

        // 3. Check faces (only if no object/audio violation is already blocking the frame)
        if (!frameViolation) {
          if (currentCfg.laptop.facePresenceDetection && results.faceLandmarks.length === 0) {
            violatingFrames++
            normalFrames = 0
            if (violatingFrames > 15) {
              frameViolation = true
              frameViolationMessage = 'No face detected. Please face the screen.'
            }
          } else if (currentCfg.laptop.multiplePeopleDetection && results.faceLandmarks.length > 1) {
            violatingFrames++
            normalFrames = 0
            if (violatingFrames > 15) {
              frameViolation = true
              frameViolationMessage = 'Multiple people detected. Only one person is allowed.'
            }
          } else if (results.faceLandmarks.length > 0) {
            // Face detected, calculate pose
            const landmarks = results.faceLandmarks[0]

            if (currentCfg.laptop.gazeTracking) {
              const nose = landmarks[1]
              const leftEdge = landmarks[234]
              const rightEdge = landmarks[454]
              const topForehead = landmarks[10]
              const chin = landmarks[152]

              const horizontalRatio = (nose.x - leftEdge.x) / (rightEdge.x - leftEdge.x)
              const verticalRatio = (nose.y - topForehead.y) / (chin.y - topForehead.y)

              const isLookingLeftOrRight = horizontalRatio < 0.25 || horizontalRatio > 0.75
              const isLookingDown = verticalRatio > 0.75

              if (isLookingLeftOrRight || isLookingDown) {
                violatingFrames++
                normalFrames = 0
                if (violatingFrames > 15) {
                  frameViolation = true
                  frameViolationMessage = 'Looking away from screen detected.'
                }
              } else {
                normalFrames++
                if (normalFrames > 5) {
                  violatingFrames = 0
                }
              }
            } else {
              normalFrames++
              if (normalFrames > 5) {
                violatingFrames = 0
              }
            }

            // Liveness detection (Blink & Micro-movements)
            if (currentCfg.laptop.livenessCheck) {
              const blendshapes = results.faceBlendshapes?.[0]?.categories
              if (blendshapes) {
                const leftBlink = blendshapes.find((b) => b.categoryName === 'eyeBlinkLeft')?.score || 0
                const rightBlink = blendshapes.find((b) => b.categoryName === 'eyeBlinkRight')?.score || 0
                if (leftBlink > 0.4 || rightBlink > 0.4) {
                  lastBlinkTime = startTimeMs
                  nosePositions = [] // Reset nose tracking on blink
                }
              }

              nosePositions.push({ x: landmarks[1].x, y: landmarks[1].y })
              if (nosePositions.length > 30) nosePositions.shift()

              // If no blink for 15 seconds, check for micro-movements
              if (startTimeMs - lastBlinkTime > 15000) {
                if (nosePositions.length >= 30) {
                  const avgX = nosePositions.reduce((sum, p) => sum + p.x, 0) / nosePositions.length
                  const avgY = nosePositions.reduce((sum, p) => sum + p.y, 0) / nosePositions.length
                  const stdDevX = Math.sqrt(
                    nosePositions.reduce((sum, p) => sum + Math.pow(p.x - avgX, 2), 0) / nosePositions.length
                  )
                  const stdDevY = Math.sqrt(
                    nosePositions.reduce((sum, p) => sum + Math.pow(p.y - avgY, 2), 0) / nosePositions.length
                  )

                  // If perfectly static
                  if (stdDevX < 0.0001 && stdDevY < 0.0001) {
                    frameViolation = true
                    frameViolationMessage = 'Static image detected. Liveness check failed.'
                  } else {
                    lastBlinkTime = startTimeMs
                  }
                }
              }
            }
          }
        }

        // 4. Propagate final proctoring state
        if (frameViolation) {
          onViolation(true, frameViolationMessage)
        } else {
          onViolation(false, '')
        }
      }

      animationFrameId = requestAnimationFrame(predictWebcam)
    }

    init()

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
      if (stream) stream.getTracks().forEach((track) => track.stop())
      if (faceLandmarker) faceLandmarker.close()
      if (objectDetector) objectDetector.close()
      if (audioContext) audioContext.close()
    }
  }, [config.laptop.cameraFeed, config.laptop.microphoneFeed, onViolation])

  if (status === 'disabled' || !config.laptop.cameraFeed) {
    return (
      <div className="flex flex-col gap-3 bg-slate-900/90 p-4 rounded-xl border border-slate-700/80 mt-2 w-full text-center">
        <div className="py-6 px-4 bg-slate-950/60 rounded-lg border border-dashed border-slate-700 flex flex-col items-center justify-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center text-sm font-bold">
            💻
          </div>
          <span className="text-xs font-semibold text-slate-300">Laptop Camera Feed Disabled</span>
          <span className="text-[11px] text-slate-500">Dev mode active via proctoring.config.json</span>
        </div>
        {sessionId && config.mobile.cameraFeed && (
          <div className="border-t border-white/5 pt-3">
            <div className="text-[11px] font-semibold text-cyan-400 mb-2">📱 Mobile Camera QR</div>
            <div className="bg-white p-2 rounded inline-block mx-auto">
              <QRCode value={qrValue || `lms://proctor/${sessionId}`} size={90} />
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
        <p className="text-sm text-red-300 mt-2">Please refresh and allow webcam permissions or disable in dev config.</p>
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
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Audio Level</span>
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

      {/* ─── Mobile Camera QR Link Panel ─── */}
      {sessionId && config.mobile.cameraFeed && (
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
              <span style={{ fontSize: 9, background: 'rgba(34,197,94,0.15)', color: '#4ade80', padding: '1px 5px', borderRadius: 4, textTransform: 'none' }}>
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
              }}
            >
              <QRCode
                value={qrValue || `lms://proctor/${sessionId}`}
                size={100}
                style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                viewBox={`0 0 100 100`}
              />
            </div>
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.4)',
              textAlign: 'center',
              lineHeight: 1.5,
              padding: '0 8px',
            }}
          >
            Scan with LMS Mobile to activate rear-camera monitoring.
            <br />
            <span style={{ color: '#4ECDC4', fontWeight: 500 }}>
              Prop your phone ~1 meter behind you so it can see your back, desk, and screen.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
