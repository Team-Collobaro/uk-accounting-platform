"use client";

import { useState, useEffect } from "react";
import {
  Brain,
  Check,
  Lock,
  ChevronDown,
  ChevronUp,
  ChevronRight,
} from "lucide-react";
import type { Section, SectionProgress } from "@/types/course";

function isSubSection(id: string) {
  return (id.match(/\./g) ?? []).length >= 2;
}

function groupSections(sections: Section[]) {
  const groups: Array<{
    parent: Section;
    parentIdx: number;
    children: Array<{ section: Section; idx: number }>;
  }> = [];
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    if (!isSubSection(s.section_id)) {
      groups.push({ parent: s, parentIdx: i, children: [] });
    } else {
      const last = groups[groups.length - 1];
      if (last) last.children.push({ section: s, idx: i });
    }
  }
  return groups;
}

export function SectionTrail({
  sections,
  currentIdx,
  progress,
  quizUnlocked,
  onSelect,
  onStartFinalQuiz,
}: {
  sections: Section[];
  currentIdx: number;
  progress: SectionProgress[];
  quizUnlocked: boolean;
  onSelect: (i: number) => void;
  onStartFinalQuiz: () => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const cur = sections[currentIdx];
    if (!cur) return;
    const parentId = isSubSection(cur.section_id)
      ? cur.section_id.split(".").slice(0, 2).join(".")
      : cur.section_id;
    setExpanded((prev) => new Set(prev).add(parentId));
  }, [currentIdx, sections]);

  const groups = groupSections(sections);

  // Parent stubs (h2 sections that have children) are containers, not
  // completable units — the student progresses through the children.
  const stubIds = new Set(
    groups.filter((g) => g.children.length > 0).map((g) => g.parent.section_id),
  );

  // Linear sequence of the sections that actually gate progress (everything
  // except stub parents). A unit unlocks once the previous unit is completed.
  const completable = sections.filter((s) => !stubIds.has(s.section_id));
  const completableIdx = new Map(
    completable.map((s, i) => [s.section_id, i]),
  );

  const isCompleted = (sectionId: string) =>
    progress.find((p) => p.section_id === sectionId)?.status === "completed";

  // The gate: index of the first not-yet-completed unit. Everything up to and
  // including it is reachable; anything past it stays locked even if older,
  // out-of-order progress rows happen to mark a later unit complete.
  const firstIncomplete = completable.findIndex(
    (s) => !isCompleted(s.section_id),
  );
  const gateIdx = firstIncomplete === -1 ? completable.length : firstIncomplete;

  const isSectionUnlocked = (sectionId: string): boolean => {
    // A stub unlocks exactly when its first child does.
    if (stubIds.has(sectionId)) {
      const group = groups.find((g) => g.parent.section_id === sectionId);
      const firstChild = group?.children[0]?.section.section_id;
      return firstChild ? isSectionUnlocked(firstChild) : true;
    }
    // Already done → always revisitable (and shows its ✓, never a lock).
    if (isCompleted(sectionId)) return true;
    const k = completableIdx.get(sectionId);
    if (k === undefined) return true;
    // Unlocked only if every preceding unit is complete.
    return k <= gateIdx;
  };

  const isUnlocked = (idx: number) => isSectionUnlocked(sections[idx].section_id);

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "6px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {groups.map(({ parent, parentIdx, children }) => {
        const isCurParent = currentIdx === parentIdx;
        const parentLocked = !isUnlocked(parentIdx);
        const isExp = expanded.has(parent.section_id);
        const hasChildren = children.length > 0;
        // Exclude the stub parent from the counter — only count real sub-sections
        const groupIds = hasChildren
          ? children.map((c) => c.section.section_id)
          : [parent.section_id];
        const groupDone = groupIds.filter(
          (id) =>
            progress.find((p) => p.section_id === id)?.status === "completed",
        ).length;
        // For groups with children, only show ✓ when ALL children are done
        const parentDone = hasChildren
          ? groupDone === groupIds.length && groupIds.length > 0
          : progress.find((p) => p.section_id === parent.section_id)?.status === "completed";

        return (
          <div key={parent.section_id}>
            {/* H2 topic row */}
            <button
              onClick={() => {
                if (!parentLocked) {
                  if (hasChildren) {
                    setExpanded((prev) => {
                      const n = new Set(prev);
                      n.has(parent.section_id)
                        ? n.delete(parent.section_id)
                        : n.add(parent.section_id);
                      return n;
                    });
                    // Skip the thin parent stub — go straight to first child
                    onSelect(children[0].idx);
                  } else {
                    onSelect(parentIdx);
                  }
                }
              }}
              className={isCurParent ? "trail-active" : ""}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 9,
                textAlign: "left",
                cursor: parentLocked ? "default" : "pointer",
                opacity: parentLocked ? 0.3 : 1,
                border: isCurParent
                  ? "1px solid var(--border-medium)"
                  : parentDone
                    ? "1px solid rgba(82,217,139,0.15)"
                    : "1px solid transparent",
                background: isCurParent
                  ? undefined
                  : parentDone
                    ? "rgba(82,217,139,0.04)"
                    : "transparent",
                boxShadow: isCurParent ? "var(--shadow-sm)" : "none",
                transition: "all 0.18s",
              }}
            >
              <span
                style={{
                  minWidth: 32,
                  height: 20,
                  borderRadius: 6,
                  padding: "0 4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  fontWeight: 700,
                  fontFamily: "monospace",
                  flexShrink: 0,
                  background: isCurParent
                    ? "rgba(78,205,196,0.14)"
                    : parentDone
                      ? "rgba(82,217,139,0.12)"
                      : "rgba(255,255,255,0.05)",
                  border: isCurParent
                    ? "1px solid rgba(78,205,196,0.4)"
                    : parentDone
                      ? "1px solid rgba(82,217,139,0.3)"
                      : "1px solid rgba(255,255,255,0.08)",
                  color: isCurParent
                    ? "var(--ac-cyan)"
                    : parentDone
                      ? "var(--ac-mint)"
                      : "var(--text-tertiary)",
                }}
              >
                {parentLocked ? (
                  <Lock size={8} />
                ) : parentDone ? (
                  <Check size={9} />
                ) : (
                  parent.section_id
                )}
              </span>
              <span
                style={{
                  flex: 1,
                  fontSize: 11,
                  fontWeight: isCurParent ? 600 : 400,
                  lineHeight: 1.35,
                  color: isCurParent
                    ? "var(--text-primary)"
                    : parentDone
                      ? "var(--ac-mint)"
                      : "var(--text-secondary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {parent.section_title}
              </span>
              {!parentLocked && hasChildren && (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 8,
                      fontFamily: "monospace",
                      color: "var(--text-tertiary)",
                      opacity: 0.5,
                    }}
                  >
                    {groupDone}/{groupIds.length}
                  </span>
                  {isExp ? (
                    <ChevronUp size={9} color="var(--text-tertiary)" />
                  ) : (
                    <ChevronDown size={9} color="var(--text-tertiary)" />
                  )}
                </span>
              )}
            </button>

            {/* H3 sub-sections */}
            {isExp && hasChildren && (
              <div
                style={{
                  marginLeft: 14,
                  paddingLeft: 8,
                  borderLeft: "1px solid rgba(78,205,196,0.1)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                  marginBottom: 2,
                }}
              >
                {children.map(({ section: child, idx: childIdx }) => {
                  const childDone =
                    progress.find((p) => p.section_id === child.section_id)
                      ?.status === "completed";
                  const isCurChild = currentIdx === childIdx;
                  const childLocked = !isUnlocked(childIdx);
                  return (
                    <button
                      key={child.section_id}
                      onClick={() => !childLocked && onSelect(childIdx)}
                      className={isCurChild ? "trail-active" : ""}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "5px 8px",
                        borderRadius: 7,
                        textAlign: "left",
                        cursor: childLocked ? "default" : "pointer",
                        opacity: childLocked ? 0.3 : 1,
                        border: isCurChild
                          ? "1px solid rgba(155,111,208,0.3)"
                          : childDone
                            ? "1px solid rgba(82,217,139,0.1)"
                            : "1px solid transparent",
                        background: isCurChild
                          ? "rgba(155,111,208,0.07)"
                          : childDone
                            ? "rgba(82,217,139,0.03)"
                            : "transparent",
                        transition: "all 0.15s",
                      }}
                    >
                      <span
                        style={{
                          minWidth: 30,
                          height: 17,
                          borderRadius: 5,
                          padding: "0 3px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 8,
                          fontWeight: 700,
                          fontFamily: "monospace",
                          flexShrink: 0,
                          background: isCurChild
                            ? "rgba(155,111,208,0.18)"
                            : childDone
                              ? "rgba(82,217,139,0.1)"
                              : "rgba(255,255,255,0.04)",
                          border: isCurChild
                            ? "1px solid rgba(155,111,208,0.4)"
                            : childDone
                              ? "1px solid rgba(82,217,139,0.25)"
                              : "1px solid rgba(255,255,255,0.06)",
                          color: isCurChild
                            ? "var(--ac-violet)"
                            : childDone
                              ? "var(--ac-mint)"
                              : "var(--text-tertiary)",
                        }}
                      >
                        {childLocked ? (
                          <Lock size={7} />
                        ) : childDone ? (
                          <Check size={8} />
                        ) : (
                          child.section_id
                        )}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          fontSize: 10,
                          lineHeight: 1.35,
                          color: isCurChild
                            ? "#C4A8F0"
                            : childDone
                              ? "var(--ac-mint)"
                              : "var(--text-tertiary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {child.section_title}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Module Quiz — unlocks after all sections done */}
      <div
        style={{
          marginTop: 4,
          paddingTop: 6,
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <button
          onClick={() => quizUnlocked && onStartFinalQuiz()}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            borderRadius: 9,
            textAlign: "left",
            cursor: quizUnlocked ? "pointer" : "default",
            opacity: quizUnlocked ? 1 : 0.3,
            border: quizUnlocked
              ? "1px solid rgba(232,184,75,0.3)"
              : "1px solid rgba(255,255,255,0.06)",
            background: quizUnlocked ? "rgba(232,184,75,0.05)" : "transparent",
            transition: "all 0.18s",
          }}
        >
          <span
            style={{
              width: 32,
              height: 20,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: quizUnlocked
                ? "rgba(232,184,75,0.15)"
                : "rgba(255,255,255,0.04)",
              border: quizUnlocked
                ? "1px solid rgba(232,184,75,0.35)"
                : "1px solid rgba(255,255,255,0.07)",
              flexShrink: 0,
            }}
          >
            <Brain
              size={10}
              color={quizUnlocked ? "#E8B84B" : "var(--text-tertiary)"}
            />
          </span>
          <span
            style={{
              flex: 1,
              fontSize: 11,
              fontWeight: 600,
              color: quizUnlocked ? "#E8B84B" : "var(--text-tertiary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            Module Quiz · 10 Questions
          </span>
          {quizUnlocked ? (
            <ChevronRight size={10} color="#E8B84B" style={{ flexShrink: 0 }} />
          ) : (
            <Lock
              size={9}
              color="var(--text-tertiary)"
              style={{ flexShrink: 0 }}
            />
          )}
        </button>
        {!quizUnlocked && (
          <p
            style={{
              fontSize: 9,
              color: "var(--text-tertiary)",
              fontFamily: "monospace",
              textAlign: "center",
              marginTop: 3,
              opacity: 0.4,
            }}
          >
            Complete all topics to unlock
          </p>
        )}
      </div>
    </div>
  );
}
