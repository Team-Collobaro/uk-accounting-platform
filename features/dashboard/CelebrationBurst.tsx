"use client"

import { motion } from "framer-motion"

export function CelebrationBurst({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 200 }}>
      {Array.from({ length: 20 }, (_, i) => {
        const angle = (i / 20) * 360
        const dist = 80 + Math.random() * 120
        const colors = ["#4ECDC4", "#9B6FD0", "#52D98B", "#E8B84B", "#E87B6F"]
        return (
          <motion.div
            key={i}
            initial={{ x: "50vw", y: "50vh", scale: 0, opacity: 1 }}
            animate={{
              x: `calc(50vw + ${Math.cos((angle * Math.PI) / 180) * dist}px)`,
              y: `calc(50vh + ${Math.sin((angle * Math.PI) / 180) * dist}px)`,
              scale: [0, 1.2, 0],
              opacity: [1, 1, 0],
            }}
            transition={{ duration: 1.2, ease: "easeOut", delay: i * 0.03 }}
            style={{
              position: "absolute",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: colors[i % colors.length],
              boxShadow: `0 0 8px ${colors[i % colors.length]}`,
            }}
          />
        )
      })}
    </div>
  )
}
