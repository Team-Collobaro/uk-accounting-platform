import type { TPhase } from "@/types/course";

export function NotesPromptBanner({
  phase,
  topicTitle,
  topicIdx,
  total,
}: {
  phase: TPhase;
  topicTitle: string | null;
  topicIdx: number;
  total: number;
}) {
  if (!topicTitle) return null;
  const cfg: Record<
    string,
    { icon: string; label: string; hint: string; accent: string }
  > = {
    PRE_NOTES: {
      icon: "✏️",
      label: "WRITE HEADING",
      hint: `Write "${topicTitle}" as a heading in your notes.`,
      accent: "var(--ac-gold)",
    },
    EXPLAIN: {
      icon: "📖",
      label: "LISTENING",
      hint: `Alex is explaining "${topicTitle}".`,
      accent: "var(--ac-cyan)",
    },
    CONFIRM: {
      icon: "📝",
      label: "UPDATE NOTES",
      hint: `Update your notes for "${topicTitle}", then reply when ready.`,
      accent: "var(--ac-mint)",
    },
    POST_NOTES: {
      icon: "💬",
      label: "QUICK CHECK",
      hint: `Answer the question about "${topicTitle}".`,
      accent: "var(--ac-violet)",
    },
    CHECK: {
      icon: "💬",
      label: "ANSWER",
      hint: `Answer Alex's question about "${topicTitle}".`,
      accent: "var(--ac-violet)",
    },
    WRAP: {
      icon: "🏁",
      label: "WRAP-UP",
      hint: "Final check — answer the question to complete this section.",
      accent: "var(--ac-cyan)",
    },
  };
  const c = cfg[phase];
  if (!c) return null;
  return (
    <div
      style={{
        margin: "0 20px 8px",
        padding: "9px 14px",
        borderRadius: 9,
        flexShrink: 0,
        background: "rgba(12,16,32,0.65)",
        border: `1px solid ${c.accent}28`,
        boxShadow: `var(--shadow-sm), 0 0 12px ${c.accent}14`,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span style={{ fontSize: 14 }}>{c.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 2,
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontFamily: "monospace",
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: c.accent,
            }}
          >
            {c.label}
          </span>
          {total > 0 && (
            <span
              style={{
                fontSize: 9,
                fontFamily: "monospace",
                color: "var(--text-tertiary)",
              }}
            >
              · {topicIdx + 1}/{total}
            </span>
          )}
        </div>
        <p
          style={{
            fontSize: 11,
            color: "var(--text-secondary)",
            lineHeight: 1.4,
            margin: 0,
          }}
        >
          {c.hint}
        </p>
      </div>
    </div>
  );
}
