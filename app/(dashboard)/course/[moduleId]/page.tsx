"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAudio } from "@/features/course/hooks/useAudio";
import { useModuleData } from "@/features/course/hooks/useModuleData";
import { useSections } from "@/features/course/hooks/useSections";
import { useTeachingPoints } from "@/features/course/hooks/useTeachingPoints";
import { useMic } from "@/features/course/hooks/useMic";
import { useChat } from "@/features/course/hooks/useChat";
import { SectionTrail } from "@/features/course/content/SectionTrail";
import { SpeakingWave } from "@/features/course/content/SpeakingWave";
import { QuizModal } from "@/features/course/content/QuizModal";
import { PageSkeleton } from "@/features/course/content/PageSkeleton";
import { AssistantMessage } from "@/features/course/content/AssistantMessage";
import { TypingIndicator } from "@/features/course/content/TypingIndicator";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Brain,
  CheckCircle2,
  MicOff,
  Volume2,
  VolumeX,
  Check,
  Lock,
  Square,
  RotateCcw,
  Search,
  PanelLeft,
  BookOpen,
  CircleHelp,
  Sparkles,
  Plus,
  AudioLines,
  ArrowUp,
} from "lucide-react";
import type { SectionProgress } from "@/types/course";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_DEFAULT_WIDTH = 280;
const SIDEBAR_MAX_WIDTH = 380;
const CHAT_MIN_WIDTH = 360;
const SIDEBAR_KEYBOARD_STEP = 20;
const SIDEBAR_WIDTH_STORAGE_KEY = "course_topics_sidebar_width";

function getSidebarMaxWidth() {
  if (typeof window === "undefined") return SIDEBAR_MAX_WIDTH;
  return Math.max(
    SIDEBAR_MIN_WIDTH,
    Math.min(SIDEBAR_MAX_WIDTH, window.innerWidth - CHAT_MIN_WIDTH),
  );
}

function clampSidebarWidth(width: number) {
  if (!Number.isFinite(width)) return SIDEBAR_DEFAULT_WIDTH;
  return Math.min(
    Math.max(Math.round(width), SIDEBAR_MIN_WIDTH),
    getSidebarMaxWidth(),
  );
}

