"use client";

import { useState, useEffect } from "react";
import { Brain, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import StarBorder from "@/components/reactbits/StarBorder";
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
  onClose,
  onComplete,
}: {
  moduleId: string;
  moduleTitle: string;
  partNumber: number;
  partTitle: string;
  onClose: () => void;
  onComplete: (passed: boolean, score: number) => void;
}) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        moduleId,
        moduleTitle,
        partNumber,
        partTitle,
        count: 5,
      }),
    })
      .then((r) => r.json() as Promise<{ questions: QuizQuestion[] }>)
      .then((d) => {
        setQuestions(d.questions ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [moduleId, moduleTitle, partNumber, partTitle]);

  const handleSubmit = async () => {
    setSubmitting(true);
    const res = await fetch("/api/quiz/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId, answers, questions }),
    });
    const data = (await res.json()) as QuizResult;
    setResult(data);
    setSubmitting(false);
    if (data) onComplete(data.passed, data.percentage);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(3,5,14,0.85)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        backdropFilter: "blur(10px)",
      }}
    >
      {/* bordered wrapper */}
      <div
        className="aurora-border"
        style={{
          width: "100%",
          maxWidth: 620,
          maxHeight: "88vh",
          borderRadius: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            background: "var(--bg-elevated)",
            borderRadius: 15,
            maxHeight: "88vh",
            boxShadow: "var(--shadow-xl)",
          }}
        >
          {/* header */}
          <div
            style={{
              padding: "16px 22px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background:
                    "linear-gradient(135deg,rgba(126,207,206,0.18),rgba(139,126,200,0.16))",
                  border: "1px solid var(--border-medium)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <Brain size={17} color="var(--ac-cyan)" />
              </div>
              <div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  Knowledge Check
                </p>
                <p
                  className="label-mono"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {moduleTitle}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-tertiary)",
                fontSize: 18,
                lineHeight: 1,
                padding: 4,
              }}
            >
              ✕
            </button>
          </div>

          {/* body */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "18px 22px",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            {loading && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: "40px 0",
                }}
              >
                <Loader2
                  size={26}
                  color="var(--ac-cyan)"
                  className="animate-spin"
                />
              </div>
            )}

            {!loading && result && (
              <div
                style={{
                  borderRadius: 11,
                  padding: "14px 18px",
                  background: result.passed
                    ? "rgba(110,201,160,0.07)"
                    : "rgba(196,123,138,0.07)",
                  border: `1px solid ${result.passed ? "rgba(110,201,160,0.28)" : "rgba(196,123,138,0.25)"}`,
                  boxShadow: `var(--shadow-sm), 0 0 20px ${result.passed ? "rgba(110,201,160,0.1)" : "rgba(196,123,138,0.08)"}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  {result.passed ? (
                    <CheckCircle2 size={19} color="var(--ac-mint)" />
                  ) : (
                    <XCircle size={19} color="var(--ac-rose)" />
                  )}
                  <p
                    style={{
                      fontWeight: 700,
                      color: result.passed
                        ? "var(--ac-mint)"
                        : "var(--ac-rose)",
                      fontSize: 14,
                    }}
                  >
                    {result.passed
                      ? `Passed — ${result.percentage}%`
                      : `Not yet — ${result.percentage}%`}
                  </p>
                </div>
                {result.weakAreas.length > 0 && (
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--text-tertiary)",
                      marginTop: 5,
                    }}
                  >
                    Revisit: {result.weakAreas.join(", ")}
                  </p>
                )}
              </div>
            )}

            {!loading &&
              questions.map((q, qi) => (
                <div
                  key={q.id}
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--text-primary)",
                      fontWeight: 500,
                      lineHeight: 1.55,
                    }}
                  >
                    {qi + 1}. {q.question}
                  </p>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 5 }}
                  >
                    {q.options.map((opt) => (
                      <label
                        key={opt}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          padding: "9px 13px",
                          borderRadius: 9,
                          cursor: result ? "default" : "pointer",
                          transition: "all 0.18s",
                          background:
                            answers[q.id] === opt
                              ? "rgba(126,207,206,0.08)"
                              : "rgba(255,255,255,0.02)",
                          border: `1px solid ${answers[q.id] === opt ? "rgba(126,207,206,0.32)" : "var(--border-subtle)"}`,
                          boxShadow:
                            answers[q.id] === opt
                              ? "0 0 10px rgba(126,207,206,0.08)"
                              : "none",
                        }}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          value={opt}
                          checked={answers[q.id] === opt}
                          onChange={() =>
                            !result &&
                            setAnswers((p) => ({ ...p, [q.id]: opt }))
                          }
                          style={{
                            marginTop: 2,
                            accentColor: "var(--ac-cyan)",
                          }}
                        />
                        <span
                          style={{
                            fontSize: 12,
                            color:
                              answers[q.id] === opt
                                ? "var(--text-primary)"
                                : "var(--text-secondary)",
                            lineHeight: 1.5,
                          }}
                        >
                          {opt}
                        </span>
                      </label>
                    ))}
                  </div>
                  {result?.explanations[q.id] && (
                    <div
                      style={{
                        padding: "9px 13px",
                        borderRadius: 9,
                        fontSize: 11,
                        lineHeight: 1.5,
                        background:
                          answers[q.id] === result.explanations[q.id].correct
                            ? "rgba(110,201,160,0.07)"
                            : "rgba(196,123,138,0.07)",
                        color:
                          answers[q.id] === result.explanations[q.id].correct
                            ? "var(--ac-mint)"
                            : "var(--ac-rose)",
                        border: `1px solid ${answers[q.id] === result.explanations[q.id].correct ? "rgba(110,201,160,0.22)" : "rgba(196,123,138,0.2)"}`,
                      }}
                    >
                      <strong>
                        Correct: {result.explanations[q.id].correct}
                      </strong>{" "}
                      — {result.explanations[q.id].explanation}
                    </div>
                  )}
                </div>
              ))}
          </div>

          {/* footer */}
          <div
            style={{
              padding: "13px 22px",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 9,
            }}
          >
            {!result ? (
              <>
                <button
                  onClick={onClose}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 9,
                    background: "none",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-secondary)",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <StarBorder
                  as="button"
                  onClick={handleSubmit}
                  disabled={
                    submitting || Object.keys(answers).length < questions.length
                  }
                  color="rgba(78,205,196,0.9)"
                  speed="3.5s"
                  thickness={1}
                  style={{
                    opacity:
                      submitting ||
                      Object.keys(answers).length < questions.length
                        ? 0.38
                        : 1,
                    cursor:
                      submitting ||
                      Object.keys(answers).length < questions.length
                        ? "not-allowed"
                        : "pointer",
                    borderRadius: 9,
                  }}
                >
                  <span
                    className="btn btn-primary"
                    style={{
                      padding: "8px 20px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      border: "none",
                      background: "none",
                      boxShadow: "none",
                    }}
                  >
                    {submitting && (
                      <Loader2 size={13} className="animate-spin" />
                    )}{" "}
                    Submit
                  </span>
                </StarBorder>
              </>
            ) : (
              <button
                onClick={onClose}
                style={{
                  padding: "8px 20px",
                  borderRadius: 9,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  background: result.passed
                    ? "rgba(110,201,160,0.12)"
                    : "rgba(196,123,138,0.08)",
                  border: `1px solid ${result.passed ? "rgba(110,201,160,0.35)" : "rgba(196,123,138,0.25)"}`,
                  color: result.passed ? "var(--ac-mint)" : "var(--ac-rose)",
                }}
              >
                {result.passed ? "Continue learning →" : "Try again later"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
