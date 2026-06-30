'use client'

import React, { useEffect, useRef, useState } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

interface ProctoringCameraProps {
  onViolation: (isViolating: boolean, message: string) => void
}

export default function ProctoringCamera({ onViolation }: ProctoringCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let faceLandmarker: FaceLandmarker | null = null
    let stream: MediaStream | null = null
    let animationFrameId: number
    let lastVideoTime = -1

    // Debounce state to avoid flickering
    let violatingFrames = 0
    let normalFrames = 0

    const init = async () => {
      try {
        // 1. Get webcam
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        // 2. Load MediaPipe FaceLandmarker
        const filesetResolver = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        )
        faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: true,
          runningMode: "VIDEO",
          numFaces: 1
        })

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
      if (!videoRef.current || !faceLandmarker) return

      let startTimeMs = performance.now()
      if (videoRef.current.currentTime !== lastVideoTime) {
        lastVideoTime = videoRef.current.currentTime
        const results = faceLandmarker.detectForVideo(videoRef.current, startTimeMs)

        if (results.faceLandmarks.length === 0) {
          // No face detected
          violatingFrames++
          normalFrames = 0
          if (violatingFrames > 15) { // roughly 0.5 seconds
            onViolation(true, 'No face detected. Please face the screen.')
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

          // Very simple thresholding
          const isLookingLeftOrRight = horizontalRatio < 0.25 || horizontalRatio > 0.75
          const isLookingDown = verticalRatio > 0.75

          if (isLookingLeftOrRight || isLookingDown) {
            violatingFrames++
            normalFrames = 0
            if (violatingFrames > 15) {
              onViolation(true, 'Looking away from screen detected.')
            }
          } else {
            normalFrames++
            if (normalFrames > 5) {
              violatingFrames = 0
              onViolation(false, '')
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(predictWebcam)
    }

    init()

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
      if (stream) stream.getTracks().forEach(track => track.stop())
      if (faceLandmarker) faceLandmarker.close()
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
      </div>
    </div>
  )
}
