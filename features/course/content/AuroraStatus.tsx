export function AuroraStatus({ speaking }: { speaking: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        userSelect: "none",
        gap: 4,
        position: "relative",
        zIndex: 2,
      }}
    >
      <p
        className="aurora-text"
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.22em",
          fontFamily: "monospace",
        }}
      >
        ALEX · AI TUTOR
      </p>
      <p
        style={{
          fontSize: 9,
          letterSpacing: "0.16em",
          fontFamily: "monospace",
          color: speaking ? "var(--ac-cyan)" : "var(--text-tertiary)",
          opacity: speaking ? 1 : 0.5,
          transition: "all 0.3s",
          textShadow: speaking ? "0 0 8px rgba(78,205,196,0.7)" : "none",
        }}
      >
        {speaking ? "◉ SPEAKING" : "○ READY"}
      </p>
    </div>
  );
}
