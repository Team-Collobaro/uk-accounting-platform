'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Copy,
  Check,
  Save,
  Laptop,
  Smartphone,
  Shield,
  Sliders,
  AlertTriangle,
  Radio,
} from 'lucide-react'
import { useProctoringConfig, ProctoringConfig, DEFAULT_PROCTORING_CONFIG } from '@/lib/proctoringConfig'

interface DevProctoringToolbarProps {
  onSimulateViolation?: (isViolating: boolean, message: string) => void
}

export default function DevProctoringToolbar({ onSimulateViolation }: DevProctoringToolbarProps) {
  const { config, updateConfig, setConfig, resetConfig } = useProctoringConfig()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'laptop' | 'browser' | 'gates' | 'mobile' | 'simulator'>('laptop')
  const [copied, setCopied] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)

  // Toggle helper
  const toggleKey = (category: keyof ProctoringConfig, key: string) => {
    updateConfig((prev: any) => {
      if (typeof prev[category] === 'object' && prev[category] !== null) {
        return {
          ...prev,
          [category]: {
            ...prev[category],
            [key]: !prev[category][key],
          },
        }
      }
      return prev
    })
  }

  // Presets
  const applyPreset = (preset: 'bypass' | 'laptop_only' | 'mobile_only' | 'strict') => {
    if (preset === 'bypass') {
      setConfig({
        devMode: true,
        laptop: {
          cameraFeed: true,
          microphoneFeed: false,
          facePresenceDetection: false,
          multiplePeopleDetection: false,
          gazeTracking: false,
          livenessCheck: false,
          forbiddenObjectDetection: false,
          audioNoiseDetection: false,
          audioCountdownBlur: false,
        },
        browserGuards: {
          tabSwitchBlur: false,
          multiMonitorDetection: false,
          screenshotProtection: false,
          clipboardCopyProtection: false,
        },
        gates: {
          bypassIntegrityAgreement: true,
          bypassMobileCameraRequired: true,
        },
        mobile: {
          cameraFeed: true,
          mlKitObjectDetection: false,
          studentMissingWatchdog: false,
          livenessDetection: false,
          claudeTier2Verification: false,
          supabaseBroadcast: false,
          heartbeatWatchdog: false,
          wakelock: false,
        },
      })
    } else if (preset === 'laptop_only') {
      setConfig({
        devMode: true,
        laptop: {
          cameraFeed: true,
          microphoneFeed: true,
          facePresenceDetection: true,
          multiplePeopleDetection: true,
          gazeTracking: true,
          livenessCheck: true,
          forbiddenObjectDetection: true,
          audioNoiseDetection: true,
          audioCountdownBlur: true,
        },
        browserGuards: {
          tabSwitchBlur: true,
          multiMonitorDetection: false,
          screenshotProtection: true,
          clipboardCopyProtection: true,
        },
        gates: {
          bypassIntegrityAgreement: false,
          bypassMobileCameraRequired: true, // Bypass mobile
        },
        mobile: {
          cameraFeed: false,
          mlKitObjectDetection: false,
          studentMissingWatchdog: false,
          livenessDetection: false,
          claudeTier2Verification: false,
          supabaseBroadcast: false,
          heartbeatWatchdog: false,
          wakelock: false,
        },
      })
    } else if (preset === 'mobile_only') {
      setConfig({
        devMode: true,
        laptop: {
          cameraFeed: false,
          microphoneFeed: false,
          facePresenceDetection: false,
          multiplePeopleDetection: false,
          gazeTracking: false,
          livenessCheck: false,
          forbiddenObjectDetection: false,
          audioNoiseDetection: false,
          audioCountdownBlur: false,
        },
        browserGuards: {
          tabSwitchBlur: false,
          multiMonitorDetection: false,
          screenshotProtection: false,
          clipboardCopyProtection: false,
        },
        gates: {
          bypassIntegrityAgreement: true,
          bypassMobileCameraRequired: false, // Require mobile
        },
        mobile: {
          cameraFeed: true,
          mlKitObjectDetection: true,
          studentMissingWatchdog: true,
          livenessDetection: true,
          claudeTier2Verification: true,
          supabaseBroadcast: true,
          heartbeatWatchdog: true,
          wakelock: true,
        },
      })
    } else if (preset === 'strict') {
      setConfig({
        devMode: false,
        laptop: {
          cameraFeed: true,
          microphoneFeed: true,
          facePresenceDetection: true,
          multiplePeopleDetection: true,
          gazeTracking: true,
          livenessCheck: true,
          forbiddenObjectDetection: true,
          audioNoiseDetection: true,
          audioCountdownBlur: true,
        },
        browserGuards: {
          tabSwitchBlur: true,
          multiMonitorDetection: true,
          screenshotProtection: true,
          clipboardCopyProtection: true,
        },
        gates: {
          bypassIntegrityAgreement: false,
          bypassMobileCameraRequired: false,
        },
        mobile: {
          cameraFeed: true,
          mlKitObjectDetection: true,
          studentMissingWatchdog: true,
          livenessDetection: true,
          claudeTier2Verification: true,
          supabaseBroadcast: true,
          heartbeatWatchdog: true,
          wakelock: true,
        },
      })
    }
  }

  const copyConfigJson = () => {
    navigator.clipboard.writeText(JSON.stringify(config, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const saveToConfigFile = async () => {
    setSaveStatus('Saving...')
    try {
      const res = await fetch('/api/dev-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) {
        setSaveStatus('Saved to proctoring.config.json!')
        setTimeout(() => setSaveStatus(null), 3000)
      } else {
        setSaveStatus('Failed to save file.')
        setTimeout(() => setSaveStatus(null), 3000)
      }
    } catch (e) {
      setSaveStatus('Error saving.')
      setTimeout(() => setSaveStatus(null), 3000)
    }
  }

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 10000, fontFamily: 'Inter, sans-serif' }}>
      {/* ─── Floating Collapsed Button ─── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            padding: '10px 16px',
            borderRadius: '30px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 700,
            fontSize: '12px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.6), 0 0 15px rgba(56, 189, 248, 0.2)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <Sliders style={{ width: 14, height: 14, color: '#38bdf8' }} />
          <span>Dev Proctoring JSON Controls</span>
          <span
            style={{
              background: config.gates.bypassMobileCameraRequired ? '#22c55e' : '#eab308',
              color: '#000',
              fontSize: '10px',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: '10px',
            }}
          >
            {config.gates.bypassMobileCameraRequired ? 'Bypass ON' : 'Normal'}
          </span>
        </button>
      )}

      {/* ─── Expanded Dashboard Panel ─── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.18 }}
            style={{
              width: '460px',
              maxHeight: '85vh',
              background: '#090d16',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              color: '#e2e8f0',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '14px 18px',
                background: '#0f172a',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders style={{ width: 16, height: 16, color: '#38bdf8' }} />
                <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.02em', color: '#fff' }}>
                  Proctoring Dev Controller
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontWeight: 600,
                  }}
                >
                  JSON Sync
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <ChevronDown style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {/* 1-Click Quick Presets */}
            <div
              style={{
                padding: '10px 16px',
                background: 'rgba(255,255,255,0.02)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                gap: '6px',
                overflowX: 'auto',
              }}
            >
              <button
                onClick={() => applyPreset('bypass')}
                style={{
                  background: 'rgba(34, 197, 94, 0.15)',
                  border: '1px solid rgba(34, 197, 94, 0.4)',
                  color: '#4ade80',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '5px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                🚀 Full Bypass
              </button>
              <button
                onClick={() => applyPreset('laptop_only')}
                style={{
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38bdf8',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '5px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                💻 Laptop Only
              </button>
              <button
                onClick={() => applyPreset('mobile_only')}
                style={{
                  background: 'rgba(168, 85, 247, 0.12)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  color: '#c084fc',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '5px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                📱 Mobile Only
              </button>
              <button
                onClick={() => applyPreset('strict')}
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '5px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                🔒 Strict
              </button>
            </div>

            {/* Navigation Tabs */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: '#0d1322',
                padding: '0 8px',
              }}
            >
              {[
                { id: 'laptop', label: 'Laptop AI', icon: Laptop },
                { id: 'browser', label: 'Guards', icon: Shield },
                { id: 'gates', label: 'Gates', icon: Radio },
                { id: 'mobile', label: 'Mobile Sync', icon: Smartphone },
                { id: 'simulator', label: 'Simulate', icon: AlertTriangle },
              ].map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    style={{
                      flex: 1,
                      padding: '10px 4px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: isActive ? '2px solid #38bdf8' : '2px solid transparent',
                      color: isActive ? '#38bdf8' : '#94a3b8',
                      fontSize: '11px',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      transition: '0.15s',
                    }}
                  >
                    <Icon style={{ width: 12, height: 12 }} />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px', minHeight: '260px' }}>
              {/* Tab 1: Laptop AI */}
              {activeTab === 'laptop' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    MediaPipe Vision & Audio Detections
                  </div>
                  {[
                    { key: 'cameraFeed', label: 'Webcam Video Stream', desc: 'Request camera & render video feed' },
                    { key: 'microphoneFeed', label: 'Microphone Audio Stream', desc: 'Capture mic for background sound' },
                    { key: 'facePresenceDetection', label: 'Face Presence Check', desc: 'Flag if no face is in frame' },
                    { key: 'multiplePeopleDetection', label: 'Multiple People Detection', desc: 'Flag if 2+ people detected' },
                    { key: 'gazeTracking', label: 'Gaze & Head Pose Tracking', desc: 'Flag looking left/right/down' },
                    { key: 'livenessCheck', label: 'Liveness & Anti-Spoof', desc: 'Eye blink and micro-movement check' },
                    { key: 'forbiddenObjectDetection', label: 'Forbidden Object Classifier', desc: 'Detect phone, books, laptops' },
                    { key: 'audioNoiseDetection', label: 'Audio Noise Level Threshold', desc: 'Check loud speech or sounds' },
                    { key: 'audioCountdownBlur', label: 'Noise Countdown Blur Lock', desc: 'Lock screen after sustained noise' },
                  ].map((item) => (
                    <SwitchRow
                      key={item.key}
                      label={item.label}
                      desc={item.desc}
                      checked={(config.laptop as any)[item.key]}
                      onChange={() => toggleKey('laptop', item.key)}
                    />
                  ))}
                </div>
              )}

              {/* Tab 2: Browser Guards */}
              {activeTab === 'browser' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Browser Anti-Cheat Locks
                  </div>
                  {[
                    { key: 'tabSwitchBlur', label: 'Tab Switch & Window Blur Lock', desc: 'Blur exam on window focus loss' },
                    { key: 'multiMonitorDetection', label: 'Multi-Monitor / Display Check', desc: 'Require single monitor' },
                    { key: 'screenshotProtection', label: 'Screenshot Shortcut Interceptor', desc: 'Block Cmd+Shift & PrintScreen' },
                    { key: 'clipboardCopyProtection', label: 'Copy & Right-Click Lock', desc: 'Disable copy, paste & context menu' },
                  ].map((item) => (
                    <SwitchRow
                      key={item.key}
                      label={item.label}
                      desc={item.desc}
                      checked={(config.browserGuards as any)[item.key]}
                      onChange={() => toggleKey('browserGuards', item.key)}
                    />
                  ))}
                </div>
              )}

              {/* Tab 3: Gates & Flow */}
              {activeTab === 'gates' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Exam Progression Gates
                  </div>
                  {[
                    {
                      key: 'bypassIntegrityAgreement',
                      label: 'Bypass Academic Integrity Screen',
                      desc: 'Skip clicking "I Agree, Start Knowledge Check"',
                    },
                    {
                      key: 'bypassMobileCameraRequired',
                      label: 'Bypass Mobile Phone Requirement',
                      desc: 'Allow exam access without scanning phone QR code',
                    },
                  ].map((item) => (
                    <SwitchRow
                      key={item.key}
                      label={item.label}
                      desc={item.desc}
                      checked={(config.gates as any)[item.key]}
                      onChange={() => toggleKey('gates', item.key)}
                    />
                  ))}
                </div>
              )}

              {/* Tab 4: Mobile Sync */}
              {activeTab === 'mobile' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Mobile Phone App ML & Realtime
                  </div>
                  {[
                    { key: 'cameraFeed', label: 'Mobile Camera Stream', desc: 'Enable rear camera preview' },
                    { key: 'mlKitObjectDetection', label: 'ML Kit Forbidden Objects', desc: 'Detect phones/notes behind back' },
                    { key: 'studentMissingWatchdog', label: 'Student Missing Alert (1s)', desc: 'Flag if student leaves view' },
                    { key: 'livenessDetection', label: 'Mobile Liveness & Pose', desc: 'Check blink and static image spoof' },
                    { key: 'claudeTier2Verification', label: 'Claude Vision Tier 2 API', desc: 'Call Anthropic API for verification' },
                    { key: 'supabaseBroadcast', label: 'Supabase Realtime Channel', desc: 'Send violation events to desktop' },
                    { key: 'heartbeatWatchdog', label: 'Heartbeat Watchdog Lock (60s)', desc: 'Lock if phone disconnects' },
                    { key: 'wakelock', label: 'Screen Wake Lock', desc: 'Keep phone screen awake' },
                  ].map((item) => (
                    <SwitchRow
                      key={item.key}
                      label={item.label}
                      desc={item.desc}
                      checked={(config.mobile as any)[item.key]}
                      onChange={() => toggleKey('mobile', item.key)}
                    />
                  ))}
                </div>
              )}

              {/* Tab 5: Simulator */}
              {activeTab === 'simulator' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Trigger Test Violations
                  </div>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                    Click any button to trigger a simulated violation banner and test UI behavior:
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                    <button
                      onClick={() => onSimulateViolation?.(true, 'No face detected. Please face the screen.')}
                      style={simBtnStyle}
                    >
                      👤 Face Lost Alert
                    </button>
                    <button
                      onClick={() => onSimulateViolation?.(true, 'Looking away from screen detected.')}
                      style={simBtnStyle}
                    >
                      👀 Looking Away
                    </button>
                    <button
                      onClick={() =>
                        onSimulateViolation?.(true, 'Speaking or high background noise detected. Content locked.')
                      }
                      style={simBtnStyle}
                    >
                      🔊 High Noise
                    </button>
                    <button
                      onClick={() =>
                        onSimulateViolation?.(true, '📱 Mobile Camera: Second phone detected behind screen')
                      }
                      style={simBtnStyle}
                    >
                      📱 Mobile Hard Alert
                    </button>
                    <button
                      onClick={() =>
                        onSimulateViolation?.(true, '📱 Mobile camera disconnected — please reconnect your phone')
                      }
                      style={simBtnStyle}
                    >
                      ⚠️ Phone Disconnect
                    </button>
                    <button
                      onClick={() => onSimulateViolation?.(false, '')}
                      style={{
                        ...simBtnStyle,
                        background: 'rgba(34, 197, 94, 0.2)',
                        borderColor: '#22c55e',
                        color: '#4ade80',
                      }}
                    >
                      ✅ Clear All
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div
              style={{
                padding: '12px 18px',
                background: '#0f172a',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <button
                onClick={resetConfig}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <RotateCcw style={{ width: 12, height: 12 }} />
                Reset Defaults
              </button>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {saveStatus && <span style={{ fontSize: '11px', color: '#38bdf8' }}>{saveStatus}</span>}
                <button
                  onClick={copyConfigJson}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {copied ? <Check style={{ width: 12, height: 12, color: '#22c55e' }} /> : <Copy style={{ width: 12, height: 12 }} />}
                  {copied ? 'Copied' : 'Copy JSON'}
                </button>
                <button
                  onClick={saveToConfigFile}
                  style={{
                    background: '#0284c7',
                    border: 'none',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Save style={{ width: 12, height: 12 }} />
                  Save JSON File
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SwitchRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string
  desc: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <div
      onClick={onChange}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 10px',
        borderRadius: '8px',
        background: checked ? 'rgba(56, 189, 248, 0.05)' : 'rgba(255,255,255,0.02)',
        border: checked ? '1px solid rgba(56, 189, 248, 0.2)' : '1px solid rgba(255,255,255,0.04)',
        cursor: 'pointer',
        transition: '0.15s',
      }}
    >
      <div style={{ flex: 1, paddingRight: '12px' }}>
        <div style={{ fontSize: '12.5px', fontWeight: 600, color: checked ? '#f8fafc' : '#94a3b8' }}>{label}</div>
        <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '1px' }}>{desc}</div>
      </div>
      <div
        style={{
          width: '36px',
          height: '20px',
          borderRadius: '20px',
          background: checked ? '#0284c7' : '#334155',
          position: 'relative',
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: '#ffffff',
            position: 'absolute',
            top: '3px',
            left: checked ? '19px' : '3px',
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}
        />
      </div>
    </div>
  )
}

const simBtnStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  color: '#e2e8f0',
  padding: '8px 10px',
  borderRadius: '8px',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'center',
  transition: 'all 0.15s',
}
