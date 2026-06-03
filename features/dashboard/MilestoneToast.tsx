"use client"

import { useEffect } from "react"
import { motion } from "framer-motion"

export function MilestoneToast({
  message,
  icon: Icon,
  color,
  onDismiss,
}: {
  message: string
  icon: React.ElementType
  color: string
  onDismiss: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      onClick={onDismiss}
      style={{
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 300,
        cursor: "pointer",
        background: `linear-gradient(135deg, ${color}18, rgba(5,8,16,0.92))`,
        border: `1px solid ${color}45`,
        borderRadius: 16,
        padding: "14px 22px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        backdropFilter: "blur(20px)",
        boxShadow: `0 8px 40px rgba(0,0,0,0.5), 0 0 30px ${color}20`,
        minWidth: 280,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          background: `${color}20`,
          border: `1px solid ${color}40`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={18} color={color} />
      </div>
      <div>
        <p
          style={{
            fontSize: 11,
            color: color,
            fontFamily: "monospace",
            letterSpacing: "0.12em",
            marginBottom: 2,
          }}
        >
          MILESTONE
        </p>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#E8F0FC" }}>{message}</p>
      </div>
    </motion.div>
  )
}
