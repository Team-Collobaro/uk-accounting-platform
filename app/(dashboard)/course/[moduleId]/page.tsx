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
import { QuizModal } from "@/features/course/content/QuizModal";
import { PageSkeleton } from "@/features/course/content/PageSkeleton";
import { AssistantMessage } from "@/features/course/content/AssistantMessage";
import { TypingIndicator } from "@/features/course/content/TypingIndicator";
import {
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Brain,
  CheckCircle2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Check,
  Lock,
  Keyboard,
  Square,
  RotateCcw,
} from "lucide-react";
import type { SectionProgress, Message } from "@/types/course";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

export default function CourseModulePage() {
  const params = useParams();
  const router = useRouter();
  const moduleId = params.moduleId as string;

  // ── Local UI state ──
  const [input, setInput] = useState("");
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizPassed, setQuizPassed] = useState(false);
  const [voiceName, setVoiceName] = useState<string | undefined>(undefined);
  // How the quiz was opened:
  //  "section" = AI quiz on a subtopic's Mark Done → completing advances to
  //              the next topic.
  //  "final"   = end-of-module HTML quiz → completing unlocks the next module.
  const [quizTrigger, setQuizTrigger] = useState<"section" | "final">("final");
  // Set once the student submits the quiz, so closing the results advances
  // them (score doesn't gate progress). Cancelling leaves them in place.
  const quizCompletedRef = useRef(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [sectionCompleted, setSectionCompleted] = useState(false);
  const [showAdvancePrompt, setShowAdvancePrompt] = useState(false);

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
    voiceRef: audio.voiceRef,
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
    availableVoices,
    voiceRef,
    cancelSpeech,
  } = audio;

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
  const quizUnlockedNow =
    realSections.length > 0 &&
    realSections.every(
      (s) =>
        sectionProgress.find((p) => p.section_id === s.section_id)?.status ===
        "completed",
    );

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

      // save last visited section for dashboard "Continue" widget
      try {
        localStorage.setItem(
          `last_section_${moduleId}`,
          JSON.stringify({ sectionId: newSection.section_id, sectionTitle: newSection.section_title }),
        );
      } catch { /* ignore */ }

      // load new section's chat from its own key
      let saved: Message[] = [];
      try {
        const raw = localStorage.getItem(`chat_history_${moduleId}_${newSection.section_id}`);
        if (raw) saved = JSON.parse(raw) as Message[];
      } catch { /* ignore */ }

      setCurrentSectionIdx(idx);
      setMessages(saved);
      setSessionKP([]);
      setTeachingPoints([]);
      setCurrentPtIdx(0);
      setTPhase("PRE_NOTES");
      hasStarted.current = saved.length > 0;
      cancelSpeech();
    },
    [
      currentSectionIdx,
      sections,
      moduleId,
      cancelSpeech,
      setCurrentSectionIdx,
      setMessages,
      setSessionKP,
      setTeachingPoints,
      setCurrentPtIdx,
      setTPhase,
      hasStarted,
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
    if (currentSectionIdx < sections.length - 1) {
      setShowAdvancePrompt(true);
      setTimeout(() => {
        setShowAdvancePrompt(false);
        setSectionCompleted(false);
        switchSection(currentSectionIdx + 1);
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
    resetSection();
    setTeachingPoints([]);
    setCurrentPtIdx(0);
    setTPhase("PRE_NOTES");
    if (currentSection) {
      setSectionProgress((prev) =>
        prev.map((p) =>
          p.section_id === currentSection.section_id
            ? { ...p, status: "in_progress", key_points: [] }
            : p,
        ),
      );
      void fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          sectionId: currentSection.section_id,
          sectionTitle: currentSection.section_title,
          status: "in_progress",
          keyPoints: [],
        }),
      });
    }
  }, [
    resetSection,
    setTeachingPoints,
    setCurrentPtIdx,
    setTPhase,
    currentSection,
    setSectionProgress,
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
    if (!t || streamRef.current) return;
    setInput("");
    void doSend(t, false);
  }, [input, doSend]);

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

  const currentVoiceName = voiceName ?? voiceRef.current?.name;
  const shortVoice = (name?: string) =>
    name ? name.replace(/Microsoft |Google /, "").slice(0, 16) : "Voice";

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

      {/* ── HEADER ── */}
      <header className="flex h-[52px] shrink-0 items-center justify-between gap-4 border-b px-4">
        {/* left */}
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="gap-1.5"
          >
            <ChevronLeft size={15} /> Back
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Part {partNumber} · {moduleId.toUpperCase()}
            </p>
            <p className="max-w-[280px] truncate text-sm font-semibold text-foreground">
              {moduleTitle}
            </p>
          </div>
        </div>

        {/* centre — progress */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:block">
            <p className="mb-1 text-right font-mono text-[10px] text-muted-foreground">
              {completedCount}/{totalSections} sections
            </p>
            <Progress value={progressPct} className="h-1.5 w-40" />
          </div>
          {currentSection && (
            <Badge variant="outline" className="font-mono text-[10px]">
              § {currentSection.section_id}
            </Badge>
          )}
        </div>

        {/* right controls */}
        <div className="flex items-center gap-1.5">
          <Button
            variant={audioEnabled ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setAudioEnabled((v) => !v);
              if (audioEnabled) cancelSpeech();
            }}
          >
            {audioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span className="hidden font-mono text-[11px] sm:inline">
              {audioEnabled ? "Audio" : "Muted"}
            </span>
          </Button>

          {availableVoices.length > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="font-mono text-[11px]">
                  {shortVoice(currentVoiceName)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                <DropdownMenuRadioGroup
                  value={currentVoiceName ?? ""}
                  onValueChange={(name) => {
                    const v = availableVoices.find((vv) => vv.name === name);
                    if (v) {
                      voiceRef.current = v;
                      setVoiceName(v.name);
                    }
                  }}
                >
                  {availableVoices.map((v) => (
                    <DropdownMenuRadioItem
                      key={v.name}
                      value={v.name}
                      className="text-xs"
                    >
                      {v.name.replace(/Microsoft |Google /, "").slice(0, 22)} ({v.lang})
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {messages.length > 0 && !streaming && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={handleRelearn}
              title="Clear this section and start over"
            >
              <RotateCcw size={13} /> Relearn
            </Button>
          )}

          {currentSection && currentProgress?.status !== "completed" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setQuizTrigger("section");
                setShowQuiz(true);
              }}
            >
              <Check size={13} /> Mark Done
            </Button>
          )}
          {currentSection && currentProgress?.status === "completed" && (
            <div className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground">
              <CheckCircle2 size={13} /> Done
            </div>
          )}

          {exchangeCount >= 4 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setQuizTrigger("final");
                setShowQuiz(true);
              }}
            >
              <Brain size={13} /> Quiz
            </Button>
          )}

          {canGoNext && nextModule && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => router.push(`/course/${nextModule}`)}
            >
              Next <ChevronRight size={13} />
            </Button>
          )}
          {!canGoNext && nextModule && exchangeCount > 0 && (
            <div
              title="Pass the quiz to unlock"
              className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground opacity-50"
            >
              <Lock size={11} /> Next
            </div>
          )}

          <Separator orientation="vertical" className="h-5" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowKeyboardHelp((v) => !v)}
            title="Keyboard shortcuts (Alt+K)"
          >
            <Keyboard size={14} />
          </Button>
        </div>
      </header>

      {/* ── MAIN ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR */}
        <aside className="flex w-[260px] shrink-0 flex-col border-r bg-card/30">
          <div className="shrink-0 border-b px-3 py-2.5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {moduleLabel} · Topics
            </p>
            <p className="truncate text-xs font-medium text-foreground">
              {moduleTitle}
            </p>
          </div>

          {sections.length > 0 ? (
            <SectionTrail
              sections={sections}
              currentIdx={currentSectionIdx}
              progress={sectionProgress}
              quizUnlocked={quizUnlockedNow}
              onSelect={switchSection}
              onStartFinalQuiz={() => {
                setQuizTrigger("final");
                setShowQuiz(true);
              }}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="px-3 text-center text-xs text-muted-foreground">
                No sections found
              </p>
            </div>
          )}

          {/* module-end items */}
          <div className="shrink-0 space-y-1 border-t px-2 py-2">
            {[
              { label: `Module ${moduleNum} — Summary`, done: moduleAlreadyCompleted },
              {
                label: `Module ${moduleNum} — End-of-Section MCQ (10 questions)`,
                done: quizPassed || moduleAlreadyCompleted,
              },
            ].map((item, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2 py-1.5",
                  item.done ? "border-border" : "border-transparent",
                )}
              >
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border bg-muted">
                  {item.done ? (
                    <Check size={9} className="text-foreground" />
                  ) : (
                    <span className="text-[7px] font-bold text-muted-foreground">
                      {i === 0 ? "★" : "?"}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "flex-1 text-[10px] leading-snug",
                    item.done
                      ? "text-muted-foreground line-through"
                      : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {/* section nav */}
          <div className="flex shrink-0 items-center justify-between border-t px-2 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 font-mono text-[10px] uppercase tracking-wide"
              onClick={() => {
                if (currentSectionIdx > 0) {
                  switchSection(currentSectionIdx - 1);
                } else if (moduleNum > 1) {
                  router.push(`/course/m${String(moduleNum - 1).padStart(2, "0")}`);
                }
              }}
              disabled={currentSectionIdx === 0 && moduleNum <= 1}
            >
              <ChevronLeft size={12} /> Prev
            </Button>

            {currentSectionIdx < sections.length - 1 ? (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 font-mono text-[10px] uppercase tracking-wide"
                onClick={() => switchSection(currentSectionIdx + 1)}
              >
                Next <ChevronRight size={12} />
              </Button>
            ) : nextModule ? (
              canGoNext ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 font-mono text-[10px] uppercase tracking-wide"
                  onClick={() => router.push(`/course/${nextModule}`)}
                >
                  Next <ChevronRight size={12} />
                </Button>
              ) : (
                <span className="flex items-center gap-1 px-2 font-mono text-[10px] uppercase tracking-wide text-muted-foreground opacity-50">
                  <Lock size={9} /> Next
                </span>
              )
            ) : null}
          </div>
        </aside>

        {/* CHAT COLUMN */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* MESSAGES */}
          <div className="chat-messages flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && !streaming && (
              <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
                <div className="max-w-sm">
                  <h2 className="text-2xl font-semibold text-foreground">
                    Ready when you are
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Your AI tutor for{" "}
                    <span className="font-medium text-foreground">
                      {currentSection?.section_title ?? moduleTitle}
                    </span>
                  </p>
                  {currentSection && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Tap <span className="font-medium text-foreground">Start Lesson</span>{" "}
                      to begin, or type a question below.
                    </p>
                  )}
                </div>

                <Button size="lg" className="gap-2" onClick={startLesson}>
                  <Brain size={16} /> Start Lesson
                </Button>

                {currentProgress?.status === "completed" && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRelearn}>
                    <RotateCcw size={13} /> Relearn this section
                  </Button>
                )}
              </div>
            )}

            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              const isLastAss =
                msg.role === "assistant" && i === messages.length - 1;

              return (
                <div
                  key={i}
                  className={cn(
                    "flex w-full animate-msg-in",
                    isUser ? "justify-end" : "justify-start",
                  )}
                >
                  {isUser ? (
                    <div className="max-w-[80%] whitespace-pre-wrap rounded-lg bg-muted px-4 py-2 text-sm leading-relaxed text-foreground">
                      {msg.content || null}
                    </div>
                  ) : (
                    <div className="w-full max-w-[92%] text-sm leading-relaxed text-foreground">
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

          {/* INPUT BAR */}
          <div className="shrink-0 border-t p-3">
            <div
              className={cn(
                "flex items-end gap-2 rounded-lg border bg-muted/30 p-2 transition-colors",
                micActive && "border-foreground/40",
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
                disabled={streaming}
                rows={1}
                placeholder={
                  micActive
                    ? "Listening…"
                    : streaming
                      ? "Alex is responding…"
                      : "Message Alex…"
                }
                className="max-h-28 min-h-0 resize-none border-0 bg-transparent px-1 py-1.5 text-sm shadow-none focus-visible:ring-0"
              />

              {/* mic */}
              <Button
                type="button"
                size="icon"
                variant={micActive ? "default" : "ghost"}
                className="h-9 w-9 shrink-0"
                onClick={toggleMic}
                disabled={streaming}
                title={micActive ? "Stop mic" : "Use mic"}
              >
                {micActive ? <MicOff size={16} /> : <Mic size={16} />}
              </Button>

              {/* stop / send */}
              {streaming || isSpeaking ? (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-9 w-9 shrink-0"
                  onClick={stopAll}
                  title="Stop"
                >
                  <Square size={14} className="fill-current" />
                </Button>
              ) : (
                <Button
                  type="button"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={sendInput}
                  disabled={!input.trim()}
                  title="Send"
                >
                  <Send size={16} />
                </Button>
              )}
            </div>

            {micActive && (
              <div className="mt-1.5 flex items-center gap-2 pl-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-foreground" />
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
