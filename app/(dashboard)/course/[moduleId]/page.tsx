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
import { AuroraStatus } from "@/features/course/content/AuroraStatus";
import { SectionTrail } from "@/features/course/content/SectionTrail";
import { NotesPromptBanner } from "@/features/course/content/NotesPromptBanner";
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
  Sparkles,
} from "lucide-react";
import type { SectionProgress, Message } from "@/types/course";
import StarBorder from "@/components/reactbits/StarBorder";
import DecryptedText from "@/components/reactbits/DecryptedText";
import SoftAurora from "@/components/SoftAurora";

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
    userActivated,
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

  /* ── shared button styles ── */
  const hudBtn = (
    active: boolean,
    accent = "var(--ac-cyan)",
    accentRgb = "126,207,206",
  ): React.CSSProperties => ({
    padding: "5px 11px",
    borderRadius: 8,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 11,
    fontWeight: 600,
    background: active ? `rgba(${accentRgb},0.12)` : "rgba(255,255,255,0.03)",
    border: `1px solid ${active ? `rgba(${accentRgb},0.30)` : "var(--border-subtle)"}`,
    color: active ? accent : "var(--text-secondary)",
    boxShadow: active
      ? `var(--shadow-sm), 0 0 12px rgba(${accentRgb},0.1)`
      : "var(--shadow-sm)",
    transition: "all 0.18s ease",
    letterSpacing: "0.04em",
  });

  /* ══ RENDER ══ */
  if (!sectionsLoaded) return <PageSkeleton />;

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: "var(--bg-base)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "'Inter', system-ui, sans-serif",
        position: "relative",
      }}
    >
      {/* ── Section advance toast ── */}
      <AnimatePresence>
        {showAdvancePrompt && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            style={{
              position: "fixed",
              bottom: 28,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 200,
              pointerEvents: "none",
              background:
                "linear-gradient(135deg, rgba(82,217,139,0.15), rgba(78,205,196,0.1))",
              border: "1px solid rgba(82,217,139,0.4)",
              borderRadius: 14,
              padding: "12px 20px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              backdropFilter: "blur(20px)",
              boxShadow:
                "0 8px 40px rgba(0,0,0,0.4), 0 0 20px rgba(82,217,139,0.15)",
            }}
          >
            <CheckCircle2 size={18} color="#52D98B" />
            <div>
              <p
                style={{
                  fontSize: 11,
                  color: "#52D98B",
                  fontFamily: "monospace",
                  letterSpacing: "0.1em",
                  marginBottom: 2,
                }}
              >
                SECTION COMPLETE
              </p>
              <p style={{ fontSize: 13, color: "#E8F0FC", fontWeight: 600 }}>
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
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            onClick={() => setShowKeyboardHelp(false)}
            style={{
              position: "fixed",
              top: 62,
              right: 16,
              zIndex: 150,
              background: "rgba(9,13,26,0.96)",
              border: "1px solid rgba(78,205,196,0.2)",
              borderRadius: 14,
              padding: "16px 18px",
              minWidth: 240,
              backdropFilter: "blur(20px)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
              cursor: "pointer",
            }}
          >
            <p
              style={{
                fontSize: 11,
                color: "rgba(78,205,196,0.7)",
                fontFamily: "monospace",
                letterSpacing: "0.14em",
                marginBottom: 12,
              }}
            >
              KEYBOARD SHORTCUTS
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
              <div
                key={key}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 7,
                }}
              >
                <span style={{ fontSize: 12, color: "#8EA8CC" }}>{label}</span>
                <kbd
                  style={{
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: "#4ECDC4",
                    background: "rgba(78,205,196,0.1)",
                    border: "1px solid rgba(78,205,196,0.25)",
                    borderRadius: 5,
                    padding: "2px 7px",
                  }}
                >
                  {key}
                </kbd>
              </div>
            ))}
            <p
              style={{
                fontSize: 9,
                color: "#4A6285",
                fontFamily: "monospace",
                marginTop: 8,
                textAlign: "center",
              }}
            >
              click to close
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── HUD BAR ── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 18px",
          height: 52,
          flexShrink: 0,
          zIndex: 10,
          background: "var(--glass-lg)",
          borderBottom: "1px solid var(--border-subtle)",
          backdropFilter: "blur(24px) saturate(150%)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.04), var(--shadow-sm)",
        }}
      >
        {/* left */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-tertiary)",
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 6px",
              borderRadius: 7,
              transition: "color 0.18s",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.color =
                "var(--text-primary)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.color =
                "var(--text-tertiary)")
            }
          >
            <ChevronLeft size={15} />
            <span
              style={{
                fontSize: 11,
                letterSpacing: "0.08em",
                fontFamily: "monospace",
              }}
            >
              BACK
            </span>
          </button>
          <div
            style={{ width: 1, height: 18, background: "var(--border-subtle)" }}
          />
          <div>
            <p
              style={{
                fontSize: 9,
                fontFamily: "monospace",
                letterSpacing: "0.16em",
                color: "var(--ac-cyan)",
                opacity: 0.75,
              }}
            >
              PART {partNumber} · {moduleId.toUpperCase()}
            </p>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginTop: 1,
                maxWidth: 300,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <DecryptedText
                text={moduleTitle}
                animateOn="view"
                sequential={true}
                revealDirection="start"
                speed={28}
                className="aurora-text"
                encryptedClassName="aurora-text"
              />
            </p>
          </div>
        </div>

        {/* centre — progress */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div>
            <p
              style={{
                fontSize: 9,
                fontFamily: "monospace",
                color: "var(--text-tertiary)",
                letterSpacing: "0.12em",
                marginBottom: 3,
                textAlign: "right",
              }}
            >
              {completedCount}/{totalSections} sections
            </p>
            <div
              style={{
                width: 160,
                height: 4,
                background: "rgba(255,255,255,0.06)",
                borderRadius: 99,
                overflow: "hidden",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)",
              }}
            >
              <div
                className="aurora-progress-fill"
                style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  transition: "width 0.55s ease",
                }}
              />
            </div>
          </div>
          {currentSection && (
            <div className="depth-pill" style={{ padding: "3px 10px" }}>
              <p
                style={{
                  fontSize: 10,
                  color: "var(--ac-cyan)",
                  fontFamily: "monospace",
                  letterSpacing: "0.08em",
                }}
              >
                § {currentSection.section_id}
              </p>
            </div>
          )}
        </div>

        {/* right controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => {
              setAudioEnabled((v) => !v);
              if (audioEnabled) cancelSpeech();
            }}
            style={hudBtn(audioEnabled)}
          >
            {audioEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            <span style={{ fontFamily: "monospace" }}>
              {audioEnabled ? "AUDIO" : "MUTED"}
            </span>
          </button>

          {availableVoices.length > 1 && (
            <select
              onChange={(e) => {
                const v = availableVoices.find(
                  (v) => v.name === e.target.value,
                );
                if (v) voiceRef.current = v;
              }}
              defaultValue={voiceRef.current?.name ?? ""}
              style={{
                padding: "4px 7px",
                borderRadius: 7,
                fontSize: 11,
                fontFamily: "monospace",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
                cursor: "pointer",
                maxWidth: 145,
                outline: "none",
              }}
            >
              {availableVoices.map((v) => (
                <option
                  key={v.name}
                  value={v.name}
                  style={{ background: "#0C1020", color: "#D8E4F0" }}
                >
                  {v.name.replace(/Microsoft |Google /, "").slice(0, 18)} (
                  {v.lang})
                </option>
              ))}
            </select>
          )}

          {messages.length > 0 && !streaming && (
            <button
              onClick={() => {
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
              }}
              style={hudBtn(false, "var(--ac-rose, #E8507A)", "232,80,122")}
              title="Clear this section and start over"
            >
              ↺ Relearn
            </button>
          )}

          {currentSection && currentProgress?.status !== "completed" && (
            <button
              onClick={() => {
                setQuizTrigger("section");
                setShowQuiz(true);
              }}
              style={hudBtn(false, "var(--ac-mint)", "110,201,160")}
            >
              <Check size={12} /> Mark Done
            </button>
          )}
          {currentSection && currentProgress?.status === "completed" && (
            <div
              style={{
                ...hudBtn(true, "var(--ac-mint)", "110,201,160"),
                cursor: "default",
                opacity: 0.6,
              }}
            >
              <CheckCircle2 size={12} /> Done
            </div>
          )}

          {exchangeCount >= 4 && (
            <StarBorder
              as="button"
              onClick={() => {
                setQuizTrigger("final");
                setShowQuiz(true);
              }}
              color="rgba(155,111,208,0.85)"
              speed="4s"
              thickness={1}
              style={{
                ...hudBtn(false, "var(--ac-violet)", "139,126,200"),
                padding: "0",
                borderRadius: 8,
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 11px",
                }}
              >
                <Brain size={12} /> Quiz
              </span>
            </StarBorder>
          )}

          {canGoNext && nextModule && (
            <button
              onClick={() => router.push(`/course/${nextModule}`)}
              style={hudBtn(true, "var(--ac-mint)", "110,201,160")}
            >
              Next <ChevronRight size={12} />
            </button>
          )}
          {!canGoNext && nextModule && exchangeCount > 0 && (
            <div
              title="Pass the quiz to unlock"
              style={{ ...hudBtn(false), opacity: 0.4, cursor: "default" }}
            >
              <Lock size={10} /> Next
            </div>
          )}

          <div
            style={{ width: 1, height: 18, background: "var(--border-subtle)" }}
          />
          <button
            onClick={() => setShowKeyboardHelp((v) => !v)}
            style={hudBtn(showKeyboardHelp)}
            title="Keyboard shortcuts (Alt+K)"
          >
            <Keyboard size={13} />
          </button>
        </div>
      </header>

      {/* ── MAIN 2-COL ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          position: "relative",
          zIndex: 5,
        }}
      >
        {/* COL 1 — Sections */}
        <div
          style={{
            width: 220,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            background:
              "linear-gradient(180deg, rgba(11,15,28,0.97) 0%, rgba(8,11,22,0.98) 100%)",
            borderRight: "1px solid var(--border-subtle)",
            boxShadow:
              "2px 0 18px rgba(0,0,0,0.4), inset -1px 0 0 rgba(255,255,255,0.025)",
          }}
        >
          <div
            style={{
              padding: "10px 12px 8px",
              borderBottom: "1px solid var(--border-subtle)",
              flexShrink: 0,
            }}
          >
            <p
              style={{
                fontSize: 9,
                fontFamily: "monospace",
                color: "var(--ac-cyan)",
                letterSpacing: "0.16em",
                marginBottom: 3,
                opacity: 0.7,
              }}
            >
              M{moduleId.replace("m", "").padStart(2, "0")} · TOPICS
            </p>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-secondary)",
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
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
          ) : !sectionsLoaded ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <Loader2
                size={17}
                color="var(--ac-cyan)"
                className="animate-spin"
                style={{ opacity: 0.5 }}
              />
              <p style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                Loading…
              </p>
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  padding: "0 12px",
                  textAlign: "center",
                }}
              >
                No sections found
              </p>
            </div>
          )}

          {/* module-end items */}
          <div
            style={{
              borderTop: "1px solid var(--border-subtle)",
              flexShrink: 0,
              padding: "7px 8px 4px",
            }}
          >
            {[
              {
                label: `Module ${parseInt(moduleId.replace("m", ""), 10)} — Summary`,
                done: moduleAlreadyCompleted,
              },
              {
                label: `Module ${parseInt(moduleId.replace("m", ""), 10)} — End-of-Section MCQ (10 questions)`,
                done: quizPassed || moduleAlreadyCompleted,
              },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 8px",
                  borderRadius: 8,
                  marginBottom: 3,
                  background: item.done
                    ? "rgba(110,201,160,0.05)"
                    : "rgba(255,255,255,0.02)",
                  border: item.done
                    ? "1px solid rgba(110,201,160,0.18)"
                    : "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: item.done
                      ? "rgba(110,201,160,0.15)"
                      : "rgba(255,255,255,0.04)",
                    border: item.done
                      ? "1px solid rgba(110,201,160,0.45)"
                      : "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  {item.done ? (
                    <Check size={9} color="var(--ac-mint)" />
                  ) : (
                    <span
                      style={{
                        fontSize: 6,
                        color: "var(--text-tertiary)",
                        fontWeight: 700,
                      }}
                    >
                      {i === 0 ? "★" : "?"}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontSize: 10,
                    lineHeight: 1.4,
                    flex: 1,
                    color: item.done
                      ? "var(--ac-mint)"
                      : "var(--text-tertiary)",
                    textDecoration: item.done ? "line-through" : "none",
                    opacity: item.done ? 0.65 : 1,
                  }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {/* section nav */}
          <div
            style={{
              padding: "9px 12px",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            {/* PREV — go to previous section, or previous module if at start */}
            <button
              onClick={() => {
                if (currentSectionIdx > 0) {
                  switchSection(currentSectionIdx - 1);
                } else {
                  const n = parseInt(moduleId.replace("m", ""), 10);
                  if (n > 1)
                    router.push(`/course/m${String(n - 1).padStart(2, "0")}`);
                }
              }}
              disabled={currentSectionIdx === 0 && parseInt(moduleId.replace("m", ""), 10) <= 1}
              style={{
                background: "none",
                border: "none",
                cursor: currentSectionIdx === 0 && parseInt(moduleId.replace("m", ""), 10) <= 1 ? "default" : "pointer",
                color: "var(--text-tertiary)",
                fontSize: 10,
                display: "flex",
                alignItems: "center",
                gap: 3,
                fontFamily: "monospace",
                letterSpacing: "0.08em",
                opacity: currentSectionIdx === 0 && parseInt(moduleId.replace("m", ""), 10) <= 1 ? 0.3 : 1,
              }}
            >
              <ChevronLeft size={12} /> PREV
            </button>

            {/* NEXT — go to next section, or next module if at end */}
            {currentSectionIdx < sections.length - 1 ? (
              <button
                onClick={() => switchSection(currentSectionIdx + 1)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-tertiary)",
                  fontSize: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  fontFamily: "monospace",
                  letterSpacing: "0.08em",
                }}
              >
                NEXT <ChevronRight size={12} />
              </button>
            ) : nextModule ? (
              canGoNext ? (
                <button
                  onClick={() => router.push(`/course/${nextModule}`)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-tertiary)",
                    fontSize: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    fontFamily: "monospace",
                    letterSpacing: "0.08em",
                  }}
                >
                  NEXT <ChevronRight size={12} />
                </button>
              ) : (
                <span
                  style={{
                    color: "var(--text-tertiary)",
                    fontSize: 10,
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                    fontFamily: "monospace",
                    letterSpacing: "0.08em",
                    opacity: 0.45,
                  }}
                >
                  <Lock size={9} /> NEXT
                </span>
              )
            ) : null}
          </div>
        </div>

        {/* COL 2 — Avatar + Chat */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            position: "relative",
          }}
        >
          {/* ── AVATAR ZONE ── */}
          <div
            style={{
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingTop: 18,
              paddingBottom: 14,
              borderBottom: "1px solid rgba(78,205,196,0.12)",
              boxShadow:
                "inset 0 -1px 0 rgba(78,205,196,0.06), 0 4px 40px rgba(0,0,0,0.3)",
              position: "relative",
              zIndex: 1,
              overflow: "hidden",
              minHeight: 200,
            }}
          >
            {/* SoftAurora background */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 0,
                pointerEvents: "none",
              }}
            >
              <SoftAurora
                speed={0.45}
                scale={1.3}
                brightness={1.1}
                color1="#4ecdc4"
                color2="#9b6fd0"
                noiseFrequency={2.0}
                noiseAmplitude={0.7}
                bandHeight={0.5}
                bandSpread={0.9}
                octaveDecay={0.12}
                layerOffset={0.9}
                colorSpeed={0.7}
                enableMouseInteraction={true}
                mouseInfluence={0.18}
              />
            </div>

            <div
              style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "100%",
                gap: 8,
              }}
            >
              {/* section label */}
              {currentSection && (
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: isSpeaking
                        ? "var(--ac-cyan)"
                        : "var(--border-medium)",
                      boxShadow: isSpeaking ? "var(--glow-cyan)" : "none",
                      transition: "all 0.4s",
                      animation: isSpeaking
                        ? "onlinePulse 2s infinite"
                        : "none",
                    }}
                  />
                  <p
                    style={{
                      fontSize: 10,
                      color: "var(--text-tertiary)",
                      fontFamily: "monospace",
                    }}
                  >
                    <span style={{ color: "var(--ac-cyan)", marginRight: 5 }}>
                      §{currentSection.section_id}
                    </span>
                    {currentSection.section_title.length > 38
                      ? currentSection.section_title.slice(0, 36) + "…"
                      : currentSection.section_title}
                  </p>
                </div>
              )}

              <AuroraStatus speaking={isSpeaking} />
            </div>
          </div>

          {/* notes prompt banner */}
          {teachingPoints.length > 0 && (
            <NotesPromptBanner
              phase={tPhase}
              topicTitle={teachingPoints[currentPtIdx]?.title ?? null}
              topicIdx={currentPtIdx}
              total={teachingPoints.length}
            />
          )}

          {/* ── MESSAGES ── */}
          <div
            className="chat-messages"
            style={
              {
                flex: 1,
                overflowY: "auto",
                padding: "16px 18px 8px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                position: "relative",
                zIndex: 1,
              } as React.CSSProperties
            }
          >
            {/* top fade mask */}
            <div
              style={{
                position: "sticky",
                top: 0,
                left: 0,
                right: 0,
                height: 28,
                marginBottom: -28,
                pointerEvents: "none",
                zIndex: 2,
                background:
                  "linear-gradient(to bottom, var(--bg-base) 0%, transparent 100%)",
                flexShrink: 0,
              }}
            />

            {messages.length === 0 && !streaming && (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 20,
                    background: "rgba(10,14,28,0.7)",
                    border: "1px solid rgba(78,205,196,0.14)",
                    borderRadius: 20,
                    padding: "32px 36px",
                    maxWidth: 320,
                    textAlign: "center",
                    boxShadow:
                      "var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,0.04)",
                    backdropFilter: "blur(16px)",
                  }}
                >
                  {/* Alex avatar */}
                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: "50%",
                        background:
                          "linear-gradient(135deg,rgba(78,205,196,0.18),rgba(155,111,208,0.22))",
                        border: "2px solid rgba(78,205,196,0.4)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 24,
                        fontWeight: 800,
                        color: "var(--ac-cyan)",
                        boxShadow: "0 0 32px rgba(78,205,196,0.2)",
                      }}
                    >
                      A
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        bottom: 2,
                        right: 2,
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: "#22c55e",
                        border: "2px solid rgba(10,14,28,0.9)",
                        boxShadow: "0 0 8px #22c55e",
                      }}
                    />
                  </div>

                  {/* Intro text */}
                  <div>
                    <p
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        margin: "0 0 6px",
                      }}
                    >
                      Hi, I&apos;m Alex
                    </p>
                    <p
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        lineHeight: 1.7,
                        margin: 0,
                      }}
                    >
                      Your AI tutor for
                      <br />
                      <span
                        style={{ color: "var(--ac-cyan)", fontWeight: 600 }}
                      >
                        {currentSection?.section_title ?? moduleTitle}
                      </span>
                    </p>
                    {currentSection && (
                      <p
                        style={{
                          fontSize: 11,
                          color: "var(--text-tertiary)",
                          marginTop: 8,
                          lineHeight: 1.6,
                        }}
                      >
                        Select a topic from the left panel,
                        <br />
                        then tap{" "}
                        <strong style={{ color: "var(--ac-cyan)" }}>
                          Start Lesson
                        </strong>{" "}
                        to begin.
                      </p>
                    )}
                  </div>

                  {/* Start Lesson button */}
                  <button
                    onClick={() => {
                      setUserActivated(true);
                      hasStarted.current = true;
                      setTPhase("PRE_NOTES");
                      void doSend("__AUTO_START__", true);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "12px 28px",
                      borderRadius: 13,
                      background:
                        "linear-gradient(135deg, #4ECDC4 0%, #52D98B 100%)",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#050810",
                      boxShadow: "0 4px 20px rgba(78,205,196,0.3)",
                      transition: "box-shadow 0.18s, transform 0.18s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        "0 6px 28px rgba(78,205,196,0.45)";
                      (e.currentTarget as HTMLElement).style.transform =
                        "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow =
                        "0 4px 20px rgba(78,205,196,0.3)";
                      (e.currentTarget as HTMLElement).style.transform = "none";
                    }}
                  >
                    <Brain size={16} />
                    Start Lesson
                  </button>

                  {/* Relearn shortcut when section is already completed */}
                  {currentProgress?.status === "completed" && (
                    <button
                      onClick={() => {
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
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "7px 18px",
                        borderRadius: 10,
                        background: "rgba(232,80,122,0.08)",
                        border: "1px solid rgba(232,80,122,0.25)",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--ac-rose, #E8507A)",
                      }}
                    >
                      ↺ Relearn this section
                    </button>
                  )}

                  {/* Or ask a question */}
                  <p
                    style={{
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      margin: 0,
                    }}
                  >
                    or type a question below
                  </p>
                </div>
              </div>
            )}

            {/* date/session divider shown once above first message */}
            {messages.length > 0 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  margin: "8px 0 12px",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: "var(--border-subtle)",
                  }}
                />
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: "monospace",
                    letterSpacing: "0.12em",
                    color: "var(--text-tertiary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  SESSION ·{" "}
                  {new Date().toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: 1,
                    background: "var(--border-subtle)",
                  }}
                />
              </div>
            )}

            {messages.map((msg, i) => {
              const isLastAss =
                msg.role === "assistant" && i === messages.length - 1;
              const isUser = msg.role === "user";
              const prevSameRole = i > 0 && messages[i - 1].role === msg.role;
              const nextSameRole =
                i < messages.length - 1 && messages[i + 1].role === msg.role;

              let radius: string;
              if (isUser) {
                radius = prevSameRole
                  ? nextSameRole
                    ? "14px 4px 4px 14px"
                    : "14px 4px 14px 14px"
                  : nextSameRole
                    ? "14px 14px 4px 14px"
                    : "14px 14px 4px 14px";
              } else {
                radius = prevSameRole
                  ? nextSameRole
                    ? "4px 14px 14px 4px"
                    : "4px 14px 14px 14px"
                  : nextSameRole
                    ? "14px 14px 14px 4px"
                    : "16px 16px 16px 4px";
              }

              return (
                <div
                  key={i}
                  className="message-enter"
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 8,
                    flexDirection: isUser ? "row-reverse" : "row",
                    marginBottom: nextSameRole ? 2 : 10,
                  }}
                >
                  {/* Avatar — only on last of a group */}
                  {!isUser && (
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: "50%",
                        flexShrink: 0,
                        visibility: nextSameRole ? "hidden" : "visible",
                        background:
                          "linear-gradient(135deg,rgba(78,205,196,0.18),rgba(155,111,208,0.18))",
                        border: "1.5px solid rgba(78,205,196,0.32)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--ac-cyan)",
                        boxShadow:
                          isSpeaking && isLastAss
                            ? "0 0 14px rgba(78,205,196,0.4)"
                            : "0 0 8px rgba(78,205,196,0.12)",
                        transition: "box-shadow 0.4s ease",
                      }}
                    >
                      A
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isUser ? "flex-end" : "flex-start",
                      gap: 2,
                      maxWidth: isUser ? "74%" : "88%",
                    }}
                  >
                    <div
                      style={{
                        padding: isUser ? "9px 14px" : "10px 15px",
                        fontSize: 13,
                        lineHeight: 1.75,
                        borderRadius: radius,
                        background: isUser
                          ? "linear-gradient(135deg, rgba(91,110,175,0.28), rgba(155,111,208,0.20))"
                          : "rgba(10,14,28,0.82)",
                        border: isUser
                          ? "1px solid rgba(155,111,208,0.30)"
                          : "1px solid rgba(78,205,196,0.10)",
                        borderLeft: !isUser
                          ? "2px solid rgba(78,205,196,0.28)"
                          : undefined,
                        color: "var(--text-primary)",
                        backdropFilter: "blur(16px)",
                        boxShadow: isUser
                          ? "0 2px 12px rgba(155,111,208,0.15)"
                          : isSpeaking && isLastAss
                            ? "0 2px 12px rgba(78,205,196,0.12), inset 0 1px 0 rgba(255,255,255,0.04)"
                            : "0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)",
                        transition: "box-shadow 0.4s ease",
                      }}
                    >
                      {isUser ? (
                        msg.content || null
                      ) : msg.content ? (
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
                        <span
                          style={{
                            color: "var(--text-tertiary)",
                            fontStyle: "italic",
                            fontSize: 12,
                          }}
                        >
                          …
                        </span>
                      )}
                    </div>

                    {/* Timestamp — only on last of a group */}
                    {!nextSameRole && (
                      <span
                        style={{
                          fontSize: 9,
                          color: "var(--text-tertiary)",
                          fontFamily: "monospace",
                          letterSpacing: "0.06em",
                          paddingLeft: isUser ? 0 : 4,
                          paddingRight: isUser ? 4 : 0,
                          opacity: 0.6,
                        }}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {streaming &&
              messages[messages.length - 1]?.role !== "assistant" && (
                <TypingIndicator />
              )}
            <div ref={chatEndRef} style={{ height: 8 }} />
          </div>

          {/* ── INPUT BAR ── */}
          <div
            style={{
              padding: "10px 14px 12px",
              flexShrink: 0,
              background: "var(--glass-lg)",
              borderTop: "1px solid var(--border-subtle)",
              backdropFilter: "blur(24px) saturate(150%)",
              boxShadow: "0 -1px 0 rgba(255,255,255,0.03)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 8,
                background: "rgba(8,11,22,0.7)",
                border: `1px solid ${micActive ? "rgba(232,80,122,0.35)" : streaming ? "rgba(78,205,196,0.18)" : "rgba(78,205,196,0.12)"}`,
                borderRadius: 14,
                padding: "8px 8px 8px 14px",
                boxShadow: "inset 0 2px 8px rgba(0,0,0,0.4)",
                transition: "border-color 0.22s",
              }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    const t = input.trim();
                    if (!t || streamRef.current) return;
                    setInput("");
                    void doSend(t, false);
                  }
                }}
                disabled={streaming}
                rows={1}
                placeholder={
                  micActive
                    ? "🎤  Listening…"
                    : streaming
                      ? "Alex is responding…"
                      : `Message Alex…`
                }
                className="aurora-input"
                style={{
                  flex: 1,
                  resize: "none",
                  background: "transparent",
                  border: "none",
                  padding: "4px 0",
                  fontSize: 13,
                  color: micActive ? "var(--ac-rose)" : "var(--text-primary)",
                  outline: "none",
                  maxHeight: 110,
                  lineHeight: 1.6,
                  fontFamily: "inherit",
                  transition: "color 0.2s",
                  boxShadow: "none",
                }}
              />

              {/* mic */}
              <button
                onClick={toggleMic}
                disabled={streaming}
                title={micActive ? "Stop mic" : "Use mic"}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  cursor: "pointer",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: micActive
                    ? "rgba(232,80,122,0.14)"
                    : "transparent",
                  border: `1px solid ${micActive ? "rgba(232,80,122,0.35)" : "transparent"}`,
                  color: micActive ? "var(--ac-rose)" : "var(--text-tertiary)",
                  animation: micActive
                    ? "tapPulse 1s ease-in-out infinite"
                    : "none",
                  transition: "all 0.2s",
                }}
              >
                {micActive ? <MicOff size={15} /> : <Mic size={15} />}
              </button>

              {/* stop (visible while streaming or speaking) */}
              {streaming || isSpeaking ? (
                <button
                  onClick={stopAll}
                  title="Stop"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    flexShrink: 0,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(232,80,122,0.14)",
                    border: "1px solid rgba(232,80,122,0.35)",
                    color: "var(--ac-rose)",
                    boxShadow: "0 0 10px rgba(232,80,122,0.15)",
                    transition: "all 0.18s",
                  }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="currentColor"
                  >
                    <rect x="1" y="1" width="10" height="10" rx="2" />
                  </svg>
                </button>
              ) : (
                /* send */
                <button
                  onClick={() => {
                    const t = input.trim();
                    if (!t || streamRef.current) return;
                    setInput("");
                    void doSend(t, false);
                  }}
                  disabled={!input.trim()}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    flexShrink: 0,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: !input.trim()
                      ? "rgba(255,255,255,0.04)"
                      : "linear-gradient(135deg,rgba(78,205,196,0.25),rgba(155,111,208,0.20))",
                    border: `1px solid ${!input.trim() ? "transparent" : "rgba(78,205,196,0.30)"}`,
                    color: !input.trim()
                      ? "var(--text-tertiary)"
                      : "var(--ac-cyan)",
                    boxShadow: !input.trim()
                      ? "none"
                      : "0 0 10px rgba(78,205,196,0.15)",
                    transition: "all 0.18s",
                  }}
                >
                  <Send size={15} />
                </button>
              )}
            </div>

            {micActive && (
              <div
                style={{
                  marginTop: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  paddingLeft: 2,
                }}
              >
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "var(--ac-rose)",
                    animation: "tapPulse 0.9s ease-in-out infinite",
                    boxShadow: "0 0 6px var(--ac-rose)",
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--ac-rose)",
                    fontFamily: "monospace",
                    letterSpacing: "0.1em",
                    opacity: 0.85,
                  }}
                >
                  LISTENING…
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

      <style>{`
        @keyframes tapPulse { 0%,100%{opacity:0.45} 50%{opacity:1} }
        @keyframes onlinePulse {
          0%,100%{transform:scale(1); box-shadow:0 0 5px rgba(126,207,206,0.4)}
          50%{transform:scale(1.4); box-shadow:0 0 12px rgba(126,207,206,0.7)}
        }
      `}</style>
    </div>
  );
}
