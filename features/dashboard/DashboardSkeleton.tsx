"use client"

import { motion } from "framer-motion"

function Shimmer({
  w,
  h,
  r = 10,
  delay = 0,
}: {
  w: string | number
  h: number
  r?: number
  delay?: number
}) {
  return (
    <motion.div
      animate={{ opacity: [0.04, 0.12, 0.04] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay }}
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background:
          "linear-gradient(90deg, rgba(78,205,196,0.08) 0%, rgba(155,111,208,0.12) 50%, rgba(78,205,196,0.08) 100%)",
        flexShrink: 0,
      }}
    />
  )
}

export function DashboardSkeleton() {
  return (
    <div style={{ minHeight: "100vh", color: "#E8F0FC", padding: "0 0 100px" }}>
      <div
        style={{
          padding: "28px 28px 24px",
          borderBottom: "1px solid rgba(78,205,196,0.07)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Shimmer w={42} h={42} r={14} delay={0} />
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <Shimmer w={80} h={9} r={5} delay={0.05} />
                <Shimmer w={140} h={22} r={8} delay={0.1} />
                <Shimmer w={110} h={11} r={5} delay={0.15} />
              </div>
            </div>
            <Shimmer w={160} h={46} r={12} delay={0.1} />
          </div>
          <div
            style={{
              background: "rgba(78,205,196,0.03)",
              border: "1px solid rgba(78,205,196,0.1)",
              borderRadius: 20,
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Shimmer w={52} h={52} r={16} delay={0.05} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Shimmer w={160} h={10} r={5} delay={0.1} />
                <Shimmer w={220} h={18} r={7} delay={0.15} />
                <Shimmer w={140} h={11} r={5} delay={0.2} />
              </div>
            </div>
            <Shimmer w={120} h={44} r={13} delay={0.1} />
          </div>
        </div>
      </div>
      <div style={{ padding: "24px 28px", maxWidth: 1400, margin: "0 auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
            gap: 12,
            marginBottom: 22,
          }}
        >
          {[0, 0.06, 0.12, 0.18, 0.24, 0.3].map((d, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: d }}
              style={{
                background: "rgba(255,255,255,0.015)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 16,
                padding: "18px 20px",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <Shimmer w={44} h={44} r={13} delay={d} />
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <Shimmer w={70} h={9} r={4} delay={d + 0.05} />
                <Shimmer w={50} h={20} r={6} delay={d + 0.1} />
              </div>
            </motion.div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: 7 }, (_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32 + i * 0.04 }}
              style={{
                background: "rgba(255,255,255,0.015)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 16,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <Shimmer w={34} h={34} r={10} delay={i * 0.04} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                <Shimmer w={60} h={9} r={4} delay={i * 0.04 + 0.05} />
                <Shimmer w={i % 2 === 0 ? 160 : 200} h={14} r={6} delay={i * 0.04 + 0.1} />
              </div>
              <Shimmer w={72} h={3} r={3} delay={i * 0.04 + 0.08} />
              <Shimmer w={15} h={15} r={4} delay={i * 0.04 + 0.12} />
            </motion.div>
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginTop: 32,
          }}
        >
          {[0, 0.2, 0.4].map((d, i) => (
            <motion.div
              key={i}
              animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: d }}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: i === 0 ? "#4ECDC4" : i === 1 ? "#9B6FD0" : "#52D98B",
              }}
            />
          ))}
        </motion.div>
      </div>
    </div>
  )
}
