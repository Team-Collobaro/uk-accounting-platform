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
import { cn } from "@/lib/utils";
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
    <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
      {groups.map(({ parent, parentIdx, children }) => {
        const isCurParent = currentIdx === parentIdx;
        const parentLocked = !isUnlocked(parentIdx);
        const isExp = expanded.has(parent.section_id);
        const hasChildren = children.length > 0;
        const groupIds = hasChildren
          ? children.map((c) => c.section.section_id)
          : [parent.section_id];
        const groupDone = groupIds.filter(
          (id) =>
            progress.find((p) => p.section_id === id)?.status === "completed",
        ).length;
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
                    onSelect(children[0].idx);
                  } else {
                    onSelect(parentIdx);
                  }
                }
              }}
              disabled={parentLocked}
              className={cn(
                "flex w-full items-center gap-2 rounded-md border-l-2 border-transparent px-2.5 py-2 text-left transition-colors",
                parentLocked && "cursor-default opacity-40",
                isCurParent ? "border-l-foreground bg-accent" : "hover:bg-accent/50",
              )}
            >
              <span
                className={cn(
                  "flex h-5 min-w-[32px] shrink-0 items-center justify-center rounded border px-1 font-mono text-[9px] font-bold",
                  isCurParent
                    ? "border-foreground text-foreground"
                    : "bg-muted text-muted-foreground",
                )}
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
                className={cn(
                  "flex-1 truncate text-[11px] leading-snug",
                  isCurParent
                    ? "font-semibold text-foreground"
                    : parentDone
                      ? "text-muted-foreground line-through"
                      : "text-foreground/80",
                )}
              >
                {parent.section_title}
              </span>
              {!parentLocked && hasChildren && (
                <span className="flex shrink-0 items-center gap-1">
                  <span className="font-mono text-[8px] text-muted-foreground">
                    {groupDone}/{groupIds.length}
                  </span>
                  {isExp ? (
                    <ChevronUp size={9} className="text-muted-foreground" />
                  ) : (
                    <ChevronDown size={9} className="text-muted-foreground" />
                  )}
                </span>
              )}
            </button>

            {/* H3 sub-sections */}
            {isExp && hasChildren && (
              <div className="mb-0.5 ml-3.5 flex flex-col gap-px border-l pl-2">
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
                      disabled={childLocked}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md border-l-2 border-transparent px-2 py-1.5 text-left transition-colors",
                        childLocked && "cursor-default opacity-40",
                        isCurChild ? "border-l-foreground bg-accent" : "hover:bg-accent/50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-[17px] min-w-[30px] shrink-0 items-center justify-center rounded border px-1 font-mono text-[8px] font-bold",
                          isCurChild
                            ? "border-foreground text-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
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
                        className={cn(
                          "flex-1 truncate text-[10px] leading-snug",
                          isCurChild
                            ? "font-medium text-foreground"
                            : childDone
                              ? "text-muted-foreground line-through"
                              : "text-muted-foreground",
                        )}
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
      <div className="mt-1 border-t pt-1.5">
        <button
          onClick={() => quizUnlocked && onStartFinalQuiz()}
          disabled={!quizUnlocked}
          className={cn(
            "flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
            quizUnlocked ? "border-border hover:bg-accent" : "cursor-default border-transparent opacity-40",
          )}
        >
          <span className="flex h-5 w-8 shrink-0 items-center justify-center rounded border bg-muted">
            <Brain size={10} className="text-foreground" />
          </span>
          <span className="flex-1 truncate text-[11px] font-semibold text-foreground">
            Module Quiz · 10 Questions
          </span>
          {quizUnlocked ? (
            <ChevronRight size={10} className="shrink-0 text-muted-foreground" />
          ) : (
            <Lock size={9} className="shrink-0 text-muted-foreground" />
          )}
        </button>
        {!quizUnlocked && (
          <p className="mt-1 text-center font-mono text-[9px] text-muted-foreground opacity-60">
            Complete all topics to unlock
          </p>
        )}
      </div>
    </div>
  );
}
