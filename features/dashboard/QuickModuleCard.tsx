"use client"

import { motion } from "framer-motion"
import { CheckCircle2, Circle, Lock, Play, ChevronRight } from "lucide-react"
import { MODULE_TITLES } from "./constants"

export function QuickModuleCard({
  moduleId,
  status,
  color,
  isNext,
  onClick,
}: {
  moduleId: string
  status: "completed" | "available" | "locked"
  color: string
  isNext?: boolean
  onClick: () => void
}) {
  const isDone  = status === "completed"
  const isAvail = status === "available"
  return (
    <motion.div
      whileHover={status !== "locked" ? { scale: 1.02, y: -2 } : {}}
      whileTap={status !== "locked" ? { scale: 0.97 } : {}}
      onClick={onClick}
      style={{
        padding: "11px 13px",
        borderRadius: 11,
        cursor: status !== "locked" ? "pointer" : "default",
        background: isDone
          ? `${color}0a`
          : isNext
            ? "rgba(78,205,196,0.07)"
            : isAvail
              ? "rgba(255,255,255,0.03)"
              : "rgba(255,255,255,0.015)",
        border: isDone
          ? `1px solid ${color}30`
          : isNext
            ? "1px solid rgba(78,205,196,0.3)"
            : isAvail
              ? "1px solid rgba(255,255,255,0.08)"
              : "1px solid rgba(255,255,255,0.03)",
        opacity: status === "locked" ? 0.35 : 1,
        transition: "all 0.15s",
        display: "flex",
        alignItems: "center",
        gap: 10,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {isNext && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, rgba(78,205,196,0.04) 0%, transparent 60%)",
            pointerEvents: "none",
          }}
        />
      )}
      <div style={{ flexShrink: 0, position: "relative", zIndex: 1 }}>
        {isDone ? (
          <div
            style={{
              width: 22, height: 22, borderRadius: "50%",
              background: `${color}18`, border: `1px solid ${color}50`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <CheckCircle2 size={12} color={color} />
          </div>
        ) : isNext ? (
          <div
            style={{
              width: 22, height: 22, borderRadius: "50%",
              background: "rgba(78,205,196,0.15)", border: "1px solid rgba(78,205,196,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Play size={9} color="#4ECDC4" style={{ marginLeft: 1 }} />
          </div>
        ) : isAvail ? (
          <div
            style={{
              width: 22, height: 22, borderRadius: "50%",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Circle size={9} color="rgba(255,255,255,0.35)" />
          </div>
        ) : (
          <div
            style={{
              width: 22, height: 22, borderRadius: "50%",
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Lock size={9} color="rgba(255,255,255,0.18)" />
          </div>
        )}
      </div>
      <div style={{ minWidth: 0, flex: 1, position: "relative", zIndex: 1 }}>
        <p
          style={{
            fontSize: 9, fontFamily: "monospace", color: "#4A6285",
            letterSpacing: "0.08em", marginBottom: 2,
          }}
        >
          {moduleId.toUpperCase()}
        </p>
        <p
          style={{
            fontSize: 12,
            fontWeight: isNext ? 600 : 500,
            color: isDone ? color : isNext ? "#4ECDC4" : isAvail ? "#8EA8CC" : "rgba(255,255,255,0.25)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {MODULE_TITLES[moduleId] ?? moduleId.toUpperCase()}
        </p>
      </div>
      {(isAvail || isNext) && (
        <ChevronRight
          size={12}
          color={isNext ? "rgba(78,205,196,0.5)" : "rgba(255,255,255,0.2)"}
          style={{ flexShrink: 0, position: "relative", zIndex: 1 }}
        />
      )}
    </motion.div>
  )
}
