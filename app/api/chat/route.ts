import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  getStudent,
  saveSession,
  updateSession,
} from "@/lib/supabase-server";
import { searchSimilar } from "@/lib/retrieval";
import { tutorStream } from "@/lib/ai";
import { logUsage } from "@/lib/costTracker";
import { calculateCost } from "@/lib/costTracker";
import type { ChatMessage } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      message: string;
      moduleId: string;
      sessionId?: string;
      moduleTitle?: string;
      partNumber?: number;
      partTitle?: string;
      currentSection?: {
        sectionId: string;
        sectionTitle: string;
        sectionOrder: number;
      };
      completedSections?: string[];
      teachingPointIdx?: number;
      teachingPointTitle?: string | null;
      teachingPointContent?: string | null;
      totalTeachingPoints?: number;
      allTeachingPoints?: string[];
      phase?: import("@/lib/ai").TeachingPhase;
    };

    const {
      message,
      moduleId,
      sessionId,
      moduleTitle,
      partNumber,
      partTitle,
      currentSection,
      completedSections,
      teachingPointIdx,
      teachingPointTitle,
      teachingPointContent,
      totalTeachingPoints,
      allTeachingPoints,
      phase,
    } = body;

    if (!message || !moduleId) {
      return NextResponse.json(
        { error: "message and moduleId are required" },
        { status: 400 },
      );
    }

    // Load student profile
    const student = await getStudent(user.id);

    // Build a minimal module object from request params
    const mod = {
      id: moduleId,
      title: moduleTitle ?? moduleId,
      partNumber: partNumber ?? 1,
      partTitle: partTitle ?? "",
      content: "",
      order: 0,
    };

    // RAG — HTML course file is the single source of truth
    // Teaching point content (exact block from HTML) is used when available — it IS the content to teach
    const isAutoStart = message === "__AUTO_START__";
    const { getModuleSections, getSectionContent } =
      await import("@/lib/courseHtml");

    // Resolve which section the tutor should teach. The client sometimes fires a
    // message before the section/teaching-points finish loading; in that case
    // currentSection is missing, so derive the next-to-learn section from the
    // student's completed list rather than silently defaulting to section 1.1.
    let effectiveSection = currentSection ?? null;
    if (!effectiveSection?.sectionId) {
      const sections = getModuleSections(moduleId);
      if (sections.length > 0) {
        const done = new Set(completedSections ?? []);
        // Advance past the furthest completed section (sections come back
        // interleaved with sub-sections like 1.2.1, so go by order, not first-gap).
        const lastDoneOrder = sections.reduce(
          (max, s) => (done.has(s.section_id) ? Math.max(max, s.section_order) : max),
          0,
        );
        const next =
          sections.find((s) => s.section_order > lastDoneOrder && !done.has(s.section_id)) ??
          sections.find((s) => !done.has(s.section_id)) ??
          sections[0];
        effectiveSection = {
          sectionId: next.section_id,
          sectionTitle: next.section_title,
          sectionOrder: next.section_order,
        };
      }
    }

    const hasTeachingPoint =
      !!teachingPointContent && teachingPointContent.trim().length > 20;

    // Build the material to teach from. When a scripted teaching point is present
    // it IS the content (tutor.ts combines it with this section context); otherwise
    // the whole section is the context. Either way the tutor always gets real content.
    let ragContext = "";
    if (effectiveSection?.sectionId) {
      const sectionContent = getSectionContent(
        moduleId,
        effectiveSection.sectionId,
      );
      ragContext = hasTeachingPoint
        ? sectionContent.slice(0, 500)
        : sectionContent;
    }

    // Free-form question (not the scripted lesson flow): enrich with vector search.
    if (!isAutoStart && !hasTeachingPoint) {
      try {
        const searchChunks = await searchSimilar(message, moduleId, 2);
        if (searchChunks.length > 0) {
          const extra = searchChunks
            .map((c: { content: string }) => c.content)
            .join("\n\n---\n\n");
          ragContext = ragContext ? `${ragContext}\n\n---\n\n${extra}` : extra;
        }
      } catch {
        /* DB unavailable */
      }
    }

    // Get or create session, load history
    let currentSessionId = sessionId;
    let history: ChatMessage[] = [];

    if (currentSessionId) {
      const { data: sessionData } = await supabase
        .from("tutor_sessions")
        .select("messages")
        .eq("id", currentSessionId)
        .eq("student_id", user.id)
        .single();

      if (sessionData) {
        history = (sessionData.messages as ChatMessage[]).slice(-20);
      }
    } else {
      const session = await saveSession({
        studentId: user.id,
        moduleId,
        messages: [],
        totalTokens: 0,
        totalCostUsd: 0,
      });
      currentSessionId = session.id;
    }

    // Stream response back to client
    const encoder = new TextEncoder();
    let inputTokens = 0;
    let outputTokens = 0;
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of tutorStream({
            student,
            module: mod,
            history,
            message,
            ragContext,
            currentSection: effectiveSection ?? undefined,
            completedSections,
            teachingPointIdx,
            teachingPointTitle,
            teachingPointContent,
            totalTeachingPoints,
            allTeachingPoints,
            phase,
          })) {
            if (typeof chunk === "string") {
              fullResponse += chunk;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ token: chunk })}\n\n`),
              );
            } else if (chunk.done) {
              inputTokens = chunk.inputTokens;
              outputTokens = chunk.outputTokens;
            }
          }

          // Persist updated session — no user message stored for auto-start
          const assistantMsg: ChatMessage = {
            role: "assistant",
            content: fullResponse,
            timestamp: new Date().toISOString(),
            tokenCount: outputTokens,
          };
          const updatedMessages = isAutoStart
            ? [...history, assistantMsg]
            : [
                ...history,
                {
                  role: "user" as const,
                  content: message,
                  timestamp: new Date().toISOString(),
                },
                assistantMsg,
              ];
          const totalTokens = inputTokens + outputTokens;
          const cost = calculateCost(inputTokens, outputTokens);

          await updateSession(
            currentSessionId!,
            updatedMessages,
            totalTokens,
            cost,
          );
          await logUsage(user.id, currentSessionId!, inputTokens, outputTokens);

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ done: true, sessionId: currentSessionId })}\n\n`,
            ),
          );
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Stream error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("/api/chat error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
