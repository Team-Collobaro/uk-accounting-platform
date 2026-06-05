import { Pencil, BookOpen, PenLine, MessageCircle, Flag, type LucideIcon } from "lucide-react";
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
  const cfg: Record<string, { icon: LucideIcon; label: string; hint: string }> = {
    PRE_NOTES: {
      icon: Pencil,
      label: "WRITE HEADING",
      hint: `Write "${topicTitle}" as a heading in your notes.`,
    },
    EXPLAIN: {
      icon: BookOpen,
      label: "LISTENING",
      hint: `Alex is explaining "${topicTitle}".`,
    },
    CONFIRM: {
      icon: PenLine,
      label: "UPDATE NOTES",
      hint: `Update your notes for "${topicTitle}", then reply when ready.`,
    },
    POST_NOTES: {
      icon: MessageCircle,
      label: "QUICK CHECK",
      hint: `Answer the question about "${topicTitle}".`,
    },
    CHECK: {
      icon: MessageCircle,
      label: "ANSWER",
      hint: `Answer Alex's question about "${topicTitle}".`,
    },
    WRAP: {
      icon: Flag,
      label: "WRAP-UP",
      hint: "Final check — answer the question to complete this section.",
    },
  };
  const c = cfg[phase];
  if (!c) return null;
  const Icon = c.icon;
  return (
    <div className="mx-5 mb-2 flex shrink-0 items-center gap-3 rounded-md border bg-muted/40 px-3.5 py-2.5">
      <Icon size={15} className="shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-1.5">
          <span className="text-[10px] font-semibold tracking-wider text-foreground">
            {c.label}
          </span>
          {total > 0 && (
            <span className="text-[10px] text-muted-foreground">
              · {topicIdx + 1}/{total}
            </span>
          )}
        </div>
        <p className="m-0 text-xs leading-snug text-muted-foreground">{c.hint}</p>
      </div>
    </div>
  );
}
