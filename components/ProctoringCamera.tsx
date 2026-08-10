'use client'

import React, { useEffect, useRef, useState } from 'react'
import { FaceLandmarker, FilesetResolver, ObjectDetector } from '@mediapipe/tasks-vision'

interface ProctoringCameraProps {
  onViolation: (isViolating: boolean, message: string) => void
}

export default function ProctoringCamera({ onViolation }: ProctoringCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioBarRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
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

    const init = async () => {
      try {
        // 1. Get webcam and microphone
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240 },
          audio: true
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        // Initialize Web Audio API
        try {
          audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          analyser = audioContext.createAnalyser()
          analyser.fftSize = 512
          const source = audioContext.createMediaStreamSource(stream)
          source.connect(analyser)
          const bufferLength = analyser.frequencyBinCount
          dataArray = new Float32Array(bufferLength)
        } catch (audioErr) {
          console.warn("Failed to initialize audio monitoring", audioErr)
        }

        // 2. Load MediaPipe resolver
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        )
        const [landmarker, detector] = await Promise.all([
          FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "GPU"
            },
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: true,
            runningMode: "VIDEO",
            numFaces: 2
          }),
          ObjectDetector.createFromOptions(filesetResolver, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite",
              delegate: "GPU"
            },
            scoreThreshold: 0.4,
            runningMode: "VIDEO"
          })
        ])

        faceLandmarker = landmarker
        objectDetector = detector

        setStatus('ready')
        predictWebcam()
      } catch (err: any) {
        setStatus('error')
        setErrorMessage(err.message || 'Webcam access denied. Required for Knowledge Check.')
        // Fail strict: if they deny camera, trigger a continuous violation
        onViolation(true, 'Camera access required to view Knowledge Check.')
      }
    }

    const predictWebcam = () => {
      if (!videoRef.current || !faceLandmarker || !objectDetector) return

      let startTimeMs = performance.now()
      if (videoRef.current.currentTime !== lastVideoTime) {
        lastVideoTime = videoRef.current.currentTime
        const results = faceLandmarker.detectForVideo(videoRef.current, startTimeMs)
        const objectResults = objectDetector.detectForVideo(videoRef.current, startTimeMs)

        let frameViolation = false
        let frameViolationMessage = ''

        // 1. Check for forbidden objects
        const forbiddenLabels = ['cell phone', 'phone', 'book', 'laptop']
        let detectedForbiddenObject = null
        for (const detection of objectResults.detections) {
          for (const category of detection.categories) {
            if (forbiddenLabels.includes(category.categoryName.toLowerCase()) && category.score > 0.4) {
              detectedForbiddenObject = category.categoryName
              break
            }
          }
          if (detectedForbiddenObject) break
        }

        if (detectedForbiddenObject) {
          violatingFrames++
          normalFrames = 0
          if (violatingFrames > 10) {
            frameViolation = true
            frameViolationMessage = `Forbidden object (${detectedForbiddenObject}) detected. Please remove it.`
          }
        }

        // 2. Check noise level (Audio)
        let isTooNoisy = false
        if (analyser && dataArray) {
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
              const secondsRemaining = Math.max(1, Math.ceil((90 - noiseFrames) / 30))
              frameViolation = true
              frameViolationMessage = `Speaking or noise detected. Content will blur in ${secondsRemaining}s. Please keep quiet.`
            } else {
              isTooNoisy = true
              frameViolation = true
              frameViolationMessage = 'Speaking or high background noise detected. Content locked.'
            }
          } else {
            if (noiseFrames > 0) {
              noiseFrames--
              if (noiseFrames > 0) {
                const secondsRemaining = Math.max(1, Math.ceil((90 - noiseFrames) / 30))
                frameViolation = true
                frameViolationMessage = `Speaking or noise detected. Content will blur in ${secondsRemaining}s. Please keep quiet.`
              }
            }
          }
        }

        // 3. Check faces (only if no object/audio violation is already blocking the frame)
        if (!frameViolation) {
          if (results.faceLandmarks.length === 0) {
            violatingFrames++
            normalFrames = 0
            if (violatingFrames > 15) {
              frameViolation = true
              frameViolationMessage = 'No face detected. Please face the screen.'
            }
          } else if (results.faceLandmarks.length > 1) {
            violatingFrames++
            normalFrames = 0
            if (violatingFrames > 15) {
              frameViolation = true
              frameViolationMessage = 'Multiple people detected. Only one person is allowed.'
            }
          } else {
            // Face detected, calculate pose roughly
            const landmarks = results.faceLandmarks[0]
            
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
      if (stream) stream.getTracks().forEach(track => track.stop())
      if (faceLandmarker) faceLandmarker.close()
      if (objectDetector) objectDetector.close()
      if (audioContext) audioContext.close()
    }
  }, [onViolation])

  if (status === 'error') {
    return (
      <div className="bg-red-900/50 border border-red-500 rounded p-4 text-center my-4">
        <p className="text-red-200 font-bold">{errorMessage}</p>
        <p className="text-sm text-red-300 mt-2">Please refresh and allow webcam permissions to take this quiz.</p>
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
      </div>
    </div>
  )
}