export default function CourseModulePage() {
  const params = useParams();
  const router = useRouter();
  const moduleId = params.moduleId as string;

  // ── Local UI state ──
  const [input, setInput] = useState("");
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizPassed, setQuizPassed] = useState(false);
  // How the quiz was opened:
  //  "section" = AI quiz on a subtopic's Mark Done → completing advances to
  //              the next topic.
  //  "final"   = end-of-module HTML quiz → completing unlocks the next module.
  const [quizTrigger, setQuizTrigger] = useState<"section" | "final">("final");
  // Set once the student submits the quiz, so closing the results advances
  // them (score doesn't gate progress). Cancelling leaves them in place.
  const quizCompletedRef = useRef(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [sectionCompleted, setSectionCompleted] = useState(false);
  const [isRelearning, setIsRelearning] = useState(false);
  const [showAdvancePrompt, setShowAdvancePrompt] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [sidebarWidthLoaded, setSidebarWidthLoaded] = useState(false);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [sidebarSearchOpen, setSidebarSearchOpen] = useState(false);
  const [sidebarQuery, setSidebarQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Speaking-orb visibility: the AI avatar pulses as an orb while its reply is
  // spoken. Stays up across the brief silent gaps between streamed sentence
  // utterances, and only reverts to the static avatar once speech has ended.
  const [orbActive, setOrbActive] = useState(false);
  const orbHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Shared refs that bridge hook boundaries
  const streamRef = useRef(false);
  const doSendRef = useRef<
    ((text: string, silent: boolean) => Promise<void>) | undefined
  >();

  // ── Feature hooks ──
  const audio = useAudio();
  const moduleData = useModuleData(moduleId);
  const sectionsData = useSections(moduleId);
  const tp = useTeachingPoints({
    moduleId,
    currentSection: sectionsData.currentSection,
    sectionProgress: sectionsData.sectionProgress,
  });
  const mic = useMic({
    doSendRef,
    streamRef,
    playingRef: audio.playingRef,
    activatedRef: audio.activatedRef,
    startMicRef: audio.startMicRef,
    micStoppedRef: audio.micStoppedRef,
    micManualRef: audio.micManualRef,
    setInput,
  });
  const chat = useChat({
    moduleId,
    sectionId: sectionsData.currentSection?.section_id,
    cancelSpeech: audio.cancelSpeech,
    feedToken: audio.feedToken,
    flushSpeech: audio.flushSpeech,
    speak: audio.speakFinal,
    bufRef: audio.bufRef,
    audioRef: audio.audioRef,
    streamRef,
    micRef: mic.micRef,
    recRef: mic.recRef,
    setMicActive: mic.setMicActive,
    micStoppedRef: audio.micStoppedRef,
    micManualRef: audio.micManualRef,
    autoMicTimer: mic.autoMicTimer,
    tpRef: tp.tpRef,
    tpIdxRef: tp.tpIdxRef,
    tPhaseRef: tp.tPhaseRef,
    setTeachingPoints: tp.setTeachingPoints,
    setCurrentPtIdx: tp.setCurrentPtIdx,
    setTPhase: tp.setTPhase,
    secRef: sectionsData.secRef,
    doneSecsRef: sectionsData.doneSecsRef,
    setSectionProgress: sectionsData.setSectionProgress,
    setSessionKP: sectionsData.setSessionKP,
    mTitleRef: moduleData.mTitleRef,
    pNumRef: moduleData.pNumRef,
    pTitleRef: moduleData.pTitleRef,
  });

  // Populate doSendRef so useMic can call doSend after first render
  useEffect(() => {
    doSendRef.current = chat.doSend;
  }, [chat.doSend]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
      const parsed = saved ? Number(saved) : NaN;
      if (Number.isFinite(parsed)) {
        setSidebarWidth(clampSidebarWidth(parsed));
      }
    } catch { /* ignore */ }
    setSidebarWidthLoaded(true);
  }, []);

  useEffect(() => {
    const handleWindowResize = () => {
      setSidebarWidth((current) => clampSidebarWidth(current));
    };
    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  useEffect(() => {
    if (!isResizingSidebar) return;

    const originalCursor = document.body.style.cursor;
    const originalUserSelect = document.body.style.userSelect;

    const handlePointerMove = (event: PointerEvent) => {
      setSidebarWidth(clampSidebarWidth(event.clientX));
    };
    const handlePointerEnd = () => {
      setIsResizingSidebar(false);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [isResizingSidebar]);

  useEffect(() => {
    if (!sidebarWidthLoaded || isResizingSidebar) return;
    try {
      window.localStorage.setItem(
        SIDEBAR_WIDTH_STORAGE_KEY,
        String(sidebarWidth),
      );
    } catch { /* ignore */ }
  }, [isResizingSidebar, sidebarWidth, sidebarWidthLoaded]);

  useEffect(
    () => () => {
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    },
    [],
  );

  const handleSidebarResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const key = event.key;
      const handlesKey =
        key === "ArrowLeft" ||
        key === "ArrowRight" ||
        key === "Home" ||
        key === "End";

      if (!handlesKey) return;
      event.preventDefault();

      setSidebarWidth((current) => {
        if (key === "Home") return SIDEBAR_MIN_WIDTH;
        if (key === "End") return getSidebarMaxWidth();
        const delta =
          key === "ArrowLeft"
            ? -SIDEBAR_KEYBOARD_STEP
            : SIDEBAR_KEYBOARD_STEP;
        return clampSidebarWidth(current + delta);
      });
    },
    [],
  );

  // Keep last_section in sync with wherever the user currently is,
  // including auto-resume jumps that bypass switchSection
  useEffect(() => {
    const sec = sectionsData.currentSection;
    if (!sec) return;
    try {
      localStorage.setItem(
        `last_section_${moduleId}`,
        JSON.stringify({ sectionId: sec.section_id, sectionTitle: sec.section_title }),
      );
    } catch { /* ignore */ }
  }, [sectionsData.currentSection, moduleId]);

  // Let speakText stop the mic before speaking
  useEffect(() => {
    audio.stopMicRef.current = () => {
      if (mic.micRef.current) {
        mic.recRef.current?.stop();
        mic.setMicActive(false);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Destructure for JSX ──
  const {
    audioEnabled,
    setAudioEnabled,
    isSpeaking,
    setUserActivated,
    ttsVoices,
    voiceId,
    setVoiceId,
    cancelSpeech,
    energyRef,
    speakText,
    audioRef,
  } = audio;

  // The per-utterance `isSpeaking` flag flickers off during the silent gaps
  // between streamed sentence utterances. So we treat speech as "ongoing" for
  // the whole reply: while audio is on AND the reply is still streaming (more
  // sentences are coming), OR while a sentence is actively being spoken. Once
  // both are false we wait out a short grace period, then hide.
  const speechOngoing = isSpeaking || (chat.streaming && audioEnabled);
  useEffect(() => {
    if (speechOngoing) {
      if (orbHideTimer.current) {
        clearTimeout(orbHideTimer.current);
        orbHideTimer.current = null;
      }
      setOrbActive(true);
    } else {
      if (orbHideTimer.current) clearTimeout(orbHideTimer.current);
      orbHideTimer.current = setTimeout(() => setOrbActive(false), 900);
    }
    return () => {
      if (orbHideTimer.current) {
        clearTimeout(orbHideTimer.current);
        orbHideTimer.current = null;
      }
    };
  }, [speechOngoing]);

  const { moduleTitle, partNumber, partTitle, nextModule, moduleAlreadyCompleted } =
    moduleData;

  const {
    sections,
    sectionsLoaded,
    currentSectionIdx,
    setCurrentSectionIdx,
    sectionProgress,
    setSectionProgress,
    sessionKP,
    setSessionKP,
    currentSection,
  } = sectionsData;

  const currentProgress =
    sectionProgress.find((p) => p.section_id === currentSection?.section_id) ??
    null;
  const currentSectionDone =
    !!currentSection &&
    !isRelearning &&
    (currentProgress?.status === "completed" || sectionCompleted);

  const {
    teachingPoints,
    currentPtIdx,
    setCurrentPtIdx,
    tPhase,
    setTPhase,
    setTeachingPoints,
  } = tp;

  const { micActive, setMicActive, toggleMic } = mic;

  const {
    messages,
    setMessages,
    streaming,
    exchangeCount,
    chatEndRef,
    hasStarted,
    doSend,
    restoreChatForSection,
    advanceTopic,
    stopAll,
    resetSection,
  } = chat;

  // ── Computed values ──
  const completedCount = sectionProgress.filter(
    (p) => p.status === "completed",
  ).length;
  const totalSections = sections.length;
  const progressPct =
    totalSections > 0 ? Math.round((completedCount / totalSections) * 100) : 0;

  const canGoNext = quizPassed || moduleAlreadyCompleted;

  // Stub sections (e.g. 1.2) are auto-skipped and never marked complete,
  // so exclude them from the quiz-unlock check
  const stubSectionIds = new Set(
    sections
      .filter((s) =>
        sections.some((other) =>
          other.section_id.startsWith(s.section_id + "."),
        ),
      )
      .map((s) => s.section_id),
  );
  const realSections = sections.filter((s) => !stubSectionIds.has(s.section_id));
  const completedTopicCount = realSections.filter(
    (s) =>
      sectionProgress.find((p) => p.section_id === s.section_id)?.status ===
      "completed",
  ).length;
  const topicProgressPct =
    realSections.length > 0
      ? Math.round((completedTopicCount / realSections.length) * 100)
      : 0;
  const currentTopicIdx = currentSection
    ? realSections.findIndex((s) => s.section_id === currentSection.section_id)
    : -1;
  const currentTopicNumber =
    currentTopicIdx >= 0
      ? currentTopicIdx + 1
      : Math.min(currentSectionIdx + 1, realSections.length || totalSections);
  const titleProgressPct =
    realSections.length > 0
      ? Math.round((currentTopicNumber / realSections.length) * 100)
      : progressPct;
  const quizUnlockedNow =
    realSections.length > 0 &&
    realSections.every(
      (s) =>
        sectionProgress.find((p) => p.section_id === s.section_id)?.status ===
        "completed",
    );
  const currentVoiceLabel =
    ttsVoices.find((v) => v.id === voiceId)?.label ?? "Voice";

  // Restore "this module is already cleared" from localStorage so the next
  // module stays unlocked after a reload. Score doesn't gate progress, so the
  // server's module-completion flag can't be relied on here.
  //
  // NOTE: the module quiz deliberately does NOT auto-open. The student starts
  // it from the sidebar "Module Quiz" button — that way reloading the page or
  // finishing a subtopic quiz never makes it pop up unexpectedly.
  useEffect(() => {
    let done = false;
    try {
      done = localStorage.getItem(`module_quiz_done_${moduleId}`) === "1";
    } catch { /* ignore */ }
    setQuizPassed(done);
  }, [moduleId]);

  // ── switchSection ──
  const switchSection = useCallback(
    (idx: number) => {
      if (idx === currentSectionIdx) return;
      const newSection = sections[idx];
      if (!newSection) return;

      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
      setShowAdvancePrompt(false);
      setSectionCompleted(false);
      let nextRelearning = false;
      try { nextRelearning = localStorage.getItem(`relearn_${moduleId}_${newSection.section_id}`) === "1"; } catch { /* ignore */ }
      setIsRelearning(nextRelearning);
      stopAll();

      // save last visited section for dashboard "Continue" widget
      try {
        localStorage.setItem(
          `last_section_${moduleId}`,
          JSON.stringify({ sectionId: newSection.section_id, sectionTitle: newSection.section_title }),
        );
      } catch { /* ignore */ }

      restoreChatForSection(newSection.section_id);

      setCurrentSectionIdx(idx);
      setSessionKP([]);
      setTeachingPoints([]);
      setCurrentPtIdx(0);
      setTPhase("PRE_NOTES");
    },
    [
      currentSectionIdx,
      sections,
      moduleId,
      stopAll,
      restoreChatForSection,
      setCurrentSectionIdx,
      setSessionKP,
      setTeachingPoints,
      setCurrentPtIdx,
      setTPhase,
    ],
  );

  // ── completeSection ──
  const completeSection = useCallback(() => {
    if (!currentSection) return;
    setSectionProgress((prev) => {
      const ex = prev.find((p) => p.section_id === currentSection.section_id);
      const upd: SectionProgress = ex
        ? { ...ex, status: "completed" }
        : {
            section_id: currentSection.section_id,
            section_title: currentSection.section_title,
            status: "completed",
            notes: "",
            key_points: sessionKP,
          };
      void fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          sectionId: currentSection.section_id,
          sectionTitle: currentSection.section_title,
          status: "completed",
          keyPoints: sessionKP,
        }),
      });
      return ex
        ? prev.map((p) =>
            p.section_id === currentSection.section_id ? upd : p,
          )
        : [...prev, upd];
    });
    setSectionCompleted(true);
    setIsRelearning(false);
    if (currentSection) {
      try { localStorage.removeItem(`relearn_${moduleId}_${currentSection.section_id}`); } catch { /* ignore */ }
    }
    if (currentSectionIdx < sections.length - 1) {
      setShowAdvancePrompt(true);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        setShowAdvancePrompt(false);
        setSectionCompleted(false);
        switchSection(currentSectionIdx + 1);
        advanceTimerRef.current = null;
      }, 2800);
    } else {
      // Last subtopic finished → clear the module so the next one unlocks and
      // it stays unlocked across reloads. The end-of-module quiz remains
      // available (optional) via the sidebar "Module Quiz" button.
      setQuizPassed(true);
      try {
        localStorage.setItem(`module_quiz_done_${moduleId}`, "1");
      } catch { /* ignore */ }
    }
  }, [
    currentSection,
    currentSectionIdx,
    sections.length,
    switchSection,
    sessionKP,
    moduleId,
    setSectionProgress,
  ]);

  // ── relearn (reset) current section ──
  const handleRelearn = useCallback(() => {
    if (advanceTimerRef.current) {
      clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    setShowAdvancePrompt(false);
    setSectionCompleted(false);
    // Don't touch sectionProgress — keeping the section "completed" in state
    // ensures downstream sections stay unlocked while the student re-engages.
    setIsRelearning(true);
    if (currentSection) {
      try { localStorage.setItem(`relearn_${moduleId}_${currentSection.section_id}`, "1"); } catch { /* ignore */ }
    }
    resetSection();
    setTeachingPoints([]);
    setCurrentPtIdx(0);
    setTPhase("PRE_NOTES");
  }, [
    resetSection,
    setTeachingPoints,
    setCurrentPtIdx,
    setTPhase,
    currentSection,
    moduleId,
  ]);

  const startLesson = useCallback(() => {
    setUserActivated(true);
    hasStarted.current = true;
    setTPhase("PRE_NOTES");
    void doSend("__AUTO_START__", true);
  }, [setUserActivated, hasStarted, setTPhase, doSend]);

  const sendInput = useCallback(() => {
    const t = input.trim();
    if (!t || streamRef.current || currentSectionDone) return;
    setInput("");
    void doSend(t, false);
  }, [currentSectionDone, input, doSend]);

  // Read the latest AI message aloud (and drive the voice wave). Clicking
  // again while speaking stops it.
  const handleReadAloud = useCallback(() => {
    if (isSpeaking || streamRef.current) {
      stopAll();
      return;
    }
    const last = [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && m.content);
    if (!last?.content) return;
    const text = last.content
      .replace(/:::VISUAL\n?/g, "")
      .replace(/\n?:::[A-Z]+\n[\s\S]*?:::/g, "")
      .replace(/[*_`#>]/g, "")
      .trim();
    if (!text) return;
    // Force audio on for an explicit read-aloud, even if muted.
    audioRef.current = true;
    setAudioEnabled(true);
    setUserActivated(true);
    speakText(text);
  }, [
    isSpeaking,
    messages,
    stopAll,
    audioRef,
    setAudioEnabled,
    setUserActivated,
    speakText,
  ]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopAll();
        return;
      }
      if (e.altKey && e.key === "n") {
        e.preventDefault();
        if (currentSectionIdx < sections.length - 1) completeSection();
        return;
      }
      if (e.altKey && e.key === "q") {
        e.preventDefault();
        setQuizTrigger("final");
        setShowQuiz(true);
        return;
      }
      if (e.altKey && e.key === "m") {
        e.preventDefault();
        toggleMic();
        return;
      }
      if (e.altKey && e.key === "a") {
        e.preventDefault();
        setAudioEnabled((v) => !v);
        return;
      }
      if (e.altKey && e.key === "k") {
        e.preventDefault();
        setShowKeyboardHelp((v) => !v);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [stopAll, completeSection, currentSectionIdx, sections.length, toggleMic, setAudioEnabled]);

  /* ══ RENDER ══ */
  if (!sectionsLoaded) return <PageSkeleton />;

  const moduleLabel = `M${moduleId.replace("m", "").padStart(2, "0")}`;
  const moduleNum = parseInt(moduleId.replace("m", ""), 10);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background font-sans text-foreground">
      {/* ── Section advance toast ── */}
      <AnimatePresence>
        {showAdvancePrompt && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            className="pointer-events-none fixed bottom-7 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-3 rounded-lg border bg-card px-5 py-3 shadow-lg"
          >
            <CheckCircle2 size={18} className="text-foreground" />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Section complete
              </p>
              <p className="text-sm font-semibold text-foreground">
                Moving to next section…
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Keyboard shortcuts help panel ── */}
      <AnimatePresence>
        {showKeyboardHelp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            onClick={() => setShowKeyboardHelp(false)}
            className="fixed right-4 top-[60px] z-[150] min-w-[240px] cursor-pointer rounded-lg border bg-card p-4 shadow-lg"
          >
            <p className="mb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Keyboard shortcuts
            </p>
            {[
              { key: "Alt+N", label: "Next section" },
              { key: "Alt+Q", label: "Open quiz" },
              { key: "Alt+M", label: "Toggle mic" },
              { key: "Alt+A", label: "Toggle audio" },
              { key: "Alt+K", label: "This help panel" },
              { key: "Escape", label: "Stop speaking" },
              { key: "Enter", label: "Send message" },
              { key: "Shift+Enter", label: "New line" },
            ].map(({ key, label }) => (
              <div key={key} className="mb-1.5 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                  {key}
                </kbd>
              </div>
            ))}
            <p className="mt-2 text-center font-mono text-[9px] text-muted-foreground">
              click to close
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN ── */}
      <div
        className={cn(
          "flex flex-1 overflow-hidden",
          isResizingSidebar && "cursor-col-resize select-none",
        )}
      >
        {/* SIDEBAR */}
        {!sidebarCollapsed && (
        <aside
          className="relative flex shrink-0 flex-col border-r border-border/70 bg-[#0d0d0d]"
          style={{ width: sidebarWidth }}
        >
          <div
            role="separator"
            aria-label="Resize topics sidebar"
            aria-orientation="vertical"
            aria-valuemin={SIDEBAR_MIN_WIDTH}
            aria-valuemax={SIDEBAR_MAX_WIDTH}
            aria-valuenow={sidebarWidth}
            aria-valuetext={`${sidebarWidth}px`}
            tabIndex={0}
            title="Drag to resize topics sidebar"
            onPointerDown={(event) => {
              event.preventDefault();
              setIsResizingSidebar(true);
            }}
            onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT_WIDTH)}
            onKeyDown={handleSidebarResizeKeyDown}
            className={cn(
              "absolute -right-1 top-0 z-20 h-full w-2 cursor-col-resize touch-none outline-none",
              "after:absolute after:left-1/2 after:top-2 after:h-[calc(100%-1rem)] after:w-px after:-translate-x-1/2 after:bg-transparent after:transition-colors",
              "hover:after:bg-foreground/25 focus-visible:after:bg-foreground/50",
              isResizingSidebar && "after:bg-foreground/50",
            )}
          />
          <div className="flex shrink-0 flex-col gap-4 px-4 pb-1 pt-4">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-[0_4px_14px_-2px_hsl(var(--brand)/0.55)]">
                <Sparkles size={18} className="fill-current" />
              </div>
              <p className="min-w-0 flex-1 truncate text-[17px] font-bold tracking-tight text-foreground">
                Account Academy
              </p>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
                  sidebarSearchOpen && "bg-white/[0.06] text-foreground",
                )}
                onClick={() => {
                  setSidebarSearchOpen((open) => {
                    if (open) setSidebarQuery("");
                    return !open;
                  });
                }}
                title="Search topics"
              >
                <Search size={16} />
              </Button>
            </div>

            {sidebarSearchOpen && (
              <Input
                value={sidebarQuery}
                onChange={(event) => setSidebarQuery(event.target.value)}
                placeholder="Search topics"
                autoFocus
                className="h-9 rounded-lg border-border/70 bg-white/[0.03] text-xs"
              />
            )}

            <div className="flex flex-col gap-2.5">
              <p className="px-0.5 text-[12px] font-medium text-muted-foreground">
                Current module
              </p>
              <div className="rounded-xl border border-border/70 bg-white/[0.025] p-3.5">
                <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-brand">
                  <BookOpen size={12} />
                  Part {partNumber} · {moduleLabel}
                </div>
                <h2 className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">
                  {moduleTitle}
                </h2>
                <div className="mt-3.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Module progress</span>
                  <span className="font-mono font-medium text-foreground">
                    {completedTopicCount}/{realSections.length || 0}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                  <motion.div
                    className="h-full rounded-full bg-brand"
                    initial={false}
                    animate={{ width: `${topicProgressPct}%` }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            </div>
          </div>

          {sections.length > 0 ? (
            <SectionTrail
              sections={sections}
              currentIdx={currentSectionIdx}
              progress={sectionProgress}
              query={sidebarQuery}
              onSelect={switchSection}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="px-3 text-center text-xs text-muted-foreground">
                No sections found
              </p>
            </div>
          )}

          {/* module-end items */}
          <div className="shrink-0 px-4 pb-3 pt-2">
            <button
              type="button"
              disabled={!quizUnlockedNow}
              onClick={() => {
                setQuizTrigger("final");
                setShowQuiz(true);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border border-border/70 bg-white/[0.025] px-3 py-3 text-left transition-colors",
                quizUnlockedNow
                  ? "hover:border-brand/40 hover:bg-brand/[0.06]"
                  : "cursor-default opacity-70",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  quizUnlockedNow
                    ? "bg-brand/15 text-brand"
                    : "bg-white/[0.05] text-muted-foreground",
                )}
              >
                <CircleHelp size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-foreground">
                  Module Quiz
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  10 Questions
                </span>
              </span>
              {quizUnlockedNow ? (
                <ChevronRight size={16} className="shrink-0 text-brand" />
              ) : (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/[0.05] px-2 py-1 font-mono text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                  <Lock size={9} /> Locked
                </span>
              )}
            </button>
            {!quizUnlockedNow && (
              <p className="mt-1.5 px-1 text-center text-[10px] text-muted-foreground">
                Complete all topics to unlock
              </p>
            )}
          </div>

          {/* section nav */}
          <div className="flex shrink-0 items-center gap-2 border-t border-border/70 px-4 py-3">
            <Button
              variant="outline"
              size="sm"
              className="h-10 flex-1 gap-1.5 rounded-xl border-border/70 bg-transparent text-[13px] font-medium text-muted-foreground hover:bg-white/[0.05] hover:text-foreground disabled:opacity-40"
              onClick={() => {
                if (currentSectionIdx > 0) {
                  switchSection(currentSectionIdx - 1);
                } else if (moduleNum > 1) {
                  router.push(`/course/m${String(moduleNum - 1).padStart(2, "0")}`);
                }
              }}
              disabled={currentSectionIdx === 0 && moduleNum <= 1}
            >
              <ChevronLeft size={15} /> Prev
            </Button>

            {currentSectionIdx < sections.length - 1 ? (
              <Button
                size="sm"
                className="h-10 flex-1 gap-1.5 rounded-xl bg-brand text-[13px] font-semibold text-brand-foreground shadow-[0_4px_14px_-3px_hsl(var(--brand)/0.6)] hover:bg-brand/90"
                onClick={() => switchSection(currentSectionIdx + 1)}
              >
                Next <ChevronRight size={15} />
              </Button>
            ) : nextModule && canGoNext ? (
              <Button
                size="sm"
                className="h-10 flex-1 gap-1.5 rounded-xl bg-brand text-[13px] font-semibold text-brand-foreground shadow-[0_4px_14px_-3px_hsl(var(--brand)/0.6)] hover:bg-brand/90"
                onClick={() => router.push(`/course/${nextModule}`)}
              >
                Next <ChevronRight size={15} />
              </Button>
            ) : nextModule ? (
              <Button
                size="sm"
                disabled
                className="h-10 flex-1 gap-1.5 rounded-xl bg-white/[0.05] text-[13px] font-medium text-muted-foreground disabled:opacity-60"
              >
                <Lock size={13} /> Next
              </Button>
            ) : (
              <div className="flex-1" />
            )}
          </div>
        </aside>
        )}

        {/* CHAT COLUMN */}
        <div className="course-canvas relative flex min-w-0 flex-1 flex-col">
          {/* ── HEADER ── */}
          <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border/50 px-3">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed((v) => !v)}
                className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                title={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
              >
                <PanelLeft size={16} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/dashboard")}
                className="shrink-0 gap-2 rounded-lg border-border/70 bg-white/[0.03] px-3.5 text-sm font-medium text-muted-foreground shadow-none hover:bg-white/[0.07] hover:text-foreground"
              >
                <ChevronLeft size={14} />
                Dashboard
              </Button>
              <span className="hidden shrink-0 items-center rounded-md bg-white/[0.06] px-2 py-1 font-mono text-[11px] font-medium text-muted-foreground sm:inline-flex">
                {moduleLabel}
              </span>
              {currentSection && (
                <span className="hidden shrink-0 items-center rounded-md border border-brand/40 bg-brand/10 px-2 py-1 font-mono text-[11px] font-semibold text-brand sm:inline-flex">
                  § {currentSection.section_id}
                </span>
              )}
              {currentSection && (
                <>
                  <span className="hidden text-muted-foreground/60 sm:inline">/</span>
                  <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                    {currentSection.section_title}
                  </p>
                </>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden items-center gap-2.5 rounded-lg bg-white/[0.05] px-3 py-1.5 lg:flex">
                <span className="font-mono text-[11px] text-muted-foreground">
                  {currentTopicNumber} <span className="text-muted-foreground/50">/</span> {realSections.length || totalSections}
                </span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.08]">
                  <motion.div
                    className="h-full rounded-full bg-brand"
                    initial={false}
                    animate={{ width: `${titleProgressPct}%` }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden h-8 max-w-[150px] gap-1.5 rounded-lg px-3 font-mono text-[11px] text-muted-foreground sm:inline-flex"
                    title="Choose voice"
                  >
                    <span className="truncate">{currentVoiceLabel}</span>
                    <ChevronDown size={12} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-48">
                  <DropdownMenuRadioGroup
                    value={voiceId}
                    onValueChange={(id) => setVoiceId(id)}
                  >
                    {ttsVoices.map((v) => (
                      <DropdownMenuRadioItem
                        key={v.id}
                        value={v.id}
                        className="text-xs"
                      >
                        {v.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-8 rounded-lg transition-colors",
                  isSpeaking
                    ? "bg-brand/15 text-brand hover:bg-brand/25"
                    : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
                )}
                onClick={handleReadAloud}
                title={isSpeaking ? "Stop reading" : "Read latest aloud"}
              >
                <AudioLines size={15} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-lg text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                onClick={() => {
                  setAudioEnabled((v) => !v);
                  if (audioEnabled) cancelSpeech();
                }}
                title={audioEnabled ? "Mute audio" : "Enable audio"}
              >
                {audioEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </Button>
              {currentSection && !currentSectionDone && (
                <Button
                  size="sm"
                  className="gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground shadow-[0_4px_14px_-3px_hsl(var(--brand)/0.6)] hover:bg-brand/90"
                  onClick={() => {
                    setQuizTrigger("section");
                    setShowQuiz(true);
                  }}
                >
                  <Check size={14} strokeWidth={3} /> Mark done
                </Button>
              )}
              {currentSectionDone && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-2 rounded-lg bg-white/[0.06] px-4"
                  disabled
                >
                  <CheckCircle2 size={14} /> Done
                </Button>
              )}
            </div>
          </header>

          {/* Voice-reactive wave — a gradient waveform that ripples in time with
              the spoken audio. Sits in flow just below the header so it never
              overlaps the chat; click to stop. Hidden via CSS for
              reduced-motion / print. */}
          {orbActive && (
            <div className="shrink-0 border-b border-border/50">
              <SpeakingWave
                energyRef={energyRef}
                onStop={() => {
                  if (orbHideTimer.current) {
                    clearTimeout(orbHideTimer.current);
                    orbHideTimer.current = null;
                  }
                  setOrbActive(false);
                  stopAll();
                }}
              />
            </div>
          )}

          {/* MESSAGES */}
          <div className="chat-messages flex flex-1 flex-col overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 px-6 py-4">
            {currentSectionDone && !streaming ? (
              <div className="flex flex-1 items-center justify-center px-6 pb-24 text-center">
                <div className="flex max-w-sm flex-col items-center">
                  <div className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <CheckCircle2 size={17} />
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                    Section complete
                  </h2>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
                    Relearn this section anytime.
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    className="mt-5 h-10 gap-2 rounded-xl bg-foreground px-4 text-sm font-semibold text-background shadow-none hover:bg-foreground/90"
                    onClick={handleRelearn}
                  >
                    <RotateCcw size={15} /> Relearn this
                  </Button>
                </div>
              </div>
            ) : messages.length === 0 && !streaming ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 pb-20 text-center">
                <div className="flex max-w-2xl flex-col items-center">
                  <h2 className="text-4xl font-bold tracking-tight text-foreground">
                    Ready when you are
                  </h2>
                  <p className="mt-8 max-w-2xl text-lg leading-8 text-muted-foreground">
                    Your AI tutor for{" "}
                    <span className="font-bold text-foreground">
                      {currentSection?.section_title ?? moduleTitle}
                    </span>
                  </p>
                  {currentSection && (
                    <p className="mt-6 text-base text-muted-foreground">
                      Tap <span className="font-semibold text-foreground">Start Lesson</span>{" "}
                      to begin, or type a question below.
                    </p>
                  )}

                  <Button
                    size="sm"
                    className="mt-8 h-10 gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-brand-foreground shadow-[0_6px_20px_-4px_hsl(var(--brand)/0.6)] hover:bg-brand/90"
                    onClick={startLesson}
                  >
                    <Brain size={15} /> Start Lesson
                  </Button>
                </div>
              </div>
            ) : null}

            {!currentSectionDone && messages.map((msg, i) => {
              const isUser = msg.role === "user";
              const isLastAss =
                msg.role === "assistant" && i === messages.length - 1;

              return (
                <div
                  key={i}
                  className={cn(
                    "flex w-full animate-msg-in",
                    isUser ? "justify-end" : "justify-start gap-3",
                  )}
                >
                  {isUser ? (
                    <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl bg-white/[0.07] px-4 py-2.5 text-sm leading-relaxed text-foreground">
                      {msg.content || null}
                    </div>
                  ) : (
                    <>
                    {/* Static avatar — the voice-reactive visualizer now lives
                        as a wave band above the input bar (see SpeakingWave). */}
                    <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-[0_3px_10px_-3px_hsl(var(--brand)/0.6)]">
                      <Sparkles size={13} className="fill-current" />
                    </div>
                    <div className="min-w-0 flex-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm leading-relaxed text-foreground">
                      {msg.content ? (
                        <AssistantMessage
                          content={msg.content}
                          svg={msg.visual}
                          answeredMcq={msg.mcqAnswer ?? null}
                          isStreaming={isLastAss && streaming}
                          onAnswer={(letter, fullText) => {
                            if (msg.mcqAnswer) return;
                            setMessages((prev) =>
                              prev.map((m, mi) =>
                                mi === i ? { ...m, mcqAnswer: letter } : m,
                              ),
                            );
                            const correct = msg.mcqCorrect;
                            if (correct && letter === correct) {
                              advanceTopic("Correct! Well done.");
                            } else {
                              void doSend(fullText, false);
                            }
                          }}
                        />
                      ) : (
                        <span className="italic text-muted-foreground">…</span>
                      )}
                    </div>
                    </>
                  )}
                </div>
              );
            })}

            {streaming &&
              messages[messages.length - 1]?.role !== "assistant" && (
                <TypingIndicator />
              )}
            <div ref={chatEndRef} className="h-2" />
          </div>
          </div>

          {/* INPUT BAR */}
          <div className="shrink-0 px-4 pb-5 pt-2">
            <div
              className={cn(
                "mx-auto flex max-w-3xl flex-col gap-2 rounded-2xl border border-border/70 bg-[#151311]/85 px-3.5 py-3 shadow-xl backdrop-blur transition-colors focus-within:border-brand/35",
                micActive && "border-brand/45",
              )}
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendInput();
                  }
                }}
                disabled={streaming || currentSectionDone}
                rows={1}
                placeholder={
                  currentSectionDone
                    ? "Relearn this section to chat again"
                    : micActive
                    ? "Listening…"
                    : streaming
                      ? "Alex is responding…"
                      : "Ask anything…"
                }
                className="max-h-32 min-h-[24px] resize-none border-0 bg-transparent px-1 py-0.5 text-sm shadow-none focus-visible:ring-0"
              />

              <div className="flex items-center justify-between">
                {/* attach (placeholder) */}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-9 shrink-0 rounded-lg text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
                  disabled={streaming || currentSectionDone}
                  title="Add"
                >
                  <Plus size={18} />
                </Button>

                <div className="flex items-center gap-1.5">
                  {/* mic */}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "size-9 shrink-0 rounded-lg",
                      micActive
                        ? "bg-brand/15 text-brand hover:bg-brand/20"
                        : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
                    )}
                    onClick={toggleMic}
                    disabled={streaming || currentSectionDone}
                    title={micActive ? "Stop mic" : "Use mic"}
                  >
                    {micActive ? <MicOff size={17} /> : <AudioLines size={17} />}
                  </Button>

                  {/* stop / send */}
                  {streaming || isSpeaking ? (
                    <Button
                      type="button"
                      size="icon"
                      className="size-9 shrink-0 rounded-lg bg-brand text-brand-foreground shadow-none hover:bg-brand/90"
                      onClick={stopAll}
                      title="Stop"
                    >
                      <Square size={13} className="fill-current" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="icon"
                      className="size-9 shrink-0 rounded-lg bg-brand text-brand-foreground shadow-none hover:bg-brand/90 disabled:bg-white/[0.06] disabled:text-muted-foreground"
                      onClick={sendInput}
                      disabled={!input.trim() || currentSectionDone}
                      title="Send"
                    >
                      <ArrowUp size={17} strokeWidth={2.5} />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {micActive && (
              <div className="mt-1.5 flex items-center gap-2 pl-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Listening…
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* quiz modal */}
      {showQuiz && (
        <QuizModal
          moduleId={moduleId}
          moduleTitle={moduleTitle}
          partNumber={partNumber}
          partTitle={partTitle}
          sectionId={
            quizTrigger === "section" ? currentSection?.section_id : undefined
          }
          sectionTitle={
            quizTrigger === "section"
              ? currentSection?.section_title
              : undefined
          }
          onClose={() => {
            setShowQuiz(false);
            // Only advance if the student actually finished the quiz (not if
            // they cancelled out of it). Score doesn't gate progress.
            if (!quizCompletedRef.current) return;
            quizCompletedRef.current = false;

            if (quizTrigger === "section") {
              // Subtopic quiz done → mark it complete and move to the next
              // topic. Finishing the last subtopic unlocks the next module
              // (handled in completeSection).
              completeSection();
            } else if (quizUnlockedNow) {
              // End-of-module quiz, taken once the whole module is done →
              // on to the next module (or the dashboard if this was the last).
              setQuizPassed(true);
              if (nextModule) {
                router.push(`/course/${nextModule}`);
              } else {
                router.push("/dashboard");
              }
            }
            // A "final" quiz taken mid-module (the header practice button) just
            // closes — it shouldn't unlock or skip ahead.
          }}
          onComplete={() => {
            // Quiz submitted — record it so closing the results advances.
            // Keep the modal open so answers can be reviewed first.
            quizCompletedRef.current = true;
            if (quizTrigger === "final" && quizUnlockedNow) {
              // Remember the module quiz is done so it won't re-pop on refresh.
              setQuizPassed(true);
              try {
                localStorage.setItem(`module_quiz_done_${moduleId}`, "1");
              } catch { /* ignore */ }
            }
          }}
        />
      )}
    </div>
  );
}
