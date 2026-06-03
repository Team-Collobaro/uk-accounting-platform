// Page-level types for the lesson/course feature

export interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  visual?: string;
  mcqAnswer?: string;
  mcqCorrect?: string;
}

export interface Section {
  section_id: string;
  section_title: string;
  section_order: number;
}

export interface TeachingPoint {
  title: string;
  content: string;
  done: boolean;
}

export interface SectionProgress {
  section_id: string;
  section_title: string;
  status: string;
  notes: string;
  key_points: string[];
  teaching_point_idx?: number;
  teaching_points?: TeachingPoint[];
  t_phase?: string;
}

// Matches TeachingPhase in lib/ai/tutor.ts — kept separate to avoid UI→lib coupling
export type TPhase =
  | "PRE_NOTES"
  | "EXPLAIN"
  | "CONFIRM"
  | "POST_NOTES"
  | "CHECK"
  | "WRAP";

// Content renderer types
export type MCQData = {
  question: string;
  options: Array<{ letter: string; text: string }>;
  correct: string;
};

export type LabeledItem = { label: string; desc: string };

export type ContentSegment =
  | { kind: "text"; text: string }
  | { kind: "pillars"; title: string; items: LabeledItem[] }
  | { kind: "steps"; title: string; items: LabeledItem[] }
  | { kind: "terms"; title: string; items: LabeledItem[] }
  | { kind: "mcq"; data: MCQData };
