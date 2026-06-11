"use client";

import {
  Check,
  Circle,
  Lock,
} from "lucide-react";
import { motion } from "framer-motion";
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
  query = "",
  onSelect,
}: {
  sections: Section[];
  currentIdx: number;
  progress: SectionProgress[];
  query?: string;
  onSelect: (i: number) => void;
}) {
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

  // The gate: the index after the last completed unit (high-water mark). This
  // way re-learning an earlier section (which sets it back to "in_progress")
  // never re-locks sections the student already unlocked further ahead.
  let lastCompletedIdx = -1;
  for (let i = 0; i < completable.length; i++) {
    if (isCompleted(completable[i].section_id)) lastCompletedIdx = i;
  }
  const gateIdx = lastCompletedIdx + 1;

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
  const normalizedQuery = query.trim().toLowerCase();
  const currentSectionId = sections[currentIdx]?.section_id;
  type TrailItem = {
    section: Section;
    idx: number;
    targetIdx: number;
    depth: 0 | 1;
    isStubParent: boolean;
    childIds: string[];
    searchText: string;
  };
  const topicItems = groups.flatMap<TrailItem>((group) => {
    const parentSearchText =
      `${group.parent.section_id} ${group.parent.section_title}`.toLowerCase();

    if (group.children.length === 0) {
      return [
        {
          section: group.parent,
          idx: group.parentIdx,
          targetIdx: group.parentIdx,
          depth: 0,
          isStubParent: false,
          childIds: [group.parent.section_id],
          searchText: parentSearchText,
        },
      ];
    }

    return [
      {
        section: group.parent,
        idx: group.parentIdx,
        targetIdx: group.children[0].idx,
        depth: 0,
        isStubParent: true,
        childIds: group.children.map(({ section }) => section.section_id),
        searchText: parentSearchText,
      },
      ...group.children.map(({ section, idx }) => ({
        section,
        idx,
        targetIdx: idx,
        depth: 1 as const,
        isStubParent: false,
        childIds: [section.section_id],
        searchText:
          `${parentSearchText} ${section.section_id} ${section.section_title}`.toLowerCase(),
      })),
    ];
  });
  const visibleTopicItems = normalizedQuery
    ? topicItems.filter((item) => item.searchText.includes(normalizedQuery))
    : topicItems;
  const lessonCount = completable.length;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto px-3 pb-3">
      <div className="flex shrink-0 items-center justify-between px-1 pb-2.5 pt-4">
        <p className="text-[13px] font-medium text-slate-500">Topics</p>
        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-800/80 px-1.5 font-mono text-[10px] font-medium text-slate-500">
          {lessonCount}
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        {visibleTopicItems.map((item, i) => {
          const { section } = item;
          const sectionDone = item.isStubParent
            ? item.childIds.every(isCompleted)
            : isCompleted(section.section_id);
          const targetSection = sections[item.targetIdx];
          const sectionLocked =
            !targetSection || !isUnlocked(item.targetIdx);
          const isCurrent = currentIdx === item.idx;
          const isGroupActive =
            item.isStubParent && !!currentSectionId && item.childIds.includes(currentSectionId);
          const active = isCurrent || isGroupActive;

          return (
            <motion.button
              key={section.section_id}
              type="button"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.22,
                delay: Math.min(i * 0.018, 0.32),
                ease: [0.22, 1, 0.36, 1],
              }}
              onClick={() => !sectionLocked && onSelect(item.targetIdx)}
              disabled={sectionLocked}
              title={section.section_title}
              className={cn(
                "group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                "text-slate-500 hover:bg-cyan-300/[0.05] hover:text-slate-200",
                item.depth === 1 && "pl-7",
                active && "bg-cyan-300/[0.06]",
                sectionLocked && "cursor-default opacity-40 hover:bg-transparent hover:text-slate-500",
              )}
            >
              {/* active topic rail */}
              {isCurrent && (
                <motion.span
                  layoutId="trail-active-rail"
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.55)]"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}

              <span className="flex w-4 shrink-0 justify-center">
                {sectionLocked ? (
                    <Lock size={13} className="opacity-80" />
                ) : sectionDone ? (
                  <span className="flex size-[18px] items-center justify-center rounded-full bg-cyan-300/15 text-cyan-300">
                    <Check size={12} strokeWidth={3} />
                  </span>
                ) : (
                  <Circle
                    size={13}
                    className={cn(active && "fill-cyan-300/20 text-cyan-300")}
                  />
                )}
              </span>

              <span
                className={cn(
                  "shrink-0 font-mono text-[11px] tabular-nums",
                  item.isStubParent ? "font-semibold" : "font-medium",
                  active ? "text-cyan-300" : "text-slate-600",
                )}
              >
                {section.section_id}
              </span>

              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-[12.5px] leading-snug",
                  item.isStubParent ? "font-medium text-slate-300" : "font-normal",
                  active && "font-medium text-slate-100",
                )}
              >
                {section.section_title}
              </span>
            </motion.button>
          );
        })}
      </div>

      {visibleTopicItems.length === 0 && (
        <div className="flex flex-1 items-center justify-center px-3 py-8 text-center">
          <p className="text-xs text-slate-500">No matching topics</p>
        </div>
      )}
    </div>
  );
}
