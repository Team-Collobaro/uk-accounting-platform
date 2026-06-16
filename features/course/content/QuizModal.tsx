"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CheckCircle2, XCircle, Loader2, Mic, MicOff } from "lucide-react";
import { useQuizVoice } from "@/features/course/hooks/useQuizVoice";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import type { QuizQuestion } from "@/types";

type QuizResult = {
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  weakAreas: string[];
  explanations: Record<
    string,
    { correct: string; explanation: string; userAnswer: string }
  >;
};

export function QuizModal({
  moduleId,
  moduleTitle,
  partNumber,
  partTitle,
  sectionId,
  sectionTitle,
  onClose,
  onComplete,
}: {
  moduleId: string;
  moduleTitle: string;
  partNumber: number;
  partTitle: string;
  // When set, the quiz is AI-generated for this subtopic instead of the
  // hand-written end-of-module quiz.
  sectionId?: string;
  sectionTitle?: string;
  onClose: () => void;
  onComplete: (passed: boolean, score: number) => void;
}) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [voiceFlash, setVoiceFlash] = useState<Record<string, boolean>>({});
  const [voiceTargetId, setVoiceTargetId] = useState<string | null>(null);
  // Per-question "didn't catch a valid answer" flag, shown briefly after a
  // final transcript that didn't decode to A/B/C/D. Cleared on next attempt
  // or when the user picks an option manually.
  const [voiceMiss, setVoiceMiss] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Cache AI-generated subtopic quizzes so a retry/revisit is instant
    // (first generation takes ~20s). Keyed per module + section.
    const cacheKey = sectionId ? `quiz_cache_${moduleId}_${sectionId}_v2` : null;

    if (cacheKey) {
      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const cached = JSON.parse(raw) as QuizQuestion[];
          if (Array.isArray(cached) && cached.length > 0) {
            setQuestions(cached);
            setLoading(false);
            return;
          }
        }
      } catch {
        /* ignore cache read errors */
      }
    }

    fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        moduleId,
        moduleTitle,
        partNumber,
        partTitle,
        sectionId,
        sectionTitle,
        count: 2,
      }),
    })
      .then((r) => r.json() as Promise<{ questions: QuizQuestion[] }>)
      .then((d) => {
        const qs = d.questions ?? [];
        setQuestions(qs);
        setLoading(false);
        // Only cache successful generations
        if (cacheKey && qs.length > 0) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(qs));
          } catch {
            /* ignore quota / serialization errors */
          }
        }
      })
      .catch(() => setLoading(false));
  }, [moduleId, moduleTitle, partNumber, partTitle, sectionId, sectionTitle]);

  const handleSubmit = async () => {
    setSubmitting(true);
    const res = await fetch("/api/quiz/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        moduleId,
        quizType: sectionId ? "section" : "module",
        answers,
        questions,
      }),
    });
    const data = (await res.json()) as QuizResult;
    setResult(data);
    setSubmitting(false);
    if (data) onComplete(data.passed, data.percentage);
  };

  const allAnswered =
    questions.length > 0 && Object.keys(answers).length >= questions.length;

  const handleVoiceAnswer = useCallback((letter: string) => {
    // eslint-disable-next-line no-console
    console.log("[quiz-modal] handleVoiceAnswer", { letter, targetId: voiceTargetId });
    const targetId = voiceTargetId;
    let questionToAnswer: QuizQuestion | undefined;
    if (targetId) {
      questionToAnswer = questions.find((q) => q.id === targetId);
    }
    if (!questionToAnswer) {
      questionToAnswer = questions.find((q) => !answers[q.id]);
    }
    if (questionToAnswer) {
      // eslint-disable-next-line no-console
      console.log("[quiz-modal] setting answer", { qid: questionToAnswer.id, letter });
      setAnswers((prev) => ({ ...prev, [questionToAnswer!.id]: letter }));
      setVoiceFlash((prev) => ({ ...prev, [questionToAnswer!.id]: true }));
      setVoiceMiss((prev) => ({ ...prev, [questionToAnswer!.id]: false }));
      setTimeout(() => {
        setVoiceFlash((prev) => ({ ...prev, [questionToAnswer!.id]: false }));
      }, 1500);
    } else {
      // eslint-disable-next-line no-console
      console.log("[quiz-modal] no question to answer!", { targetId, answers });
    }
    setVoiceTargetId(null);
    stopVoiceRef.current();
  }, [questions, answers, voiceTargetId]);

  const handleVoiceMiss = useCallback((_transcript: string) => {
    const targetId = voiceTargetId;
    const qid =
      targetId ?? questions.find((q) => !answers[q.id])?.id ?? null;
    if (qid) {
      setVoiceMiss((prev) => ({ ...prev, [qid]: true }));
    }
  }, [questions, answers, voiceTargetId]);

  const handleVoiceSubmit = useCallback(() => {
    if (allAnswered && !submitting && !result) {
      handleSubmit();
      stopVoiceRef.current();
    }
  }, [allAnswered, submitting, result]);

  const { active, start, stop, supported, lastTranscript } = useQuizVoice({
    onAnswer: handleVoiceAnswer,
    onSubmit: handleVoiceSubmit,
    onMiss: handleVoiceMiss,
    enabled: !result && !submitting,
  });

  const stopVoiceRef = useRef(stop);
  useEffect(() => {
    stopVoiceRef.current = stop;
  }, [stop]);

  // Stop voice when modal unmounts. Using an empty dep array + ref so the
  // cleanup only fires on unmount; depending on [stop] would tear down the
  // active recognition on every re-render (stop changes every render since
  // useQuizVoice returns fresh closures).
  useEffect(() => {
    return () => {
      stopVoiceRef.current();
    };
  }, []);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle>{sectionId ? "Subtopic Check" : "Knowledge Check"}</DialogTitle>
          <DialogDescription className="truncate">
            {sectionTitle ?? moduleTitle}
          </DialogDescription>
        </DialogHeader>

        {/* body */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 size={26} className="animate-spin text-muted-foreground" />
              {sectionId && (
                <p className="text-xs text-muted-foreground">
                  Generating questions on this subtopic…
                </p>
              )}
            </div>
          )}

          {!loading && questions.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 py-9 text-center">
              <XCircle size={22} className="text-muted-foreground" />
              <p className="text-sm text-foreground">
                Couldn&apos;t generate questions right now.
              </p>
              <p className="text-xs text-muted-foreground">
                Close this and click Mark Done again to retry.
              </p>
            </div>
          )}

          {!loading && result && (
            <Alert>
              {result.passed ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {result.passed ? "Passed" : "Not yet"} — {result.score}/
                {result.total} correct ({result.percentage}%)
              </AlertTitle>
              {result.weakAreas.length > 0 && (
                <AlertDescription>
                  Revisit: {result.weakAreas.join(", ")}
                </AlertDescription>
              )}
            </Alert>
          )}

          {!loading &&
            questions.map((q, qi) => {
              const correctLetter = q.correct.trim().toUpperCase();
              const userLetter = (answers[q.id] ?? "").trim().toUpperCase();
              const gotItWrong = !!result && userLetter !== correctLetter;
              const correctOption = q.options.find(
                (o) => o.trim().charAt(0).toUpperCase() === correctLetter,
              );
              return (
                <div key={q.id} className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug text-foreground">
                      {qi + 1}. {q.question}
                    </p>
                    {!result && !answers[q.id] && (
                      <button
                        onClick={() => {
                          if (!supported) return;
                          if (active && voiceTargetId === q.id) {
                            // Toggle off for the same question
                            stop();
                            setVoiceTargetId(null);
                          } else {
                            // Switching to a different question (or starting
                            // fresh) — fully reset recognition so the new
                            // target is picked up. Without this, clicking a
                            // different question's mic while already listening
                            // only updates voiceTargetId but the running
                            // recognition never restarts and the UI lies.
                            if (active) {
                              stop();
                            }
                            setVoiceTargetId(q.id);
                            setVoiceMiss((prev) => ({ ...prev, [q.id]: false }));
                            start();
                          }
                        }}
                        disabled={!supported}
                        className={cn(
                          "mt-0.5 flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
                          !supported && "cursor-not-allowed opacity-40",
                          supported && active && voiceTargetId === q.id
                            ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-400"
                            : supported
                              ? "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                              : "border-border text-muted-foreground",
                        )}
                        title={
                          supported
                            ? "Answer by voice"
                            : "Voice answering isn't supported in this browser. Try Chrome or Safari."
                        }
                      >
                        {supported && active && voiceTargetId === q.id ? (
                          <>
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                            <MicOff size={12} />
                          </>
                        ) : (
                          <Mic size={12} />
                        )}
                        <span className="hidden sm:inline">
                          {supported && active && voiceTargetId === q.id
                            ? "Listening"
                            : "Voice"}
                        </span>
                      </button>
                    )}
                    {answers[q.id] && !result && (
                      <span className="mt-0.5 flex shrink-0 items-center gap-1 rounded-md border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs text-green-500">
                        <CheckCircle2 size={12} />
                        <span className="hidden sm:inline">Answered</span>
                      </span>
                    )}
                  </div>
                  {active && voiceTargetId === q.id && !voiceMiss[q.id] && (
                    <span className="flex flex-col gap-0.5 text-xs text-cyan-400">
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                        Say “option B” or “the answer is C” for best results…
                      </span>
                      {lastTranscript && (
                        <span className="pl-3 text-[11px] text-cyan-400/70">
                          Heard: “{lastTranscript}”
                        </span>
                      )}
                    </span>
                  )}
                  {voiceMiss[q.id] && (
                    <span className="flex flex-col gap-0.5 text-xs text-amber-500">
                      <span className="flex items-center gap-1.5">
                        <XCircle size={12} />
                        Didn&apos;t catch a clear answer
                        {lastTranscript ? ` (“${lastTranscript}”)` : ""} — try again or tap an option.
                      </span>
                    </span>
                  )}
                  <RadioGroup
                    value={answers[q.id] ?? ""}
                    onValueChange={(v) => {
                      if (result) return;
                      setAnswers((p) => ({ ...p, [q.id]: v }));
                      setVoiceMiss((prev) => ({ ...prev, [q.id]: false }));
                    }}
                    className="gap-1.5"
                  >
                    {q.options.map((opt, oi) => {
                      const id = `${q.id}-${oi}`;
                      const letter = opt.trim().charAt(0).toUpperCase();
                      const selected = userLetter === letter;
                      // After grading: highlight the correct option green, and
                      // a wrong pick red. Before grading: just show selection.
                      const isCorrect = !!result && letter === correctLetter;
                      const isWrongPick =
                        !!result && selected && letter !== correctLetter;
                      return (
                        <label
                          key={opt}
                          htmlFor={id}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors",
                            !result &&
                              (selected
                                ? "border-foreground bg-accent"
                                : "hover:bg-accent/50"),
                            isCorrect &&
                              "border-green-500/60 bg-green-500/10",
                            isWrongPick && "border-red-500/60 bg-red-500/10",
                            result &&
                              !isCorrect &&
                              !isWrongPick &&
                              "opacity-60",
                            result && "cursor-default",
                            voiceFlash[q.id] && selected && "ring-2 ring-cyan-400 ring-offset-2 ring-offset-background scale-[1.01]",
                          )}
                        >
                          <RadioGroupItem
                            value={letter}
                            id={id}
                            disabled={!!result}
                            className={cn(
                              "mt-0.5",
                              isCorrect && "border-green-500 text-green-500",
                              isWrongPick && "border-red-500 text-red-500",
                            )}
                          />
                          <span
                            className={cn(
                              "flex-1 text-sm leading-snug",
                              isCorrect
                                ? "text-green-600 dark:text-green-400"
                                : isWrongPick
                                  ? "text-red-600 dark:text-red-400"
                                  : selected
                                    ? "text-foreground"
                                    : "text-muted-foreground",
                            )}
                          >
                            {opt}
                          </span>
                          {isCorrect && (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                          )}
                          {isWrongPick && (
                            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                          )}
                        </label>
                      );
                    })}
                  </RadioGroup>
                  {result?.explanations[q.id] && (
                    <div
                      className={cn(
                        "rounded-md border px-3 py-2 text-xs leading-snug text-muted-foreground",
                        gotItWrong
                          ? "border-red-500/30 bg-red-500/5"
                          : "bg-muted/40",
                      )}
                    >
                      {gotItWrong && (
                        <p className="mb-1 font-medium text-red-600 dark:text-red-400">
                          Correct answer: {correctOption ?? correctLetter}
                        </p>
                      )}
                      <span>{result.explanations[q.id].explanation}</span>
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          {!result ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || !allAnswered}>
                {submitting && <Loader2 size={14} className="mr-1.5 animate-spin" />}
                Submit
              </Button>
            </>
          ) : (
            <Button onClick={onClose}>
              {result.passed ? "Continue learning →" : "Continue anyway →"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
