"use client"

import { motion } from "framer-motion"
import CountUp from "@/components/reactbits/CountUp"

export function StatCard({
  icon: Icon,
  label,
  value,
  countTo,
  color,
  delay,
  suffix,
}: {
  icon: React.ElementType
  label: string
  value: string
  countTo?: number
  color: string
  delay: number
  suffix?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -4, scale: 1.02 }}
      style={{
        background: `linear-gradient(135deg, ${color}08 0%, rgba(5,8,16,0.6) 100%)`,
        border: `1px solid ${color}25`,
        borderRadius: 16,
        padding: "18px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        position: "relative",
        overflow: "hidden",
        backdropFilter: "blur(12px)",
        cursor: "default",
        transition: "box-shadow 0.2s",
      }}
      whileTap={{ scale: 0.98 }}
    >
      <div
        style={{
          position: "absolute",
          top: -24,
          right: -24,
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: `radial-gradient(circle,${color}10 0%,transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 13,
          background: `${color}15`,
          border: `1px solid ${color}30`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={19} color={color} />
      </div>
      <div>
        <p
          style={{
            fontSize: 10,
            color: "#4A6285",
            fontFamily: "monospace",
            letterSpacing: "0.08em",
            marginBottom: 3,
            textTransform: "uppercase",
          }}
        >
          {label}
        </p>
        <p style={{ fontSize: 22, fontWeight: 800, color: "#E8F0FC", lineHeight: 1 }}>
          {countTo !== undefined ? (
            <>
              <CountUp to={countTo} from={0} duration={1.4} delay={delay} />
              {suffix}
            </>
          ) : (
            value
          )}
        </p>
      </div>
    </motion.div>
  )
}
